// The sheets this plugin installs are addressed by name (`data-dsh-bot`), because several
// parts of the skin look each other up that way -- installCompiledStyles skips our own sheets
// when it reads the shell's hashed class names. That makes the name a key, and a key with two
// copies in <head> is a page that reads as half-updated: the rules that win are the ones
// later in document order, not the ones from the bundle actually on screen.
//
// This runs the installer for real against a small stand-in for <head>, rather than checking
// that the source looks right.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { test } from 'node:test'

const makeHead = () => {
  const children = []
  const sheet = (datasetName, text) => {
    const node = { dataset: { dshBot: datasetName }, textContent: text }
    node.remove = () => { const index = children.indexOf(node); if (index >= 0) children.splice(index, 1) }
    return node
  }
  const head = {
    appendChild: (node) => { children.push(node); return node },
    // The installer's own selector, and only it: a stand-in that answered everything would be
    // claiming things about this code that nothing here checks.
    querySelectorAll: (selector) => {
      assert.equal(selector, 'style[data-dsh-bot]')
      return children.filter(node => 'dshBot' in node.dataset)
    },
  }
  const document = {
    head,
    styleSheets: [],
    createElement: () => sheet('', ''),
    // The compiled installer watches for the shell's own sheets arriving before it re-renders.
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  // <head> as a page that never reloaded has it: copies left by earlier bundles.
  const seed = (datasetName, text) => { const node = sheet(datasetName, text); children.push(node); return node }
  return { document, children, seed }
}

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/styles.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom'],
})

const load = (document) => {
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, document,
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return [] } },
    require: (name) => {
      if (name === 'react') return { createElement: () => null, useState: v => [v, () => {}], useEffect: () => {}, useLayoutEffect: () => {}, useRef: v => ({ current: v }), Fragment: 'fragment' }
      if (name === 'react-dom') return { createPortal: () => null }
      throw new Error(`no platform module ${name}`)
    },
  })
  return module.exports
}

test('installing the same sheet twice leaves one copy, the newest one', () => {
  const { document, children } = makeHead()
  const { installStyles } = load(document)
  const first = installStyles('.a{}', 'shell')
  assert.deepEqual(children, [first])
  const second = installStyles('.b{}', 'shell')
  assert.equal(children.length, 1, 'the second install replaces the first rather than stacking')
  assert.equal(children[0], second)
  assert.equal(children[0].textContent, '.b{}', 'and the one left is the current rules')
  assert.ok(first.dataset.dshBot === 'shell' && !children.includes(first), 'the old node is gone')
})

test('a different name is a different sheet, and keeps its own place', () => {
  const { document, children } = makeHead()
  const { installStyles } = load(document)
  installStyles('.a{}', 'shell')
  installStyles('.b{}', 'peers')
  installStyles('.c{}', 'shell')
  assert.deepEqual(children.map(node => node.dataset.dshBot), ['peers', 'shell'])
  assert.deepEqual(children.map(node => node.textContent), ['.b{}', '.c{}'])
})

// The compiled sheets are the ones with a re-rendering body, and they go through the same
// installer -- so the guarantee is theirs too, not just installStyles'.
test('the compiled sheets go through the installer, so they get the same guarantee', () => {
  const { document, children } = makeHead()
  const { installCompiledStyles } = load(document)
  installCompiledStyles('.x{}', 'peers')
  installCompiledStyles('.y{}', 'peers')
  assert.equal(children.length, 1, 'one sheet per name, however often it is compiled')
  assert.equal(children[0].dataset.dshBot, 'peers')
})

// A page that has already stacked copies must still be able to end up with one, or the fix
// only helps from a fresh load -- the point is that the next apply cleans up.
test('an already stacked set of sheets is reduced to one by the next install', () => {
  const { document, children, seed } = makeHead()
  const { installStyles } = load(document)
  seed('shell', '.old1{}')
  seed('shell', '.old2{}')
  seed('shell', '.old3{}')
  assert.equal(children.length, 3, 'the duplicates are there to begin with')
  installStyles('.now{}', 'shell')
  assert.deepEqual(children.map(node => node.textContent), ['.now{}'])
})
