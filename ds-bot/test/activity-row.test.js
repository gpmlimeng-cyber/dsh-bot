import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// The header's activity rule, bundled without a DOM: the component itself needs the
// shell's running host, but the decision it makes is one pure function.
const { outputFiles } = await build({
  stdin: {
    contents: "export { showsActivity } from './src/client/activity-row.js'",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
runInNewContext(outputFiles[0].text, {
  module, exports: module.exports,
  document: { hidden: false },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  require: (name) => {
    if (name === 'react') return { createElement: () => null, Fragment: 'f', useEffect() {}, useLayoutEffect() {}, useState: v => [v, () => {}], useMemo: f => f(), useRef: v => ({ current: v }), useId: () => 'id' }
    if (name === 'react-dom') return { createPortal: node => node }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { MarkdownText: () => null }
    throw new Error(`Unexpected platform module ${name}`)
  },
})
const { showsActivity } = module.exports
const member = { id: 'chief' }

// A room's own turn is the relay, an internal round that fans out to its members. Its
// avatar saying "thinking" read as a second, fake participant: the user reported a group
// avatar appearing before the admin answered. The official skin draws it too (its
// `visible` accepted a room since 41710f6); dropping it is our deliberate deviation.
test('a room\'s own relay turn leaves no activity row', () => {
  assert.equal(showsActivity({ running: true, streaming: false, relaying: false, bot: undefined }), false)
})

// A Bot's own turn keeps the row, which is the whole point of the rule.
test('a Bot\'s own turn still gets one', () => {
  assert.equal(showsActivity({ running: true, streaming: false, relaying: false, bot: member }), true)
})

// While the relay runs, the round belongs to its members: their typing rows come from
// the relay itself (cells.js), never from the header.
test('a relay in flight is the members\' round, not the header\'s', () => {
  assert.equal(showsActivity({ running: true, streaming: false, relaying: true, bot: member }), false)
})

test('nothing running shows nothing', () => {
  assert.equal(showsActivity({ running: false, streaming: false, relaying: false, bot: member }), false)
})

// The room avatar must not come back through the render branch either.
test('the activity row draws a Bot mark, never a room avatar', () => {
  const source = readFileSync(new URL('../src/client/activity-row.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /RoomAvatar/)
  assert.match(source, /const visible = showsActivity\(\{ running, streaming, relaying, bot \}\)/)
})
