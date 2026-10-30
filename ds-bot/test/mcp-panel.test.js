import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// Same stand-in React as test/sidebar-switch.js: the panel runs as plain functions, so a
// tree can be read without a browser. `useState` keeps its value across the passes the
// panel needs to show what its first fetch answered.
const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const { outputFiles } = await build({
  stdin: { contents: "export { McpPanel } from './src/client/mcp-panel.js'\nexport { CATEGORIES } from './src/client/market.js'", resolveDir: PLUGIN },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})

const stores = new Map()
const ran = new Set()
let slot = 0
let pending = []
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  Fragment: Symbol('Fragment'),
  useEffect: (effect) => { const key = slot++; if (!ran.has(key)) pending.push([key, effect]) },
  useLayoutEffect: (effect) => { const key = slot++; if (!ran.has(key)) pending.push([key, effect]) },
  useState: (initial) => {
    const key = slot++
    if (!stores.has(key)) stores.set(key, typeof initial === 'function' ? initial() : initial)
    return [stores.get(key), (next) => { stores.set(key, typeof next === 'function' ? next(stores.get(key)) : next) }]
  },
  useMemo: make => make(), useRef: current => ({ current }), useId: () => 'id',
}
const module = { exports: {} }
runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: name => (name === 'react' ? react : {}), window: { innerWidth: 1280 } })
const { McpPanel, CATEGORIES } = module.exports

// Every string and attribute in a rendered tree, so an assertion reads like the page does.
function text(node, out = []) {
  if (Array.isArray(node)) { node.forEach(item => text(item, out)); return out }
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (typeof node.type === 'function') { const save = slot; slot = 0; text(node.type(node.props), out); slot = save; return out }
  if (node.props?.className !== undefined) out.push(`.${node.props.className}`)
  if (typeof node.props?.['aria-label'] === 'string') out.push(node.props['aria-label'])
  text(node.props?.children, out)
  return out
}

const SERVER = { serverName: 'files', transport: 'stdio', enabled: true, readOnly: null, toolCount: 12, entryId: 'mcp-files', command: 'npx', args: [], env: [], url: null, headers: [] }

async function render(servers) {
  stores.clear(); ran.clear(); pending = []
  const actions = {
    mcpList: () => Promise.resolve({ servers, available: true }),
    mcpTools: () => Promise.resolve({ tools: [] }),
    mcpAdd: () => Promise.resolve({ servers }), mcpSave: () => Promise.resolve({ servers }),
    mcpToggle: () => Promise.resolve({ servers }), mcpRemove: () => Promise.resolve({ servers }),
  }
  let tree = null
  for (let pass = 0; pass < 5; pass += 1) {
    slot = 0
    tree = McpPanel({ actions })
    const run = pending
    pending = []
    for (const [key, effect] of run) { ran.add(key); effect() }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  return text(tree)
}

test('the market lists MCP between Skills and Connectors', () => {
  assert.equal(CATEGORIES().map(category => category.id).join(','), 'plugins,skills,mcp,connectors,capabilities')
})

test('the MCP page names itself and offers the one action it owns', async () => {
  const page = (await render([])).join('|')
  assert.ok(page.includes('.bt-mcp-head'))
  assert.ok(page.includes('MCP'))
  assert.ok(page.includes('Add server'))
  assert.ok(page.includes('No MCP server yet. Add one and its tools appear to every Bot.'))
})

test('a server row carries its transport, its tool count and its switch', async () => {
  const page = (await render([SERVER])).join('|')
  assert.ok(page.includes('files'))
  assert.ok(page.includes('stdio · 12 tools'))
  assert.ok(page.includes('.bt-mcp-switch'))
  assert.ok(page.includes('Disable'))
  // A row the page did not write says so instead of offering an edit it cannot do.
  const readOnly = (await render([{ ...SERVER, readOnly: 'unaddressable' }])).join('|')
  assert.ok(readOnly.includes('read-only'))
})
