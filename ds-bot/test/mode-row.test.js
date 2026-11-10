import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { modeRowSlot, placeModeRow } from '../src/client/mode-row.js'

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const { JSDOM } = createRequire(join(process.env.DSH_HARNESS ?? join(PLUGIN, '..', 'deepseek-harness'), 'package.json'))('jsdom')

// A page with the shell's sidebar, which no longer takes the row: there is no drawer form.
const page = ({ sidebar = true } = {}) => {
  const dom = new JSDOM(`<!doctype html><body>${sidebar ? '<div class="bt-side"><div class="bt-side-top"></div></div>' : ''}</body>`)
  return dom.window.document
}

const row = document => {
  const node = document.createElement('button')
  node.className = 'bt-modebar'
  return node
}

test('a desktop window keeps the row in the band', () => {
  const document = page()
  assert.equal(modeRowSlot(document), document.body)
  const bar = row(document)
  placeModeRow(document, [bar])
  assert.equal(bar.parentNode, document.body)
})

test('painting again never doubles the row', () => {
  const document = page()
  const bar = row(document)
  const actions = document.createElement('div')
  placeModeRow(document, [bar, actions])
  placeModeRow(document, [bar, actions])
  assert.equal(document.body.querySelectorAll('.bt-modebar').length, 1)
  assert.equal(bar.parentNode, document.body)
})
