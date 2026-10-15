import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { bundleClient } from '../scripts/build-client.mjs'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')

const committed = () => readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('client.js is the build of src/client', async () => {
  assert.equal(await bundleClient(), committed(), 'client.js is stale: run `npm run build` and commit it')
})

// dsh runs client.js as a classic script that hands a factory to the module loader; the
// factory's `require` answers only the shell's platform modules.
test('client.js registers a factory that exports apply and inject', () => {
  const registrations = []
  runInNewContext(committed(), { window: { __ModuleLoader__: { load: registration => registrations.push(registration) } } })
  assert.equal(registrations.length, 1)
  const [{ id, factory, ...rest }] = registrations
  assert.equal(id, 'ds-bot')
  assert.deepEqual(Object.keys(rest), [])

  const requested = []
  const platform = {
    'react': { createElement: () => null, Fragment: Symbol('Fragment'), useState: initial => [initial, () => {}], useEffect: () => {}, useMemo: make => make(), useRef: current => ({ current }) },
    'react-dom': { createPortal: node => node },
    '@deepseek-ai/dsh-client-ui-primitives': { MarkdownText: () => null },
  }
  const exports = factory((specifier) => {
    requested.push(specifier)
    if (!(specifier in platform)) throw new Error(`no platform module ${specifier}`)
    return platform[specifier]
  })
  assert.deepEqual([...new Set(requested)].sort(), Object.keys(platform).sort())
  assert.equal(Object.prototype.toString.call(exports), '[object Module]')
  assert.deepEqual(Object.keys(exports), ['apply', 'inject'])
  assert.equal(typeof exports.apply, 'function')
  // No `configForms`: the client never writes the user's DSH settings, such as the
  // work-details mode it once held at `verbose`.
  assert.deepEqual(Array.from(exports.inject), ['sessions', 'uiWorkspace', 'uiConversation', 'slots', 'theme', 'layout'])
})

// A page has no other way to say which build it is running, and "is the screen on the current
// bundle?" has cost this project more than one round of measuring the wrong thing. The build
// stamps its own sources' fingerprint into the file and the page publishes it on <html>, so a
// device reading names the build instead of comparing features one at a time. It has to be a
// function of the sources alone -- no clock, no commit -- or `--check` above could never pass.
test('the build carries the fingerprint of the sources it was made from', async () => {
  const built = await bundleClient()
  const stamped = /^\/\/ Source fingerprint: ([0-9a-f]{8})$/m.exec(built)
  assert.ok(stamped, 'the file names its sources')
  assert.equal((built.match(/Source fingerprint/g) ?? []).length, 1, 'and names them once')
  // Published where a device reading can find it, with the value the header carries.
  assert.ok(built.includes(`document.documentElement.dataset.btSrc = true ? "${stamped[1]}" : "unbuilt"`), 'and the page publishes it on <html>')
  // Sources loaded without the build step say so rather than claim a fingerprint.
  assert.ok(read('index.js').includes("typeof __DS_BOT_SRC__ === 'string' ? __DS_BOT_SRC__ : 'unbuilt'"), 'the guard is in the source')
  // Same sources, same stamp: rebuilding cannot move it.
  assert.equal(await bundleClient(), built, 'two builds of the same sources are the same file')
})
