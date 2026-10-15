// The phone's bottom bar is four pages, and two of them are not ours: the conversation and
// the plugin manager are main panels of the shell, reached through `layout.selectPanel`,
// while the Bot list and Settings are this plugin's own overlays. So the bar is a
// navigator over two surfaces and the wiring below is what keeps the two halves in step --
// what the tab opens, what it closes first, and the one main panel it must not assume
// exists (`selectPanel` throws on an id the shell has not registered).
//
// The sheet is checked as source, not as computed style: every rule has to carry the same
// gate the component reads (mobile AND portrait), because a rule that dropped one of the
// two would reach the desktop or a phone held sideways, where nothing draws the bar.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const nav = read('nav-bar.js')
const index = read('index.js')
const mobile = read('mobile.js')
const styles = read('styles.js')

const GATE = 'html[data-bt-mobile][data-bt-portrait]'
const css = nav.split('\n').filter(line => line.startsWith(GATE))

test('every rule of the bar hangs on the mobile layout and an upright window', () => {
  // The sheet's own rules are the lines that start with a selector; the gate must be the
  // whole prefix of each one, so `html[data-bt-mobile]` alone or a bare `.bt-nav` cannot
  // slip in.
  assert.ok(css.length >= 8, `expected the bar's rules, found ${css.length}`)
  for (const line of css) {
    assert.ok(line.startsWith(GATE), line)
    const after = line.slice(GATE.length)
    assert.ok(after.startsWith(' ') || after.startsWith('{') || after.startsWith('[data-bt-keyboard]'), line)
  }
  // The token the rule set is published on is the same gate, and it is the only place the
  // height is written down.
  assert.equal(css.filter(line => line.includes('--bt-nav-h:')).length, 1, '--bt-nav-h is declared once')
  assert.ok(css[0].includes('--bt-nav-h:56px'), css[0])
  // The device's own bottom inset is the platform's pair, not env() alone: the Android
  // layer's own full-bleed layers read exactly these two, and on edge-to-edge Android
  // env(safe-area-inset-bottom) is 0 while the shell's variable is not.
  assert.ok(css[0].includes('--bt-nav-gap:max(env(safe-area-inset-bottom,0px),var(--dsh-android-system-bottom,0px))'), css[0])
  assert.ok(!css[0].includes('ime-bottom'), 'the keyboard inset is not silently folded in')
})

test('the bar and the three pages under it take their foot from one token', () => {
  const users = ['.bt-nav{', '[class*="centerCol"]', '.bt-settings-layer{', '.bt-side.bt-rail{']
  for (const marker of users) {
    const line = css.find(rule => rule.includes(marker))
    assert.ok(line, `${marker} has a rule`)
    assert.ok(line.includes('var(--bt-nav-h)'), `${marker} reads the shared height: ${line}`)
    assert.ok(line.includes('var(--bt-nav-gap)'), `${marker} reads the shared inset: ${line}`)
  }
  // The conversation column is a stretched grid item whose padding is what shortens it,
  // so this one needs the important flag against the shell's own padding on the column.
  const center = css.find(rule => rule.includes('[class*="centerCol"]'))
  assert.ok(center.includes('!important'), center)
})

test('the four pages are named for a UI dump, tasks first', () => {
  const order = [...nav.matchAll(/\['(tasks|peers|plugins|me)', '(\w+)'/g)].map(match => [match[1], match[2]])
  assert.deepEqual(order, [['tasks', 'Chats'], ['peers', 'Peers'], ['plugins', 'Plugins'], ['me', 'Me']])
  // The accessible name is the label itself, and it is on the button rather than left to
  // the drawn text, which is hidden from the tree: a real-device dump reads this.
  assert.ok(nav.includes("'aria-label': t(label)"), 'each tab carries its own label')
  assert.ok(nav.includes("'aria-current': active === id ? 'page' : undefined"), 'the current tab says so')
  // Every label goes through t(), so the bar names its pages in the interface's language
  // and Chinese is not baked into the source.
  assert.ok(nav.includes("h('span', { className: 'bt-nav-tab-text', 'aria-hidden': true }, t(label))"), 'the drawn label is translated too')
})

// The two states are two drawings of one shape, copied from Fluent -- not one drawing with a
// heavier stroke, which is what the user ruled out. One family for all four pages, and it is
// the platform's own product family, so the bar cannot read as a mix. Each string below is
// the whole path data of one file, which is what "byte for byte" means.
test('each page is Fluent\u2019s regular and Fluent\u2019s fill, credited where they live', () => {
  const icons = read('icons.js')
  assert.ok(icons.includes('Fluent System Icons (MIT) \u00b7 Copyright (c) 2020 Microsoft Corporation \u00b7 @fluentui/svg-icons v1.1.344'), 'the MIT notice sits with the artwork')
  const glyphs = [
    ['M12 2a10 10 0 1 1-4.59 18.89L3.6 21.96a1.25 1.25 0 0 1-1.54-1.54l1.06-3.83A10 10 0 0 1 12 2m0 1.5a8.5 8.5 0 0 0-7.43 12.64l.15.27-1.1 3.98 3.98-1.11.27.15A8.5 8.5 0 1 0 12 3.5M8.75 13h4.5a.75.75 0 0 1 .1 1.5h-4.6a.75.75 0 0 1-.1-1.5zh4.5zm0-3.5h6.5a.75.75 0 0 1 .1 1.5h-6.6a.75.75 0 0 1-.1-1.5zh6.5z', 'chat, the regular one'],
    ['M12 2a10 10 0 1 1-4.64 18.86l-4.3 1.12a.85.85 0 0 1-1.03-1.04l1.11-4.29A10 10 0 0 1 12 2m1.25 11h-4.6a.75.75 0 0 0 0 1.5h4.7a.75.75 0 0 0 0-1.5zm2-3.5h-6.6a.75.75 0 0 0 0 1.5h6.7a.75.75 0 0 0 0-1.5z', 'chat, the solid one'],
    ['M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zm0 1.5H6.25a.75.75 0 0 0-.75.75v.9c0 .66.29 1.29.79 1.71Q8.17 20.5 12 20.5q3.83-.01 5.72-1.64c.5-.43.78-1.05.78-1.7v-.91a.75.75 0 0 0-.75-.75M11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zm4.35 3h-8.5a.75.75 0 0 0-.75.75v4.5c0 .42.34.75.75.75h8.5c.41 0 .75-.33.75-.75v-4.5a.75.75 0 0 0-.75-.75m-6.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5', 'bot, the regular one'],
    ['M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zM11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zM9.75 6.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5', 'bot, the solid one'],
    ['M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20m0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M7.08 8.7c-.4-1.01.6-2.02 1.63-1.62l.2.09 3.75 1.42a4.8 4.8 0 0 1 2.75 2.75l.16.43 1.63 3.79a1.25 1.25 0 0 1-1.64 1.64l-3.76-1.61-.46-.18a4.8 4.8 0 0 1-2.75-2.75L7.21 9.03zm3 3.48c.32.8.95 1.44 1.74 1.78l.52.23 2.98 1.13-1.14-3-.22-.5a3.3 3.3 0 0 0-1.78-1.74L8.7 8.7z', 'compass, the regular one'],
    ['M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20M8.56 7.43a.88.88 0 0 0-1.13 1.13l1.5 3.97a4.4 4.4 0 0 0 2.54 2.53l3.97 1.5a.88.88 0 0 0 1.13-1.12l-1.51-3.96a4.4 4.4 0 0 0-2.53-2.54z', 'compass, the solid one'],
    ['M17.75 14C19 14 20 15 20 16.25v.57c0 .9-.32 1.76-.9 2.44Q16.74 22.01 12 22q-4.74.01-7.1-2.74a3.8 3.8 0 0 1-.9-2.43v-.58C4 15 5.01 14 6.25 14zm0 1.5H6.25a.75.75 0 0 0-.75.75v.58c0 .53.2 1.05.54 1.46C7.3 19.76 9.26 20.5 12 20.5q4.09 0 5.96-2.21c.35-.41.54-.93.54-1.47v-.57a.75.75 0 0 0-.75-.75M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7', 'person, the regular one'],
    ['M17.75 14C19 14 20 15 20 16.25v.92q-.01.88-.5 1.6Q17.13 22 12 22q-5.15 0-7.49-3.24a2.8 2.8 0 0 1-.5-1.6v-.91C4 15 5 14 6.24 14zM12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10', 'person, the solid one'],
  ]
  for (const [data, what] of glyphs) assert.ok(icons.includes(data), `${what} is @fluentui/svg-icons' own artwork`)
  // One factory for this family, declared once, on Fluent's own 24 grid -- and the families
  // that stood in before this one are gone, each with its notice.
  assert.equal(icons.split('const fluentNavIcon = (d, box = FLUENT_NAV_BOX)').length - 1, 1, 'one Fluent factory')
  assert.ok(icons.includes("viewBox: '0 0 24 24'"), 'on Fluent\u2019s 24 grid')
  assert.equal((icons.match(/export const Fluent\w+/g) ?? []).length, 8, 'four pairs')
  for (const dead of ['Phosphor Icons (MIT)', 'phosphorIcon', 'PHOSPHOR_BOX', 'ionicon(', 'Ionicons (MIT)', 'IonChatbubbleIcon', 'IonPeopleIcon', 'fluentIcon']) {
    assert.ok(!icons.includes(dead), `${dead} is gone with the family it belonged to`)
  }
  // Nothing is pinned here either: Fluent draws both weights as filled artwork, so there is
  // no line for the Lucide trick to hold steady.
  const factory = icons.slice(icons.indexOf('const fluentNavIcon'), icons.indexOf('// 任务: the rounded bubble'))
  assert.ok(factory.length > 0 && !factory.includes('vectorEffect'), factory)
})

test('the tab on screen draws the filled one, and says so in the tree', () => {
  // The pair travels in the tab row, and the render picks by the same `active` the styles
  // hang on -- so the state cannot drift from the drawing.
  const rows = [...nav.matchAll(/\['(tasks|peers|plugins|me)', '\w+', (\w+), (\w+)\]/g)]
  assert.equal(rows.length, 4, 'four rows, each with both drawings')
  for (const [, id, outline, filled] of rows) {
    assert.ok(outline.endsWith('Icon') && !outline.includes('Filled'), `${id}: the outline first`)
    assert.equal(filled, outline.replace(/Icon$/, 'FilledIcon'), `${id}: the filled one is the same shape`)
  }
  assert.ok(nav.includes('h(active === id ? IconFilled : Icon)'), 'the drawing follows the state')
  assert.ok(nav.includes("'data-icon': active === id ? 'filled' : 'outline'"), 'and the tree reports which one')
})

// The four names are copy, not code: they live in the dictionary every other string in
// this skin lives in, and the drawn label and the accessible name are the same call — the
// screen and a screen reader must not disagree, in either language.
test('the four names are dictionary copy, shared with the accessible name', () => {
  const rows = nav.split('\n').filter(line => /^\s*\['(tasks|peers|plugins|me)', /.test(line))
  assert.equal(rows.length, 4, `one row per page, found ${rows.length}`)
  for (const row of rows) assert.ok(!/[\u4e00-\u9fff]/.test(row), `no Chinese baked into ${row.trim()}`)
  assert.equal((nav.match(/t\(label\)/g) ?? []).length, 2, 'one translated string, drawn once and named once')
  const i18n = read('i18n.js')
  for (const [key, zh] of [['Chats', '任务'], ['Peers', '伙伴'], ['Plugins', '发现'], ['Me', '我的']]) {
    assert.ok(i18n.includes(`${key}: '${zh}'`), `${key} carries its Chinese copy`)
  }
  // The table ships Chinese only: the key text IS the English copy and the host locale
  // falls back to it, so there is no second table that could drift out of step.
  assert.ok(i18n.includes('export const DICTIONARY = { zh: ZH }'), 'one table, Chinese; English is the key')
  assert.ok(i18n.includes("locale.register(NAMESPACE, 'zh', ZH)"), 'and that is the dictionary the locale service gets')
})

test('the selected page is the sampled ink and heavier, not the accent', () => {
  const active = css.find(line => line.includes('.bt-nav-tab[data-active]') && line.includes('color'))
  assert.ok(active.includes('color:var(--bt-nav-on)'), active)
  // The label follows its icon: nothing gives the text a colour of its own, so the two are
  // one colour by construction, selected or not -- which is what the user's screenshot shows.
  const text = css.find(line => line.includes('.bt-nav-tab-text{'))
  assert.ok(!text.includes('color'), `the label inherits the tab's colour: ${text}`)
  assert.ok(css.some(line => line.includes('.bt-nav-tab[data-active] .bt-nav-tab-text') && line.includes('font-weight:600')), 'and only the selected one is heavier')
  const rest = css.find(line => line.includes('.bt-nav-tab{'))
  assert.ok(rest.includes('color:var(--bt-nav-ink)'), 'the unselected pages take the bar\'s own grey token')
  const bold = css.find(line => line.includes('.bt-nav-tab[data-active] .bt-nav-tab-text'))
  assert.ok(bold.includes('font-weight:600'), bold)
  assert.ok(!nav.includes('var(--bt-accent)'), 'the accent is not a tab state')
})

test('each tab reads the page it belongs to, and never keeps a selection of its own', () => {
  // The main panel is the shell's; the two overlays are ours. Both are read.
  assert.ok(nav.includes("const active = ui.settings ? 'me'"), 'Settings wins')
  // 伙伴 is a page of its own now: it is lit by its own state, not by the conversation's
  // drawer, which stays the drawer's (and would otherwise light the tab from any chat).
  const chain = nav.slice(nav.indexOf('const active = ui.settings'), nav.indexOf('const go ='))
  assert.match(chain, /ui\.peers \? 'peers'/, 'the peers page wins next')
  assert.ok(!chain.includes('mobileNav'), 'the drawer no longer stands in for the peers page')
  assert.ok(nav.includes(": nav.panel === 'plugins' ? 'plugins'"), 'then the shell panel')
  assert.ok(nav.includes(": nav.panel === null ? 'tasks' : null"), 'and a foreign panel lights nothing')
})

test('a tab closes the other pages before it acts', () => {
  const go = nav.slice(nav.indexOf('const go = (id) =>'), nav.indexOf('return createPortal'))
  // 任务 and 发现 are the shell's two panels: both of our overlays go first, in either
  // order, so neither can be left standing over the page that replaces it.
  const branch = (from, to) => go.slice(go.indexOf(`id === '${from}'`), to === null ? go.length : go.indexOf(`id === '${to}'`))
  const tasks = branch('tasks', 'peers')
  assert.match(tasks, /actions\.closeMobileNav\(\)[\s\S]*actions\.closeSettings\(\)[\s\S]*actions\.selectPanel\(null\)/, tasks)
  const plugins = branch('plugins', null)
  assert.match(plugins, /actions\.closeMobileNav\(\)[\s\S]*actions\.closeSettings\(\)[\s\S]*actions\.selectPanel\('plugins'\)/, plugins)
  // 伙伴 is a page of its own: the settings screen and the conversation's drawer both go
  // before it opens, and the tab opens the page rather than the drawer.
  assert.match(branch('peers', 'plugins'), /actions\.closeSettings\(\)[\s\S]*actions\.closeMobileNav\(\)[\s\S]*actions\.openPeers\(\)/, 'the other surfaces go first')
  // The drawer is not a page of the bar: a tab that leaves the conversation still closes it.
  assert.match(tasks, /actions\.closePeers\(\)[\s\S]*actions\.closeMobileNav\(\)/, tasks)
  assert.match(plugins, /actions\.closePeers\(\)[\s\S]*actions\.closeMobileNav\(\)/, plugins)
  assert.match(go, /actions\.closePeers\(\)\n\s*actions\.closeMobileNav\(\)\n\s*actions\.openSettings\('general'\)/, '我的 closes the page on its way to Settings')
  // A tab bar picks a page: the page already on screen is left where it is, which is what
  // the app the user copied does (and the exits for a page are the other three tabs).
  assert.match(go, /if \(active === id\) return/, 'the current page is not re-opened or closed')
  assert.ok(!go.includes('closeMobileNav()\n        actions.selectPanel(null)'), 'a second tap does not navigate')
  // 我的 is the fallthrough: the peers page is closed and Settings opens over the
  // conversation.
  assert.match(plugins, /actions\.closeMobileNav\(\)\n\s*actions\.openSettings\('general'\)/, plugins)
})

test('发现 is not drawn without the shell panel, and is never selected without it', () => {
  assert.ok(nav.includes("TABS.filter(([id]) => id !== 'plugins' || nav.plugins)"), 'the tab is filtered')
  // The check is against the live registry, and the tab acts only through an action the
  // registry gate protects -- selectPanel throws on an unregistered id (layout service).
  assert.ok(index.includes("ctx.slots.entriesOfSlot?.('main')"), 'the main slot is read')
  assert.ok(index.includes("entry.options?.key === 'plugins'"), 'the panel is looked up by key')
  assert.ok(index.includes("ctx.slots.subscribe?.('main', readPlugins)"), 'and watched, so a late plugin manager still gets its tab')
})

// The phone showed the composer floating a bar's height above the keyboard, with the bar
// itself behind it. While the IME is up the bar goes and its 56px goes back to the
// conversation; mobile.js publishes the flag from the platform's own IME inset and the
// visual viewport, because the platform leaves no flag of its own.
test('the keyboard takes the bar and the room it reserved', () => {
  const rules = css.filter(line => line.includes('[data-bt-keyboard]'))
  assert.ok(rules.some(line => line.includes('.bt-nav{display:none}')), 'the bar goes while the keyboard is up')
  assert.ok(rules.some(line => line.includes('[class*="centerCol"]{padding-bottom:0!important}')), 'and the conversation gets its 56px back')
  assert.ok(rules.some(line => line.includes('.bt-side.bt-rail{padding-bottom:12px}')), 'the conversation drawer too')
  assert.ok(rules.some(line => line.includes('.bt-settings-layer{bottom:0}')), 'and the Settings screen')
  // A short transition, so the composer does not jump when the flag flips.
  const reserved = css.find(line => line.includes('[class*="centerCol"]') && line.includes('var(--bt-nav-h)'))
  assert.ok(reserved.includes('transition:padding-bottom .18s ease'), reserved)
  // The flag itself: read from the platform's IME inset and the visual viewport, never guessed.
  const mobile = read('mobile.js')
  assert.ok(mobile.includes("getPropertyValue('--dsh-android-ime-bottom')"), 'the platform\'s IME inset is read')
  assert.ok(mobile.includes('window.innerHeight - window.visualViewport.height > KEYBOARD_MIN_PX'), 'and the layout-vs-visual gap, since innerHeight stays put here')
  assert.ok(mobile.includes("document.hasFocus()"), 'and only while this page is the one in use')
  assert.ok(mobile.includes("document.documentElement.dataset.btKeyboard = '1'"), 'published on the root')
  assert.ok(mobile.includes("delete document.documentElement.dataset.btKeyboard"), 'and taken back when it closes')
  assert.ok(mobile.includes("window.visualViewport?.addEventListener?.('resize'"), 'watched where the keyboard shows up')
  assert.ok(mobile.includes("window.addEventListener('focus', onViewport)") && mobile.includes("window.addEventListener('blur', onViewport)") && mobile.includes("document.addEventListener?.('visibilitychange', onViewport)"), 'and re-decided when the window is gained or lost, not only on a resize')
  // The shell writes the inset into the root's own style, so the keyboard's own transition is
  // observable: waiting for the next viewport event left the flag stale after the keyboard closed.
  assert.ok(mobile.includes("new MutationObserver(() => publishKeyboard()).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })"), 're-decided where the inset is written')
})

test('the bar has no frame at all, and wears the page colour', () => {
  // The user asked for the frame gone -- all four sides, an outline and a shadow -- and for
  // the bar to be the same colour as the page it sits on. Written out rather than merely
  // absent, so nothing upstream can put a line back.
  const bar = css.find(line => line.includes('.bt-nav{'))
  const rule = bar.slice(bar.indexOf('.bt-nav{'))
  assert.ok(rule.includes('border:0'), `no edge on any side: ${rule}`)
  assert.ok(rule.includes('outline:0'), `nothing outlines it: ${rule}`)
  assert.ok(rule.includes('box-shadow:none'), `nothing shadows it: ${rule}`)
  assert.ok(rule.includes('background:var(--bt-main)'), `the surface is the page's colour: ${rule}`)
  assert.ok(!rule.includes('backdrop-filter'), 'nothing scrolls under it, so no frost is needed')
  // A coloured border or shadow anywhere in the rule would be a line by another name.
  assert.ok(!/border-(top|right|bottom|left)\s*:/.test(rule), rule)
  assert.ok(!/box-shadow:(?!none)/.test(rule), rule)
})

// The conversation's drawer, which the hamburger opens. It is not the 伙伴 page any more --
// that one is its own full-screen surface (peers-page.js), and the bar stays on it, so the
// drawer keeps covering the screen from the top edge and giving the bar's height back.
test('the conversation\'s drawer starts at the top edge and carries the inset itself', () => {
  // A drawer that started below the status bar's inset left that band showing the page behind
  // it -- the seam the user reported while the drawer was the 伙伴 page.
  const page = css.find(line => line.startsWith(GATE + ' .bt-side.bt-rail{'))
  assert.ok(page, 'the drawer rule')
  assert.ok(page.includes('top:0'), page)
  assert.ok(page.includes('padding-top:var(--bt-fade-h,calc(var(--bt-top-inset'), 'the strip\'s own height, from its one definition, with the strip-less fallback')
  // The bar's own height is still given back at the foot of the same surface.
  assert.ok(page.includes('padding-bottom:calc(var(--bt-nav-h)'), page)
})

// The user asked for the conversation's hamburger back. It toggles the conversation's own
// drawer (`ui.mobileNav`), which is what it did before; the 伙伴 tab has its own page now.
test('the hamburger stays, and still opens the conversation drawer', () => {
  assert.ok(!nav.includes('.bt-mobile-nav{opacity:0'), 'the hamburger is not hidden any more')
  assert.ok(css.some(line => line.includes('body:has(.bt-side.bt-rail[data-mobile-open]) .bt-mobile-bar{display:none}')), 'the drawer carries no bar of its own')
  const header = read('header.js')
  assert.ok(header.includes('onToggle: () => actions.toggleMobileNav()'), 'the hamburger toggles the nav state')
  const sidebar = read('sidebar.js')
  assert.ok(sidebar.includes('const mobileOpen = useUi(value => value.mobileNav === true)'), 'and that state is what renders the drawer')
})

test('a popup menu is drawn over the bar', () => {
  // The menus clamp to the viewport bottom (context-menu.js), so a long-press on one of
  // the last rows lands under a 56px bar that takes the taps there.
  const menu = css.find(line => line.includes('.bt-menu{'))
  assert.ok(menu, 'the portrait rule for menus')
  assert.ok(menu.includes('z-index:96'), menu)
  const bar = css.find(line => line.includes('.bt-nav{'))
  assert.ok(bar.includes('z-index:95'), 'and the bar is a step below it')
})

test('the flag the sheet and the tree share is published on mobile and portrait only', () => {
  assert.ok(mobile.includes("export const PORTRAIT_QUERY = '(orientation: portrait)'"), 'the query is named')
  assert.ok(mobile.includes("document.documentElement.dataset.btPortrait = '1'"), 'the flag is published')
  // Never outside data-bt-mobile: the same reason data-bt-size is not.
  assert.ok(mobile.includes("document.documentElement.dataset.btMobile === '1' && portraitMedia()?.matches === true"), 'the pair gates the flag')
  assert.ok(mobile.includes('usePortrait'), 'the components read it reactively')
  assert.ok(mobile.includes("portraitMedia()?.addEventListener?.('change'"), 'and a turn is watched')
})

test('the bar is installed with the shell group and the bar state rides the face', () => {
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-nav', order: 45, inject: face }, BottomNav)"), 'the overlay entry')
  assert.ok(index.includes("installCompiledStyles(NAV_CSS, 'bottom-nav')"), 'the sheet is installed with the surface')
  assert.ok(index.includes('hooks: { nav,'), 'the nav source is handed to the slot')
  // Both close paths land on the conversation, and only while the bar is on screen: on a
  // desktop the settings dialog is a popup over a panel the user opened on purpose.
  assert.ok(index.includes('if (isPortraitNav()) ctx.layout.selectPanel(null)'), 'closing a page goes home')
  assert.ok(index.includes('openMobileNav: () =>'), 'the bar can open the peers page')
})

// The phone's own numbers, run through the real decision: while the keyboard is up the skin
// hides the bar and gives its 56px back, and the only thing standing between the user and that
// behaviour is whether this function notices. Both signals belong to the platform -- one is a
// custom property whose value is a token string, not a number -- so a parse that quietly gives
// 0 is a bar that keeps the reservation the user can see under the keyboard.
const mobileBundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/mobile.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react'],
})

const keyboardUpWith = ({ ime = '', visual = null, innerHeight = 622, focus = true }) => {
  const module = { exports: {} }
  runInNewContext(mobileBundle.outputFiles[0].text, {
    module, exports: module.exports,
    document: { documentElement: { style: {}, dataset: {} }, querySelector: () => null, hasFocus: () => focus },
    getComputedStyle: () => ({ getPropertyValue: (name) => (name === '--dsh-android-ime-bottom' ? ime : '') }),
    window: { innerHeight, visualViewport: visual },
    require: (name) => {
      if (name === 'react') return { createElement: () => null, useState: v => [v, () => {}], useEffect: () => {}, useRef: v => ({ current: v }) }
      throw new Error(`no platform module ${name}`)
    },
  })
  return module.exports.keyboardUp()
}

test('the keyboard decision reads the phone\'s own numbers', () => {
  // Measured on the device: --dsh-android-ime-bottom 0 → 267px, visualViewport 622.5 → 356.4.
  assert.equal(keyboardUpWith({ ime: '0px', visual: { height: 622.5 } }), false, 'down: the inset is zero')
  assert.equal(keyboardUpWith({ ime: '267px', visual: { height: 356.4 } }), true, 'up: the inset says so')
  // The platform has been seen to hand out a token string rather than a length; the largest px
  // in it is the one that counts, and this is the case that would otherwise silently read 0.
  assert.equal(keyboardUpWith({ ime: 'max(267px, 46px)', visual: { height: 356.4 } }), true, 'up, even as a token string')
  // Neither signal counts while this page is not the one in use: a keyboard raised in the other
  // window of a split screen must not take the bar off the page the user is looking at.
  assert.equal(keyboardUpWith({ ime: '267px', visual: { height: 356.4 }, focus: false }), false, 'up, but in another window')
  assert.equal(keyboardUpWith({ ime: '', visual: { height: 356.4 }, focus: false }), false, 'the gap alone, in another window')
  // And the second signal, for a platform that leaves the inset alone: the visual viewport
  // shrinks while the layout viewport does not (265.6px here, over the 80px threshold).
  // The shell's zero is final, and this is the case that cost the user the bar: a keyboard in
  // the other half of a split screen shrank this page's visual viewport (measured 608 -> 320,
  // the IME's own 288dp) while the shell's inset for this window stayed 0. The gap is a guess.
  assert.equal(keyboardUpWith({ ime: '0px', visual: { height: 320 } }), false, 'another window\'s keyboard is not this one\'s')
  assert.equal(keyboardUpWith({ ime: '', visual: { height: 356.4 } }), true, 'up by the viewport gap alone')
  assert.equal(keyboardUpWith({ ime: '', visual: { height: 600 } }), false, 'a short toolbar is not a keyboard')
  assert.equal(keyboardUpWith({ ime: '', visual: null }), false, 'and no visual viewport is not a keyboard')
})

// The join at the status bar's own lower edge. The page takes the shell's colour, so the join
// is already one colour -- but the shell can move that colour on its own (it did once today),
// and a join that moves under the page is a hard line rather than a soft one. This band is the
// insurance: the page's colour fading to nothing over the status bar's own height, and it never
// takes a tap. It is a sibling of the bar rather than a child, so the keyboard (which takes the bar
// away) and the pages the bar steps aside for both leave it in place.
test('the status bar\'s join is softened by a band that takes no taps', () => {
  const band = css.find(line => line.includes('.bt-topfade{'))
  assert.ok(band, 'the band has a rule')
  assert.ok(band.includes('position:fixed'), band)
  assert.ok(band.includes('top:0'), 'the strip starts at the screen edge, over the status bar')
  assert.ok(band.includes('height:var(--bt-fade-h'), 'as tall as the token, which reaches the pill row')
  assert.ok(!band.includes('+ 56px'), 'the number lives in the one definition, not here')
  assert.ok(band.includes('background:linear-gradient(to bottom,var(--bt-main),transparent)'), 'one gradient, see-through from y=0: the user asked to read the words through it at the status bar')
  assert.ok(!band.includes('calc(100% - 10px)'), 'with no solid part and no step inside it')
  // The tint is all of it: the user asked to read the text under the strip, not to see it smeared.
  assert.ok(!band.includes('backdrop-filter'), 'no blur, so what passes under stays legible')
  assert.ok(band.includes('pointer-events:none'), 'and it takes no tap')
  const bar = css.find(line => line.includes('.bt-nav{'))
  const z = line => Number(/z-index:(\d+)/.exec(line)[1])
  assert.ok(z(band) < z(bar), `under the bar\'s own controls: ${z(band)} < ${z(bar)}`)
  // Rendered with the bar, not inside it: `display:none` on the bar must not take the band too.
  assert.ok(nav.includes("active === 'tasks' ? h('div', { className: 'bt-topfade', 'aria-hidden': true }) : null"), 'drawn over the conversation only -- the four pages carry their own top')
  assert.ok(nav.includes('createPortal(h(Fragment, null,'), 'in the same portal')
  assert.ok(nav.includes("import { Fragment, createElement as h } from 'react'"), 'and Fragment is what wraps them')
  // Over the chat the layers that bring their own top take the band with the bar (styles.js).
  for (const layer of ['.bt-pane', '.bt-panel', '.bt-mem-layer', '.bt-palette-layer', '.bt-settings-layer']) {
    assert.ok(styles.includes(`body:has(${layer}) :is(.bt-mobile-bar,.bt-topfade)`), `the band is hidden under ${layer}`)
  }
})

// Tapping a tab must not repaint a block of the screen. The skin's one press tint is excluded
// from these tabs (styles.js) and the tab dims its own glyph and label instead, which changes
// neither the bar's colour nor the page's, and answers in 120ms rather than animating.
test('a tab answers a press by dimming, not by filling', () => {
  const press = css.find(line => line.includes('.bt-nav-tab:active{'))
  assert.ok(press, 'the tab has a press state of its own')
  assert.ok(press.includes('opacity:'), press)
  assert.ok(!press.includes('background'), `no fill on press: ${press}`)
  const tab = css.find(line => line.includes('.bt-nav-tab{'))
  assert.ok(tab.includes('background:none'), `the tab has no fill at all: ${tab}`)
  assert.ok(tab.includes('transition:color .12s ease,opacity .12s ease'), `and transitions colour and dim only: ${tab}`)
  assert.ok(!tab.includes('transition:background'), tab)
})

// The strip is only worth drawing if something scrolls under it. The column used to keep the
// status bar's inset as its top padding, so the transcript began below the strip and there was
// nothing behind the frost; on an upright phone the column now gives that inset up and the
// transcript's own scroll box takes it back, so the first line still arrives clear of the strip
// (and of the pill row, which was the 60px it reserved) while scrolled content passes under it.
test('the transcript scrolls under the strip, and still arrives clear of it', () => {
  const gate = 'html[data-bt-mobile][data-bt-portrait] '
  const lines = read('styles.js').split('\n')
  const column = lines.find(line => line.startsWith(`${gate}[data-dsh-frame]>[class*="centerCol"]`))
  assert.ok(column && column.includes('padding-top:0!important'), `the column lets content reach the top: ${column}`)
  const scroll = lines.find(line => line.startsWith(`${gate}[class*="_scroll"]`))
  assert.ok(scroll, 'the transcript scroll box has a rule')
  assert.ok(scroll.includes('padding-top:var(--bt-fade-h'), scroll)
  assert.ok(scroll.includes('+ 10px)'), `with the strip-less phone's old inset as the fallback: ${scroll}`)
  // One definition for the strip's height, read by every surface that reserves it: the frost,
  // this scroll box, the phone drawer and the 伙伴 page. A second copy is how they drift.
  const declared = css.filter(line => line.includes('--bt-fade-h:'))
  assert.equal(declared.length, 1, `declared once, found ${declared.length}`)
  assert.ok(declared[0].includes('--bt-fade-h:calc(var(--bt-top-inset') && declared[0].includes('+ 56px)'), declared[0])
  const readers = ['nav-bar.js', 'peers-page.js', 'styles.js']
    .flatMap(name => read(name).split('\n').filter(line => line.includes('var(--bt-fade-h')))
  assert.ok(readers.length >= 4, `four readers, found ${readers.length}`)
  for (const line of readers) assert.ok(line.includes('var(--bt-fade-h'), line)
  // The phone held sideways has no strip, so its inset is untouched -- the two rules above are
  // the only ones that give it up, and both carry the portrait gate.
  const ungated = lines.filter(line => line.startsWith('html[data-bt-mobile] [data-dsh-frame]>[class*="centerCol"]'))
  assert.equal(ungated.length, 1, 'one rule, the original one, without the portrait gate')
  assert.ok(ungated[0].includes('padding-top:var(--dsh-mobile-top-inset'), ungated[0])
})
