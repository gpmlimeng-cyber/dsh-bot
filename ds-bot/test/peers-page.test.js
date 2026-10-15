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

const { peersList, peersRooms, peersModel, peersFolder, PeersPage } = await (async () => {
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

test('the same book holds the group chats, read the same way', () => {
  const rooms = [{ id: 'z', name: 'Zulu' }, { id: 'a', name: 'alpha' }, { id: 'h', name: 'Hidden', hidden: true }]
  assert.deepEqual(plain(peersRooms(rooms, '').map(room => room.id)), ['a', 'z'], 'by name, and a room the user hid from the sidebar stays hidden')
  assert.deepEqual(plain(peersRooms(rooms, 'LU').map(room => room.id)), ['z'], 'the same substring match, trimmed and case-folded')
  assert.deepEqual(plain(peersRooms(rooms, 'zzz')), [], 'no match, no rows')
  assert.deepEqual(plain(peersRooms(undefined, '')), [], 'an empty roster is not a crash')
  assert.deepEqual(rooms.map(room => room.id), ['z', 'a', 'h'], 'and nothing is reordered in place')
})

test('the page is a header row and one scroller of labelled cards', () => {
  // The tree the component draws, read as a tree: the header row is the first child of the page
  // and NOTHING of the list lives inside it -- a list inside the header would be content under the
  // search field, which is what a card crossing that seam looks like.
  const tree = render(ROSTER)
  assert.deepEqual(plain(tree.children.map(classList)), [['bt-peers-top'], ['bt-peers-list']], 'the header, then the scroller')
  const top = findAll(tree, 'bt-peers-top')[0]
  assert.deepEqual(plain(findAll(top, 'bt-peers-list')), [], 'no list inside the header row')
  assert.equal(findAll(top, 'bt-settings-top').length, 1, 'the header holds the title row')
  assert.equal(findAll(top, 'bt-side-search').length, 1, 'and the search field')
  // Three cards, one per section of contacts: the group chats, then the people.
  const cards = findAll(tree, 'bt-settings-group-card')
  assert.equal(cards.length, 2, 'one card per section')
  assert.deepEqual(plain(cards.map(card => card.children.length)), [1, 2], 'one group row, two Bot rows')
  // And one button per contact, with the chevron INSIDE it, after the body: a chevron outside the
  // button is a chevron on a line of its own, under the row it belongs to.
  const rows = findAll(tree, 'bt-peers-row')
  assert.equal(rows.length, 3, 'one row per contact')
  for (const row of rows) {
    const kids = plain(row.children.map(node => classList(node)[0] ?? '(mark)'))
    assert.deepEqual(kids, ['(mark)', 'bt-peers-body', 'bt-peers-go'], 'mark, the two lines, the chevron -- all inside the button')
  }
  assert.deepEqual(plain(findAll(tree, 'bt-peers-go').map(node => classList(node))), [['bt-peers-go'], ['bt-peers-go'], ['bt-peers-go']], 'three of them, one per row')
})

test('a label sits on the name\'s line and a value on the line below it', () => {
  // The name and the description are the two lines of one body, and the body takes what the
  // chevron leaves: a row is the avatar, the body, the chevron -- nothing floats between them.
  assert.ok(peers.includes("className: 'bt-peers-body' }"), 'the row has a two-line body')
  assert.ok(peers.includes("className: 'bt-peers-name-row' }"), 'whose first line holds the name and its labels')
  assert.ok(peers.includes("className: 'bt-peers-desc' }"), 'and whose second is the description')
  // What is a label is drawn as one, in the skin's own tag, and it belongs beside the name: the
  // role, and the Main Bot badge -- which only a Main Bot gets, read from the roster's own list.
  assert.ok(peers.includes("h('span', { className: 'bt-tag' }, bot.role)"), 'the role is a tag')
  assert.ok(peers.includes("isMainOf(roster, bot.id) ? h('span', { className: 'bt-tag' }, t('Main Bot')) : null"), 'and Main Bot is a tag, only on a Main Bot')
  assert.ok(peers.includes("import { isMainOf } from './sources.js'"), 'read from the roster\'s own rule')
  const from = peers.indexOf("className: 'bt-peers-row', 'data-bot-id'")
  const botRow = peers.slice(from, peers.indexOf("h('span', { className: 'bt-peers-go'", from))
  const firstLine = botRow.slice(0, botRow.indexOf("className: 'bt-peers-desc'"))
  const secondLine = botRow.slice(botRow.indexOf("className: 'bt-peers-desc'"))
  assert.ok(firstLine.includes("bt-tag' }, bot.role") && firstLine.includes("t('Main Bot')"), 'both tags are on the name\'s line')
  assert.ok(!secondLine.includes('bt-tag'), 'and none is left down on the description')
  // What is a value is small text on the line below, and only values: the model, and the folder.
  assert.ok(secondLine.includes("model ? h('span', { className: 'bt-peers-text' }, model) : null"), 'the model is text')
  // The folder is always said: the Bot's own last segment when it has one, and the team workspace's
  // own word from 我的 -> Bot settings when it has none -- which is the usual case, and what the
  // settings row shows, so the two read the same line.
  assert.ok(peers.includes("peersFolder(bot.workDir) ?? t('Team workspace')"), 'the folder falls back to the settings row\'s own word')
  assert.ok(secondLine.includes("h('span', { className: 'bt-peers-text' }, folder)"), 'and is always drawn')
  assert.ok(!secondLine.includes('folder ?'), 'with no gap where it has nothing of its own')
  assert.ok(code('folder-menu.js').includes("t('Team workspace')"), 'which is the word that settings row uses')
  // The model is read the way the settings page reads it -- one rule, in the leaf both reach --
  // rather than a second copy of the catalog lookup here.
  assert.ok(peers.includes("import { modelOf } from './model-ref.js'"), 'the model comes from the shared rule')
  assert.ok(code('model-menu.js').includes("export { modelOf }"), 'which the picker re-exports for its own callers')
  assert.ok(!peers.includes('bot.model.split'), 'and nothing here re-derives it')
  // A group is not one Bot's conversation, so it has no model, no folder and no role: its second
  // line says how many members it has, and its first is the name alone.
  assert.ok(peers.includes('const count = (room.members ?? []).length') && peers.includes("t('{count} members', { count })"), 'a group says its members')
  assert.ok(peers.includes("className: 'bt-peers-name-row' }, h('span', { className: 'bt-peers-name' }, room.name)"), 'and the group\'s name line carries no label')
  // Two lines of one row, so the row is taller than the one line it was: the skin says how tall.
  const sheet = code('peers-page.js')
  assert.ok(sheet.includes('.bt-peers-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}'), 'the body stacks them')
  assert.ok(sheet.includes('.bt-peers-name-row{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden}'), 'the name line keeps the name and its labels in one row, whatever the room')
  assert.ok(sheet.includes('.bt-peers-desc{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden;font-size:12px;line-height:16px;color:var(--bt-ink-3)}'), 'the description is one small second-level line')
  assert.ok(sheet.includes('.bt-peers-text{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'), 'and a value gives way rather than widening the row')
  // Neither line wraps and neither line overflows: every text in them is nowrap with its own
  // ellipsis, the labels keep their width (the skin's .bt-tag is flex:none), and the one flexible
  // item -- the name -- is the one that is cut short first.
  assert.ok(sheet.includes('.bt-peers-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'), 'the name is the item that gives way')
  // The chevron is the row's right edge: it is pushed there by its own margin, it keeps its own
  // width, and the text side gives way -- so all five rows show it at one x, and a long model or
  // folder cannot move it.
  const tags = code('styles.js').match(/\.bt-tag\{[^}]*\}/)[0]
  assert.ok(tags.includes('flex:none') && tags.includes('white-space:nowrap'), 'and the skin\'s own tag never shrinks and never wraps')
  assert.ok(sheet.includes('.bt-peers-go{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-3)}'), 'the chevron pins itself to the row\'s end')
  assert.ok(sheet.includes('.bt-peers-row{display:flex;align-items:center;gap:12px;'), 'on a row that centres it vertically')
})

test('the model and the folder are read as names, not as the raw roster', () => {
  assert.equal(peersModel({ model: 'deepseek/deepseek-chat' }, { models: [] }), 'deepseek-chat', 'the ref\'s last segment when the catalog has no entry')
  assert.equal(peersModel({ model: 'deepseek/deepseek-chat' }, { models: [{ ref: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' }] }), 'DeepSeek Chat', 'the catalog\'s own name when it is served')
  assert.equal(peersModel({ appliedModel: 'a/b' }, { models: [] }), 'b', 'and the model it last ran on counts')
  assert.equal(peersModel({}, { models: [] }), null, 'no model, no text')
  assert.equal(peersFolder('/data/user/0/home/repos/dsh-bot/'), 'dsh-bot', 'the folder keeps its last segment, trailing slashes and all')
  assert.equal(peersFolder('dsh-bot'), 'dsh-bot', 'a bare name is already one')
  assert.equal(peersFolder('/'), null, 'a path with no folder in it says nothing')
  assert.equal(peersFolder(undefined), null, 'and a Bot with no folder says nothing')
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
  assert.ok(peers.includes('peersRooms(roster.rooms, query)'), 'both rosters, by the one box')
  assert.ok(!peers.includes('fetch(') && !peers.includes('call('), 'nothing new is fetched')
})

test('a group is a row of its own kind, under its own heading', () => {
  // A group row is the same row shape as a Bot's -- wrapper, button, name, chevron -- with the
  // group's own mark and id, and without a role tag (a group has no role to carry).
  const group = peers.slice(peers.indexOf("className: 'bt-peers-row', 'data-room-id': room.id"), peers.indexOf("className: 'bt-peers-row', 'data-bot-id'"))
  assert.ok(group.includes('h(RoomAvatar, { room, roster, size: 36 })'), 'the group\'s own avatar')
  assert.ok(group.includes("h('span', { className: 'bt-peers-name' }, room.name)"), 'and its name')
  assert.ok(!group.includes('bt-tag'), 'with no role beside it')
  assert.ok(group.includes('h(ChevronRightIcon)'), 'and the same chevron')
  // Two sections, in 我的 -> 全部设置's own shape: a heading over a card, the rows inside it. The
  // list role sits on the card, so one section is one list rather than a list of everything.
  assert.ok(peers.includes("h('section', { className: 'bt-settings-group' },"), 'the section is the skin\'s group')
  assert.ok(peers.includes("h('h3', { className: 'bt-settings-group-head' }, label)"), 'with its heading')
  assert.ok(peers.includes("h('div', { className: 'bt-settings-group-card', role: 'list' }, rows)"), 'and its card carrying the list')
  assert.ok(peers.includes("section(t('Groups'), groups.map"), 'the group chats come first')
  assert.ok(peers.includes("section(t('Peers'), shown.map"), 'then the people')
  assert.ok(!peers.includes("className: 'bt-peers-list', role: 'list'"), 'the page is no longer one flat list')
  // A section with nothing in it is not drawn, and the empty line covers both: a heading over an
  // empty card reads as a fault, and a search that matches one side should not draw the other.
  assert.ok(peers.includes('groups.length > 0 ? section(') && peers.includes('shown.length > 0 ? section('), 'each section is drawn only when it has rows')
  const empty = peers.slice(peers.indexOf("className: 'bt-peers-empty'"))
  assert.ok(empty.startsWith("className: 'bt-peers-empty', role: 'status' }, t('Nothing matches')"), 'one empty line for both kinds of contact')
})

test('a row opens that chat and lands back on the conversation', () => {
  const open = peers.slice(peers.indexOf('const openChat ='), peers.indexOf('return createPortal'))
  assert.match(open, /actions\.closePeers\(\)[\s\S]*actions\.selectPanel\(null\)[\s\S]*actions\.closePanel\(\)[\s\S]*actions\.openSession\(id\)/, open)
  // The details pane is closed on the way: it is full-screen on the phone (z 96, over the bar), so a
  // settings screen left open is what the user arrives at instead of the chat. openSession keeps one.
  assert.ok(open.includes('actions.closePanel()'), 'no settings pane survives the tap')
  assert.ok(open.includes('openSession(id)'), 'and the tap ends in the conversation')
  // A group is the same kind of Session a Bot is, and the sidebar's own group row opens it through
  // the same call (RoomRow, sidebar.js): one door, whichever row was tapped.
  assert.ok(peers.includes('onClick: () => openChat(room.id)') && peers.includes('onClick: () => openChat(bot.id)'), 'both rows take the one door')
  assert.ok(sidebar.includes("'data-room-id': id, onClick: () => actions.openSession(id)"), 'which is the door the sidebar\'s group row uses')
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
