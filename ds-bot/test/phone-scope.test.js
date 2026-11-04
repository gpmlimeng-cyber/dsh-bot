import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// The phone's rules all key off the drawer marker. A class cannot tell them apart: every
// class that appears under the marker also carries a desktop base rule (`.bt-row`,
// `.bt-head-btn` …), so the sheet's own count of marked rules is the only honest record.
// Adding phone rules means adding the marker first, then bumping this number.
const MARKED_PHONE_RULES = 66
const MARKER = '[data-mobile-nav="frame"]'

// Plain one-line rules: everything in `src/client/styles.js` that looks like CSS.
function selectors(text) {
  const found = []
  for (const line of text.split('\n')) {
    const code = line.trim()
    if (!code.includes('{') || !code.includes(':') || code.startsWith('//') || code.startsWith('*')) continue
    if (code.includes('/* vendored */')) continue
    const open = code.indexOf('{')
    if (!code.slice(open + 1).includes(':')) continue
    found.push(code.slice(0, open).replace(/^.*[}]\s*/, '').trim())
  }
  return found.filter(name => name && !name.includes('${') && !name.includes('`') && !name.includes('=>'))
}

const rules = selectors(readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8'))
const marked = rules.filter(selector => selector.includes(MARKER))

test('the phone keeps every rule that carries the drawer marker', () => {
  assert.ok(marked.length >= MARKED_PHONE_RULES, `the phone lost rules: ${marked.length} of ${MARKED_PHONE_RULES}`)
})

test('the skin never adds a rule outside the phone', () => {
  // The skin's tokens paint nothing on their own; every consumer must carry the marker.
  const skin = rules.filter(selector => selector.includes(':not([data-bt-skin=ours])'))
  assert.ok(skin.length >= 7, `expected the skin rules, found ${skin.length}`)
  for (const selector of skin) {
    assert.ok(selector.includes(MARKER), `a skin rule is not scoped to the phone: ${selector}`)
  }
})
