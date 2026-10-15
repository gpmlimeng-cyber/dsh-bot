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
  // 伙伴 is a page and the tab is its own way back: the second tap returns to the
  // conversation rather than leaving the list behind the plugin page.
  assert.match(branch('peers', 'plugins'), /if \(ui\.mobileNav\) \{[\s\S]*actions\.closeMobileNav\(\)[\s\S]*actions\.selectPanel\(null\)/)
  assert.match(branch('peers', 'plugins'), /actions\.closeSettings\(\)/, 'the settings screen goes first')
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
