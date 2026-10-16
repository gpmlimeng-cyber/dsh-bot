// The touch feedback the two touch bands share. Android paints its own tap highlight -- the
// grey block that ignores this skin's radius and colours -- so the bands cancel it on the root
// (the property is inherited, which is also what reaches the controls the shell draws) and put
// our own press tint in its place. The tint is a background image rather than a colour, so a
// filled button keeps its fill and the tint is drawn inside whatever radius the element has;
// being a background layer it also changes no box, so a press cannot shift anything.
//
// The same two bands carry the rest of the phone's chrome: the bar this WebView draws down
// the edge of anything that scrolls is hidden there -- on the band's own scroller and on every
// element under it -- with the scrolling itself left exactly as it was.
//
// Four things this file holds still, each of them a way this could quietly regress: a selector
// that stops covering the role-based rows (the shell's own list rows are not buttons), a press
// state that moves to hover and then sticks after a long press, a reduced-motion reset that
// silences the press colour instead of only the movement, and a scrollbar rule that either
// reaches past the bands or takes the scrolling away with the bar. The desktop window publishes
// neither band, so everything asserted here can only ever reach a touch layout.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const lines = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8').split('\n')
const band = ':is(html[data-bt-mobile],html[data-bt-pc])'
// One name for the press tint, so a change of feedback is one value; it aliases --bt-active, the
// token the sheet already defines for a held control.
const press = 'linear-gradient(var(--bt-press),var(--bt-press))'

test('the platform tap highlight is cancelled once, on both touch bands, and inherited', () => {
  const declared = lines.filter(line => line.includes('-webkit-tap-highlight-color'))
  assert.equal(declared.length, 1)
  assert.ok(declared[0].startsWith(`${band}{-webkit-tap-highlight-color:transparent}`), declared[0])
})

test('the press tint covers buttons and the role-based rows, on press only', () => {
  const tinted = lines.filter(line => line.includes(press))
  assert.equal(tinted.length, 1)
  const rule = tinted[0]
  assert.ok(rule.startsWith(`${band} :is(`), rule)
  for (const pressable of ['button', '[role="button"]', '[role="tab"]', '[role="option"]', '[role="menuitem"]']) {
    assert.ok(rule.includes(pressable), `${pressable} missing from ${rule}`)
  }
  assert.ok(rule.includes(':active'), rule)
  assert.ok(!rule.includes(':hover'), rule)
  assert.ok(rule.includes(':not(:disabled)'), rule)
  // A background image, so the element's own fill stays: a background colour here would paint
  // over the accent of every filled button in the skin.
  assert.ok(rule.includes('background-image:'), rule)
  assert.ok(!rule.includes('background-color:'), rule)
  // The bottom bar's tabs are excluded: a quarter of the bar wide and 56px tall, the tint
  // there is a block of colour under the thumb, which is the change the user called out.
  // They dim their own glyph instead (nav-bar.js), so the bar and the page keep their colour.
  assert.ok(rule.includes(':not(.bt-nav-tab)'), rule)
  const declared = lines.filter(line => line.includes('--bt-press:'))
  assert.equal(declared.length, 1, 'one definition for the tint')
  assert.ok(declared[0].includes('--bt-press:var(--bt-active)'), 'and it is the held-control colour it names')
})

test('reduced motion drops the press scale and leaves the press colour alone', () => {
  const reset = lines.findIndex(line => line.includes(':active{transform:none;scale:none}'))
  assert.ok(reset > 0, 'no reduced-motion reset of the press scale')
  const block = lines.slice(reset - 1, reset + 2).join('\n')
  assert.ok(block.includes('@media (prefers-reduced-motion:reduce)'), block)
  assert.ok(block.includes(band), block)
  // Reduce is about movement, and a device that turns system animations off reports reduce --
  // silencing the tint as well would leave those taps answering with nothing at all.
  assert.ok(!lines.some(line => line.includes(band) && line.includes('background-image:none')), 'reduced motion silences the tint again')
})

test('the mobile bands hide every scrollbar and keep the scrolling', () => {
  // One rule for the whole band, not a list of containers that goes stale the next time a
  // screen is added -- and the band element itself, whose scroller no descendant rule reaches.
  const width = lines.findIndex(line => line.includes('{scrollbar-width:none}'))
  assert.ok(width > 0, 'no scrollbar-width declaration')
  assert.equal(lines[width], `${band} *{scrollbar-width:none}`)
  assert.equal(lines[width - 1], `${band},`)
  const webkit = lines.findIndex(line => line.includes('display:none;width:0;height:0'))
  assert.ok(webkit > 0, 'no hidden scrollbar box')
  assert.equal(lines[webkit], `${band} ::-webkit-scrollbar{display:none;width:0;height:0}`)
  assert.equal(lines[webkit - 1], `${band}::-webkit-scrollbar,`)
  // Hiding the bar is visual only: nothing here takes a scroller's scrolling away.
  assert.ok(!lines[width].includes('overflow') && !lines[webkit].includes('overflow'), `${lines[width]} ${lines[webkit]}`)
  const list = lines.filter(line => line.startsWith('.bt-list{'))
  assert.equal(list.length, 1)
  assert.ok(list[0].includes('overflow-y:auto'), list[0])
  // And nothing bare: a `*` outside the band would reach the desktop window too.
  assert.ok(lines.every(line => !(line.includes('scrollbar') && /(^|,)\s*\*\{/.test(line))), 'a scrollbar rule escaped the bands')
})
