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
  for (const borrowed of ["className: 'bt-settings-layer bt-discover'", "className: 'bt-settings'", "className: 'bt-settings-top'", "className: 'bt-settings-scroll'", "className: 'bt-settings-group'", "className: 'bt-settings-group-card'", "className: 'bt-settings-item'", "className: 'bt-settings-name'"]) {
    assert.ok(discover.includes(borrowed), `the page borrows ${borrowed}`)
  }
  assert.ok(!discover.includes('bt-discover-card') && !discover.includes('bt-discover-row'), 'and restates none of it under its own name')
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
  assert.deepEqual(panelRows, ['plugins', 'schedules'], 'the shell panels this page opens')
  assert.ok(discover.includes('PANEL_ROWS.includes('), 'and that list is read, not rewritten')
})

test('the row that opens a shell panel is the only one that needs a back of ours', () => {
  // The plugin manager and the automation tasks screen are the shell's own main panels and draw
  // no back, so the page carries a second level for exactly those two.
  assert.match(index, /if \(PANEL_ROWS\.includes\(key\)\) \{[\s\S]*actions\.selectPanel\(key\)/, 'a panel row selects the panel')
  // The rows that are not panels land on the screens 我的 already opens, under the same page keys
  // the settings dialog uses: one screen, one key, whichever door is taken.
  const settings = sidebar.slice(sidebar.indexOf("t('Usage')"), sidebar.indexOf("t('Bot settings')"))
  assert.ok(settings.includes("actions.openSettings('usage')"), '用量 is the usage screen')
  assert.ok(settings.includes('actions.openConnectors()'), '连接器 is the connectors screen')
  for (const key of ['connectors', 'capabilities', 'secrets', 'usage']) {
    assert.ok(read('settings.js').includes(`['${key}', `), `${key} is a settings page the dialog already draws`)
  }
  assert.ok(index.includes('settings: { page: key, id: null }'), 'and every one of this page\'s rows uses the row key as that page')
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
  // One layer at a time: the strip and Escape both go back to the list, and the list's own Escape
  // is what leaves the page. The strip used to jump straight out of the page.
  assert.match(discover, /useEscape\(\(\) => actions\.closeDiscover\(\)\)/, 'Escape closes the list')
  assert.match(back, /useEscape\(\(\) => actions\.closeDiscoverRow\(\)\)/, 'and steps back one level from the second')
  assert.ok(!back.includes('closeDiscoverPage'), 'the strip never skips the list')
  assert.match(index, /closeDiscoverRow: \(\) => \{[\s\S]*actions\.selectPanel\(null\)[\s\S]*discoverPanel: null, discover: true/, 'back: the panel goes and the list returns')
  assert.match(index, /closeDiscoverPage: \(\) => \{[\s\S]*actions\.selectPanel\(null\)[\s\S]*discover: false, discoverPanel: null/, 'the page still has a way out altogether')
  // A settings page opened from this list steps back to the list too, not past it: its own Escape
  // and its back both land on closeSettings, which reads the row it came from.
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

test('the page is 全部设置\'s own look, plus the two things the user asked for', () => {
  // The card, the row, the head, the spacing, the icon's size and colour, the chevron's: all of it
  // is the settings page's, from styles.js, and this sheet restates none of it. What is left here
  // is the shadow the user asked for on the card, the hairline between the rows of one card, and
  // the strip a shell panel's second level needs.
  const sheet = read('discover-page.js').slice(read('discover-page.js').indexOf('export const DISCOVER_CSS'))
  // Only the page's own two rules are checked here: the strip is its own component and declares its
  // own box.
  const own = sheet.split('\n').filter(line => line.includes('.bt-discover '))
  assert.equal(own.length, 2, `expected the page's two rules, found ${own.length}`)
  for (const restated of ['border-radius:', 'min-height:', 'font-size:', 'padding:', 'justify-content:', 'text-align:', 'gap:']) {
    assert.ok(!own.some(line => line.includes(restated)), `the page restates no ${restated} of the settings page's own`)
  }
  const card = sheet.split('\n').find(line => line.includes('.bt-discover .bt-settings-group-card{'))
  assert.ok(card, 'the card gets one rule of its own')
  assert.ok(card.includes('box-shadow:var(--bt-float-shadow)'), 'the one shared shadow, not a value of its own')
  assert.ok(!card.includes('border-radius') && !card.includes('background:'), 'and nothing else: the rest is that page\'s')
  // The hairline is drawn rather than a border: a border would run the card's whole width and meet
  // both edges, and it must start at the icon and stop short of them. Colour: the skin's own
  // lightest line token -- no new grey is written here.
  const line = sheet.split('\n').find(entry => entry.includes('.bt-discover .bt-settings-item+.bt-settings-item::before'))
  assert.ok(line, 'the hairline between two rows has its rule')
  assert.ok(line.includes('left:12px') && line.includes('right:12px'), 'inset from both edges, starting at the icon')
  assert.ok(!line.includes('left:0') && !line.includes('right:0'), 'and never reaching them')
  assert.ok(line.includes('background:var(--bt-line-weak)'), 'in the shared faint-line token')
  assert.ok(read('styles.js').includes('--bt-line-weak:'), 'which the skin declares')
  assert.ok(!/#[0-9a-f]{3,8}|rgba?\(/i.test(line), 'with no colour of its own')
  // And the row it draws on is the settings page's own, which already carries the position the
  // pseudo-element needs.
  assert.ok(read('styles.js').includes('.bt-settings-item{position:relative;'), 'the row is already a positioned box')
})

test('the page is a surface of its own, one at a time', () => {
  assert.ok(index.includes('discover: false, discoverPanel: null'), 'a state of its own')
  for (const action of ['openDiscover: () =>', 'closeDiscover: () =>', 'openDiscoverRow: (key) =>', 'closeDiscoverRow: () =>', 'closeDiscoverPage: () =>']) {
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
  // page and for a settings screen opened from it: both are the settings layer, and the skin
  // already hides the bar for that layer. The strip of a shell panel's second level needs its own
  // line -- it is not that layer -- and 伙伴 keeps its copy.
  assert.ok(styles.includes('body:has(.bt-settings-layer) :is(.bt-mobile-bar,.bt-topfade)'), 'the page is the settings layer, so the bar steps aside by the skin\'s own rule')
  assert.ok(discover.includes('body:has(.bt-subback) .bt-mobile-bar{display:none}'), 'and the strip hides it too')
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
  // Two rules for what the user asked on top of 全部设置's spec (the card's shadow, the hairline
  // between its rows) and the strip's four: the page has no look of its own beyond those.
  assert.equal(rules.length, 7, `expected the page's own rules, found ${rules.length}`)
  for (const line of rules) {
    const after = line.slice('html[data-bt-mobile]'.length)
    assert.ok(after.startsWith(' ') || after.startsWith('{') || after.startsWith('[data-bt-keyboard]'), line)
  }
  assert.ok(rules.every(line => line.includes('.bt-discover') || line.includes('.bt-subback')), 'and every one is scoped to this page or to its strip')
  // The head, the body's scrolling, the card's corners, the row's height and type, the gap between
  // two cards, the icon's size and colour and the chevron's: all of that is the settings page's,
  // declared once there, so there is nothing here to read back.
  assert.ok(!read('peers-page.js').includes('bt-settings-'), 'and the peers page is left where it is')
  // The row stays a button and the card is not announced: a button that called itself a list item
  // stops being announced as a button.
  assert.ok(discover.includes("className: 'bt-settings-group-card' }"), 'the card is the wrapper')
  const row = discover.slice(discover.indexOf("className: 'bt-settings-item'"), discover.indexOf("className: 'bt-settings-name'"))
  assert.ok(!row.includes('role:'), `the row keeps the button role: ${row}`)
  for (const borrowed of ['bt-row-body', 'bt-row-meta', 'RowMeta', 'unread']) {
    assert.ok(!discover.includes(borrowed), `${borrowed} belongs to the conversation rows`)
  }
})
