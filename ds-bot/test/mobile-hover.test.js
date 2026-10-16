// The root of the "tapped and it stayed highlighted" family: a rule that answers :hover answers it on a
// finger too, because an Android tap leaves that pseudo-class set on whatever it touched -- so a control
// that lights up under a cursor lights up and stays lit under a thumb. The skin's answer is that no rule
// here reacts to :hover unless the device admits to a pointer, which is what @media (hover:hover) (and
// pointer:fine) mean.
//
// This is the one that keeps it that way. It is a lint, not a style preference: it reads every CSS-bearing
// module in the client and reports any :hover whose enclosing media never asks for a pointer. Comments are
// skipped, so a rule may still be *mentioned* in prose; state selectors that a touch device needs
// ([aria-expanded=true], [aria-pressed=true], :focus-visible) are not hover and are left alone, which is
// why a shared selector had to be split rather than moved whole.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const DIR = new URL('../src/client/', import.meta.url)

const commentMask = (text) => {
  const masked = new Uint8Array(text.length + 1)
  let i = 0
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      masked.fill(1, i, stop + 1)
      i = stop
    } else if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      masked.fill(1, i, stop + 1)
      i = stop
    } else i += 1
  }
  return masked
}

const matching = (text, masked, open) => {
  let depth = 0
  for (let j = open; j < text.length; j += 1) {
    if (masked[j]) continue
    if (text[j] === '{') depth += 1
    else if (text[j] === '}') {
      depth -= 1
      if (depth === 0) return j
    }
  }
  return -1
}

/** Every @media condition enclosing `pos`, innermost last -- comments are not conditions. */
const mediaAt = (text, masked, pos) => {
  const out = []
  let i = 0
  while (i < pos) {
    if (masked[i] || !text.startsWith('@media', i)) {
      i += 1
      continue
    }
    const open = text.indexOf('{', i)
    if (open === -1 || open > pos) {
      i += 1
      continue
    }
    const close = matching(text, masked, open)
    if (close > pos) out.push(text.slice(i, open).trim())
    i = open + 1
  }
  return out
}

const offenders = () => {
  const found = []
  for (const name of readdirSync(DIR).filter(file => file.endsWith('.js'))) {
    const text = readFileSync(new URL(name, DIR), 'utf8')
    if (!text.includes(':hover')) continue
    const masked = commentMask(text)
    let at = text.indexOf(':hover')
    while (at !== -1) {
      // A :hover inside a media *condition* ("@media (hover:hover)") is not a selector: the prelude of
      // the media rule reaches the brace that opens its body, and anything before that brace is the
      // condition itself.
      const prelude = text.lastIndexOf('@media', at)
      const inCondition = prelude !== -1 && text.indexOf('{', prelude) > at
      if (!masked[at] && !inCondition) {
        const conds = mediaAt(text, masked, at)
        if (!conds.some(cond => cond.includes('hover:hover') || cond.includes('pointer:fine'))) {
          found.push(`${name}:${text.slice(0, at).split('\n').length}`)
        }
      }
      at = text.indexOf(':hover', at + 6)
    }
  }
  return found
}

test('no rule reacts to :hover without asking for a pointer', () => {
  const found = offenders()
  assert.deepEqual(found, [], `bare :hover outside @media (hover:hover): ${found.join(', ')}`)
})
