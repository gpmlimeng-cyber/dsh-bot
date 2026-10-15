// 发现 is a page of its own (discover-page.js), not the plugin manager opened the moment the tab
// is tapped: the tab opens a list, and the list's rows are the doors that already existed — the
// plugin manager panel, the connectors screen, the automation tasks panel and the usage page.
// Nothing here invents a route, so what is pinned is the mapping (which row opens which door),
// the one thing the page does add (the strip the shell's own panels do not draw), and the wiring
// that keeps it a single surface: one page at a time, and the tab bar above it.
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

// The rows, read out of the declaration rather than copied: the order is the page's own, and a
// row added or removed here has to be answered for in the assertions below.
const rows = [...discover.slice(discover.indexOf('export const DISCOVER_ROWS'), discover.indexOf('export const PANEL_ROWS'))
  .matchAll(/\['([a-z]+)', '([^']+)', (\w+)\]/g)].map(match => [match[1], match[2], match[3]])
const panelRows = [...discover.slice(discover.indexOf('export const PANEL_ROWS')).match(/\[[^\]]*\]/)[0]
  .matchAll(/'([a-z]+)'/g)].map(match => match[1])

test('the list is four doors that already exist, in one place', () => {
  assert.deepEqual(rows.map(row => row[0]), ['plugins', 'connectors', 'schedules', 'usage'], 'the four rows, in order')
  assert.deepEqual(rows.map(row => row[1]), ['Plugin manager', 'Connectors', 'Automation tasks', 'Usage'], 'named by the screens they open')
  // Every icon is one the skin already draws, out of the one icon module.
  assert.ok(discover.includes("} from './icons.js'"), 'the icons come from icons.js')
  for (const [, , icon] of rows) {
    assert.ok(discover.includes(icon), `${icon} is imported rather than drawn here`)
    assert.ok(read('icons.js').includes(`export const ${icon} =`), `${icon} already exists`)
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
  // The other two land on the screens 我的 already opens, under the same page keys the sidebar's
  // own doors use: one screen, one key, whichever door is taken.
  const settings = sidebar.slice(sidebar.indexOf("t('Usage')"), sidebar.indexOf("t('Bot settings')"))
  assert.ok(settings.includes("actions.openSettings('usage')"), '用量 is the usage screen')
  assert.ok(settings.includes('actions.openConnectors()'), '连接器 is the connectors screen')
  assert.ok(index.includes("openConnectors: () => { ui.set(state => ({ ...state, settings: { page: 'connectors'"), 'which is the key this page uses')
  assert.ok(index.includes('settings: { page: key, id: null }'), 'and both of this page\'s rows use the row key as that page')
  for (const key of rows.map(row => row[0]).filter(key => !panelRows.includes(key))) {
    assert.ok(key === 'connectors' || key === 'usage', `${key} has a screen behind it`)
  }
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
  // Both levels have a way out: the list closes on Escape, the strip leaves the page.
  assert.match(discover, /useEscape\(\(\) => actions\.closeDiscover\(\)\)/, 'Escape closes the list')
  assert.match(discover, /useEscape\(\(\) => actions\.closeDiscoverPage\(\)\)/, 'and leaves the page from the second level')
  assert.match(index, /closeDiscoverRow: \(\) => \{[\s\S]*actions\.selectPanel\(null\)[\s\S]*discoverPanel: null, discover: true/, 'back: the panel goes and the list returns')
  assert.match(index, /closeDiscoverPage: \(\) => \{[\s\S]*actions\.selectPanel\(null\)[\s\S]*discover: false, discoverPanel: null/, 'Escape: the page goes altogether')
  // The strip is the skin's measurement, not a local one: 48px control, 22px glyph, page colour.
  assert.ok(discover.includes('.bt-subback{position:fixed;top:0;left:0;right:0;height:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 56px)'), 'the strip covers the status bar and the row')
  assert.ok(discover.includes('z-index:96'), 'over the panel')
  assert.ok(discover.includes('background:var(--bt-main)'), 'in the page\'s own colour')
  assert.ok(discover.includes('pointer-events:none'), 'the strip does not eat the panel\'s taps')
  assert.ok(discover.includes('.bt-subback-btn{pointer-events:auto;flex:none;width:48px;height:48px'), 'the control is 48px')
  assert.ok(discover.includes('.bt-subback-btn>svg{width:22px;height:22px}'), 'and its glyph 22px')
})

test('the page is a surface of its own, one at a time', () => {
  assert.ok(index.includes('discover: false, discoverPanel: null'), 'a state of its own')
  for (const action of ['openDiscover: () =>', 'closeDiscover: () =>', 'openDiscoverRow: (key) =>', 'closeDiscoverRow: () =>', 'closeDiscoverPage: () =>']) {
    assert.ok(index.includes(action), `${action} exists`)
  }
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-discover', order: 44, inject: face }, DiscoverPage)"), 'drawn on an overlay entry of its own')
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-discover-back', order: 46, inject: face }, DiscoverBack)"), 'and the strip on one above it')
  assert.ok(index.includes("installCompiledStyles(DISCOVER_CSS, 'discover')"), 'with its own named sheet')
  // The tab lights while the page or its second level is up, and it opens the list rather than
  // the panel: the tab is a page of the bar, and the panel is a row of the page.
  assert.ok(nav.includes(": ui.discover || ui.discoverPanel !== null ? 'plugins'"), 'the tab lights for both levels')
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
})

test('the page and its tab carry one name, and the copy is in the dictionary', () => {
  // The tab is 发现 (nav-bar's own label): the page it opens is the same page, so it wears the
  // same name rather than a second one.
  assert.ok(nav.includes("['plugins', 'Plugins', FluentCompassIcon, FluentCompassFilledIcon]"), 'the tab is the 发现 tab')
  assert.ok(discover.includes("h('h2', { className: 'bt-discover-title' }, t('Plugins'))"), 'the page title is that tab\'s label')
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
  // The list item is the list item and the row inside stays a button: a button that called itself
  // a list item stops being announced as a button (the members list draws it the same way).
  assert.ok(discover.includes("className: 'bt-discover-item', role: 'listitem'"), 'the wrapper is the list item')
  const row = discover.slice(discover.indexOf("className: 'bt-discover-row'"), discover.indexOf("className: 'bt-discover-name'"))
  assert.ok(!row.includes('role:'), `the row keeps the button role: ${row}`)
  for (const borrowed of ['bt-row-body', 'bt-row-meta', 'RowMeta', 'unread']) {
    assert.ok(!discover.includes(borrowed), `${borrowed} belongs to the conversation rows`)
  }
})
