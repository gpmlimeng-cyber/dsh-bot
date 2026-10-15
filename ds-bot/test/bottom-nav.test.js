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
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const nav = read('nav-bar.js')
const index = read('index.js')
const mobile = read('mobile.js')

const GATE = 'html[data-bt-mobile][data-bt-portrait]'
const css = nav.split('\n').filter(line => line.startsWith(GATE))

test('every rule of the bar hangs on the mobile layout and an upright window', () => {
  // The sheet's own rules are the lines that start with a selector; the gate must be the
  // whole prefix of each one, so `html[data-bt-mobile]` alone or a bare `.bt-nav` cannot
  // slip in.
  assert.ok(css.length >= 8, `expected the bar's rules, found ${css.length}`)
  for (const line of css) assert.ok(line.startsWith(`${GATE} `) || line.startsWith(`${GATE}{`), line)
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
  assert.deepEqual(order, [['tasks', 'Tasks'], ['peers', 'Peers'], ['plugins', 'Discover'], ['me', 'Me']])
  // The accessible name is the label itself, and it is on the button rather than left to
  // the drawn text, which is hidden from the tree: a real-device dump reads this.
  assert.ok(nav.includes("'aria-label': t(label)"), 'each tab carries its own label')
  assert.ok(nav.includes("'aria-current': active === id ? 'page' : undefined"), 'the current tab says so')
  // Every label goes through t(), so the bar names its pages in the interface's language
  // and Chinese is not baked into the source.
  assert.ok(nav.includes("h('span', { className: 'bt-nav-tab-text', 'aria-hidden': true }, t(label))"), 'the drawn label is translated too')
})

// The two states are two drawings of one shape, copied from Phosphor -- not one drawing with
// a heavier stroke, which is what the user ruled out. One family for all four pages, so the
// bar cannot read as a mix, and the artwork is byte-for-byte what the package ships.
test('each page is Phosphor’s regular and Phosphor’s fill, credited where they live', () => {
  const icons = read('icons.js')
  assert.ok(icons.includes('Phosphor Icons (MIT) · Copyright (c) 2023 Phosphor Icons · @phosphor-icons/core v2.1.1'), 'the MIT notice sits with the artwork')
  const glyphs = [
    ['M216,48H40A16,16,0,0,0,24,64V224', 'chat, the regular one'],
    ['M232,64V192a16,16,0,0,1-16,16H83', 'chat, the solid one'],
    ['M200,48H136V16a8,8,0,0,0-16,0V48', 'robot, the regular one'],
    ['M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48ZM172,96', 'robot, the solid one'],
    ['M128,24A104,104,0,1,0,232,128', 'compass, the regular one'],
    ['M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm51.58,57.79', 'compass, the solid one'],
    ['M230.92,212c-15.23-26.33', 'user, the regular one'],
    ['M230.93,220a8,8,0,0,1-6.93,4H32', 'user, the solid one'],
  ]
  for (const [data, what] of glyphs) assert.ok(icons.includes(data), `${what} is @phosphor-icons/core's own artwork`)
  // One factory for this family, declared once, on Phosphor's own 256 grid -- and the
  // families that stood in before it are gone, each with its notice.
  assert.equal(icons.split('const phosphorIcon = (d, box = PHOSPHOR_BOX)').length - 1, 1, 'one Phosphor factory')
  assert.ok(icons.includes("viewBox: '0 0 256 256'"), 'on Phosphor\'s 256 grid')
  assert.equal((icons.match(/export const Phosphor\w+/g) ?? []).length, 8, 'four pairs')
  for (const dead of ['ionicon(', 'Ionicons (MIT)', 'IonChatbubbleIcon', 'fluentIcon', 'FLUENT_NAV_BOX', 'FluentBotIcon', 'FluentSystem', '@fluentui/svg-icons', 'IonPeopleIcon']) {
    assert.ok(!icons.includes(dead), `${dead} is gone with the family it belonged to`)
  }
  // Nothing is pinned: Phosphor's 16 units of ring on a 256 grid are 1.5px at this box.
  assert.ok(!icons.includes('non-scaling-stroke"...attributes'), 'the Lucide pinning is not copied here')
  assert.ok(Math.abs(16 * 24 / 256 - 1.5) < 0.001, 'the regular weight lands on the skin\'s own 1.5px')
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
  for (const [key, zh] of [['Tasks', '任务'], ['Peers', '伙伴'], ['Discover', '发现'], ['Me', '我的']]) {
    assert.ok(i18n.includes(`${key}: '${zh}'`), `${key} carries its Chinese copy`)
  }
  // The table ships Chinese only: the key text IS the English copy and the host locale
  // falls back to it, so there is no second table that could drift out of step.
  assert.ok(i18n.includes('export const DICTIONARY = { zh: ZH }'), 'one table, Chinese; English is the key')
  assert.ok(i18n.includes("locale.register(NAMESPACE, 'zh', ZH)"), 'and that is the dictionary the locale service gets')
})

test('the selected page is ink and heavier, not the accent', () => {
  const active = css.find(line => line.includes('.bt-nav-tab[data-active]') && line.includes('color'))
  assert.ok(active.includes('color:var(--bt-ink)'), active)
  // The label follows its icon: nothing gives the text a colour of its own, so the two are
  // one colour by construction, selected or not -- which is what the user's screenshot shows.
  const text = css.find(line => line.includes('.bt-nav-tab-text{'))
  assert.ok(!text.includes('color'), `the label inherits the tab's colour: ${text}`)
  assert.ok(css.some(line => line.includes('.bt-nav-tab[data-active] .bt-nav-tab-text') && line.includes('font-weight:600')), 'and only the selected one is heavier')
  const rest = css.find(line => line.includes('.bt-nav-tab{'))
  assert.ok(rest.includes('color:var(--bt-ink-3)'), 'the unselected pages are the light grey')
  const bold = css.find(line => line.includes('.bt-nav-tab[data-active] .bt-nav-tab-text'))
  assert.ok(bold.includes('font-weight:600'), bold)
  assert.ok(!nav.includes('var(--bt-accent)'), 'the accent is not a tab state')
})

test('each tab reads the page it belongs to, and never keeps a selection of its own', () => {
  // The main panel is the shell's; the two overlays are ours. Both are read.
  assert.ok(nav.includes("const active = ui.settings ? 'me'"), 'Settings wins')
  assert.ok(nav.includes(": ui.mobileNav ? 'peers'"), 'the peers page wins next')
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
  // 伙伴 is a page, and the settings screen goes before it opens.
  assert.match(branch('peers', 'plugins'), /actions\.closeSettings\(\)[\s\S]*actions\.openMobileNav\(\)/, 'the settings screen goes first')
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

test('the bar is a surface, not a line: no edge and no shadow', () => {
  // The screenshot the user asked for draws no line above its bar; the surface is what
  // separates it, so it has to be a surface of its own -- the page's own colour would have
  // taken the bar with the line.
  const bar = css.find(line => line.includes('.bt-nav{'))
  assert.ok(!bar.includes('border-top'), `no rule draws a line: ${bar}`)
  assert.ok(!bar.includes('box-shadow'), `and none casts a shadow: ${bar}`)
  assert.ok(bar.includes('background:var(--bt-page)'), `the surface is the page's colour: ${bar}`)
  assert.ok(!bar.includes('backdrop-filter'), 'nothing scrolls under it, so no frost is needed')
  // The body of the rule only: the comment above it is allowed to say the words.
  const rule = bar.slice(bar.indexOf('.bt-nav{'))
  assert.ok(!/border-top|box-shadow/.test(rule), rule)
})

test('the peers page starts at the top edge of the screen and carries the inset itself', () => {
  // With the floating bar hidden on this page, a page that started below the status bar's
  // inset left that band showing the conversation behind it -- the seam the user reported.
  const page = css.find(line => line.startsWith(GATE + ' .bt-side.bt-rail{'))
  assert.ok(page, 'the peers page rule')
  assert.ok(page.includes('top:0'), page)
  assert.ok(page.includes('padding-top:calc(var(--bt-top-inset'), 'the inset is the page\'s own padding')
  assert.ok(page.includes(' + 10px)'), 'plus the base rule\'s own 10px, so the top row does not move')
  // The bar's own height is still given back at the foot of the same page.
  assert.ok(page.includes('padding-bottom:calc(var(--bt-nav-h)'), page)
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
