// Four rules the mobile work kept to by hand, each of them a way the skin could regress without any
// existing lint noticing. They are the ones a review has to remember today, so they are written down
// as checks instead:
//
//   a title bar's right key carries the page's own action and never a second way out;
//   every rule that reads a size/portrait/keyboard flag is written against the mobile band too;
//   every phone layer that starts at y=0 reserves the status-bar strip;
//   a hit area is the control's own box, not a pseudo-element stretched behind it.
//
// Plus two things the other lints cannot see because they only read the phone band: the memory
// page's head keys (a rule without the band attribute) and the focus ring the phone must not keep.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const DIR = new URL('../src/client/', import.meta.url)
const read = (name) => readFileSync(new URL(name, DIR), 'utf8')

/** Blanks out comments, keeping newlines so line numbers survive. */
const uncommented = (text) => {
  const out = text.split('')
  let i = 0
  while (i < text.length) {
    const block = text.startsWith('/*', i)
    const line = text.startsWith('//', i) && text[i - 1] !== ':'
    if (!block && !line) { i += 1; continue }
    const close = block ? text.indexOf('*/', i + 2) : text.indexOf('\n', i)
    const end = close === -1 ? text.length : close + (block ? 2 : 0)
    for (let j = i; j < end; j += 1) if (out[j] !== '\n') out[j] = ' '
    i = end
  }
  return out.join('')
}

/** Every leaf rule of every client module: { file, line, selector, body }. */
const rules = () => {
  const found = []
  for (const file of readdirSync(DIR).filter(name => name.endsWith('.js'))) {
    const text = uncommented(read(file))
    const pattern = /([^{}]*)\{([^{}]*)\}/g
    let match
    while ((match = pattern.exec(text))) {
      const selector = match[1].trim()
      if (selector) found.push({ file, line: text.slice(0, match.index + match[1].length).split('\n').length, selector, body: match[2] })
    }
  }
  return found
}

test('a title bar\u2019s right key carries the page\u2019s action, never a second way out', () => {
  const settings = read('settings.js')
  const bar = settings.slice(settings.indexOf("className: 'bt-settings-top' }"), settings.indexOf("className: 'bt-settings-nav'"))
  assert.ok(bar.includes("'Create group chat'"), 'the bar\u2019s right slot is the group chats\u2019 own action')
  assert.ok(!bar.includes("t('Close"), 'and never a close key: the left key is the way out, the right one is a function')
  assert.ok(!bar.includes('ChevronRight'), 'and never an arrow that reads as a door')
  // The 伙伴 page's right key is its action too (peers-page.js), and the discover bar holds the title
  // alone -- the two bars this rule also names.
  assert.ok(read('peers-page.js').includes("onClick: () => actions.openNewChat('new')"), 'the 伙伴 bar\u2019s right key is New')
  assert.ok(!/onClick: \(\) => (close|actions\.close)/.test(read('peers-page.js').slice(read('peers-page.js').indexOf("className: 'bt-settings-top' }"), read('peers-page.js').indexOf('bt-peers-list'))), 'and it is not a way out either')
  assert.ok(read('discover-page.js').includes("h('h2', null, t('Discover'))"), 'the discover bar carries the title and nothing beside it')
})

test('every size, portrait or keyboard rule is written against the mobile band too', () => {
  const found = rules()
    .filter(rule => /data-bt-(size|portrait|keyboard)/.test(rule.selector) && !rule.selector.includes('data-bt-mobile'))
    .map(rule => `${rule.file}:${rule.line} ${rule.selector}`)
  assert.deepEqual(found, [], 'a size/portrait/keyboard rule without html[data-bt-mobile] can reach the desktop, where those attributes are never published')
})

test('every phone layer that starts at y=0 reserves the status-bar strip', () => {
  const found = rules()
    .filter(rule => rule.selector.includes('data-bt-mobile'))
    .filter(rule => rule.body.includes('position:fixed'))
    .filter(rule => /(?:^|;)\s*top:0(?:px)?\s*(?:;|$)/.test(rule.body))
    .filter(rule => !/frame-chrome-top|bt-top-inset/.test(rule.body))
    .map(rule => `${rule.file}:${rule.line} ${rule.selector}`)
  assert.deepEqual(found, [], 'a phone layer pinned to the top of the window slides under the status bar unless it reserves --dsh-frame-chrome-top (or --bt-top-inset)')
})

test('a phone hit area is the control\u2019s own box, not something stretched behind it', () => {
  // A negative inset on a control that is not ours to resize is a hit area drawn where nothing can be
  // touched by name -- the technique the title-bar keys dropped. Each one that remains must say why.
  const REASONS = new Map([
    ['.bt-swatch-custom input', 'the custom-colour swatch IS an <input type=color>, so it is the target itself; the 4px each side is all the room the 22px dot leaves (hit is 30, under the floor -- audit A1-c)'],
    ['html[data-bt-mobile] [data-slot="conversation.input.attachments"] [class*="_remove"]::after', 'the shell\u2019s attachment remove button is not ours to resize and carries no class of ours; the pseudo is the only handle this skin has on it (device-verified 32px hit). Making it a real 44px box needs a device check.'],
  ])
  const found = rules()
    .filter(rule => /(?:^|;)\s*inset:[^;}]*-\d/.test(rule.body))
    .filter(rule => /button|input|\[class\*=/.test(rule.selector))
  const stale = [...REASONS.keys()].filter(selector => !found.some(rule => rule.selector === selector))
  assert.deepEqual(stale, [], `a reason that no longer names a rule is hiding nothing: ${stale.join(', ')}`)
  const unnamed = found.filter(rule => !REASONS.has(rule.selector)).map(rule => `${rule.file}:${rule.line} ${rule.selector}`)
  assert.deepEqual(unnamed, [], 'a control\u2019s hit area is stretched with a negative inset; give the control the box, or write the reason into REASONS')
})

test('the phone keeps no focus ring after a tap, and the rule reaches only this skin', () => {
  const styles = uncommented(read('styles.js'))
  const at = styles.indexOf(':focus:not(:focus-visible)')
  assert.ok(at > -1, 'no rule answers the ring an Android tap leaves behind')
  const selector = styles.slice(styles.lastIndexOf('}', at) + 1, styles.indexOf('{', at))
  assert.ok(selector.includes('html[data-bt-mobile]'), 'and it is the phone\u2019s: a desktop window keeps its ring')
  for (const part of selector.split(',')) {
    const scoped = part.trim().replace('html[data-bt-mobile]', '').trim()
    assert.ok(scoped.startsWith('[class^="bt-"]') || scoped.startsWith('[class*=" bt-"]'), `it reaches past this skin\u2019s own classes: ${part.trim()}`)
  }
})

test('the memory page\u2019s head keys are finger targets on a phone', () => {
  // This head is a full screen's title row on a phone and a 60px dialog head on the desktop, and its
  // keys are declared without the band attribute -- which is exactly why the touch-target lint cannot
  // see them. They are checked here instead.
  const rule = rules().find(rule => rule.selector === 'html[data-bt-mobile] .bt-mem-head .bt-icon-btn')
  assert.ok(rule, 'the memory head has no phone rule of its own, so it keeps the desktop 32px keys')
  const width = /(?:^|;)\s*width:(\d+(?:\.\d+)?)px/.exec(rule.body)
  const height = /(?:^|;)\s*height:(\d+(?:\.\d+)?)px/.exec(rule.body)
  assert.ok(width && Number(width[1]) >= 44 && height && Number(height[1]) >= 44, `the memory head\u2019s keys are ${width?.[1]}x${height?.[1]} on a phone, under the 44px floor`)
})

test('our own targets sized by their content get the floor on a phone', () => {
  // The touch-target lint reads declared boxes; these three are a drawing inside a box, so their size
  // came from what they contained (a 22px avatar, a 36px one, a line of 12px text). Each gets the
  // floor without moving the drawing: the box grows and a negative margin hands the layout back what
  // the box took. A device read found them (audit A1-d).
  const all = rules()
  const lead = all.find(rule => rule.selector === 'html[data-bt-mobile] button.bt-lead')
  assert.ok(lead && /min-width:44px/.test(lead.body) && /min-height:44px/.test(lead.body) && /margin:-11px/.test(lead.body), 'the message head\u2019s avatar key is not a 44px box handed back by its margin')
  const account = all.find(rule => rule.selector === 'html[data-bt-mobile] .bt-account')
  assert.ok(account && /width:44px/.test(account.body) && /height:44px/.test(account.body) && /margin:-4px/.test(account.body), 'the account launcher is not a 44px box handed back by its margin')
  const more = all.find(rule => rule.selector === 'html[data-bt-mobile] .bt-more')
  const pad = more && /padding:(\d+)px 0/.exec(more.body)
  const base = all.find(rule => rule.selector === '.bt-more')
  const line = base && /line-height:(\d+)px/.exec(base.body)
  assert.ok(pad && line && Number(pad[1]) * 2 + Number(line[1]) >= 44, `the Show-more family is ${pad?.[1]}px of padding around a ${line?.[1]}px line, under the 44px floor`)
})

test('a tab close is always there on a phone, and the panel drag band is not', () => {
  // Audit F1 / F4. A touch device has no hover, so a close that only appears on hover is a close that is
  // not there; and a phone that fills the screen with the panel has nothing to resize, so the 8px band
  // straddling its left edge only eats the gesture where Android's own back gesture lives.
  const all = rules()
  const close = all.find(rule => rule.selector === 'html[data-bt-mobile] .bt-bcard-x')
  assert.ok(close, 'the tab close has no phone rule of its own, so it stays hidden until hovered')
  assert.ok(/opacity:1/.test(close.body), 'the close is still drawn only on hover')
  assert.ok(/width:44px/.test(close.body) && /height:44px/.test(close.body), 'the close is not a 44px target on a phone')
  assert.ok(/backdrop-filter:none/.test(close.body), 'the close keeps its blur on a phone')
  const grip = all.find(rule => rule.selector === 'html[data-bt-mobile] .bt-panel-grip')
  assert.ok(grip && /display:none/.test(grip.body), 'the drag band still straddles the left edge of the phone screen')
})

test('reduced motion ends the phone\u2019s motion without removing it', () => {
  // `animation:none` and a zero duration are the same thing to the eye and a different thing to the
  // script: three listeners wait for animationend (activity-row.js:54/75, browser-pane.js:556,
  // mark.js:70), so the backstop shortens instead of deleting, and bounds anything looping.
  const styles = uncommented(read('styles.js'))
  const at = styles.lastIndexOf('@media (prefers-reduced-motion:reduce){\n:is(html[data-bt-mobile],html[data-bt-pc]) *{')
  assert.ok(at > -1, 'the phone has no reduced-motion backstop')
  const block = styles.slice(at, styles.indexOf('}', styles.indexOf('{', at) + 1))
  assert.ok(/animation-duration:\.01ms!important/.test(block), 'the backstop does not end animations at .01ms')
  assert.ok(/animation-iteration-count:1!important/.test(block), 'a looping animation is not bounded')
  assert.ok(/transition-duration:\.01ms!important/.test(block), 'the backstop does not end transitions')
  assert.ok(!/animation:none|animation-duration:0/.test(block), 'a removed animation never fires animationend -- the panel, the activity row and the mark would stick')
  for (const [file, needle] of [['styles.js', '.bt-mark *{animation-duration:.01ms!important'], ['usage-page.js', '.bt-us *,.bt-us *::before{animation-duration:.01ms!important']]) {
    assert.ok(read(file).includes(needle), `${file}: a reduced-motion block still removes animations outright, and a listener under it would never hear back`)
  }
})

test('a layer that hands its Esc to the shell\u2019s modal machinery says it is a modal', () => {
  // useModalLayer(ref, open, onClose) finds the dialog through the ref it is given, and the shell's
  // modalSelector is '[role="dialog"][aria-modal="true"], [role="menu"]' -- so a layer that calls it
  // without aria-modal loses Esc (and gains no focus trap) with nothing to show for it. This is the
  // guard Lead asked for: convert a layer, mark it, or the test says so.
  const files = readdirSync(DIR).filter(name => name.endsWith('.js'))
  const users = files.filter(name => read(name).includes('useModalLayer(')).sort()
  // Three shapes, three ways of owning the key, and which layer is which is a decision, not a
  // detail -- so each shape gets its own line below and a file that drifts into another one is red.
  //
  // An overlay is a dialog at every width, on a scrim: the shell's machinery owns the key outright,
  // and a useEscape left behind would be a second owner of the same key.
  const OVERLAYS = ['memory-panel.js', 'palette.js']
  // A pane is the screen on a phone and the right-hand column on a wide window, where the sidebar is
  // still live and Tab must be able to leave: phone hands the key over, wide keeps ours. Both lines
  // are required together -- deleting either one is the mistake this list is here to catch. A pane
  // with two shapes of its own (new-chat's picker and its Create Bot form, create-bot's pane and its
  // inline form) narrows `mobile` further so the hook and the render read the same condition.
  const PANES = ['create-bot.js', 'exchange.js', 'new-chat.js', 'settings.js', 'voice.js']
  // Drawn on a phone only (its own render returns null above the breakpoint), so there is no wide
  // shape to keep our key for -- but the hook must be told when the dialog is up: handed a fixed
  // true it would mount with no element to read, never run again, and lose Esc without a sound.
  const PHONE_ONLY = ['discover-page.js']
  // One element, two files: the details view's key is split the same way, but the element it belongs
  // to is the panel's own <aside>, which browser-pane.js owns, while the wide half of the pair is
  // registered in details-drawer.js (the view that always had it). The panel hands the key over once
  // for the whole panel rather than per view: the views share one element, so a hook that came and
  // went with the tab would hand the focus back to the opener on every tab switch.
  const HOSTED = { 'browser-pane.js': 'details-drawer.js' }
  assert.deepEqual(users, [...OVERLAYS, ...PANES, ...PHONE_ONLY, ...Object.keys(HOSTED)].sort(), `the layers converted so far are not the ones expected: ${users.join(', ')}`)
  for (const name of users) {
    const source = read(name)
    assert.ok(source.includes("'aria-modal': true"), `${name} calls useModalLayer without marking its dialog aria-modal -- it would have no Esc`)
    // The ref has to be the one on the element that carries aria-modal. "Some ref in this file is
    // attached somewhere" is not the same claim: memory-panel.js opens with a useRef for its menu,
    // so a looser check would let that layer through while its dialog went on having no Esc --
    // exactly the silent failure this guard exists to catch.
    const call = /useModalLayer\((\w+),/.exec(source)
    assert.ok(call, `${name} passes no ref to useModalLayer, so the hook has no dialog to read`)
    const marked = source.split('\n').some(line => line.includes(`ref: ${call[1]}`) && line.includes("'aria-modal': true"))
    assert.ok(marked, `${name} hands ${call[1]} to useModalLayer but does not attach it to the element marked aria-modal, so the hook has no dialog to read`)
  }
  for (const name of OVERLAYS) {
    assert.ok(!read(name).includes('useEscape'), `${name} is a dialog at every width, so it hands the key over at every width -- our own stack there would be a second owner of one key`)
    assert.match(read(name), /useModalLayer\(\w+, true,/, `${name} is only mounted while it is up, so the hook is told so`)
  }
  for (const name of PANES) {
    assert.match(read(name), /useModalLayer\(\w+, mobile\b/, `${name}: the phone's shape hands Escape to the shell's machinery`)
    assert.match(read(name), /useEscape\(mobile \? \(\) => \{\} :/, `${name}: the wide shape keeps our own key and focus -- the pair is deliberate, do not delete either line`)
  }
  for (const name of PHONE_ONLY) {
    assert.ok(!read(name).includes('useEscape'), `${name} is drawn on a phone only, so it has no wide shape to keep our key for`)
    assert.ok(!/useModalLayer\(\w+, true,/.test(read(name)), `${name} must hand the hook the same condition its render reads: a fixed true mounted with no dialog would never run again`)
  }
  for (const [host, view] of Object.entries(HOSTED)) {
    assert.match(read(host), /useModalLayer\(\w+, mobile,/, `${host}: the phone's screen hands Escape to the shell's machinery`)
    assert.ok(!read(host).includes('useEscape'), `${host}: one key, not two -- the wide half of the pair lives in ${view}`)
    assert.match(read(view), /useEscape\(mobile \? \(\) => \{\} :/, `${view}: the wide column keeps our own key and focus -- the pair is deliberate, do not delete either line`)
  }
})

test('every dialog we render wears the shell overlay marker', () => {
  // The Android responsive plugin (@dsh-android/dsh-client-ui-responsive, mobile/form-marker.js,
  // MobileFormMarker.syncModal) keeps every [role=dialog][aria-modal=true] that is NOT inside
  // [data-shell-overlay] and flips data-dsh-modal-open on <html>; the plugin's own rule then answers
  // that flag with `html[data-dsh-modal-open] [data-dsh-frame] > [*sidebarCol]{transform:none}`,
  // because the shell's settings overlay is drawn inside that column and would be carried off canvas
  // with it. So a dialog we mark aria-modal -- deliberately, the shell's modal machinery reads it for
  // Escape, the trap and the focus handed back -- also slides the shell's off-canvas left column back
  // on screen: the drawer the user saw come in behind every popup (10-16). SHELL_OVERLAY is the
  // plugin's own exemption (shell-overlay.js has the whole story), and it belongs on the element that
  // carries aria-modal -- closest() reads the element itself as well as its ancestors.
  const files = readdirSync(DIR).filter(name => name.endsWith('.js'))
  let marked = 0
  for (const name of files) {
    const source = read(name)
    for (const [at, line] of source.split('\n').entries()) {
      if (!line.includes("'aria-modal': true")) continue
      marked += 1
      assert.ok(line.includes('SHELL_OVERLAY'), `${name}:${at + 1} marks a dialog aria-modal without ...SHELL_OVERLAY -- the shell's drawer slides in behind it`)
      assert.ok(source.includes("from './shell-overlay.js'"), `${name} uses ...SHELL_OVERLAY without importing it`)
    }
  }
  assert.equal(marked, 9, `the dialogs marked aria-modal are not the ones expected: ${marked}`)
})

test('the pinned mark sits after the name, in the one layout that has a name', () => {
  // The pin follows the name, at 12px -- the user's own correction to an avatar-corner badge, and
  // then to a 14px one. It is Fluent's *outline* cut: at 12px the filled pin's interior detail read
  // as a smudge (the user called it dirty; a model reading their screenshot took it for a muted
  // bell), so the line drawing is the honest one at this size. Its ink is a step heavier than
  // --bt-ink-2, worked out from the token rather than a second copy of it. One anchor, in one
  // layout: a row with a name. The icon-only rail has no name to sit after and the 伙伴 grid draws
  // none, which is also the end of the old `left:calc(50% + 12px)` -- a placement measured from the
  // row's own width, written for a centred rail and drifting the moment a row is left-aligned.
  const sidebar = read('sidebar.js')
  assert.match(sidebar, /import \{[^}]*IconPinOutlineRegular[^}]*\} from '@deepseek-ai\/dsh-client-ui-primitives'/, 'Fluent\'s outline pin, which is the cut that survives 12px')
  assert.ok(!sidebar.includes('IconPinFillRegular'), 'and not the filled one, whose detail is what read as a smudge')
  assert.ok(!read('icons.js').includes('PinMarkIcon'), 'the hand-drawn pushpin is gone, not left as a second definition')
  assert.equal((sidebar.match(/pinned \? h\(PinMark\) : null/g) ?? []).length, 2, 'both named-row shapes place it, after the title')
  assert.equal((sidebar.match(/pin: pinned/g) ?? []).length, 0, 'no avatar carries it any more')
  assert.ok(!sidebar.includes('bot.pinned === true && !tile'), 'and the tile is not the exception that draws one')
  const rule = sidebar.split('\n').find(line => line.includes('.bt-pin{'))
  assert.ok(rule, 'the pin is a mark on the name\'s own line')
  assert.ok(rule.includes('flex:none'), 'laid out by the name\'s own gap')
  assert.ok(rule.includes('color:color-mix(in srgb,var(--bt-ink) 75%,transparent)'), 'heavier than ink-2, derived from the token: a 12px glyph at 60% was half of "looks dirty"')
  assert.ok(sidebar.includes('.bt-pin svg{width:12px;height:12px}'), 'and sized by the skin, like every other Fluent icon')
  assert.ok(!sidebar.split('\n').some(line => line.includes('.bt-pin') && (line.includes('calc(50%') || line.includes('position:absolute'))), 'nothing places the pin from the row\'s own width')
})

test('an open drawer carries a visible close in its top row, beside search and New, wearing the shell\'s own glyph', () => {
  // U1, the reported blocker: with the drawer open the bar that holds the hamburger is
  // `display:none`, the panel covers the screen with its scrim underneath, so "tap the empty
  // space" does not exist on a phone and the only non-key exit was an unhinted leftward swipe.
  // The user asked for one visible close, in the top row next to the search field. Its glyph is
  // the shell's own pane icon, by the user's own request ("reuse his icon"), so this file no
  // longer expects a Fluent close here.
  const sidebar = read('sidebar.js')
  assert.ok(!sidebar.includes('IconCloseOutlineRegular'), 'no second close drawn or imported: the shell\'s own glyph is reused')
  const close = sidebar.match(/mobile\s*\?\s*h\('button',\s*\{([\s\S]*?)\},\s*h\(SidebarIcon\)\)/)
  assert.ok(close, 'the button belongs to the drawer form only — the wide column already has its hamburger')
  assert.match(close[1], /className: 'bt-round bt-side-close'/, 'the round seat the row\'s other keys use')
  assert.match(close[1], /'aria-label': t\('Close navigation'\)/, 'named like the hamburger that opens it')
  assert.match(close[1], /onClick: actions\.closeMobileNav/, 'and it closes the drawer, the same action the scrim and the swipe use')
  // 44px target and a press feedback come from `.bt-round` in the drawer's top row, so the
  // close cannot drift from the two keys beside it.
  assert.ok(read('styles.js').includes('html[data-bt-mobile] .bt-side.bt-rail .bt-side-top .bt-round{flex:0 0 44px;width:44px;height:44px}'), 'the row\'s keys are 44px on a phone')
  assert.ok(read('styles.js').includes('.bt-round:active{transform:scale(.94)}'), 'and every one of them answers a press')
  // The shell's own collapse key would be a fourth key in this row doing what this close does, so
  // a phone hides it -- the same treatment the shell already gives it in a Windows title bar and
  // on macOS. The wide column keeps it.
  assert.ok(read('styles.js').includes('html[data-bt-mobile] .bt-side-collapse{display:none}'), 'the shell\'s collapse key is hidden on a phone')
  const glyph = sidebar.split('\n').find(line => line.includes('.bt-side-close svg{'))
  assert.ok(glyph, 'the glyph is sized by the skin, like the shell\'s own key one line down')
  assert.ok(glyph.includes('width:16px;height:16px'), 'the shell draws this glyph at 16 (icons.js SidebarIcon)')
})

test('a term the user has not been taught is said in words, on screen', () => {
  // U12: the usage page said 缓存命中率 and 压缩与交接, and the memory page named MEMORY.md in a
  // `title=` alone -- and the user's own words are that they do not hover or tap to be told
  // anything. Each of the three now has a line of its own, where it is read.
  const usage = read('usage-page.js')
  assert.ok(usage.includes("className: 'bt-us-hint' }, t('Cache hit rate: input the model had already read, so it was not sent again.')"),
    'the rate says what it counts, under the cells it labels')
  assert.ok(usage.includes("className: 'bt-us-hint' }, t('Compaction and handoff: a chat too long to keep whole is summarised so the work can go on.')"),
    'and the chart says what 压缩与交接 counts')
  assert.ok(usage.includes('.bt-us-hint{'), 'the line is styled where the page keeps its own sheet')
  assert.ok(usage.includes('.bt-us-stats>.bt-us-hint{padding:0 18px 14px}'), 'and lines up with the cells when it sits in their grid')
  const memory = read('memory-panel.js')
  assert.ok(memory.includes("className: 'bt-mem-note' }, t('MEMORY.md, which every conversation reads')"),
    'the memory page names the file in words')
  assert.ok(memory.includes("title: t('MEMORY.md, which every conversation reads')"), 'and keeps the title for whoever does hover')
  assert.ok(read('styles.js').includes('.bt-mem-note{'), 'with the line styled in the skin')
  // Both strings are copy the user reads, so both are translated rather than left in English.
  const dictionary = read('i18n.js')
  assert.ok(dictionary.includes("'Cache hit rate: input the model had already read, so it was not sent again.':"), 'the rate line is translated')
  assert.ok(dictionary.includes("'Compaction and handoff: a chat too long to keep whole is summarised so the work can go on.':"), 'and so is the chart line')
})

test('the shell\'s own relay row is hidden, by the tool name the shell puts on it', () => {
  // U13's real shape (the user's report, and the target's DOM): the shell draws its own tool row into
  // the same node our relay content goes in, so `:empty` does not hide it once the replies are there.
  // The row's root carries `data-tool` with the tool's name -- the shell's own hook, not a CSS-module
  // hash that changes every build -- so the row is hidden by name.
  const styles = read('styles.js')
  assert.ok(styles.includes('[class*="_flowItem"]:has(> [data-slot="conversation.chat.node"]:empty){display:none!important}'),
    'a cell with nothing in it is still hidden whole')
  // The row carries no data-tool (the target's outerHTML has data-chat-call-id and
  // data-chat-anchor-key only), so the hook is the id this host gives a relay call itself. Both sides
  // are read here, so the marker cannot drift away from the rule that hides it.
  const hostFile = name => readFileSync(new URL(`../src/host/${name}`, import.meta.url), 'utf8')
  assert.ok(hostFile('groups.js').includes("`toolu_relay_${randomUUID().replace(/-/g, '')}`"), 'the host names every relay call with its own marker')
  assert.ok(styles.includes('[data-chat-call-id^="toolu_relay_"]{display:none!important}'),
    'and the rule hides exactly those rows, by that marker -- not by a hashed class or a shell attribute')
  assert.ok(styles.includes('[data-chat-anchor-key^="call:toolu_relay_"]{display:none!important}'),
    'the anchor key the same row carries is covered too')
  // Only the relay: every other tool keeps the shell's row, which is where those belong.
  for (const tool of ['read', 'bash']) assert.ok(!styles.includes(`[data-tool="${tool}"]`), `${tool} keeps its row`)
})
