import assert from 'node:assert/strict'
import { test } from 'node:test'
import { teamRules } from '../src/host/prompt.js'
import { SA_FOLD_AT, foldAtOf, saOn } from '../src/client/themes.js'

// The SuperAgent page's switches are on unless someone wrote `false`; a missing key, an
// older state and a deleted key all read as on, which is what the page shows.
test('a SuperAgent switch is on unless it was written false', () => {
  assert.deepEqual([saOn({}, 'saFold'), saOn({ saFold: true }, 'saFold'), saOn({ saFold: false }, 'saFold'), saOn(undefined, 'saFold')], [true, true, false, true])
})

// One number decides where a group line folds; anything out of range reads as the default
// rather than folding a chat shut.
test('the fold threshold falls back to 1000/20 unless a value in range was saved', () => {
  assert.deepEqual(foldAtOf({}), SA_FOLD_AT)
  assert.deepEqual(foldAtOf({ saFoldAt: { chars: 500, lines: 8 } }), { chars: 500, lines: 8 })
  const bad = [
    { chars: 299, lines: 20 }, { chars: 20_001, lines: 20 }, { chars: 1000, lines: 7 }, { chars: 1000, lines: 501 },
    { chars: 1000.5, lines: 20 }, { chars: 1000 }, 'x', null,
  ]
  assert.deepEqual(bad.map(saFoldAt => foldAtOf({ saFoldAt })), bad.map(() => SA_FOLD_AT))
})

// The four rules the page switches live at the end of the team rules: with every switch on
// the text is exactly what it was before the page existed, and it stays byte-stable.
test('the team rules keep their four optional lines, and change nothing while the switches do not', () => {
  const all = teamRules({})
  const lines = (text) => text.split('\n')
  assert.equal(all, teamRules({}), 'the same switches give the same bytes')
  assert.deepEqual(lines(all).slice(-4).map(line => line.slice(0, 11)), ['- In a grou', '- When what', '- A command', '- You may p'])
  const off = teamRules({ saConclude: false, saLookup: false, saBackground: false, saPrepare: false })
  assert.equal(lines(off).length, lines(all).length - 4)
  assert.ok(!off.includes('Look it up') && !off.includes('- You may prepare ahead'))
  // One switch off drops one line and leaves the rest in order.
  const half = teamRules({ saLookup: false })
  assert.equal(lines(half).length, lines(all).length - 1)
  assert.ok(!half.includes('- When what you say depends on something said earlier'))
  assert.ok(half.includes('- A command that may take more than a few seconds'))
})
