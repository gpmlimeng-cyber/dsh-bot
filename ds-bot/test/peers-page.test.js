// 伙伴 is a page of its own, not the conversation's sidebar: the user pointed at WeChat's
// address book, and the sidebar's list is a list of *conversations* -- preview, unread count,
// time. This pins the three things that tell the two apart (a row is a Bot, it carries a role
// label, it opens that Bot's chat) plus the wiring that keeps them apart -- and the parts of
// the address book the ask left out, so a later hand does not bolt an A-Z rail onto a list of
// six people.
//
// The filter runs for real: the module is bundled with its react externals stubbed, the way
// member-status does it, so the order and the match are the page's own code rather than a
// second copy written here. The sheet is checked as source, and comments are stripped first --
// the file's own header explains what was *not* built, and a plain substring search would read
// a comment saying "no A-Z rail" as building one.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const code = (name) => read(name).split('\n').filter(line => !line.trim().startsWith('//')).join('\n')

const peers = code('peers-page.js')
const index = code('index.js')
const nav = code('nav-bar.js')
const sidebar = code('sidebar.js')
const header = code('header.js')

const { peersList, peersMainsFirst, peersModel, peersFolder, PeersPage } = await (async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/client/peers-page.js', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', write: false,
    external: ['react', 'react-dom'],
  })
  const module = { exports: {} }
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {}, useRef: initial => ({ current: initial }), useLayoutEffect: () => {}, Fragment: 'fragment',
  }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports,
    // The page is drawn for a phone, and the portal has to hand its node back: this is a render
    // without a DOM, so the element tree IS the thing under test.
    document: { body: 'body' },
    window: { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) },
    require: (name) => {
      if (name === 'react') return react
      if (name === 'react-dom') return { createPortal: node => node }
      throw new Error(`no platform module ${name}`)
    },
  })
  return module.exports
})()

// Values out of the bundle's realm compare by content only.
const plain = (value) => JSON.parse(JSON.stringify(value))

// The page's own tree, as the component draws it: a roster in, one element out. Node values from
// the bundle's realm are read with plain(), for the same reason the lists are.
const render = (roster, ui = { peers: true }) => PeersPage({ useRoster: selector => selector(roster), useUi: selector => selector(ui), actions: {} })
const classList = (node) => String(node?.props?.className ?? '').split(' ').filter(Boolean)
const findAll = (node, className, out = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) findAll(child, className, out); return out }
  if (classList(node).includes(className)) out.push(node)
  for (const child of node.children ?? []) findAll(child, className, out)
  return out
}
const ROSTER = {
  bots: [
    { id: 'b1', name: 'Alpha', role: 'all', model: 'deepseek/deepseek-chat' },
    { id: 'b2', name: 'Main', role: 'lead', workDir: '/x/repos/dsh-bot' },
  ],
  rooms: [{ id: 'r1', name: 'Room', members: ['b1', 'b2'] }],
  mainBotIds: ['b2'], models: [],
}

test('the list is Bots by name, narrowed by what is typed', () => {
  const bots = [{ id: 'b', name: 'Bravo' }, { id: 'a', name: 'alpha' }, { id: 'c', name: 'Charlie' }]
  assert.deepEqual(plain(peersList(bots, '').map(bot => bot.id)), ['a', 'b', 'c'], 'by name')
  assert.deepEqual(plain(peersList(bots, 'r').map(bot => bot.id)), ['b', 'c'], 'a substring match, in either name')
  assert.deepEqual(plain(peersList(bots, '  ALPHA  ').map(bot => bot.id)), ['a'], 'trimmed and case-folded')
  assert.deepEqual(plain(peersList(bots, 'zzz')), [], 'no match, no rows')
  assert.deepEqual(plain(peersList(undefined, '')), [], 'an empty roster is not a crash')
  assert.deepEqual(bots.map(bot => bot.id), ['b', 'a', 'c'], 'and sorting does not reorder the roster in place')
})

test('the page is a header row and one scroller of labelled cards', () => {
  // The tree the component draws, read as a tree: the header row is the first child of the page and
  // NOTHING of the list lives inside it -- a list inside the header would be content under the search
  // field, which is what a card crossing that seam looks like.
  const tree = render(ROSTER)
  assert.deepEqual(plain(tree.children.map(classList)), [['bt-peers-top'], ['bt-peers-list']], 'the header, then the scroller')
  const top = findAll(tree, 'bt-peers-top')[0]
  assert.deepEqual(plain(findAll(top, 'bt-peers-list')), [], 'no list inside the header row')
  assert.equal(findAll(top, 'bt-settings-top').length, 1, 'the header holds the title row')
  assert.equal(findAll(top, 'bt-side-search').length, 1, 'and the search field')
  // Two cards: the group chats' door, then the people.
  const cards = findAll(tree, 'bt-settings-group-card')
  assert.equal(cards.length, 2, 'one card per section')
  assert.deepEqual(plain(cards.map(card => card.children.length)), [1, 2], 'the door, then each Bot')
  // The chevron is INSIDE the row, after the body: outside it, it is a chevron on a line of its own,
  // under the row it belongs to. The door's own mark is the icon its settings row carries.
  const rows = findAll(tree, 'bt-peers-row')
  assert.equal(rows.length, 3, 'the door and one row per Bot')
  const kidsOf = (node) => plain(node.children.filter(child => child !== null && child !== undefined).map(child => classList(child)[0] ?? '(mark)'))
  assert.deepEqual(rows.map(kidsOf), [
    ['bt-peers-icon', 'bt-peers-body', 'bt-row-count'],
    ['(mark)', 'bt-peers-body'],
    ['(mark)', 'bt-peers-body'],
  ], 'the door wears the section icon and its count, a Bot its own mark')
  // The row's own controls are its SIBLINGS -- a button cannot hold a button -- and the item lays them
  // out on one line: the chevron on every row, and the Main Bot switch in front of it where a Bot has
  // one. A sibling inside a block used to wrap onto a line of its own (the stray chevron the user
  // reported); the item's flex row is what keeps them beside the text.
  const items = findAll(tree, 'bt-peers-item')
  assert.equal(items.length, 3, 'one item per row')
  const childName = (node) => classList(node)[0] ?? node?.props?.label ?? '(mark)'
  assert.deepEqual(plain(items.map(item => item.children.filter(Boolean).map(childName))), [
    ['bt-peers-row', 'bt-peers-go'],
    ['bt-peers-row', 'bt-peers-main', 'bt-peers-go'],
    ['bt-peers-row', 'bt-peers-main', 'bt-peers-go'],
  ], 'the door has a chevron, a Bot has its Main Bot action and a chevron')
  // One action per Bot row: pressed on the Main Bot, plain on the other, and out of reach for the only
  // Main Bot there is (the host refuses to leave the team with none).
  const mains = items.flatMap(item => item.children).filter(node => classList(node).includes('bt-peers-main'))
  assert.equal(mains.length, 2, 'one per Bot row, and none on the door')
  // plain() is JSON, so an attribute that is not set reads as null: unpressed is an absence.
  assert.deepEqual(plain(mains.map(node => node.props['aria-pressed'])), ['true', null], 'pressed on the Main Bot, unpressed on the other')
  assert.deepEqual(plain(mains.map(node => node.props.disabled)), [true, false], 'and the only Main Bot cannot hand the role away from itself')
  assert.ok(mains.every(node => node.children.some(child => typeof child === 'object' && child !== null)), 'each carries the star the badge wears')
  // A phone's control: 44px of finger, a state that is drawn as well as announced, and an answer to the
  // tap itself rather than to a hover.
  const sheet = code('peers-page.js')
  assert.ok(sheet.includes('.bt-peers-main{flex:none;width:44px;height:44px;'), 'the target is finger-sized')
  assert.ok(sheet.includes('.bt-peers-main[aria-pressed=true]{background:var(--bt-active);color:var(--bt-star)}'), 'and shows its state with the star the badge uses')
  assert.ok(sheet.includes('.bt-peers-main:active{background:var(--bt-active)}'), 'answering the tap at once')
  // Nothing here animates on its own: every row wears the skin's own mark, and the skin already
  // silences marks under prefers-reduced-motion (which is what this device asks for).
  assert.ok(code('styles.js').includes('@media (prefers-reduced-motion:reduce){.bt-mark *{animation:none!important;transition:none!important}}'), 'the skin silences the marks')
  assert.ok(peers.includes('h(BotMark, { bot, size: 36 })'), 'and every row wears that same mark')
  assert.ok(peers.includes('h(MotionSection, { roster, actions, run })'), 'the animation level is offered once, as the Bots page draws it')
  // The door names the page it opens, and that page is 我的 -> 群聊: the key is the settings page's own.
  const door = rows.find(row => row.props['data-page'] === 'groups')
  assert.ok(door, 'the door carries the page it opens')
  assert.ok(code('settings.js').includes("['groups', 'Group chats']"), 'which is the page key 我的 -> 群聊 uses')
  assert.equal(findAll(door, 'bt-peers-desc').length, 0, 'and the door says one thing, so it has no second line')
  // The count is the page's own number, in the skin's own badge, before the chevron.
  // The face it is handed: the cluster drawing, with the roster's own Bots and the row's own size.
  // (The stub renderer stops at a component, so what is checked here is the wiring; the drawing
  // itself is RoomAvatar's, already in use by every group chat.)
  const face = findAll(door, 'bt-peers-icon')[0].children[0]
  assert.equal(typeof face.type, 'function', 'the door\'s face is that component')
  assert.deepEqual(plain(face.props.bots.map(bot => bot.id)), ['b1', 'b2'], 'handed the roster\'s first Bots')
  assert.equal(face.props.size, 36, 'in the row\'s own box')
  const count = findAll(door, 'bt-row-count')
  assert.equal(count.length, 1, 'the door carries the group chats\' count')
  assert.equal(String(count[0].children[0]), String(ROSTER.rooms.length), 'which is the number that page lists')
  assert.ok(peers.includes("h('span', { className: 'bt-row-count', title: t('Group chats · {count}', { count: rooms }) }, String(rooms))"), 'named with that page\'s own words')
  assert.ok(peers.includes('const rooms = (roster.rooms ?? []).length'), 'counted the way that page counts')
  // What a description line is made of, row by row: a Bot with a model has two values and says so
  // with the one mark between them, and a Bot without a model has one value and therefore no mark --
  // a leading separator is not a separator.
  const partOf = (child) => classList(child)[0] ?? (typeof child === 'string' ? child : '(node)')
  const parts = (node) => plain(node.children.filter(child => child !== null && child !== undefined).map(partOf))
  assert.deepEqual(findAll(tree, 'bt-peers-desc').map(parts), [
    ['bt-peers-text'],
    ['bt-peers-text', 'bt-peers-sep', 'bt-peers-text'],
  ], 'the mark appears between two values and nowhere else')
  // ...and the rows are drawn with the Main Bot first, which is why the order above is that way.
  const botRows = findAll(tree, 'bt-peers-row').filter(row => row.props['data-bot-id'])
  assert.deepEqual(plain(botRows.map(row => row.props['data-bot-id'])), ['b2', 'b1'], 'the Main Bot leads the list')
})

test('a label sits on the name\'s line and a value on the line below it', () => {
  // The name and the description are the two lines of one body, and the body takes what the
  // chevron leaves: a row is the mark, the body, the chevron -- nothing floats between them.
  assert.ok(peers.includes("className: 'bt-peers-body' }"), 'the row has a two-line body')
  assert.ok(peers.includes("className: 'bt-peers-name-row' }"), 'whose first line holds the name and its labels')
  assert.ok(peers.includes("className: 'bt-peers-desc' }"), 'and whose second is the description')
  // What is a label is drawn as one, in the skin's own tag, and it belongs beside the name: the role,
  // and the Main Bot badge -- which only a Main Bot gets, read from the roster's own list.
  assert.ok(peers.includes("h('span', { className: 'bt-tag' }, bot.role)"), 'the role is a tag')
  assert.ok(peers.includes("isMainOf(roster, bot.id) ? h('span', { className: 'bt-tag' }, t('Main Bot')) : null"), 'and Main Bot is a tag, only on a Main Bot')
  assert.ok(peers.includes("import { isMainOf } from './sources.js'"), 'read from the roster\'s own rule')
  const from = peers.indexOf("className: 'bt-peers-row', 'data-bot-id'")
  const botRow = peers.slice(from, peers.indexOf("h('span', { className: 'bt-peers-go'", from))
  const firstLine = botRow.slice(0, botRow.indexOf("className: 'bt-peers-desc'"))
  const secondLine = botRow.slice(botRow.indexOf("className: 'bt-peers-desc'"))
  assert.ok(firstLine.includes("bt-tag' }, bot.role") && firstLine.includes("t('Main Bot')"), 'both tags are on the name\'s line')
  assert.ok(!secondLine.includes('bt-tag'), 'and none is left down on the description')
  assert.ok(secondLine.includes("model ? h('span', { className: 'bt-peers-text' }, model) : null"), 'the model is text')
  assert.ok(secondLine.includes("h('span', { className: 'bt-peers-text' }, folder)"), 'and the folder is always drawn')
  assert.ok(!secondLine.includes('folder ?'), 'with no gap where it has nothing of its own')
  // The folder falls back to the settings row's own word, and the model to that page's own rule; the
  // one mark between two values keeps its width, so the values are what give way.
  assert.ok(peers.includes("peersFolder(bot.workDir) ?? t('Team workspace')"), 'the folder falls back to the settings row\'s own word')
  assert.ok(code('folder-menu.js').includes("t('Team workspace')"), 'which is that row\'s word')
  assert.ok(peers.includes("import { modelOf } from './model-ref.js'"), 'the model comes from the shared rule')
  assert.ok(code('model-menu.js').includes("export { modelOf }"), 'which the picker re-exports for its own callers')
  assert.ok(!peers.includes('bot.model.split'), 'and nothing here re-derives it')
  assert.ok(peers.includes("h('span', { className: 'bt-peers-sep', 'aria-hidden': true }, '·')"), 'the two values are separated by one fixed mark')
  const sheet = code('peers-page.js')
  assert.ok(sheet.includes('.bt-peers-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}'), 'the body stacks them')
  assert.ok(sheet.includes('.bt-peers-name-row{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden}'), 'the name line keeps the name and its labels in one row, whatever the room')
  assert.ok(sheet.includes('.bt-peers-desc{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden;font-size:12px;line-height:16px;color:var(--bt-ink-3)}'), 'the description is one small second-level line')
  assert.ok(sheet.includes('.bt-peers-text{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'), 'and a value gives way rather than widening the row')
  assert.ok(sheet.includes('.bt-peers-sep{flex:none}'), 'and the mark between them never shrinks, so it cannot be squeezed out')
  assert.ok(sheet.includes('.bt-peers-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'), 'the name is the item that gives way')
  const tags = code('styles.js').match(/\.bt-tag\{[^}]*\}/)[0]
  assert.ok(tags.includes('flex:none') && tags.includes('white-space:nowrap'), 'and the skin\'s own tag never shrinks and never wraps')
  // The chevron is the row's right edge: it is pushed there by its own margin, it keeps its own
  // width, and the text side gives way -- so every row shows it at one x, and a long model or folder
  // cannot move it.
  assert.ok(sheet.includes('.bt-peers-go{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-3)}'), 'the chevron pins itself to the row\'s end')
  assert.ok(sheet.includes('.bt-peers-row{display:flex;align-items:center;gap:12px;'), 'on a row that centres it vertically')
})

test('the Main Bots are listed first, and nobody else moves', () => {
  // A stable partition: the Main Bots (roster.mainBotIds, the skin's own rule) take the front in the
  // order they came in, and every other Bot keeps its place after them -- the roster is never reordered.
  const bots = [{ id: 'a' }, { id: 'm1' }, { id: 'b' }, { id: 'm2' }, { id: 'c' }]
  assert.deepEqual(plain(peersMainsFirst(bots, { mainBotIds: ['m2'] }).map(bot => bot.id)), ['m2', 'a', 'm1', 'b', 'c'], 'the Main Bot leads, the rest keep their order')
  assert.deepEqual(plain(peersMainsFirst(bots, { mainBotIds: ['a', 'm1', 'm2'] }).map(bot => bot.id)), ['a', 'm1', 'm2', 'b', 'c'], 'several Main Bots keep the order they are listed in')
  assert.deepEqual(plain(peersMainsFirst(bots, { mainBotIds: [] }).map(bot => bot.id)), ['a', 'm1', 'b', 'm2', 'c'], 'and with no Main Bot the list is left as it was')
  assert.deepEqual(bots.map(bot => bot.id), ['a', 'm1', 'b', 'm2', 'c'], 'the roster itself is untouched')
})

test('a row is a Bot with its role and a chevron, not a conversation', () => {
  // The wrapper is the list item and the row inside it stays a button, the way the members
  // list does it: a button that called itself a list item stops being announced as a button.
  assert.ok(peers.includes("className: 'bt-peers-item', role: 'listitem'"), 'the list item is the wrapper')
  assert.ok(peers.includes("className: 'bt-peers-row', 'data-bot-id': bot.id"), 'the row is a button')
  const row = peers.slice(peers.indexOf("className: 'bt-peers-row', 'data-bot-id'"), peers.indexOf('h(BotMark'))
  assert.ok(!row.includes('role:'), `the button keeps the button role: ${row}`)
  assert.ok(peers.includes('h(BotMark, { bot, size: 36 })'), 'its avatar is the Bot\'s mark')
  assert.ok(peers.includes("h('span', { className: 'bt-peers-name' }, bot.name)"), 'its name')
  assert.ok(peers.includes("h('span', { className: 'bt-tag' }, bot.role)"), 'its role, in the skin\'s existing tag')
  assert.ok(peers.includes('h(ChevronRightIcon)'), 'and the chevron that says it opens something')
  // Nothing of the sidebar's row travels with it: no preview, no unread count, no time.
  for (const borrowed of ['bt-row-body', 'bt-row-meta', 'RowMeta', 'unread']) {
    assert.ok(!peers.includes(borrowed), `${borrowed} belongs to the conversation rows`)
  }
  // The data is the roster the rest of the skin reads, and the filter is the only transform.
  assert.ok(peers.includes('peersList(roster.bots, query)'), 'the roster, filtered')
  assert.ok(!peers.includes('fetch(') && !peers.includes('call('), 'nothing new is fetched')
})

test('the group chats are one door, not a second copy of their page', () => {
  // The user asked for 群聊 to lead to the group-chat list page (我的 -> 群聊, settings.js) rather than
  // to list the groups here: this page opens that page and copies none of it -- no group rows, no
  // 新建群聊 button, no member counts.
  assert.ok(peers.includes("section(t('Group chats'), ["), 'one section, holding one row')
  assert.ok(peers.includes("className: 'bt-peers-row', 'data-page': 'groups', onClick: () => openPage('groups')"), 'the door names the page it opens and asks for it')
  // Its face is the team's: the roster's first four Bots in the same cluster a group chat wears --
  // one drawing, asked for by a list of Bots instead of by a room (mark.js, RoomAvatar).
  assert.ok(peers.includes("h('span', { className: 'bt-peers-icon', 'aria-hidden': true }, h(RoomAvatar, { bots: team, roster, size: 36 }))"), 'the door wears the team cluster')
  assert.ok(peers.includes('const team = (roster.bots ?? []).slice(0, 4)'), 'built from the roster\'s first four Bots')
  assert.ok(code('mark.js').includes('export function RoomAvatar({ room, bots, roster, size = 36 })'), 'through the one cluster drawing, which takes either')
  assert.ok(peers.includes("section(t('Peers'), shown.map"), 'then the people')
  for (const gone of ['data-room-id', '{count} members', 'room.members', 'peersRooms']) {
    assert.ok(!peers.includes(gone), `${gone} was the list this page no longer draws`)
  }
  // The page's own list still holds the shape 我的 -> 全部设置 draws: a section, a heading, a card.
  assert.ok(peers.includes("h('section', { className: 'bt-settings-group' },"), 'the section is the skin\'s group')
  assert.ok(peers.includes("h('h3', { className: 'bt-settings-group-head' }, label)"), 'with its heading')
  assert.ok(peers.includes("h('div', { className: 'bt-settings-group-card', role: 'list' }, rows)"), 'and its card carrying the list')
  assert.ok(!peers.includes("className: 'bt-peers-list', role: 'list'"), 'the page is not one flat list')
  assert.ok(peers.includes('shown.length > 0 ? section('), 'the people are drawn only when the search leaves someone')
  const empty = peers.slice(peers.indexOf("className: 'bt-peers-empty'"))
  assert.ok(empty.startsWith("className: 'bt-peers-empty', role: 'status' }, t('Nothing matches')"), 'and one empty line covers a search that matches nobody')
})

test('a Bot\'s row opens that Bot\'s page, the 群聊 door opens the group chats\'', () => {
  // Both go through one action -- openPeerPage -- because both are Settings pages opened from this
  // list, and neither is redrawn here.
  const door = peers.slice(peers.indexOf('const openPage ='), peers.indexOf('return createPortal'))
  assert.ok(door.includes('actions.openPeerPage(page, id)'), 'one door for both')
  assert.ok(peers.includes("onClick: () => openPage('bots', bot.id)"), 'a Bot\'s row asks for that Bot\'s page')
  assert.ok(peers.includes("onClick: () => openPage('groups')"), 'and the 群聊 row asks for the group chats\' list -- 我的 -> 群聊, which is the page the user pointed at')
  // That action is the Bot\'s settings page (the same page 编辑 Bot asks for) or the groups list,
  // drawn as a page of the bar\'s own flow, and it remembers that closing it lands back here.
  assert.match(index, /openPeerPage: \(page, id = null\) => \{[\s\S]*settings: \{ page, id, tab: true, from: 'peers' \}/, 'the page, marked as one, with the way back')
  assert.ok(index.includes("if (state.settings.from === 'peers')") && index.includes('settings: null, peers: true'), 'which closeSettings reads')
  assert.ok(index.includes("from: state.settings?.from ?? null"), 'and every step inside keeps it, so a page opened after a drill-in still leaves onto this list')
  // The phone's own back arrow follows that record too: on a page with nothing above it (the group
  // chats' list) it leaves Settings the way it came in, and a page reached from Settings' own list
  // still shows that list.
  assert.ok(code('settings.js').includes('if (back !== null) { actions.openSettings(shown); return }'), 'the arrow goes up a level when there is one')
  assert.ok(code('settings.js').includes('if (from !== null) close()'), 'and otherwise leaves by the door it came in through')
  assert.ok(code('settings.js').includes('else setScreen(\'list\')'), 'while a page with no door shows the list it came from')
  assert.ok(code('overlays.js').includes('from: settings.from ?? null'), 'which the layer is handed')
  // The arrow's name is that same answer: a button that returns to this list must not be named for
  // Settings' own list (the mismatch 快速执行 found on the device).
  assert.ok(code('settings.js').includes("const BACK_TO = { peers: 'Back to Peers' }"), 'the door has its own name for the arrow')
  assert.ok(code('settings.js').includes("t(BACK_TO[from] ?? 'Back to all settings')"), 'used where the fallback was, and only there')
  assert.ok(code('i18n.js').includes("'Back to all settings': '返回全部设置'"), 'named the way the other two are ("back to X")')
  assert.ok(code('i18n.js').includes("'Back to Peers': '返回伙伴'"), 'with its copy')
  assert.ok(peers.includes("'data-screen'") === false, 'neither page is redrawn here: the key is all this page knows')
  // The group chats' page is Settings' own, and its title bar's right-hand control is that page's
  // action: the two buttons that both left the page (left = one step back, right = close Settings)
  // became one that stays and does the work -- and the row the wide dialog uses is kept for it,
  // because that dialog has no bar to raise the form from.
  const settingsPage = code('settings.js')
  assert.ok(settingsPage.includes("shown === 'groups' && !room ? h('button', {"), 'the bar knows this page')
  assert.ok(settingsPage.includes("'aria-label': t('Create group chat'), title: roster.bots.length < 2 ? t('A group chat needs at least two Bots') : t('Create group chat')"), 'and offers the page\'s own action, guarded the way that row was')
  assert.ok(settingsPage.includes('disabled: roster.bots.length < 2') && settingsPage.includes('onClick: () => setCreatingGroup(true)'), 'which raises the same form')
  assert.ok(settingsPage.includes(": mobile ? null : h('div', { key: 'new', className: 'bt-actions' },"), 'the list\'s row is the wide dialog\'s own')
  assert.ok(settingsPage.includes('h(GroupsPage, { roster, actions, run, creating: creatingGroup, setCreating: setCreatingGroup, mobile })'), 'and one form answers both doors')
  assert.ok(settingsPage.includes('useEffect(() => { setCreatingGroup(false) }, [shown])'), 'leaving the page puts the form away')
  assert.ok(code('styles.js').includes('.bt-settings-top>.bt-icon-btn:disabled{opacity:.4;cursor:default}'), 'a control the page cannot use yet says so')
})

test('the header\'s new button is the drawer\'s own entry, not a second door', () => {
  // The user asked this page's 新建 to be the drawer's 新建: the same label the skin carries there,
  // and the same action, which opens the picker -- new-chat.js reads mode 'new' as the list of
  // create-Bot / create-group / pick-a-chat rows -- rather than taking the create-Bot form straight
  // (which is what mode 'create' does, and what this button used to ask for).
  assert.ok(peers.includes("'aria-label': t('New…')"), 'the drawer\'s own label')
  assert.ok(peers.includes("onClick: () => actions.openNewChat('new')"), 'and the drawer\'s own door')
  for (const drawer of ['sidebar.js', 'header.js']) {
    const source = code(drawer)
    assert.ok(source.includes("t('New…')") && source.includes("actions.openNewChat('new')"), `${drawer} opens the same one`)
  }
  const newChat = code('new-chat.js')
  assert.ok(newChat.includes("mode === 'create' ? { name: '', fromList: false } : null"), 'which the form is still in the mode that asks for it')
  // It sits in 我的's own title bar, and the page closes on the way: openNewChat clears `peers`.
  assert.ok(peers.includes("className: 'bt-settings-top' }"), 'in the title row')
  assert.ok(index.includes('openNewChat: (mode) =>') && index.includes('newChat: mode') && index.includes('peers: false'), 'and nothing is stacked on the page')
  // One control, one surface: the skin stays the shared declaration (styles.js), never a copy here.
  assert.ok(code('styles.js').includes('html[data-bt-mobile] .bt-peers-new,'), 'the skin list carries this control')
  assert.ok(!peers.includes('box-shadow:0 2px 8px -1px rgba(0,0,0,.06)'), 'and this sheet does not restate the surface')
})

test('the page is a surface of its own, with its own state', () => {
  assert.ok(index.includes('peers: false'), 'a state of its own, not the drawer\'s')
  assert.ok(index.includes('openPeers: () =>'), 'opened by its own action')
  assert.ok(index.includes('closePeers: () =>'), 'and closed by one')
  assert.ok(index.includes("shadow('shell.overlay', { id: 'bot-peers', order: 44, inject: face }, PeersPage)"), 'drawn on an overlay entry of its own')
  assert.ok(index.includes("installCompiledStyles(PEERS_CSS, 'peers')"), 'with its own sheet')
  assert.ok(nav.includes(": ui.peers ? 'peers'"), 'the tab lights while it is up')
  assert.ok(nav.includes('actions.openPeers()'), 'and the tab opens it')
  // The floating bar carries the conversation's title, so it steps aside for this page.
  assert.ok(peers.includes('body:has(.bt-peers) .bt-mobile-bar{display:none}'), 'the bar goes while the page is up')
  // One surface at a time: opening the page closes the drawer, and the drawer closes the page.
  assert.ok(index.includes('{ ...state, peers: true, mobileNav: false'), 'the page closes the drawer')
  assert.ok(index.includes('{ ...state, mobileNav: true, peers: false'), 'and the drawer closes the page')
  // Every rule is a phone rule; the only thing allowed after that gate is the keyboard flag.
  const rules = read('peers-page.js').split('\n').filter(line => line.startsWith('html['))
  assert.ok(rules.length >= 8, `expected the page's rules, found ${rules.length}`)
  for (const line of rules) {
    const after = line.slice('html[data-bt-mobile]'.length)
    assert.ok(after.startsWith(' ') || after.startsWith('{') || after.startsWith('[data-bt-keyboard]'), line)
  }
  // The keyboard takes the bar's reservation of the floor here too, or the list would keep a
  // dead band under the search box -- the same defect the user reported under the composer.
  assert.ok(rules.some(line => line.includes('[data-bt-keyboard] .bt-peers{padding-bottom:12px}')), 'the room goes back while the keyboard is up')
})

test('the conversation\'s own sidebar and hamburger are left alone', () => {
  // The hamburger still opens the conversation drawer: that state is ui.mobileNav, untouched.
  assert.ok(header.includes('onToggle: () => actions.toggleMobileNav()'), 'the hamburger still toggles the drawer')
  assert.ok(sidebar.includes('const mobileOpen = useUi(value => value.mobileNav === true)'), 'which still renders the sidebar list')
  assert.ok(nav.includes('actions.closeMobileNav()'), 'the bar still closes that drawer on its way past')
  assert.ok(!sidebar.includes('peers'), 'and the sidebar knows nothing about this page')
})

test('the parts of the address book the ask left out stay out', () => {
  // The sections the user did ask for (group chats, then people) are read in the test above; what
  // stays out is the rest of WeChat's address book.
  for (const out of ['alphabet', 'pinyin', 'collapsible', 'Add friend']) {
    assert.ok(!peers.includes(out), `${out} was explicitly not asked for`)
  }
  // One title and one search field, nothing else in the head -- and the title is the settings
  // page's own bar, whose single rule centres whatever it holds at 16/24 (styles.js).
  assert.ok(peers.includes("className: 'bt-settings-top' }"), 'the title, in the settings page\'s own bar')
  assert.ok(peers.includes("h('h2', null, t('Peers'))"), 'which holds the name and nothing of its own')
  assert.ok(!peers.includes('bt-peers-title') && !peers.includes('bt-peers-head'), 'with no title row of its own any more')
  assert.ok(peers.includes("className: 'bt-side-search'"), 'and the search field the sidebar already styles')
})
