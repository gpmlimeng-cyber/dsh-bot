// What a bubble is allowed to be wide. On a desktop window the share cap stands (a column at the
// shell's own measure keeps the line short of a wall of text, and the tools stand beside the
// bubble). On the phone's two narrow bands -- a hand, and the small tablet held upright -- the user
// asked for the bubble to match the input card: the card is the same column less its 16px gutters
// and a row runs inside those gutters, so the row's own measure is the answer, the left edge is
// already on the card's line, and a group's row gives its avatar column (30px) back.
//
// Four things this file holds still, each a way the change could quietly go wrong: the share cap
// surviving as the answer for the wider band, the subtraction being declared once and only where
// an avatar column exists, the user's own rows not being retuned separately (they read the same
// token; .bt-umsg in the live transcript, .bt-urow/.bt-ububble in the earlier pages and the group
// replies), and the tools moving under the bubble on exactly the bands that get the wide cap --
// beside a row at the whole measure they reached past the viewport and scrolled the page sideways.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const styles = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8').split('\n')
const messages = readFileSync(new URL('../src/client/user-message.js', import.meta.url), 'utf8').split('\n')
const narrow = 'html[data-bt-mobile]:not([data-bt-size=expanded])'
const mobile = 'html[data-bt-mobile]'
const domain = '[class*="_body"]:has(> [class*="_scrollBody"])'

test('the share cap keeps its own rule, and only a group Bot row takes 30px off', () => {
  const cap = styles.filter(line => line.startsWith(`${domain}{--bt-bubble-max`))
  assert.equal(cap.length, 1)
  assert.ok(cap[0].includes('.702'), cap[0])
  const row = styles.filter(line => line.includes('{--bt-bubble-max:calc(100% - 30px)}'))
  assert.equal(row.length, 1, 'the subtraction is declared once')
  // The avatar column is what holds the left margin: without one the row would be indented on
  // one side only, so a one-to-one chat keeps the cap above.
  assert.equal(row[0], `${narrow} ${domain} .bt-astack[data-lead]{--bt-bubble-max:calc(100% - 30px)}`)
})

test('only the narrow bands of the mobile layout take it, never a desktop window', () => {
  for (const line of [...styles, ...messages]) {
    if (!line.includes('--bt-bubble-max:calc(100%')) continue
    assert.ok(line.startsWith(narrow), line)
  }
  // The whole measure is asked for on those bands only, and always as the row's own 100%.
  const whole = styles.filter(line => line.includes('--bt-bubble-max:min(var(--dsh-chat-content-width,748px),100%)'))
  assert.equal(whole.length, 1, 'declared once')
  assert.ok(whole[0].startsWith(`${narrow} ${domain}{`), whole[0])
})

// The user asked for both kinds of bubble to start on the input card's left edge and grow right, so
// the user's own rows stopped hugging the right: the live transcript's row (row-reverse, with the
// stack's items at flex-end) and the earlier pages' / group replies' row both start from the left now.
test('both sides start on the left edge and grow right', () => {
  const umsg = messages.find(line => line.startsWith('.bt-umsg{'))
  assert.ok(umsg.includes('flex-direction:row;') && umsg.includes('justify-content:flex-start'), umsg)
  assert.ok(!umsg.includes('row-reverse'), 'the row no longer hugs the right')
  const ustack = messages.find(line => line.startsWith('.bt-ustack{'))
  assert.ok(ustack.includes('align-items:flex-start'), ustack)
  const uattach = messages.find(line => line.startsWith('.bt-uattach{'))
  assert.ok(uattach.includes('justify-content:flex-start'), uattach)
  assert.ok(styles.some(line => line.startsWith('.bt-urow{display:flex;justify-content:flex-start}')), 'and the earlier pages agree')
})

test("the user's own bubbles keep the base cap", () => {
  assert.ok(!styles.some(line => line.startsWith(narrow) && line.includes('.bt-umsg')), 'the phone retunes the user row')
  assert.ok(!styles.some(line => line.startsWith(narrow) && line.includes('.bt-urow')), 'the phone retunes the user rows')
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
    ':not([data-bt-size=expanded]) .bt-tools{top:100%;left:0;margin:6px 0 0;transform:none}',
    ':not([data-bt-size=expanded]) .bt-astack[data-lead] .bt-tools{left:30px}',
    ':not([data-bt-size=expanded]) .bt-tools::after{display:none}',
  ])
})
