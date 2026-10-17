import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/header.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
// A phone viewport, switched per test. mobile.js caches the object matchMedia hands it, so
// `matches` is a live getter rather than a snapshot; document.body is what the bar's portal is
// handed (the platform stub returns the node itself and never reads it).
let phone = false
const viewport = {
  matchMedia: () => ({
    get matches() { return phone },
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }),
}
runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports, URL, URLSearchParams, setTimeout, clearTimeout,
  window: viewport,
  document: { body: {}, addEventListener() {}, removeEventListener() {} },
  require: (name) => {
    const platform = {
      react: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }), useState: initial => [initial, () => {}], useEffect: () => {}, useRef: current => ({ current }), useLayoutEffect: () => {}, useMemo: make => make(), useCallback: fn => fn, Fragment: 'fragment' },
      'react-dom': { createPortal: node => node },
      '@deepseek-ai/dsh-client-ui-primitives': { MarkdownText: () => null },
    }
    if (!(name in platform)) throw new Error(`no platform module ${name}`)
    return platform[name]
  },
})
const { HeaderPill } = module.exports

const roster = { byId: { a: { id: 'a', name: 'Chief', sessionId: 'a' } }, roomsById: {}, bots: [], exchangeTurns: {}, questions: {} }
const hook = value => select => select(value)
const header = actions => HeaderPill({
  sessionId: 'a',
  useRoster: hook(roster),
  useSessions: hook({ byId: {} }),
  useSessionStatus: hook(new Map()),
  useSession: hook({}),
  useActivity: hook({}),
  useMemoryNews: hook({}),
  useTurnClock: hook({}),
  useUi: hook({}),
  useLive: hook({}),
  actions,
})
const sideButton = (node) => {
  if (node === null || typeof node !== 'object') return null
  if (node.props?.['data-bt-right-sidebar'] !== undefined) return node
  for (const child of node.children ?? []) {
    const found = sideButton(child)
    if (found) return found
  }
  return null
}

// 公开#172: the Bot header replaces DSH's session header, and with it the corner seat
// where DSH puts the button that opens its right sidebar; only the shortcut was left.
test('the Bot header has the right sidebar toggle that DSH keeps in the header it replaces', () => {
  let toggled = 0
  const button = sideButton(header({ hasRightSidebar: () => true, toggleRightSidebar: () => { toggled += 1 } }))
  assert.ok(button)
  assert.equal(button.props['aria-label'], 'Show or hide the right sidebar')
  button.props.onClick()
  assert.equal(toggled, 1)
})

test('without DSH\'s right sidebar the Bot header shows no toggle', () => {
  assert.equal(sideButton(header({ hasRightSidebar: () => false, toggleRightSidebar: () => {} })), null)
})

// 丙 (styles.js): a 424px frame has no right column to toggle -- the shell's own rule wants 300px
// beside a 400px centre -- so a phone draws no key even while the service is there. The wide
// layout above keeps the shell's seat.
test('a phone draws no right sidebar key even when the shell offers one', () => {
  const previous = phone
  phone = true
  try {
    assert.equal(sideButton(header({ hasRightSidebar: () => true, toggleRightSidebar: () => {} })), null)
  } finally {
    phone = previous
  }
})
