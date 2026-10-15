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

const { peersList } = await (async () => {
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
    require: (name) => {
      if (name === 'react') return react
      if (name === 'react-dom') return { createPortal: () => null }
      throw new Error(`no platform module ${name}`)
    },
  })
  return module.exports
})()

// Values out of the bundle's realm compare by content only.
const plain = (value) => JSON.parse(JSON.stringify(value))

test('the list is Bots by name, narrowed by what is typed', () => {
  const bots = [{ id: 'b', name: 'Bravo' }, { id: 'a', name: 'alpha' }, { id: 'c', name: 'Charlie' }]
  assert.deepEqual(plain(peersList(bots, '').map(bot => bot.id)), ['a', 'b', 'c'], 'by name')
  assert.deepEqual(plain(peersList(bots, 'r').map(bot => bot.id)), ['b', 'c'], 'a substring match, in either name')
  assert.deepEqual(plain(peersList(bots, '  ALPHA  ').map(bot => bot.id)), ['a'], 'trimmed and case-folded')
  assert.deepEqual(plain(peersList(bots, 'zzz')), [], 'no match, no rows')
  assert.deepEqual(plain(peersList(undefined, '')), [], 'an empty roster is not a crash')
  assert.deepEqual(bots.map(bot => bot.id), ['b', 'a', 'c'], 'and sorting does not reorder the roster in place')
})

test('a row is a Bot with its role and a chevron, not a conversation', () => {
  // The wrapper is the list item and the row inside it stays a button, the way the members
  // list does it: a button that called itself a list item stops being announced as a button.
  assert.ok(peers.includes("className: 'bt-peers-item', role: 'listitem'"), 'the list item is the wrapper')
  assert.ok(peers.includes("className: 'bt-peers-row', 'data-bot-id': bot.id"), 'the row is a button')
  const row = peers.slice(peers.indexOf("className: 'bt-peers-row'"), peers.indexOf('h(BotMark'))
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

test('a row opens that Bot\'s chat and lands back on the conversation', () => {
  const open = peers.slice(peers.indexOf('const openBot ='), peers.indexOf('return createPortal'))
  assert.match(open, /actions\.closePeers\(\)[\s\S]*actions\.selectPanel\(null\)[\s\S]*actions\.openSession\(id\)/, open)
})

test('the header\'s new button opens the real create-Bot form, not a dead end', () => {
  // The user asked for 新建 in this page's header, and the label the skin carries is the
  // header's own 「创建 Bot」: what it opens is the platform's create-Bot flow taken straight to
  // the form (new-chat.js reads mode 'create' as an initial draft, and the command palette's own
  // "Create Bot" goes to the same door).
  assert.ok(peers.includes("'aria-label': t('Create Bot')"), 'named for what it does, in the existing string')
  assert.ok(peers.includes("onClick: () => actions.openNewChat('create')"), 'and it asks for the form')
  const newChat = code('new-chat.js')
  assert.ok(newChat.includes("mode === 'create' ? { name: '', fromList: false } : null"), 'which opens the form itself, not the picker')
  assert.ok(code('palette.js').includes("title: t('Create Bot'), run: () => actions.openNewChat('create')"), 'the same door the command palette uses')
  // It sits in the title row, and the page closes on the way: openNewChat clears `peers`.
  assert.ok(peers.includes("className: 'bt-peers-head'"), 'in the title row')
  assert.ok(index.includes('openNewChat: (mode) =>') && index.includes('newChat: mode') && index.includes('peers: false'), 'and the form is never stacked on the page')
  // One control, one surface: the skin stays the shared declaration (styles.js), never a copy here.
  assert.ok(code('styles.js').includes('html[data-bt-mobile] .bt-peers-head .bt-round,'), 'the skin list carries this control')
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
  for (const out of ['alphabet', 'pinyin', 'collapsible', 'Add friend', 'section', 'group']) {
    assert.ok(!peers.includes(out), `${out} was explicitly not asked for`)
  }
  // One title and one search field, nothing else in the head.
  assert.ok(peers.includes("h('h2', { className: 'bt-peers-title' }, t('Peers'))"), 'the title')
  assert.ok(peers.includes("className: 'bt-side-search'"), 'and the search field the sidebar already styles')
})
