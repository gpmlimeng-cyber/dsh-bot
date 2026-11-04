import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { SKIN_CHOICES, skinOf, widthOf } from '../src/client/themes.js'

const bundle = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('the skin follows the device until the user picks one', () => {
  assert.equal(skinOf(undefined), 'ours')
  assert.equal(skinOf({}), 'ours')
  // A phone with no pick wears the app's shape; a desktop with no pick keeps ours.
  assert.equal(skinOf({}, { phone: true }), 'app')
  assert.equal(skinOf({ skin: 'neon' }, { phone: true }), 'app')
  // A pick always wins, whichever way the device goes.
  assert.equal(skinOf({ skin: 'ours' }, { phone: true }), 'ours')
  assert.equal(skinOf({ skin: 'app' }), 'app')
  assert.deepEqual(Object.keys(SKIN_CHOICES), ['ours', 'app'])
})

// The skin is a phone look: a rule that could reach the desktop would restyle a window the
// user never asked about, so every skin rule carries the drawer marker. No pick leaves the
// attribute off, which is how a phone gets the skin by default.
test('every skin rule is scoped to the phone', () => {
  const selectors = []
  for (let at = bundle.indexOf(':not([data-bt-skin=ours])'); at >= 0; at = bundle.indexOf(':not([data-bt-skin=ours])', at + 1)) {
    const open = bundle.indexOf('{', at)
    const start = Math.max(bundle.lastIndexOf('}', at), bundle.lastIndexOf('\n', at), bundle.lastIndexOf('`', at))
    selectors.push(bundle.slice(start + 1, open).trim())
  }
  assert.ok(selectors.length >= 6, `expected the skin rules, found ${selectors.length}`)
  for (const selector of selectors) {
    assert.ok(
      selector.includes('[data-mobile-nav="frame"]'),
      `the skin rule is not scoped to the phone: ${selector}`,
    )
  }
})

// The width setting drives the Bot's bubbles. The user's own bubbles are the host's: their
// percentage would resolve against the width the host already shrank, so the skin leaves
// them alone and only restyles their shape.
test('the skin reads the width setting on the Bot’s side and leaves the host’s alone', () => {
  // The setting's own default is 90% of the column; a pick is honoured as it is.
  assert.equal(widthOf({}), 90)
  assert.equal(widthOf({ width: 50 }), 50)
  assert.match(bundle, /:not\(\[data-bt-skin=ours\]\) \.bt-msg,[^{]*\{max-width:calc\(var\(--bt-msg-w\) \* 100%\)\}/)
  const user = /:not\(\[data-bt-skin=ours\]\) \[class\*="_userRow"\] \[class\*="_bubble"\]\{([^}]*)\}/.exec(bundle)
  assert.ok(user !== null, 'no rule for the host’s user bubbles')
  assert.ok(!user[1].includes('max-width'), 'the skin still caps the host’s user bubble width')
})

// A tap on the bubble opens its tools; on the phone the icons sit bare right under the
// bubble's left edge, and a row with a sender avatar starts them after it.
test('the phone rests a bubble’s tools under its left edge', () => {
  const tools = /:not\(\[data-bt-skin=ours\]\) \.bt-tools\{([^}]*)\}/.exec(bundle)
  assert.ok(tools !== null, 'no tools rule for the skin')
  assert.match(tools[1], /top:calc\(100% - 6px\)/)
  assert.match(tools[1], /left:0/)
  // Bare icons: no plate, no shadow, no padding around them.
  assert.match(tools[1], /background:none/)
  assert.match(tools[1], /box-shadow:none/)
  assert.match(tools[1], /padding:0/)
  // A tap opens them above every layer this plugin draws (sheets at 61, palette at 70).
  assert.match(tools[1], /z-index:1000/)
  assert.match(bundle, /:not\(\[data-bt-skin=ours\]\) :is\(\.bt-menu,\.bt-react-strip\)\{z-index:1001\}/)
  // A 32px box, not the 44px touch target, so no empty ring reads as a gap under the bubble.
  assert.match(bundle, /:not\(\[data-bt-skin=ours\]\) \.bt-tools \.bt-tool\{width:32px;height:32px\}/)
  assert.match(bundle, /:not\(\[data-bt-skin=ours\]\) \.bt-tools \.bt-tool\{width:32px;height:32px\}/)
  assert.match(bundle, /:not\(\[data-bt-skin=ours\]\) \.bt-msg-line:has\(>\.bt-lead\) \.bt-tools\{left:30px\}/)
  assert.doesNotMatch(bundle, /:not\(\[data-bt-skin=ours\]\) \.bt-group-msg\{position:relative\}/)
})

// The bubble this plugin draws for the user's own messages drops its time on the phone; the
// desktop keeps it, and the shell's user row has no time of its own to touch.
test('the phone leaves the time out of the user’s own bubble', () => {
  const ours = /:not\(\[data-bt-skin=ours\]\) \.bt-utime\{display:none\}/.exec(bundle)
  assert.ok(ours !== null, 'the plugin’s own bubble time still shows on the phone')
  const line = bundle.slice(bundle.lastIndexOf('\n', ours.index) + 1, bundle.indexOf('}', ours.index))
  assert.ok(line.includes('[data-mobile-nav="frame"]'), `a time is hidden off the phone: ${line.slice(0, 120)}`)
  assert.ok(!bundle.includes('_userRow"] [class*="_time"]'), 'the empty shell-row time selector came back')
})

// The group's own bubble is drawn by this plugin, so it has to read the same tokens.
test('the plugin’s own user bubble follows the skin’s padding and radius', () => {
  const rule = /:not\(\[data-bt-skin=ours\]\) \.bt-ububble\{([^}]*)\}/.exec(bundle)
  assert.ok(rule !== null, 'the plugin’s own user bubble ignores the skin')
  assert.match(rule[1], /padding:var\(--bt-app-pad\)/)
  assert.match(rule[1], /border-radius:var\(--bt-app-radius-bubble\)/)
})

// The host draws the user's bubble with one shorthand and no per-corner rule, so the same
// shorthand here covers all four corners; a longhand would only add a way to miss one.
test('the host’s user bubble keeps one radius shorthand', () => {
  const user = /:not\(\[data-bt-skin=ours\]\) \[class\*="_userRow"\] \[class\*="_bubble"\]\{([^}]*)\}/.exec(bundle)
  assert.ok(user !== null, 'no rule for the host’s user bubbles')
  assert.match(user[1], /border-radius:var\(--bt-app-radius-bubble\)!important/)
  assert.ok(!/border-(?:start|end)-(?:start|end)-radius/.test(user[1]), 'the user bubble grew a per-corner radius')
  // Nothing pins the skin back to a full-width bubble.
  assert.ok(!bundle.includes('--bt-app-msg-max'), 'the skin still carries its own width token')
})

test('the phone skin carries the app’s own bubble metrics', () => {
  const rule = /:not\(\[data-bt-skin=ours\]\) body:not\(\[data-bt-layout=flat\]\) \.bt-bubble\{([^}]*)\}/.exec(bundle)
  assert.ok(rule !== null, 'no bubble rule for the skin')
  const body = rule[1]
  assert.match(body, /border-radius:var\(--bt-app-radius-bubble\)/)
  assert.match(body, /padding:var\(--bt-app-pad\)/)
  assert.match(body, /line-height:1\.625/)
  assert.match(bundle, /--bt-app-radius-bubble:5px/)
  assert.match(bundle, /--bt-app-pad:8px 10px/)
  // Neighbouring bubbles use the radius minus the padding step, not a hand-written 9px.
  assert.match(bundle, /border-start-start-radius:var\(--bt-app-radius-bubble-inset\)/)
  assert.match(bundle, /--bt-app-radius-bubble-inset:max\(2px, calc\(var\(--bt-app-radius-bubble\) - 12px - 1px\)\)/)
  // A negative corner would be dropped whole, so the floor has to stay.
  assert.match(bundle, /max\(2px,/)
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

// A token declaration paints nothing; its consumers do, so the marker has to be on every one
// of them or a rule that reaches the desktop would repaint it.
test('every rule that uses a skin token is scoped to the phone', () => {
  const consumers = []
  for (let at = bundle.indexOf('var(--bt-app-'); at >= 0; at = bundle.indexOf('var(--bt-app-', at + 1)) {
    const start = Math.max(bundle.lastIndexOf('}', at), bundle.lastIndexOf('\n', at), bundle.lastIndexOf('`', at))
    consumers.push(bundle.slice(start + 1, bundle.indexOf('{', start + 1)).trim())
  }
  assert.ok(consumers.length >= 3, `expected the token's consumers, found ${consumers.length}`)
  for (const selector of consumers) {
    assert.ok(selector.includes('[data-mobile-nav="frame"]'), `the token is used outside the phone: ${selector}`)
  }
})
