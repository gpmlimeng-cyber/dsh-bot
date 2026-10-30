import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { modeRowSlot, placeModeRow } from '../src/client/mode-row.js'

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const { JSDOM } = createRequire(join(process.env.DSH_HARNESS ?? join(PLUGIN, '..', 'deepseek-harness'), 'package.json'))('jsdom')

// A page with the drawer form's marker; the host plugin stamps it when the sidebar becomes
// the drawer, and the row follows it into the sidebar.
const page = ({ drawer = true, sidebar = true } = {}) => {
  const dom = new JSDOM(`<!doctype html><body>${drawer ? '<div data-mobile-nav="frame"></div>' : ''}${sidebar ? '<div class="bt-side"><div class="bt-side-top"></div></div>' : ''}</body>`)
  return dom.window.document
}

const row = document => {
  const node = document.createElement('button')
  node.className = 'bt-modebar'
  return node
}

test('a desktop window keeps the row in the band', () => {
  const document = page({ drawer: false })
  assert.equal(modeRowSlot(document), document.body)
  const bar = row(document)
  placeModeRow(document, [bar])
  assert.equal(bar.parentNode, document.body)
})

test('a phone puts the row in the drawer, not over the page', () => {
  const document = page()
  const side = document.querySelector('.bt-side')
  assert.equal(modeRowSlot(document), side)
  const bar = row(document)
  const actions = document.createElement('div')
  placeModeRow(document, [bar, actions])
  assert.equal(bar.parentNode, side)
  // The drawer's own content keeps its place below the row.
  assert.equal(side.firstChild, bar)
  assert.equal(bar.nextSibling, actions)
  // Nothing floats over the page while the drawer is closed: the row is the drawer's,
  // not the page's.
  assert.notEqual(bar.parentNode, document.body)
  assert.equal(document.body.children.length, 2)
})

test('a drawer without the sidebar leaves the row in the band, not nowhere', () => {
  const document = page({ sidebar: false })
  assert.equal(modeRowSlot(document), document.body)
})

test('painting again never doubles the row', () => {
  const document = page()
  const side = document.querySelector('.bt-side')
  const bar = row(document)
  const actions = document.createElement('div')
  placeModeRow(document, [bar, actions])
  placeModeRow(document, [bar, actions])
  assert.equal(side.querySelectorAll('.bt-modebar').length, 1)
  assert.equal(bar.parentNode, side)
})
