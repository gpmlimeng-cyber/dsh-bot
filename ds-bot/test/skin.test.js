import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
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
