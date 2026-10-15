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
  // Size and ink are the pair sampled off the reference: a 13px glyph, and the light grey it
  // is drawn in. Both are one-line changes, and both are pinned here so a later edit is
  // deliberate rather than accidental.
  assert.ok(rule('.bt-plus svg{').includes('width:13px') && rule('.bt-plus svg{').includes('height:13px'), 'the glyph is 13px, as sampled')
  assert.ok(plus.includes('color:#8f8f8f'), `the sampled ink: ${plus}`)
  assert.ok(styles.includes('body[data-ds-dark-theme] .bt-plus{color:var(--bt-ink-2)}'), 'dark keeps the skin\'s own ink')
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

// The composer's gap to the bar. It was 16px -- the composer's own bottom padding -- and read
// as a gap rather than a dock; the user asked for it closer. What must not move is the
// column's 56px reservation, which is what keeps the bar from covering anything.
test('the composer docks 8px above the bar, and only in the state the user was looking at', () => {
  const dock = styles.split('\n').find(line => line.includes('data-bt-keyboard]) [class*="_root"]'))
  assert.ok(dock, 'the tighter dock has a rule')
  assert.ok(dock.startsWith('html[data-bt-mobile][data-bt-portrait]:not([data-bt-keyboard]) '), dock)
  assert.ok(dock.includes('padding-bottom:8px!important'), dock)
  // The reservation the bar relies on is untouched: it is the nav's own tokens, and no rule
  // in this file changes them.
  assert.ok(!styles.includes('--bt-nav-h:8px') && !styles.includes('--bt-nav-gap:8px'), 'the bar reservation is not what shrank')
  assert.ok(read('nav-bar.js').includes('--bt-nav-h:56px'), 'and it is still 56px, declared once')
})
