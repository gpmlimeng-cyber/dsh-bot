import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PC_DETAILS_MAX, PC_DETAILS_RATIO, PC_QUERY, pcDetailsWidth, pcSidebarStep, shellCollapsed } from '../src/client/pc-layout.js'

// The sidebar column the shell keeps below its own 1024 line has to be opened for the PC
// band and closed again on the way out, and only ever on a band change. Each case below is
// one hand on the device: fold, unfold, and what the user did inside the band.

test('the band opens a collapsed column and remembers that it did', () => {
  assert.deepEqual(pcSidebarStep(null, true, true, false), { call: 'expand', opened: true })
})

test('a column the user already had open is not claimed', () => {
  // The slot's own expand is a no-op on an open column, so the call is safe either way --
  // but the exit must not close a column this band did not open.
  assert.deepEqual(pcSidebarStep(null, true, false, false), { call: 'expand', opened: false })
})

test('inside the band nothing acts, so a column the user folded stays folded', () => {
  assert.deepEqual(pcSidebarStep(true, true, true, true), { call: null, opened: true })
  assert.deepEqual(pcSidebarStep(true, true, false, false), { call: null, opened: false })
})

test('leaving the band closes the column this band opened', () => {
  assert.deepEqual(pcSidebarStep(true, false, false, true), { call: 'collapse', opened: false })
})

test('leaving the band leaves a column the user had open alone', () => {
  assert.deepEqual(pcSidebarStep(true, false, false, false), { call: null, opened: false })
})

test('leaving a column the user folded inside the band does not toggle it back open', () => {
  // The only handle on the closing direction is a toggle, so a collapse call here would
  // unfold the column instead of tidying up after this band.
  assert.deepEqual(pcSidebarStep(true, false, true, true), { call: null, opened: false })
})

test('the first pass counts as a change, in either direction', () => {
  assert.deepEqual(pcSidebarStep(null, false, false, false), { call: null, opened: false })
  assert.deepEqual(pcSidebarStep(null, false, true, true), { call: null, opened: false })
})

test('the band query is the one complement of the phone layout', () => {
  assert.equal(PC_QUERY, '(min-width:841px) and (max-width:1023px) and (orientation:landscape)')
})

const doc = ({ collapsed, columnWidth } = {}) => ({
  querySelector: (selector) => {
    if (selector.includes('data-sidebar-collapsed')) return collapsed ? {} : null
    if (selector.includes('_sidebarCol')) return columnWidth === undefined ? null : { getBoundingClientRect: () => ({ width: columnWidth }) }
    return null
  },
})

test('the frame attribute is the shell\u2019s own verdict on the collapsed column', () => {
  assert.equal(shellCollapsed(doc({ collapsed: true, columnWidth: 55.64 }), true), true)
  assert.equal(shellCollapsed(doc({ collapsed: false, columnWidth: 280 }), false), false)
})

test('without the attribute the column\u2019s rendered width settles it', () => {
  // `wide` is `!collapsed || !settled` below the shell's 1024 line, so it can still read
  // true for the few hundred ms a fold takes -- the rail is 56px wide and the column 264+.
  assert.equal(shellCollapsed(doc({ columnWidth: 55.64 }), true), true)
  assert.equal(shellCollapsed(doc({ columnWidth: 280 }), false), false)
})

test('with no frame at all the slot prop is the last resort', () => {
  assert.equal(shellCollapsed(doc({}), true), false)
  assert.equal(shellCollapsed(doc({}), false), true)
  assert.equal(shellCollapsed({}, true), false)
  assert.equal(shellCollapsed(undefined, false), true)
})

// The panel's width in the band. The device reports 859 x 608 for the unfolded window.
test('the details column is 292 of an 859px window, capped at 300', () => {
  assert.equal(pcDetailsWidth(859), 292)
  assert.equal(pcDetailsWidth(850), Math.round(850 * PC_DETAILS_RATIO))
  assert.equal(pcDetailsWidth(1200), PC_DETAILS_MAX)
  assert.equal(pcDetailsWidth(841), Math.round(841 * PC_DETAILS_RATIO))
})

test('every width the band can ask for stays under the desktop default it replaces', () => {
  // browser-pane.js keeps 320 for the desktop window; the band must not silently resolve to
  // it, or the conversation column loses the room the 292 was chosen for.
  for (let viewport = 841; viewport <= 1023; viewport += 1) {
    const width = pcDetailsWidth(viewport)
    assert.ok(width <= PC_DETAILS_MAX, `${viewport} -> ${width}`)
    assert.ok(width < 320, `${viewport} -> ${width}`)
  }
})
