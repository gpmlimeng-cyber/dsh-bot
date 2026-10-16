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
