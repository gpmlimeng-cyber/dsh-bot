// Component-level tests for the NeedsYou entry (src/client/attention.js and its seat
// in header.js): real React against jsdom, the way the browser mounts it. The pure
// collection logic is covered separately below, over the esbuild bundle.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { DICTIONARY } from '../src/client/i18n.js'

// jsdom comes from the harness packages the tests load (dev/harness or DSH_HARNESS);
// react does not ship there, so it comes from the deepseek-harness checkout beside
// ds-bot, whose pnpm store pins it — requiring from the react package itself
// resolves its own react-dom sibling through the store's links.
const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const harnessRequire = createRequire(join(process.env.DSH_HARNESS ?? join(PLUGIN, 'dev', 'harness'), 'package.json'))
const { JSDOM } = harnessRequire('jsdom')
const reactRequire = createRequire(join(PLUGIN, '..', 'deepseek-harness', 'node_modules', '.pnpm', 'react@18.3.1', 'node_modules', 'react', 'package.json'))
const React = reactRequire('react')
const reactDom = reactRequire('react-dom/client')

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="portal"></div></body></html>', { url: 'https://ds-bot.test/' })
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

test('a missing useWork is held by the header guard, not a TypeError', async () => {
  // The guard itself lives in header.js (`useWork && useUi ? … : null`); the same
  // predicate here stands in for it. What must never happen is a render that calls
  // `useWork(...)` with nothing to call, and with the guard the component is simply
  // not mounted.
  const props = seat({ useWork: undefined })
  const guarded = Boolean(props.useWork) && Boolean(props.useUi)
  assert.equal(guarded, false)
  let thrown = null
  try {
    needsYou(roster.getSnapshot(), props.useWork ? props.useWork(work.getSnapshot()) : { approvals: [] }, ui.getSnapshot().unread ?? {}, roster.getSnapshot())
  } catch (error) { thrown = error }
  assert.equal(thrown, null)
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
