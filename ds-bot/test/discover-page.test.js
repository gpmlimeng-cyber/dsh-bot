// 发现 is a page of its own (discover-page.js), not the plugin manager opened the moment the tab
// is tapped: the tab opens a list, and the list's rows are the doors that already existed — the
// plugin manager panel, the connectors and automation-tasks screens, and the usage page. Each row
// is a card of its own, the way the reference app draws its list. Nothing here invents a route, so
// what is pinned is the mapping (which row opens which door), the one thing the page does add (the
// strip the shell's own panels do not draw), and the wiring that keeps it a single surface: one
// page at a time, one layer at a time, and the tab bar above it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DICTIONARY } from '../src/client/i18n.js'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const code = (name) => read(name).split('\n').filter(line => !line.trim().startsWith('//')).join('\n')

const discover = code('discover-page.js')
const index = code('index.js')
const nav = code('nav-bar.js')
const navForTopfade = read('nav-bar.js')
const sidebar = code('sidebar.js')
const styles = code('styles.js')

// The cards, read out of the declaration rather than copied: the drawing order and the grouping are
// the page's own, and a row added or removed here has to be answered for in the assertions below.
// A card opens with its own `[` line; its rows follow indented under it.
const cardsBlock = discover.slice(discover.indexOf('export const DISCOVER_CARDS = ['), discover.indexOf('export const DISCOVER_ROWS'))
const cards = []
for (const line of cardsBlock.split('\n')) {
  if (line.trim() === '[' || line.trim() === '[[') cards.push([])
  const row = /\[['"]([a-z]+)['"], ['"]([^'"]+)['"], (\w+)\]/.exec(line)
  if (row && cards.length > 0) cards[cards.length - 1].push([row[1], row[2], row[3]])
}
const rows = cards.flat()
const panelRows = [...discover.slice(discover.indexOf('export const PANEL_ROWS')).match(/\[[^\]]*\]/)[0]
  .matchAll(/'([a-z]+)'/g)].map(match => match[1])

test('a tab page\u2019s strip is the colour of the surface that page shows', () => {
  // The user saw a band under the status bar on 全部设置 (live read: --bt-main #ffffff above, --bt-sidebar
  // #f9f9f9 below, and #141414 against #1b1b1b in the dark palette). The two pages under this layer do
  // not share a base -- the settings list is the sidebar colour with --bt-card rows on it, and 发现 is
  // one dialog painted --bt-main -- so each says which word its strip wears.
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage]{top:0;box-sizing:border-box;padding-top:var(--dsh-frame-chrome-top,0px);background:var(--bt-sidebar)}'), 'the strip follows the settings list\u2019s own base')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings[data-screen=list] .bt-settings-top{background:var(--bt-sidebar)}'), 'and so does that list\u2019s title row')
  assert.ok(styles.includes('.bt-settings-nav{position:relative;width:198px;flex:none;padding:16px 8px;border-right:.5px solid var(--bt-line);display:flex;flex-direction:column;gap:2px;background:var(--bt-sidebar);box-sizing:border-box}'), 'which is the colour the list itself already wears')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings[data-screen=page] .bt-settings-top{background:var(--bt-main)}'), 'which is the colour that screen\u2019s title row wears')
  // And the strip follows the screen: the second screen of the flow is the dialog itself (--bt-main), so
  // leaving the list's --bt-sidebar up there would be the same seam one screen further in.
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage]:has(.bt-settings[data-screen=page]){background:var(--bt-main)}'), 'the page screen says its own word too')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-discover.bt-settings-layer[data-tabpage]{background:var(--bt-main)}'), '发现\u2019s strip follows its own dialog instead')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-discover .bt-settings[data-screen=list] .bt-settings-top{background:transparent}'), 'and its title row leaves the dialog\u2019s colour showing')
  // 伙伴 is a page, so it wears the page base too: --bt-main, the same word as the veil the skin
  // draws over it, which is why nothing shows there. Its own sheet hides the bar, and the skin hides
  // the veil as well -- both are --bt-main, so that part is invisible and named for what it is.
  assert.ok(read('peers-page.js').includes('padding:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) 12px calc(var(--bt-nav-h) + var(--bt-nav-gap));background:var(--bt-main)'), '伙伴 wears the page base')
  assert.ok(read('peers-page.js').includes('body:has(.bt-peers) .bt-mobile-bar{display:none}'), 'its sheet hides the bar over it')
  assert.ok(styles.includes('html[data-bt-mobile] body:has(.bt-peers) :is(.bt-mobile-bar,.bt-topfade),'), 'and the skin hides the veil too, which is the one that was left up')
  // A dialog's scrim is the whole screen's. The layer keeps its own top, so the scrim is fixed rather
  // than absolute -- absolute filled only the layer and left the strip undimmed. Padding the layer
  // instead would have moved a centred dialog (`.bt-palette` is absolute at top:50%).
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer:not([data-tabpage])>.bt-scrim,\nhtml[data-bt-mobile] .bt-palette-layer>.bt-backdrop,\nhtml[data-bt-mobile] .bt-mem-layer>.bt-scrim{position:fixed;inset:0}'), 'a floating layer dims the strip as well')
  assert.ok(!styles.includes('html[data-bt-mobile] .bt-settings-layer:not([data-tabpage]){top:0'), 'and none of those layers is padded, which would move its dialog')
  // The frost is the conversation's own: it is drawn on the tasks tab alone (nav-bar.js), so nothing
  // here needs a second word for it.
  assert.ok(navForTopfade.includes("active === 'tasks' ? h('div', { className: 'bt-topfade', 'aria-hidden': true }) : null"), 'the veil belongs to the conversation')
})

// It used to be written inside the test above, which made its failures read as that test's. Same file,
// and neither test's assertions changed.
test('the list is three cards of doors that already exist, with no headings', () => {
  // 插件 ｜ 连接器·能力·定时任务·密钥 ｜ 用量 -- the user's own grouping, in this order, one card per group.
  assert.deepEqual(cards.map(card => card.length), [1, 4, 1], 'three cards, 1/4/1 rows')
  assert.deepEqual(rows.map(row => row[0]), ['plugins', 'connectors', 'capabilities', 'schedules', 'secrets', 'usage'], 'the rows, in order')
  assert.deepEqual(rows.map(row => row[1]), ['Plugin manager', 'Connectors', 'Capabilities', 'Automation tasks', 'Secrets', 'Usage'], 'named by the screens they open')
  // No heading anywhere: the grouping is the card, so the page draws no heading element of its own
  // and keeps no heading copy in the dictionary.
  assert.ok(!discover.includes('bt-settings-group-head'), 'no heading is drawn, though the settings page has one')
  assert.ok(!discover.includes('Models & usage'), 'and no heading copy is left in the page')
  assert.ok(!('Models & usage' in DICTIONARY.zh), 'nor in the dictionary')
  // The look is 我的 -> 全部设置's: the page wears that page's own layer, dialog, head, scrolling
  // body, group card and item row, so there is one design rather than two that resemble each other.
  for (const borrowed of ["className: 'bt-settings-layer bt-discover'", "className: 'bt-settings'", "className: 'bt-settings-top'", "className: 'bt-settings-scroll'", "className: 'bt-settings-group'", "className: 'bt-settings-group-card bt-discover-card'", "className: 'bt-settings-item bt-discover-row'", "className: 'bt-settings-name'"]) {
    assert.ok(discover.includes(borrowed), `the page borrows ${borrowed}`)
  }
  // The names the page's own sheets and the device probes were written against are kept as aliases
  // on the same two elements -- the look is the settings page's, the handles stay this page's --
  // so neither a rule nor a verifier's selector has to be rewritten for the change of skin.
  assert.ok(discover.includes("className: 'bt-settings-group-card bt-discover-card'"), 'the card carries both names')
  assert.ok(discover.includes("className: 'bt-settings-item bt-discover-row'"), 'and so does the row')
  assert.ok(!discover.includes('.bt-discover-card{') && !discover.includes('.bt-discover-row{'), 'with no rule of their own behind them')
  // 模型 and Agent 预设 are the two the user asked for that have no door of ours: the model chooser
  // is per Bot (and per Session), inside a Bot's own menu, and the only preset in the skin is that
  // Bot's permission preset, inside its settings. They are left out rather than drawn as buttons
  // that go nowhere -- their card keeps the row that does have a screen, while it is asked.
  assert.ok(!discover.includes('Agent preset'), 'no dead Agent 预设 row')
  assert.ok(!rows.some(row => row[0] === 'models'), 'and no dead 模型 row')
  // Every icon is Fluent artwork the skin carries, from the one icon module -- not a line drawing
  // of ours, and not a name without a definition behind it.
  assert.ok(discover.includes("} from './icons.js'"), 'the icons come from icons.js')
  for (const [, , icon] of rows) {
    assert.ok(discover.includes(icon), `${icon} is the row's own icon`)
    assert.ok(read('icons.js').includes(`export const ${icon} = fluentNavIcon(`), `${icon} is Fluent artwork, not a drawing of ours`)
  }
  // A row is the door itself: the page holds a key and a label, never an action of its own, so
  // its own door is looked up in one place (index.js).
  assert.ok(discover.includes('onClick: () => actions.openDiscoverRow(key)'), 'the row asks for its key')
  assert.ok(!discover.includes('selectPanel') && !discover.includes('openSettings'), 'and the page itself opens nothing')
  // The two panel rows are the ones with no back of their own; see the strip below.
  assert.deepEqual(panelRows, ['plugins', 'schedules'], 'the rows whose door is a shell panel, with our strip')
  assert.ok(discover.includes('PANEL_ROWS.includes('), 'and that list is read, not rewritten')
})

test('the row that opens a shell panel is the only one that needs a back of ours', () => {
  // The plugin manager and the automation tasks screen are the shell's own main panels and draw
  // no back, so the page carries a second level for exactly those two.
  assert.match(index, /if \(PANEL_ROWS\.includes\(key\)\) \{[\s\S]*actions\.selectPanel\(key\)/, 'a panel row selects the panel')
  // And it selects it before the page steps aside, inside a guard: selectPanel throws on an id
  // nothing registered, and a row that threw after closing the list would leave the conversation
  // showing with nothing opened -- which is what tapping the automation row used to do in a window
  // where the shell had no such panel.
  const row = index.slice(index.indexOf('openDiscoverRow: (key) =>'), index.indexOf('closeDiscoverRow:'))
  assert.ok(row.includes('try {') && row.includes('} catch {') && row.includes('return'), 'a panel that is not registered leaves the list up')
  assert.ok(row.indexOf('actions.selectPanel(key)') < row.indexOf('discoverPanel: key'), 'the panel opens first, so a throw changes nothing')
  // The rows that are not panels land on the screens 我的 already opens, under the same page keys
  // the settings dialog uses: one screen, one key, whichever door is taken.
  const settings = sidebar.slice(sidebar.indexOf("t('Usage')"), sidebar.indexOf("t('Bot settings')"))
  assert.ok(settings.includes("actions.openSettings('usage')"), '用量 is the usage screen')
  assert.ok(settings.includes('actions.openConnectors()'), '连接器 is the connectors screen')
  for (const key of ['connectors', 'capabilities', 'schedules', 'secrets', 'usage']) {
    assert.ok(read('settings.js').includes(`['${key}', `), `${key} is a settings page the dialog already draws`)
  }
  assert.ok(index.includes('settings: { page: key, id: null, tab: true }'), 'and every one of this page\'s rows uses the row key as that page, through the tab door')
})

test('the second level carries the strip a shell panel does not draw', () => {
  const back = discover.slice(discover.indexOf('export function DiscoverBack'), discover.indexOf('export const DISCOVER_CSS'))
  assert.ok(back.includes('PANEL_ROWS.includes(value.discoverPanel)'), 'only for the panel rows')
  assert.ok(back.includes("'aria-label': t('Back to the list')"), 'named for where it goes')
  assert.ok(back.includes('onClick: () => actions.closeDiscoverRow()'), 'and it goes back to the list')
  // The strip tells the shell's own column to reserve its height; the attribute is published
  // with the strip and taken down with it, so no rule is left behind for the next panel.
  assert.ok(back.includes("document.documentElement.dataset.btSubpage = '1'"), 'the height is published')
  assert.ok(back.includes('delete document.documentElement.dataset.btSubpage'), 'and withdrawn')
  assert.ok(styles.includes('html[data-bt-mobile][data-bt-portrait][data-bt-subpage] [data-dsh-frame]>[class*="centerCol"]{padding-top:calc(var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)) + 56px)!important}'), 'the panel\'s column reserves it')
  assert.ok(!discover.includes('dataset.btSubpage') || back.includes('dataset.btSubpage'), 'published from the strip alone')
  // One Escape handler, on the page, and the state decides which level it leaves: the strip used to
  // register a second one, and because the layers are read newest-first that layer sat on top of the
  // page's for the page's whole life -- so on the list the key hit a no-op and did nothing. There is
  // no separate "leave the page altogether" action any more; nothing calls one.
  assert.match(discover, /const panel = useUi\(value => value\.discoverPanel \?\? null\)/, 'the page reads the second level')
  assert.match(discover, /useModalLayer\(dialogRef, shown, \(\) => \(panel !== null \? actions\.closeDiscoverRow\(\) : actions\.closeDiscover\(\)\)\)/, 'and one handler leaves the level the state says is up')
  assert.ok(!back.includes('useEscape'), 'the strip registers no Escape of its own')
  assert.ok(!index.includes('closeDiscoverPage'), 'and there is no action left that skips a level')
  assert.match(index, /closeDiscoverRow: \(\) => \{[\s\S]*actions\.selectPanel\(null\)[\s\S]*discoverPanel: null, discover: true/, 'back: the panel goes and the list returns')
  // A settings page opened from this list steps back one level at a time, the way its own back
  // arrow does: Escape inside a page returns to Settings' own list first, and leaving that list is
  // what comes back here (closeSettings reads the row the page was opened from).
  const settingsPage = read('settings.js')
  assert.match(settingsPage, /useModalLayer\(dialogRef, mobile, leaveLevel\)/, 'Escape steps up inside Settings on a phone')
  assert.match(settingsPage, /useEscape\(mobile \? \(\) => \{\} : leaveLevel\)/, 'and the wide column keeps the key it always had')
  assert.ok(settingsPage.includes("onClick: () => { if (screen === 'list') close(); else stepBack() }"), 'the same rule its back arrow uses')
  const close = index.slice(index.indexOf('closeSettings: () =>'), index.indexOf('openMemory:'))
  assert.ok(close.includes('state.discoverPanel !== null'), 'closing a page this list opened comes back here')
  assert.ok(close.includes('discover: true, discoverPanel: null'), 'to the list it came from')
  // The strip is the skin's measurement, not a local one: 48px control, 22px glyph, page colour.
  assert.ok(discover.includes('.bt-subback{position:fixed;top:0;left:0;right:0;height:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 56px)'), 'the strip covers the status bar and the row')
  assert.ok(discover.includes('z-index:96'), 'over the panel')
  assert.ok(discover.includes('background:var(--bt-main)'), 'in the page\'s own colour')
  assert.ok(discover.includes('pointer-events:none'), 'the strip does not eat the panel\'s taps')
  assert.ok(discover.includes('.bt-subback-btn{pointer-events:auto;flex:none;width:48px;height:48px'), 'the control is 48px')
  assert.ok(discover.includes('.bt-subback-btn>svg{width:22px;height:22px}'), 'and its glyph 22px')
})

test('the page is 全部设置\'s own look, to the letter', () => {
  // The card, its 1px border and corners, the row's height and type, the icon's size and colour,
  // the chevron, the spacing between two cards, the head and the body: all of it is the settings
  // page's, declared once in styles.js, and this sheet restates none of it -- nor adjusts it.
  const sheet = read('discover-page.js').slice(read('discover-page.js').indexOf('export const DISCOVER_CSS'))
  assert.ok(!sheet.includes('.bt-discover '), 'the page declares no rule of its own')
  assert.ok(!sheet.includes('box-shadow'), 'no shadow is added')
  assert.ok(!sheet.includes('::before'), 'and no line is drawn between two rows')
  const settings = read('styles.js')
  for (const rule of [
    '.bt-settings-group-card{display:block;border:0;box-shadow:inset 0 0 0 .5px var(--bt-line);border-radius:16px;background:var(--bt-card);overflow:hidden}',
    '.bt-settings-group+.bt-settings-group{margin-top:var(--bt-set-gap,14px)}',
    '.bt-settings-item{min-height:var(--bt-set-row-h,48px);padding:0 12px;border-radius:0;font-size:14px',
    '.bt-settings-item>svg{flex:none;width:24px;height:24px;color:var(--bt-ink-2)}',
    '.bt-settings-top h2{position:absolute',
  ]) {
    assert.ok(settings.includes(rule), `the skin declares it: ${rule.slice(0, 48)}…`)
  }
  // Which leaves the strip: four rules, and no look of the page's own beside them. Even the way the
  // page appears is the skin's (the test below), so nothing here can drift from it.
  const own = sheet.split('\n').filter(line => line.startsWith('html['))
  assert.equal(own.length, 4, `expected the strip's four rules, found ${own.length}`)
  assert.ok(own.every(line => line.includes('.bt-subback')), 'every one of them the strip\'s')
})

test('the page is a surface of its own, one at a time', () => {
  assert.ok(index.includes('discover: false, discoverPanel: null'), 'a state of its own')
  for (const action of ['openDiscover: () =>', 'closeDiscover: () =>', 'openDiscoverRow: (key) =>', 'closeDiscoverRow: () =>']) {
    assert.ok(index.includes(action), `${action} exists`)
  }
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-discover', order: 44, inject: face }, DiscoverPage)"), 'drawn on an overlay entry of its own')
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-discover-back', order: 46, inject: face }, DiscoverBack)"), 'and the strip on one above it')
  assert.ok(index.includes("installCompiledStyles(DISCOVER_CSS, 'discover')"), 'with its own named sheet')
  // The tab lights while the page or its second level is up -- including the second level that is
  // a settings screen, which is why 发现 is read before Settings: the light stays on the page the
  // user came in through. It opens the list rather than the panel.
  const active = nav.slice(nav.indexOf('const active ='), nav.indexOf('const go = (id) =>'))
  assert.ok(active.startsWith('const active = ui.discover || ui.discoverPanel !== null ? \'plugins\''), '发现 is read first, so a settings page under it does not move the light')
  assert.ok(active.indexOf('ui.discover') < active.indexOf('ui.settings'), 'and before Settings')
  assert.ok(nav.includes('actions.openDiscover()'), 'and opens the list')
  // The conversation's own top row carries that conversation's title, so it steps aside for this
  // page and for the strip of a shell panel's second level. Which layers do that is the skin's list
  // (styles.js), and 发现 and its strip are both named in it -- the list page also carries the
  // settings layer, which that list already had. 伙伴 keeps its own copy: it is not that layer.
  assert.ok(styles.includes('body:has(.bt-settings-layer) :is(.bt-mobile-bar,.bt-topfade)'), 'the page is the settings layer, so the bar steps aside by the skin\'s own rule')
  // And its head starts at the status bar's own lower edge, not under the strip's height: the skin
  // maps --dsh-frame-chrome-top to --bt-top-inset on a phone, and the layer's inset reads it.
  assert.ok(styles.includes('.bt-settings-layer{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;'), 'the layer starts at the chrome top')
  assert.ok(styles.includes('html[data-bt-mobile]{--dsh-frame-chrome-top:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)))}'), 'which is the status bar\'s inset on a phone')
  // Every opaque surface that hides that bar -- the panes (New..., the exchange, voice, the browser)
  // and the details column -- then owns the strip itself, or the band above it is whatever the shell
  // painted behind (the leftover the user read as the status bar not matching the page).
  assert.ok(styles.includes('html[data-bt-mobile] .bt-pane,\nhtml[data-bt-mobile] .bt-panel{top:0;box-sizing:border-box;padding-top:var(--dsh-frame-chrome-top,0px)}'), 'a pane and the details column paint the strip and clear it')
  assert.ok(styles.includes('.bt-pane{position:fixed;top:var(--dsh-frame-chrome-top,0px);'), 'and the desktop pane keeps the shell\'s own top')
  assert.ok(!/\n\.bt-pane\{[^}]*padding-top/.test(styles), 'so the strip is a phone rule, not a desktop one')
  assert.ok(!read('discover-page.js').includes('var(--bt-fade-h'), 'so this page reserves no veil height')
  assert.ok(styles.includes('body:has(.bt-discover) :is(.bt-mobile-bar,.bt-topfade)'), 'and 发现 is named in the list as well')
  assert.ok(styles.includes('body:has(.bt-subback) :is(.bt-mobile-bar,.bt-topfade)'), 'and so is the strip, which is no layer of the skin\'s')
  assert.ok(!discover.includes('bt-mobile-bar'), 'the page leaves that list to the skin')
  assert.ok(read('peers-page.js').includes('body:has(.bt-peers) .bt-mobile-bar{display:none}'), 'the same rule 伙伴 uses, in its own sheet')
  // Every opener that puts another full-pane surface over the conversation takes this page down
  // with it. Two deliberate exceptions: openSettings/openConnectors are the doors this page's own
  // rows use (the row clears the page before it calls them) and closePeers only closes something.
  const doors = ['openSettings:', 'openConnectors:', 'closePeers:']
  for (const line of index.split('\n').filter(line => line.includes('peers: false'))) {
    if (doors.some(name => line.includes(name))) continue
    assert.ok(line.includes('discover'), `an opener that takes the peers page down takes ours too: ${line.trim()}`)
  }
  // The session opens are not on the bar, so they clear the page themselves rather than relying
  // on a tab: the same pair the peers page is cleared by.
  const openSession = index.slice(index.indexOf('openSession: (id) =>'), index.indexOf('openAgentSession:'))
  const openAgent = index.slice(index.indexOf('openAgentSession: (sessionId)'), index.indexOf('addAgent: async'))
  assert.ok(openSession.includes('discover: false, discoverPanel: null'), 'a conversation opens over the page')
  assert.ok(openAgent.includes('discover: false, discoverPanel: null'), 'and so does an Agent Session')
  // And the bar's four tabs all answer for it, so no page is left standing over the one that
  // replaces it (bottom-nav.test.js carries the order).
  const go = nav.slice(nav.indexOf('const go = (id) =>'), nav.indexOf('return createPortal'))
  assert.ok(go.includes('actions.openDiscover()'), 'the 发现 tab opens the list')
  assert.equal([...go.matchAll(/actions\.closeDiscover\(\)/g)].length, 3, 'and the other three tabs close it')
  assert.ok(go.indexOf('actions.closeDiscover()') < go.indexOf('actions.closeSettings()'), 'before Settings, which would otherwise step back to the list')
})

test('the page and its tab carry one name, and the copy is in the dictionary', () => {
  // The tab is 发现 (nav-bar's own label): the page it opens is the same page, so it wears the
  // same name rather than a second one -- and that name is "Discover", not "Plugins" (插件 is
  // only the first row of this page's list).
  assert.ok(nav.includes("['plugins', 'Discover', FluentCompassIcon, FluentCompassFilledIcon]"), 'the tab is the 发现 tab')
  // The page's name sits in the settings page's own head, whose one rule centres it (styles.js):
  // the title is absolutely placed across the bar's whole width, so the two side buttons cannot
  // pull it off centre and this page needs no rule of its own for that.
  assert.ok(discover.includes("h('div', { className: 'bt-settings-top' }, h('h2', null, t('Discover')))"), 'the page title is that tab\'s label, in the settings page\'s own head')
  assert.ok(styles.includes('.bt-settings-top h2{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);margin:0;padding:0 60px;text-align:center;'), 'which centres whatever it holds')
  assert.ok(discover.includes("'aria-label': t('Discover')"), 'and so is the dialog it is announced as')
  assert.ok(!/t\('Plugins'\)/.test(discover), 'the page never calls itself 插件')
  // Every string is a key the dictionary has, in the language the rest of the skin is in.
  const keys = [...discover.matchAll(/t\('([^']+)'\)/g)].map(match => match[1])
  assert.ok(keys.length >= 2, `expected the page's strings, found ${keys.length}`)
  for (const key of [...keys, ...rows.map(row => row[1])]) {
    assert.ok(key in DICTIONARY.zh, `${key} has a Chinese string`)
  }
  assert.ok(!/[\u4e00-\u9fff]/.test(discover), 'and no Chinese is hard-coded here')
})

test('every rule is a phone rule, and the page hands the shell nothing but the strip', () => {
  const rules = read('discover-page.js').split('\n').filter(line => line.startsWith('html['))
  // The page has no look of its own at all -- it is the settings page's, and the sheet is the
  // strip's own four rules. Which layers hide the top row, and how a phone's page appears, is the
  // skin's business (styles.js).
  assert.equal(rules.length, 4, `expected the strip's four rules, found ${rules.length}`)
  for (const line of rules) {
    const after = line.slice('html[data-bt-mobile]'.length)
    assert.ok(after.startsWith(' ') || after.startsWith('{') || after.startsWith('[data-bt-keyboard]'), line)
  }
  assert.ok(rules.every(line => line.includes('.bt-subback')), 'and every one is the strip\'s')
  // How this page appears is the skin's, declared once for the layer it shares with 我的: a layer a
  // tab opened is a page, and a page is drawn rather than summoned -- no 220ms veil fade over the tab
  // it replaces, no veil at all, and no 160ms lingering sink over the tab chosen next. The marker is
  // what says so, and it is what keeps a dialog over the conversation a dialog.
  assert.ok(discover.includes("className: 'bt-settings-layer bt-discover', 'data-tabpage': ''"), 'this page is one of the four pages, and says so')
  assert.ok(read('settings.js').includes("'data-tabpage': tab ? '' : undefined"), '我的 carries the marker when a tab opened it')
  assert.ok(index.includes("settings: { page, id, tab: door === null ? (state.settings?.tab ?? false) : door === 'tab', from: state.settings?.from ?? null }"), 'the door is remembered, and kept by every step inside Settings')
  assert.ok(nav.includes("actions.openSettings('general', null, 'tab')"), 'the 我的 tab comes through the tab door')
  assert.ok(index.includes("settings: { page: key, id: null, tab: true }"), 'and so does every row of this list')
  assert.ok(read('overlays.js').includes('tab: settings.tab === true'), 'which the layer is handed')
  // And it paints the strip the chrome reserves, so the band above the page is the page's own colour
  // instead of the shell's leftover: the dialog moves down by exactly that strip.
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage]{top:0;box-sizing:border-box;padding-top:var(--dsh-frame-chrome-top,0px);background:var(--bt-sidebar)}'), "the page paints from the screen's top edge, in the settings list's own colour (发现 overrides it with its dialog's)")
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage]>.bt-settings{animation:none!important}'), 'the phone plays no entrance for it, and beats the reduced-motion fade that would otherwise stand in for one')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage][data-leaving]{opacity:0;transition:none}'), 'and no exit')
  assert.ok(styles.includes('html[data-bt-mobile] .bt-settings-layer[data-tabpage]>.bt-scrim{display:none}'), 'and draws no veil')
  assert.ok(styles.includes('animation:bt-dialog-rise'), 'while the dialog keeps all three')
  assert.ok(styles.includes('.bt-mem{position:relative;width:min(680px,calc(100vw - 48px))'), 'and the memory dialog is still a card on this layout, so it keeps its own entrance')
  assert.ok(!styles.includes('.bt-settings-layer>.bt-settings{animation:none}'), 'and none of it reaches a layer without the marker')
  // A page that must not animate is not a motion to soften: the one reduced-motion rule that would
  // otherwise stand in for an entrance is an !important, so the "no entrance" carries one too.
  assert.ok(styles.includes('animation:bt-fade .12s ease-out!important'), 'the reduced-motion fade is still there for the surfaces that do animate')
  // The head, the body's scrolling, the card's corners, the row's height and type, the gap between
  // two cards, the icon's size and colour and the chevron's: all of that is the settings page's,
  // declared once there, so there is nothing here to read back. 伙伴 borrows that head too, and
  // nothing else of it: its own list and rows are still its own.
  assert.ok(read('peers-page.js').includes("className: 'bt-settings-top' }"), '伙伴\'s title row is that page\'s bar as well')
  assert.ok(read('peers-page.js').includes("className: 'bt-peers-row'"), 'and its rows are still its own')
  // The row stays a button and the card is not announced: a button that called itself a list item
  // stops being announced as a button.
  assert.ok(discover.includes("className: 'bt-settings-group-card bt-discover-card' }"), 'the card is the wrapper')
  const row = discover.slice(discover.indexOf("className: 'bt-settings-item'"), discover.indexOf("className: 'bt-settings-name'"))
  assert.ok(!row.includes('role:'), `the row keeps the button role: ${row}`)
  for (const borrowed of ['bt-row-body', 'bt-row-meta', 'RowMeta', 'unread']) {
    assert.ok(!discover.includes(borrowed), `${borrowed} belongs to the conversation rows`)
  }
})
