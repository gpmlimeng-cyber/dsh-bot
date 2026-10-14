// The touch feedback the two touch bands share. Android paints its own tap highlight -- the
// grey block that ignores this skin's radius and colours -- so the bands cancel it on the root
// (the property is inherited, which is also what reaches the controls the shell draws) and put
// our own press tint in its place. The tint is a background image rather than a colour, so a
// filled button keeps its fill and the tint is drawn inside whatever radius the element has;
// being a background layer it also changes no box, so a press cannot shift anything.
//
// Three things this file holds still, each of them a way the feedback could quietly regress:
// a selector that stops covering the role-based rows (the shell's own list rows are not
// buttons), a press state that moves to hover and then sticks after a long press, and a
// reduced-motion reset that leaves the press scale running. The desktop window publishes
// neither band, so everything asserted here can only ever reach a touch layout.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const lines = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8').split('\n')
const band = ':is(html[data-bt-mobile],html[data-bt-pc])'
const press = 'linear-gradient(var(--bt-active),var(--bt-active))'

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
})

test('reduced motion drops the press tint and the press scale together', () => {
  const reset = lines.findIndex(line => line.includes('background-image:none!important'))
  assert.ok(reset > 0, 'no reduced-motion reset of the press tint')
  const block = lines.slice(reset - 1, reset + 2).join('\n')
  assert.ok(block.includes('@media (prefers-reduced-motion:reduce)'), block)
  assert.ok(block.includes('transform:none') && block.includes('scale:none'), block)
  assert.ok(block.includes(band), block)
})
