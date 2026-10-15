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

// The groups, read out of the declaration rather than copied: the drawing order and the headings
// are the page's own, and a row added or removed here has to be answered for in the assertions
// below. A group opens with its own `['Heading', [` line; its rows follow indented under it.
const groupsBlock = discover.slice(discover.indexOf('export const DISCOVER_GROUPS = ['), discover.indexOf('export const DISCOVER_HEADINGS'))
const groups = []
for (const line of groupsBlock.split('\n')) {
  if (/^ {2}\['[^']+', \[$/.test(line)) { groups.push([]); continue }
  const row = /^\s*\['([a-z]+)', '([^']+)', (\w+)\],$/.exec(line)
  if (row && groups.length > 0) groups[groups.length - 1].push([row[1], row[2], row[3]])
}
const headings = [...groupsBlock.matchAll(/^ {2}\['([^']+)', \[$/gm)].map(match => match[1])
const rows = groups.flat()
const panelRows = [...discover.slice(discover.indexOf('export const PANEL_ROWS')).match(/\[[^\]]*\]/)[0]
  .matchAll(/'([a-z]+)'/g)].map(match => match[1])

test('the list is three groups of doors that already exist, one card each', () => {
  // 插件 ｜ 连接与自动化 ｜ 模型与用量 -- the user's own grouping, in this order, one row per card.
  assert.deepEqual(headings, ['Plugins', 'Connections & automation', 'Models & usage'], 'three headings, in order')
  assert.deepEqual(groups.map(group => group.length), [1, 2, 1], '插件 heads a single row and still shows its heading')
  assert.deepEqual(rows.map(row => row[0]), ['plugins', 'connectors', 'schedules', 'usage'], 'the rows, in order')
  assert.deepEqual(rows.map(row => row[1]), ['Plugin manager', 'Connectors', 'Automation tasks', 'Usage'], 'named by the screens they open')
  // 模型 and Agent 预设 are the two the user asked for that have no door of ours: the model chooser
  // is per Bot (and per Session), inside a Bot's own menu, and the only preset in the skin is that
  // Bot's permission preset, inside its settings. They are left out rather than drawn as buttons
  // that go nowhere -- the group is here, with the row that does have a screen, while it is asked.
  assert.ok(!discover.includes('Agent preset'), 'no dead Agent 预设 row')
  assert.ok(!rows.some(row => row[0] === 'models'), 'and no dead 模型 row')
  // Every heading is a translated string of its own, and the heading is drawn for every group --
  // the one-row group included.
  assert.ok(discover.includes("h('div', { className: 'bt-discover-grouphead' }, t(heading))"), 'the heading is drawn per group, in the dictionary\'s words')
  for (const heading of headings) assert.ok(heading in DICTIONARY.zh, `${heading} has a Chinese string`)
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
  // The other two rows land on the screens 我的 already opens, under the same page keys the
  // settings dialog uses: one screen, one key, whichever door is taken.
  const settings = sidebar.slice(sidebar.indexOf("t('Usage')"), sidebar.indexOf("t('Bot settings')"))
  assert.ok(settings.includes("actions.openSettings('usage')"), '用量 is the usage screen')
  assert.ok(settings.includes('actions.openConnectors()'), '连接器 is the connectors screen')
  for (const key of ['connectors', 'usage']) {
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

test('a row is a card of its own, from the shared surface', () => {
  // The card, not the row, carries the skin: the same card surface the composer and the floating
  // controls wear, and the one shadow token they both read.
  const card = discover.slice(discover.indexOf('.bt-discover-card{'), discover.indexOf('.bt-discover-row{'))
  assert.ok(card.includes('border-radius:16px'), 'rounded like the reference')
  assert.ok(card.includes('background:var(--bt-card)'), 'on the card colour')
  assert.ok(card.includes('box-shadow:var(--bt-float-shadow)'), 'the one shared shadow, not a value of its own')
  assert.ok(card.includes('overflow:hidden'), 'and it clips its row, so a row\'s tint stops at its corners')
  const row = discover.slice(discover.indexOf('.bt-discover-row{'), discover.indexOf('.bt-discover-row:hover'))
  assert.ok(row.includes('min-height:56px'), 'a row is 56px')
  assert.ok(row.includes('background:none'), 'the row adds no surface of its own')
  // Nothing is shared between rows any more: one row per card means there is no divider to draw,
  // and the rule that drew one is gone rather than left behind unused.
  assert.ok(!discover.includes('::before'), 'no hairline is drawn between rows')
  assert.ok(!discover.includes('--bt-line-weak'), 'and no line token is read here')
  // The spacing is the grouping: 16px between two groups, 8px between the cards inside one, so a
  // heading reads as belonging to the cards under it.
  assert.ok(discover.includes('.bt-discover-list{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:16px'), '16px between groups')
  assert.ok(discover.includes('.bt-discover-group{display:flex;flex-direction:column;gap:8px}'), '8px between the cards of one group')
  assert.ok(discover.includes('.bt-discover-card{flex:none;'), 'a card takes the width it is given')
  // The heading is the skin's small grey line: the muted ink, 13px, and no surface of its own.
  const head = discover.split('\n').find(line => line.includes('.bt-discover-grouphead{'))
  assert.ok(head, 'the heading has a rule')
  assert.ok(head.includes('color:var(--bt-ink-3)'), 'in the muted ink')
  assert.ok(head.includes('font-size:13px'), 'at the small size')
  assert.ok(!head.includes('background:'), 'with no surface of its own')
  assert.ok(discover.includes('.bt-discover-icon svg{width:20px;height:20px}'), 'the icon is 20px')
  assert.ok(discover.includes('.bt-discover-icon{flex:none;display:inline-flex;color:var(--bt-ink)}'), 'drawn in the ink, not the muted one')
  assert.ok(discover.includes('.bt-discover-go{flex:none;display:inline-flex;color:var(--bt-ink-3)}'), 'the chevron a shade lighter, at the row\'s far end')
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
  assert.ok(discover.includes("h('h2', { className: 'bt-discover-title' }, t('Discover'))"), 'the page title is that tab\'s label')
  assert.ok(discover.includes("'aria-label': t('Discover')"), 'and so is the region it is announced as')
  assert.ok(!/t\('Plugins'\)/.test(discover), 'the page never calls itself 插件')
  // Every string is a key the dictionary has, in the language the rest of the skin is in.
  const keys = [...discover.matchAll(/t\('([^']+)'\)/g)].map(match => match[1])
  assert.ok(keys.length >= 2, `expected the page's strings, found ${keys.length}`)
  for (const key of [...keys, ...rows.map(row => row[1])]) {
    assert.ok(key in DICTIONARY.zh, `${key} has a Chinese string`)
  }
  assert.ok(!/[\u4e00-\u9fff]/.test(discover), 'and no Chinese is hard-coded here')
})

test('every rule is a phone rule, and the floor stays the bar\'s', () => {
  const rules = read('discover-page.js').split('\n').filter(line => line.startsWith('html['))
  assert.ok(rules.length >= 10, `expected the page's rules, found ${rules.length}`)
  for (const line of rules) {
    const after = line.slice('html[data-bt-mobile]'.length)
    assert.ok(after.startsWith(' ') || after.startsWith('{') || after.startsWith('[data-bt-keyboard]'), line)
  }
  // The top is the page's own reservation, read from the one declaration 伙伴 reads, so the two
  // pages cannot drift apart.
  assert.ok(rules.some(line => line.includes('.bt-discover{position:fixed') && line.includes('var(--bt-fade-h,')), 'the top is the shared reservation')
  assert.ok(read('peers-page.js').includes('var(--bt-fade-h,'), 'declared once, for both pages')
  // The bar keeps its 56px at the foot, and the keyboard takes that reservation back -- the same
  // defect the user reported under the composer.
  assert.ok(rules.some(line => line.includes('padding:') && line.includes('var(--bt-nav-h) + var(--bt-nav-gap)')), 'the bar\'s height is given back')
  assert.ok(rules.some(line => line.includes('[data-bt-keyboard] .bt-discover{padding-bottom:12px}')), 'and given back to the keyboard')
  // The card is the group and the row inside stays a button: a group announces nothing, and a
  // button that called itself a list item stops being announced as a button.
  assert.ok(discover.includes("className: 'bt-discover-card', role: 'presentation'"), 'the card is the wrapper')
  assert.ok(!discover.includes('bt-discover-item'), 'and the per-row wrapper is gone with the per-row card')
  const row = discover.slice(discover.indexOf("className: 'bt-discover-row'"), discover.indexOf("className: 'bt-discover-name'"))
  assert.ok(!row.includes('role:'), `the row keeps the button role: ${row}`)
  for (const borrowed of ['bt-row-body', 'bt-row-meta', 'RowMeta', 'unread']) {
    assert.ok(!discover.includes(borrowed), `${borrowed} belongs to the conversation rows`)
  }
})
