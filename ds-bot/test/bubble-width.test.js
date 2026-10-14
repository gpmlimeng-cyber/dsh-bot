// A phone reads a bubble's two margins as one number. A group Bot's row carries a 22px face and
// the 8px gutter beside it on the left, so at the shared cap the bubble sat 30px in on that side
// and 70px short on the other; the phone takes the same 30px off the row's measure, which leaves
// the bubble 30px of air on both sides without moving the avatar or where the text starts. A
// one-to-one chat has no avatar column, so it takes nothing and keeps the base cap.
//
// Five things this file holds still, each a way the change could quietly go wrong: the share cap
// surviving as the answer for every wider band (a tablet has room, and the 680px floor makes the
// cap the difference between a column and a wall of text), the subtraction reaching the desktop
// window or a one-to-one chat, the user's own bubbles being retuned along with the Bot's (they
// are their own rows -- .bt-umsg in the live transcript, .bt-urow/.bt-ububble in the earlier
// pages and the group replies, all drawn beside a Bot stack and never inside one), the tools
// being moved on a band that still has room beside the bubble, and a row asking for the whole
// measure: at 100% the toolbar beside such a row reached past the viewport (76px of buttons,
// laid out at 100% of the row) and the page scrolled sideways, which is what the tools moving
// under the bubble also fixed.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const styles = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8').split('\n')
const messages = readFileSync(new URL('../src/client/user-message.js', import.meta.url), 'utf8').split('\n')
const compact = 'html[data-bt-mobile][data-bt-size=compact]'
const mobile = 'html[data-bt-mobile]'
const domain = '[class*="_body"]:has(> [class*="_scrollBody"])'

test('the share cap keeps its own rule, and only a group Bot row takes 30px off', () => {
  const cap = styles.filter(line => line.startsWith(`${domain}{--bt-bubble-max`))
  assert.equal(cap.length, 1)
  assert.ok(cap[0].includes('.702'), cap[0])
  const row = styles.filter(line => line.includes('{--bt-bubble-max:calc(100% - 30px)}'))
  assert.equal(row.length, 1, 'the subtraction is declared once')
  // The avatar column is what holds the left margin: without one the row would be indented on
  // one side only, so a one-to-one chat keeps the base cap.
  assert.equal(row[0], `${compact} ${domain} .bt-astack[data-lead]{--bt-bubble-max:calc(100% - 30px)}`)
})

test('only the phone takes it, and no band asks a bubble for the whole measure', () => {
  for (const line of [...styles, ...messages]) {
    if (!line.includes('--bt-bubble-max:calc(100%')) continue
    assert.ok(line.startsWith(compact), line)
  }
  assert.ok(!styles.some(line => line.includes('--bt-bubble-max:100%')), 'a row asks for the whole measure')
})

test("the user's own bubbles keep the base cap", () => {
  assert.ok(!styles.some(line => line.startsWith(compact) && line.includes('.bt-umsg')), 'the phone retunes the user row')
  assert.ok(!styles.some(line => line.startsWith(compact) && line.includes('.bt-urow')), 'the phone retunes the user rows')
  const stack = messages.filter(line => line.startsWith('.bt-ustack{'))
  assert.equal(stack.length, 1)
  assert.ok(stack[0].includes('max-width:var(--bt-bubble-max)'), stack[0])
})

test('the phone puts the tools under the bubble, past a group avatar column', () => {
  const base = styles.filter(line => line.startsWith('.bt-tools{'))
  assert.equal(base.length, 1)
  // Where a pointer is: beside the bubble, in a column of its own.
  assert.ok(base[0].includes('left:100%'), base[0])
  const moved = styles.filter(line => line.startsWith(mobile) && line.includes('.bt-tools'))
  assert.deepEqual(moved.map(line => line.slice(mobile.length)), [
    '[data-bt-size=compact] .bt-tools{top:100%;left:0;margin:6px 0 0;transform:none}',
    '[data-bt-size=compact] .bt-astack[data-lead] .bt-tools{left:30px}',
    '[data-bt-size=compact] .bt-tools::after{display:none}',
  ])
})
