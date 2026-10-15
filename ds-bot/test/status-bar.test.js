// The status bar bridge. The shell paints the strip behind the status bar in a colour it owns --
// which is why the page could never match it exactly -- and this is the call that asks it to
// stop. The protocol is the shell's (set(mode, color, appearance)), and what matters here is
// what happens on the shells that do NOT have it: no such object, a property that is not a
// function, or a bridge that throws. None of those may take the skin down, and none may raise
// from a call the page makes on its own.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { STATUS_BAR_MODE, publishStatusBarMode } from '../src/client/status-bar.js'

const withWindow = (bridge, run) => {
  const had = 'window' in globalThis
  const previous = globalThis.window
  globalThis.window = { dshStatusBarBridge: bridge }
  try { return run() } finally {
    if (had) globalThis.window = previous
    else delete globalThis.window
  }
}

test('the page asks for a transparent status bar, with the shell\'s own protocol', () => {
  assert.deepEqual(STATUS_BAR_MODE, ['transparent', '', 'auto'], 'mode, colour and appearance, as documented')
  const calls = []
  const bridge = { set: (...args) => calls.push(args) }
  assert.equal(withWindow(bridge, () => publishStatusBarMode()), true, 'it reports that it asked')
  assert.deepEqual(calls, [['transparent', '', 'auto']], 'and asked exactly once, exactly that')
  // Idempotent per the protocol: calling twice is not an error and asks the same thing again.
  withWindow(bridge, () => publishStatusBarMode())
  assert.equal(calls.length, 2)
})

test('a shell without the bridge is left alone, and is never asked twice about it', () => {
  for (const missing of [undefined, null, {}, { set: 'not a function' }, { set: null }]) {
    const quiet = withWindow(missing, () => publishStatusBarMode())
    assert.equal(quiet, false, `no call for ${JSON.stringify(missing)}`)
  }
  // A bridge that throws is reported and swallowed: the status bar is chrome, the conversation
  // is the product, and this call happens while the skin is being applied.
  const seen = []
  const angry = { set: () => { throw new Error('Method not found') } }
  assert.equal(withWindow(angry, () => publishStatusBarMode(error => seen.push(error))), false)
  assert.equal(seen.length, 1, 'and the failure is handed to the reporter')
  assert.equal(withWindow(angry, () => publishStatusBarMode()), false, 'no reporter is still no throw')
})

test('and the writer wires it, with the reader still feeding the frosted strip', () => {
  const index = readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8')
  assert.ok(index.includes("import { publishStatusBarMode } from './status-bar.js'"), 'imported')
  assert.ok(index.includes("publishStatusBarMode(quietly('status bar'))"), 'called where the theme is applied')
  assert.ok(index.includes("publishStatusBarMode(quietly('status bar'))\n      publishShellBackground()"), 'before the reader, which stays for the strip\'s tint')
})
