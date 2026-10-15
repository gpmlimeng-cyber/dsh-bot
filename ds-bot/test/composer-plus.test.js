// The add button in the composer. The user pointed at a reference app's composer and asked for
// its shape: a bare glyph rather than a chip. That part needs no measurement -- what has to be
// measured is the icon's size and ink, and the bar's radius, which come from the device
// sampling and land here as one-line changes.
//
// What this file holds is the part that must not drift while those numbers are argued about:
// the button has no fill and no hairline of its own, and it is still a working menu button.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const styles = read('styles.js')
const rule = (selector) => styles.split('\n').find(line => line.startsWith(selector))

test('the add button is a bare glyph, with no fill and no hairline of its own', () => {
  const plus = rule('.bt-plus{')
  assert.ok(plus, 'the button has a rule')
  assert.ok(plus.includes('background:none'), `no fill of its own: ${plus}`)
  assert.ok(plus.includes('box-shadow:none'), `no hairline of its own: ${plus}`)
  assert.ok(plus.includes('border:0'), `and no border: ${plus}`)
  // The icon is what carries it, so the glyph must not be sized to nothing either.
  assert.ok(rule('.bt-plus svg{').includes('width:'), 'the glyph is sized')
  // Feedback stays: held and open-then-closed are different from rest, or the button would
  // answer nothing at all.
  assert.ok(rule('.bt-plus:hover,.bt-plus[aria-expanded=true]{').includes('background:'), 'a light tint when it is live')
})

test('and it is still the button that opens the add menu', () => {
  const composer = read('composer.js')
  assert.ok(composer.includes("className: 'bt-plus'"), 'the button is ours')
  assert.ok(composer.includes("'aria-haspopup': 'menu'"), 'and announces the menu it opens')
  assert.ok(composer.includes("className: 'bt-menu bt-menu-up bt-plus-menu'") && composer.includes('createPortal'), 'the menu is portalled as before')
  assert.ok(composer.includes('onClick: toggle'), 'and the same toggle is wired')
  // The platform's own add button stays hidden: two plus signs in one row is the thing this
  // skin removed, and the sampling above is about OUR button.
  assert.ok(styles.includes('[data-composer-card] button[class*="_add"]{display:none!important}'), 'no second plus sign')
})
