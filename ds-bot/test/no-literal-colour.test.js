// A colour is a token, not a number typed where it is used. The same red was written out at
// eighteen places, the same amber at six with three different values, and nothing could tell that
// a theme change had missed one of them -- so this is the lint that keeps the sheet's colours in
// one place: the token block in styles.js (body{...}, and its dark twin), with the palettes that
// are colours by trade (themes.js, inks.js) beside it.
//
// It reads every client module, skips comments, and reports any chromatic value written as a
// literal: a hex whose three channels are not equal, or an rgb()/rgba() the same way. Neutral
// values are left alone on purpose -- a shadow or a scrim is black or white at some alpha, and
// there is nothing to tokenise about it. Two values that are not CSS are named in ALLOW with the
// reason they stay: they are read by JS, not painted by a rule, so a token could not reach them.
//
// What it cannot see, written down so the gap is not mistaken for coverage: a colour that arrives
// from JS (a stored preference, the shell's own variables), a neutral that has drifted off grey
// (r=g=b passes), and a colour inside a data: URL or an inline SVG -- those are drawings, and the
// one in characters.js is named in ALLOW for exactly that reason.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const DIR = new URL('../src/client/', import.meta.url)

/** The modules whose whole job is to hold colours, so a literal there is the point rather than a leak. */
const PALETTES = new Set(['themes.js', 'inks.js'])

/** Values that are not CSS: read by JS, where a token cannot follow. Each one with its reason. */
const ALLOW = new Map([
  ['characters.js: #1783FF', 'the character avatar draws its own mark in a glyph it hands to the shell -- a drawing, not a skin surface (Lead: leave it)'],
  ['settings.js: #4d6bfe', 'the custom-accent field\u2019s starting value; the comment beside it says it must equal --bt-accent (styles.js, the token block)'],
])

const read = (name) => readFileSync(new URL(name, DIR), 'utf8')

/** Blanks out comments, keeping newlines so line numbers survive. A `//` inside a value (a data:
 *  URL's own http://) is not a comment, so a colon in front of it keeps the text. */
const uncommented = (text) => {
  const out = text.split('')
  let i = 0
  while (i < text.length) {
    const block = text.startsWith('/*', i)
    const line = text.startsWith('//', i) && text[i - 1] !== ':'
    if (!block && !line) { i += 1; continue }
    const close = block ? text.indexOf('*/', i + 2) : text.indexOf('\n', i)
    const end = close === -1 ? text.length : close + (block ? 2 : 0)
    for (let j = i; j < end; j += 1) if (out[j] !== '\n') out[j] = ' '
    i = end
  }
  return out.join('')
}

/** Every hex whose channels are not all equal, and every rgb()/rgba() the same way. */
const chromatics = (raw) => {
  const out = []
  for (const hit of raw.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const h = hit[1]
    const full = h.length <= 4 ? h.split('').map(c => c + c).join('') : h
    const [r, g, b] = [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16))
    if (r !== g || g !== b) out.push(hit[0])
  }
  for (const hit of raw.matchAll(/rgba?\(([^)]*)\)/g)) {
    const n = (hit[1].match(/\d+(\.\d+)?/g) ?? []).map(Number)
    if (n.length >= 3 && !(n[0] === n[1] && n[1] === n[2])) out.push(hit[0])
  }
  return out
}

/** Whether this line is one of the two token blocks that ARE the colours (styles.js). */
const isTokenBlock = (line) => /^body(\[data-ds-dark-theme\])?\{--bt-nav-ink:/.test(line)

test('no client module paints with a colour literal', () => {
  const found = []
  const used = new Set()
  for (const file of readdirSync(DIR).filter(name => name.endsWith('.js'))) {
    if (PALETTES.has(file)) continue
    const lines = uncommented(read(file)).split('\n')
    lines.forEach((line, index) => {
      if (isTokenBlock(line)) return
      for (const part of line.split(/[;{}]/)) {
        for (const literal of chromatics(part)) {
          const key = `${file}: ${literal}`
          if (ALLOW.has(key)) { used.add(key); continue }
          found.push(`${file}:${index + 1} ${literal}  in \`${part.trim().slice(0, 60)}\``)
        }
      }
    })
  }
  const stale = [...ALLOW.keys()].filter(key => !used.has(key))
  assert.deepEqual(stale, [], `an allowance that no longer names anything is hiding nothing: ${stale.join(', ')}`)
  // The message names the remedy, and the offenders the assertion reports carry their own file, line and
  // declaration -- an earlier wording put "(styles.js, the token block)" in the headline, which read as
  // the place the colour was found rather than the place it should have been read from.
  assert.deepEqual(found, [], found.length
    ? `read these from a token (styles.js:62, the body block) instead of writing them where they are used:\n  ${found.join('\n  ')}`
    : '')
})
