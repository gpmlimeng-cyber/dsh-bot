import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import { build } from 'esbuild'

// The "+" is the phone's only upload entry: it stands in every chat (including one with no
// Bot or group behind it) and brings its own file picker, so attaching never depends on what
// the shell happens to put in the composer.
const { outputFiles } = await build({
  stdin: { contents: "export { ComposerPlus } from './src/client/composer.js'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const slots = []
let cursor = 0
const react = {
  createElement: (type, props, ...children) => {
    const node = { type, props: { ...props, children: children.flat(Infinity) } }
    if (props?.ref && typeof props.ref === 'object') props.ref.current = node
    return node
  },
  Fragment: Symbol('Fragment'),
  useState(initial) {
    const i = cursor++
    if (slots[i] === undefined) slots[i] = { v: typeof initial === 'function' ? initial() : initial }
    const slot = slots[i]
    return [slot.v, (v) => { slot.v = typeof v === 'function' ? v(slot.v) : v }]
  },
  useRef(initial) { const i = cursor++; if (slots[i] === undefined) slots[i] = { current: initial }; return slots[i] },
  useMemo: make => make(), useCallback: fn => fn, useEffect() {}, useLayoutEffect() {}, useId: () => 'id',
}
const module = { exports: {} }
const created = []
runInNewContext(outputFiles[0].text, {
  module, exports: module.exports,
  window: { innerHeight: 800, addEventListener() {}, removeEventListener() {} },
  document: {
    body: {},
    createElement: () => { const node = { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v }, getAttribute(k) { return this.attrs[k] ?? null }, addEventListener() {}, click() { this.clicked = true } }; created.push(node); return node },
    addEventListener() {}, removeEventListener() {},
  },
  require: name => (name === 'react' ? react : name === 'react-dom' ? { createPortal: node => node } : {}),
})
const { ComposerPlus } = module.exports

const walk = (node, match, out = []) => {
  if (Array.isArray(node)) { node.forEach(child => walk(child, match, out)); return out }
  if (!node || typeof node !== 'object') return out
  if (match(node)) out.push(node)
  walk(node.props?.children, match, out)
  return out
}
const textOf = node => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.props?.children)
}
const render = () => ComposerPlus({
  sessionId: 'session-1',
  useRoster: selector => selector({ byId: {}, roomsById: {} }),
  inputActions: { captureInsertion: () => null },
  actions: { canReferenceChat: () => true, openSettings() {}, referenceChat() {} },
})

// Open the plus beside a composer card that has `hostInput` (a shell file input) or none.
function open(hostInput) {
  slots.length = 0
  created.length = 0
  const appended = []
  const card = {
    querySelector: selector => (hostInput && selector === 'input[type=file]' ? hostInput : null),
    appendChild: (node) => { appended.push(node) },
  }
  const patch = (tree) => {
    walk(tree, node => node.props?.className === 'bt-plus').forEach((node) => {
      node.closest = () => card
      node.getBoundingClientRect = () => ({ left: 0, top: 0, right: 32, bottom: 32, width: 32, height: 32 })
    })
  }
  cursor = 0
  const first = render()
  patch(first)
  walk(first, node => node.props?.className === 'bt-plus')[0].props.onClick()
  cursor = 0
  const tree = render()
  patch(tree)
  return { appended, created, items: walk(tree, node => node.props?.role === 'menuitem').map(textOf) }
}

test('the plus stands in a chat that has no Bot or group behind it', () => {
  slots.length = 0
  cursor = 0
  assert.equal(walk(render(), node => node.props?.className === 'bt-plus').length, 1, 'a plain session lost its plus')
})

test('the plus hands the shell’s own file input to the upload rows', () => {
  const shared = { click() {}, getAttribute: () => null, setAttribute() {}, addEventListener() {} }
  const opened = open(shared)
  assert.ok(opened.items.some(text => text.includes('Add image')), `no Add image row: ${JSON.stringify(opened.items)}`)
})

test('a composer with no file input offers no upload row', () => {
  // It is the shell's input that uploads, so a composer without one keeps its paperclip
  // (the rule below) instead of showing an entry that cannot work.
  const opened = open(null)
  assert.ok(!opened.items.some(text => text.includes('Add image')), `unexpected Add image row: ${JSON.stringify(opened.items)}`)
})

// One entry on the phone's left: hidden where both can upload, and painted as the same plus
// glyph where only the shell's button is there.
test('the phone shows one plus wherever the shell puts the paperclip', () => {
  const text = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8')
  const hide = /html:has\(\[data-mobile-nav="frame"\]\) \[data-composer-card\]([^{]*)\[data-mobile-nav="file-upload"\]\{display:none!important\}/.exec(text)
  assert.ok(hide !== null, 'no rule hides the shell paperclip on the phone')
  assert.ok(hide[1].includes(':has(.bt-plus)'), 'the paperclip hides even where the plus is missing')
  assert.ok(hide[1].includes(':has(input[type=file])'), 'the paperclip hides where nothing can upload')
  const mask = /:not\(:has\(\.bt-plus\)\) \[data-mobile-nav="file-upload"\]\{[^}]*mask:url\("data:image\/svg\+xml/.exec(text)
  assert.ok(mask !== null, 'the shell paperclip is not repainted as a plus where ours is missing')
})
