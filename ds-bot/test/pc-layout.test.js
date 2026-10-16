import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PC_DETAILS_MAX, PC_DETAILS_RATIO, PC_QUERY, pcDetailsWidth, pcSidebarStep, shellCollapsed } from '../src/client/pc-layout.js'

// The sidebar column the shell keeps below its own 1024 line has to be opened for the PC
// band and closed again on the way out, and only ever on a band change. Each case below is
// one hand on the device: fold, unfold, and what the user did inside the band.

test('the band opens the column on entry, whether or not it was already up', () => {
  // The slot's own expand is a no-op on an open column, so the call is safe either way; what
  // matters is that a wrong `collapsed` read cannot leave the band without its column.
  assert.equal(pcSidebarStep(null, true, true), 'expand')
  assert.equal(pcSidebarStep(null, true, false), 'expand')
})

test('inside the band nothing acts, so a column the user folded stays folded', () => {
  // The second case is also the remount case, and it is the one that failed on the device: the
  // shell swaps the column between its wide tree and its rail tree once its own `settled`
  // catches up, which unmounts the component this step runs in. Held in a ref, the band came
  // back null and the next pass read as an entry and re-opened the column -- a fold that undid
  // itself two seconds later. It is module state now (pc-layout.js, pcSidebarMemory), and this
  // case is what that memory is asked.
  assert.equal(pcSidebarStep(true, true, true), null)
  assert.equal(pcSidebarStep(true, true, false), null)
})

test('leaving the band closes an open column, whoever opened it', () => {
  // The measured leak: the column was already open before the band was ever entered, so
  // nothing in this plugin had claimed it -- and below 1024 the shell reads one flag for its
  // desktop column and for its phone drawer, so it came back on the phone as a full-screen
  // drawer over a 45% scrim. The exit is the one place that can tidy that.
  assert.equal(pcSidebarStep(true, false, false), 'collapse')
})

test('leaving a column the user folded inside the band does not toggle it back open', () => {
  // The only handle on the closing direction is a toggle, so a collapse call here would
  // unfold the column instead of tidying up after this band.
  assert.equal(pcSidebarStep(true, false, true), null)
})

test('the first pass counts as a change, in either direction', () => {
  assert.equal(pcSidebarStep(null, false, false), null)
  assert.equal(pcSidebarStep(null, false, true), null)
})

test('the band query is the one complement of the phone layout', () => {
  assert.equal(PC_QUERY, '(min-width:841px) and (max-width:1023px) and (orientation:landscape)')
})

const doc = ({ collapsed, columnWidth, columnRight } = {}) => ({
  querySelector: (selector) => {
    if (selector.includes('data-sidebar-collapsed')) return collapsed ? {} : null
    if (selector.includes('_sidebarCol')) return columnWidth === undefined ? null : { getBoundingClientRect: () => ({ width: columnWidth, right: columnRight ?? columnWidth }) }
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

test('an off-canvas column is collapsed however wide it is', () => {
  // The phone's column keeps its full 288px while it sits off canvas under the frame's 56px
  // track (measured: rect [-288.4, 0, 288, 623]). Width alone would call that "not collapsed",
  // and the fallback's only caller is the band's collapse handle -- the shell's toggle -- so a
  // wrong "not collapsed" there folds nothing and pulls the drawer out instead.
  assert.equal(shellCollapsed(doc({ columnWidth: 288, columnRight: 0 }), true), true)
  assert.equal(shellCollapsed(doc({ columnWidth: 288, columnRight: 288 }), false), false)
})

test('with no frame at all the slot prop is the last resort', () => {
  assert.equal(shellCollapsed(doc({}), true), false)
  assert.equal(shellCollapsed(doc({}), false), true)
  assert.equal(shellCollapsed({}, true), false)
  assert.equal(shellCollapsed(undefined, false), true)
})

// The panel's width in the band. The device reports 859 x 608 for the unfolded window.
test('the details column is 280 of an 859px window, and the cap holds across the band', () => {
  assert.equal(pcDetailsWidth(859), 280)
  assert.equal(pcDetailsWidth(1023), PC_DETAILS_MAX)
  assert.equal(pcDetailsWidth(1200), PC_DETAILS_MAX)
  // 33vw drops below the cap only under 848px, at the bottom of the band.
  assert.equal(pcDetailsWidth(841), Math.round(841 * PC_DETAILS_RATIO))
  assert.ok(pcDetailsWidth(841) < PC_DETAILS_MAX)
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
