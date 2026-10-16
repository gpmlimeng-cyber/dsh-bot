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
const lines = styles.split('\n')
const rule = (selector) => lines.find(line => line.startsWith(selector))

test('the add button is a bare glyph, with no fill and no hairline of its own', () => {
  const plus = rule('.bt-plus{')
  assert.ok(plus, 'the button has a rule')
  assert.ok(plus.includes('background:none'), `no fill of its own: ${plus}`)
  assert.ok(plus.includes('box-shadow:none'), `no hairline of its own: ${plus}`)
  assert.ok(plus.includes('border:0'), `and no border: ${plus}`)
  // The glyph is deliberately large and dark -- the user asked for it bigger and more visible,
  // which replaced the sampled pair (13px in #8f8f8f) this rule was first drawn with. The ink
  // is the theme's own, so dark comes with it and needs no override.
  assert.ok(rule('.bt-plus svg{').includes('width:20px') && rule('.bt-plus svg{').includes('height:20px'), 'a 20px glyph')
  assert.ok(plus.includes('color:var(--bt-ink)'), `the theme's own ink: ${plus}`)
  assert.ok(!styles.includes('data-ds-dark-theme] .bt-plus'), 'so dark needs no rule of its own')
  // The hit area stays inside the card's content box: 44px tall less two 7.5px paddings is 29px,
  // so a 32px button would grow the card and move the dock that was just measured.
  assert.ok(plus.includes('width:28px') && plus.includes('height:28px'), 'a 28px target')
  // Feedback stays: held and open-then-closed are different from rest, or the button would
  // answer nothing at all. The two are separate rules now -- the expanded state has to work under a
  // finger, and a hover belongs to a pointer (every hover in this skin lives in (hover:hover)).
  assert.ok(rule('.bt-plus[aria-expanded=true]{').includes('background:'), 'a light tint while it is open')
  assert.ok(lines.includes('.bt-plus:hover{background:color-mix(in srgb,var(--bt-ink) 10%,transparent);color:var(--bt-ink)}'), 'and the same tint for a pointer, inside the pointer block')
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
test('the composer docks 8px, above the bar and above the keyboard alike', () => {
  const dock = lines.find(line => line.includes('[class*="_root"]:has(> [data-composer-card]){padding-bottom:8px'))
  assert.ok(dock, 'the tighter dock has a rule')
  // One rule for both states: docked against the bar, and docked against the keyboard (the
  // platform's own 16px held the card off the keyboard, measured on the device).
  assert.ok(dock.startsWith('html[data-bt-mobile][data-bt-portrait] '), dock)
  assert.ok(!dock.includes('data-bt-keyboard'), 'and it is not gated off for the keyboard')
  // The reservation the bar relies on is untouched: it is the nav's own tokens, and no rule
  // in this file changes them.
  assert.ok(!styles.includes('--bt-nav-h:8px') && !styles.includes('--bt-nav-gap:8px'), 'the bar reservation is not what shrank')
  assert.ok(read('nav-bar.js').includes('--bt-nav-h:56px'), 'and it is still 56px, declared once')
})
