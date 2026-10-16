// Component-level tests for the NeedsYou entry (src/client/attention.js and its seat
// in header.js): real React against jsdom, the way the browser mounts it. The pure
// collection logic is covered separately below, over the esbuild bundle.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { DICTIONARY } from '../src/client/i18n.js'

// jsdom comes from the harness packages the tests load (dev/harness or DSH_HARNESS), and react may
// come from the same place: dev/harness carries it for exactly this test on machines with no
// deepseek-harness checkout. On a checkout machine react comes from the checkout beside ds-bot
// instead, whose pnpm store pins it -- requiring from the react package itself resolves its own
// react-dom sibling through the store's links, which is why that path is preferred when it exists.
// The sibling is only used, never created: harness-resolve.mjs treats a directory named
// deepseek-harness in an ancestor as the harness anchor, so making one would move every test's anchor.
const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const harnessRequire = createRequire(join(process.env.DSH_HARNESS ?? join(PLUGIN, 'dev', 'harness'), 'package.json'))
const { JSDOM } = harnessRequire('jsdom')
const sibling = join(PLUGIN, '..', 'deepseek-harness', 'node_modules', '.pnpm', 'react@18.3.1', 'node_modules', 'react', 'package.json')
const reactRequire = existsSync(sibling) ? createRequire(sibling) : harnessRequire
const React = reactRequire('react')
const reactDom = reactRequire('react-dom/client')

// pretendToBeVisual supplies requestAnimationFrame, which the header's activity row uses.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="portal"></div></body></html>', { url: 'https://ds-bot.test/', pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.getComputedStyle = dom.window.getComputedStyle
for (const key of ['HTMLElement', 'Element', 'Node', 'SVGElement']) globalThis[key] = dom.window[key]

// The sources are the same small observables the client uses, so the selectors run
// for real rather than against canned snapshots.
function source(initial) {
  let value = initial
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set(next) { value = typeof next === 'function' ? next(value) : next; for (const listener of [...listeners]) listener() },
  }
}

const roster = source({
  byId: { s1: { id: 's1', name: 'Chief', sessionId: 's1' }, s2: { id: 's2', name: 'Writer', sessionId: 's2' } },
  roomsById: { r1: { id: 'r1', name: 'Ops' } },
  questions: {},
  secretRequests: {},
})
const work = source({ approvals: [] })
const ui = source({ unread: {} })
const opened = []
const actions = { openSession: id => opened.push(id) }

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/attention.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom'],
})
// The real header, so the test exercises the guard where it lives.
const headerBundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/header.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
// The bundle gets the real react and react-dom: the vm boundary must not fork the
// module identity, or the hooks stop matching the renderer's.
runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports,
  require: name => {
    if (name === 'react') return React
    if (name === 'react-dom') return reactDom
    throw new Error(`no platform module ${name}`)
  },
})
const { NeedsYou, needsYou } = module.exports
const headerModule = { exports: {} }
runInNewContext(headerBundle.outputFiles[0].text, {
  module: headerModule, exports: headerModule.exports,
  // The header's effects touch the DOM timers and observers directly, so the sandbox
  // needs the same constructors the browser gives the page.
  window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math, localStorage: dom.window.localStorage,
  navigator: dom.window.navigator, getComputedStyle: dom.window.getComputedStyle,
  require: name => {
    // The header's chain touches the primitives package only through cells.js's
    // MarkdownText, which this surface never draws.
    if (name === 'react') return React
    if (name === 'react-dom') return reactDom
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText: () => null }
    throw new Error(`no platform module ${name}`)
  },
})
const { HeaderPill } = headerModule.exports

const seat = (overrides = {}) => ({ useRoster: pick => pick(roster.getSnapshot()), useWork: pick => pick(work.getSnapshot()), useUi: pick => pick(ui.getSnapshot()), actions, ...overrides })

async function renderSeat(props) {
  // A fresh container per mount: one root per test, so no state leaks between them.
  const container = document.createElement('div')
  document.body.append(container)
  const root = reactDom.createRoot(container)
  root.render(React.createElement(NeedsYou, props))
  await new Promise(resolve => setTimeout(resolve, 30))
  return { container, root, cleanup: () => { root.unmount(); container.remove() } }
}

// The header needs every hook the seat receives; the sources double for all of them,
// so a withheld useWork is the only hole in the surface.
const sessions = source({ byId: {} })
const sessionStatus = source(new Map())
const activity = source({})
const memoryNews = source({})
const turnClock = source({})
const live = source({})
const calls = []
const pillActions = { beginVisit: () => {}, endVisit: () => {}, openSession: id => calls.push(id), clearLive: () => {} }

async function renderPill({ work } = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const props = {
    sessionId: 's1',
    useRoster: pick => pick(roster.getSnapshot()),
    useSessions: pick => pick(sessions.getSnapshot()),
    useSessionStatus: pick => pick(sessionStatus.getSnapshot()),
    useSession: pick => pick(sessionStatus.getSnapshot()),
    useActivity: pick => pick(activity.getSnapshot()),
    useMemoryNews: pick => pick(memoryNews.getSnapshot()),
    useTurnClock: pick => pick(turnClock.getSnapshot()),
    useUi: pick => pick(ui.getSnapshot()),
    useLive: pick => pick(live.getSnapshot()),
    ...(work === undefined ? {} : { useWork: pick => pick(work.getSnapshot()) }),
    actions: pillActions,
  }
  const errors = []
  const onError = event => errors.push(`uncaught: ${event.error?.message ?? event.message}`.slice(0, 300))
  window.addEventListener('error', onError)
  const root = reactDom.createRoot(container)
  try { root.render(React.createElement(HeaderPill, props)) } catch (error) { errors.push(`render threw: ${error}`) }
  await new Promise(resolve => setTimeout(resolve, 30))
  window.removeEventListener('error', onError)
  if (errors.length > 0 && container.children.length === 0) throw new Error(`HeaderPill mount failed: ${errors.join(' || ')}`)
  return { container, cleanup: () => { root.unmount(); container.remove() } }
}

const deep = value => JSON.parse(JSON.stringify(value))

test('the button renders with the count while items wait', async () => {
  roster.set(state => ({ ...state, questions: { s2: { question: '哪种格式？' } } }))
  work.set({ approvals: [{ sessionId: 'r1', botId: 's1', tool: 'pwsh' }] })
  const { container, cleanup } = await renderSeat(seat())
  const button = container.querySelector('.bt-attention')
  assert.ok(button, 'the button renders')
  assert.equal(button.getAttribute('aria-label'), 'Needs you')
  assert.equal(button.textContent.includes('2'), true, 'the count is 2')
  // The popover rows live in a portal and only after the button opens; closed, there are none.
  assert.equal(document.querySelectorAll('.bt-attention-row').length, 0)
  cleanup()
  roster.set(state => ({ ...state, questions: {} }))
  work.set({ approvals: [] })
})

test('N = 0 renders null: no button, no empty shell', async () => {
  const { container, cleanup } = await renderSeat(seat())
  assert.equal(container.querySelector('.bt-attention'), null)
  assert.equal(container.textContent, '')
  cleanup()
})

test('a missing useWork is held by the real HeaderPill guard, not a TypeError', async () => {
  // The guard is header.js's own `useWork && useUi ? h(NeedsYou, …) : null`; the test
  // mounts the real HeaderPill (the bundled header.js) with useWork withheld and
  // asserts the pill still renders whole and nothing throws. With the guard mutated
  // away this mount throws `useWork is not a function` and this test goes red.
  const { container, cleanup } = await renderPill({ work: undefined })
  assert.ok(container.querySelector('.bt-pill'), 'the pill renders without useWork')
  assert.equal(container.querySelector('.bt-attention'), null, 'NeedsYou is not mounted')
  cleanup()
})

test('the count caps at 9+', async () => {
  const questions = {}
  for (let index = 0; index < 12; index += 1) questions[`sq${index}`] = { question: `Q${index}` }
  roster.set(state => ({ ...state, questions }))
  const { container, cleanup } = await renderSeat(seat())
  const button = container.querySelector('.bt-attention')
  assert.ok(button)
  assert.equal(button.textContent.includes('9+'), true, '12 items show 9+')
  assert.equal(button.textContent.includes('12'), false)
  cleanup()
  roster.set(state => ({ ...state, questions: {} }))
})

test('every item name the popover shows is in the Chinese dictionary', () => {
  const zh = DICTIONARY.zh
  for (const key of ['Needs you', 'Nothing needs your attention', 'Waiting for a key', 'Someone replied',
    '{tool} waits for approval', 'The key {name} is waiting']) {
    assert.equal(typeof zh[key], 'string', key)
  }
})

test('needsYou collects all four kinds, most urgent first', () => {
  const snapshot = {
    byId: { s1: { id: 's1', name: 'Chief', sessionId: 's1' }, s2: { id: 's2', name: 'Writer', sessionId: 's2' } },
    roomsById: { r1: { id: 'r1', name: 'Ops' } },
  }
  const items = needsYou(
    { questions: { s2: { question: '用哪种格式？' } }, secretRequests: { s1: [{ status: 'pending', name: 'GITHUB_TOKEN', sessionId: 's1' }, { status: 'canceled', name: 'OLD', sessionId: 's1' }] } },
    { approvals: [{ sessionId: 'r1', botId: 's1', tool: 'pwsh' }] },
    { s1: true, s2: false, ghost: true },
    snapshot)
  assert.deepEqual(deep(items.map(item => [item.kind, item.where])), [
    ['question', 'Writer'],
    ['approval', 'Ops'],
    ['secret', 'Chief'],
    ['unread', 'Chief'],
  ])
  // The canceled key request is not an item; an unread id that names no known
  // conversation is not one either. A row opens the conversation it belongs to.
  assert.equal(items.filter(item => item.kind === 'secret').length, 1)
  assert.equal(items.some(item => item.where === 'ghost'), false)
  assert.deepEqual(deep(items.map(item => item.open)), ['s2', 'r1', 's1', 's1'])
})

test('needsYou is empty when nothing waits', () => {
  assert.equal(needsYou({}, {}, {}, { byId: {}, roomsById: {} }).length, 0)
  assert.equal(needsYou({ questions: {}, secretRequests: { s1: [] } }, { approvals: [] }, { s1: false }, { byId: {}, roomsById: {} }).length, 0)
})

// A card a Bot asks for in a group chat sits in the room as well: one question, two copies. The
// bell names the room and leaves the waiting copy out, so the user is not asked the same thing twice.
test('a card mirrored into its room is listed once, under the room', () => {
  const snapshot = {
    byId: { s1: { id: 's1', name: 'Chief', sessionId: 's1' } },
    roomsById: { r1: { id: 'r1', name: 'Ops' } },
  }
  const items = needsYou(
    {
      questions: {
        r1: { id: 'q1', question: '用哪种格式？', mirrorOf: 's1' },
        s1: { id: 'q1', question: '用哪种格式？', mirroredTo: 'r1' },
      },
      secretRequests: {},
    },
    { approvals: [] },
    { s1: false },
    snapshot)
  assert.deepEqual(deep(items.map(item => [item.kind, item.where, item.open])), [['question', 'Ops', 'r1']])
})
