import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { SKIN_CHOICES, skinOf } from '../src/client/themes.js'

const bundle = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('a skin the plugin does not know is this plugin’s own', () => {
  assert.equal(skinOf(undefined), 'ours')
  assert.equal(skinOf({}), 'ours')
  assert.equal(skinOf({ skin: 'neon' }), 'ours')
  assert.equal(skinOf({ skin: 'app' }), 'app')
  assert.deepEqual(Object.keys(SKIN_CHOICES), ['ours', 'app'])
})

// The skin is a phone look: a rule that could reach the desktop would restyle a window the
// user never asked about, so every rule but the token carries the drawer marker.
test('every skin rule is scoped to the phone', () => {
  const selectors = []
  for (let at = bundle.indexOf('[data-bt-skin=app]'); at >= 0; at = bundle.indexOf('[data-bt-skin=app]', at + 1)) {
    const open = bundle.indexOf('{', at)
    const start = Math.max(bundle.lastIndexOf('}', at), bundle.lastIndexOf('\n', at), bundle.lastIndexOf('`', at))
    selectors.push(bundle.slice(start + 1, open).trim())
  }
  assert.ok(selectors.length >= 3, `expected the skin rules, found ${selectors.length}`)
  for (const selector of selectors) {
    assert.ok(
      selector.includes('[data-mobile-nav="frame"]') || selector === 'html[data-bt-skin=app]',
      `the skin rule is not scoped to the phone: ${selector}`,
    )
  }
})

test('the phone skin carries the app’s own bubble metrics', () => {
  const rule = /\[data-bt-skin=app\]:has\(\[data-mobile-nav="frame"\]\) body:not\(\[data-bt-layout=flat\]\) \.bt-bubble\{([^}]*)\}/.exec(bundle)
  assert.ok(rule !== null, 'no bubble rule for the skin')
  const body = rule[1]
  assert.match(body, /border-radius:var\(--bt-skin-bubble\)/)
  assert.match(body, /padding:13px 18px/)
  assert.match(bundle, /html\[data-bt-skin=app\]\{--bt-skin-bubble:26px\}/)
  assert.match(bundle, /\[data-bt-skin=app\]:has\(\[data-mobile-nav="frame"\]\) \.bt-msg,[^{]*\{max-width:90%\}/)
})

// The settings row is the only place the skin is chosen, and the host never hears about it,
// so the row has to read this device's own pick instead of the host's prefs.
const { outputFiles } = await build({
  stdin: {
    contents: "export { SettingsDialog } from './src/client/settings.js'",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const slots = []
let cursor = 0
const react = {
  createContext: (initial) => { const ctx = { value: initial }; ctx.Provider = ({ children }) => children; return ctx },
  useContext: ctx => ctx.value,
  createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
  Fragment: Symbol('Fragment'),
  useState(initial) {
    const i = cursor++
    if (slots[i] === undefined) slots[i] = { v: typeof initial === 'function' ? initial() : initial }
    const slot = slots[i]
    return [slot.v, (v) => { slot.v = typeof v === 'function' ? v(slot.v) : v }]
  },
  useRef(initial) { const i = cursor++; if (slots[i] === undefined) slots[i] = { current: initial }; return slots[i] },
  useCallback: fn => fn, useMemo: make => make(), useEffect() {}, useLayoutEffect() {},
  useSyncExternalStore: (subscribe, get) => get(), useId: () => 'id',
}
const module = { exports: {} }
const noop = () => {}
runInNewContext(outputFiles[0].text, {
  module, exports: module.exports,
  window: { innerHeight: 800, innerWidth: 390, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }) },
  document: { body: {}, documentElement: { dataset: {} }, addEventListener: noop, removeEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  setTimeout, clearTimeout, Promise,
  require: name => (name === 'react' ? react : name === 'react-dom' ? { createPortal: node => node } : {}),
})
const { SettingsDialog } = module.exports

const collect = (node, out = []) => {
  if (Array.isArray(node)) { node.forEach(child => collect(child, out)); return out }
  if (!node || typeof node !== 'object') return out
  out.push(node)
  collect(node.props?.children, out)
  return out
}
// The row is a Choice inside GeneralPage; expanding that one component keeps the walk
// honest about what the real render passes down, without rendering the whole dialog.
function skinRow({ stored = 'app', hostPrefs = {} } = {}) {
  const calls = []
  slots.length = 0
  const actions = {
    localPref: (key, value) => { calls.push([key, value]); return Promise.resolve() },
    skinPref: () => stored,
    closeSettings: noop,
  }
  const props = {
    page: 'general', id: null, useUpdate: noop,
    roster: { prefs: hostPrefs, byId: {}, roomsById: {}, rooms: [], bots: [], mainBotIds: [] },
    actions,
  }
  const row = () => {
    cursor = 0
    const page = collect(SettingsDialog(props)).find(node => typeof node.type === 'function' && node.type.name === 'GeneralPage')
    assert.ok(page, 'the general page did not render')
    const found = collect(page.type(page.props)).find(node => node.props?.label === 'Mobile skin' && typeof node.props.pick === 'function')
    assert.ok(found, 'no skin row')
    return found
  }
  return { calls, row, pick: (id) => { row().props.pick(id); return row() } }
}

test('the skin row shows the pick this device made, not the host’s prefs', () => {
  assert.equal(skinRow({ stored: 'app', hostPrefs: {} }).row().props.value, 'app')
  // The host keeps no skin, so its prefs must not win even if they carried one.
  assert.equal(skinRow({ stored: 'ours', hostPrefs: { skin: 'app' } }).row().props.value, 'ours')
})

test('picking a skin keeps it on the row and never sends it to the host', () => {
  const skin = skinRow({ stored: 'app', hostPrefs: {} })
  assert.equal(skin.pick('ours').props.value, 'ours')
  assert.deepEqual(skin.calls, [['skin', 'ours']])
})
