// The dictionary is keyed by the English copy itself, so a mistake is silent: a duplicated
// key shadows the first entry, and copy the host renders that the table never learned comes
// out in English. i18n.test.js covers the client → table direction; this covers the other
// side (the host) and the duplicate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { DICTIONARY } from '../src/client/i18n.js'

const SOURCE = new URL('../src/client/i18n.js', import.meta.url)
// The host renders its own copy through the same table, so its literals count too.
const DIRS = ['../src/client/', '../src/host/']

const referenced = () => {
  const keys = new Set()
  for (const dir of DIRS) {
    for (const name of readdirSync(new URL(dir, import.meta.url)).filter(file => file.endsWith('.js'))) {
      const text = readFileSync(new URL(name, new URL(dir, import.meta.url)), 'utf8')
      for (const match of text.matchAll(/\b(?:t|hostText)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
        keys.add(match[2].replace(/\\'/g, "'"))
      }
    }
  }
  return keys
}

test('no English copy is keyed twice', () => {
  const text = readFileSync(SOURCE, 'utf8')
  const start = text.indexOf('const ZH = {')
  const end = text.indexOf('\n}\n', start)
  assert.notEqual(start, -1, 'the Chinese table is gone')
  assert.notEqual(end, -1, 'the Chinese table has no end')
  const seen = new Map()
  const duplicates = []
  for (const match of text.slice(start, end).matchAll(/^\s{2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))\s*:/gm)) {
    const key = match[1] ?? match[2] ?? match[3]
    if (seen.has(key)) duplicates.push(key)
    seen.set(key, true)
  }
  assert.deepEqual(duplicates, [], 'a duplicated key keeps only the last translation')
})

test('every literal the client or the host translates has a Chinese entry', () => {
  const missing = [...referenced()].filter(key => !Object.hasOwn(DICTIONARY.zh, key)).sort()
  assert.deepEqual(missing, [])
})
