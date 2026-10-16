// A foldable held sideways is a desktop window in all but name: unfolded it lands in the
// 841-1023 band, which the mobile skin used to draw as a sheet with a full-screen panel.
// The skin hands that window to the shell's own layout instead (mobile.js), and this
// module carries the two pieces of that decision that are worth testing on their own: the
// query itself, and the one move the sidebar makes on a band change.
//
// No React here on purpose: the test suite runs in plain Node, and a module that imports
// React cannot be loaded there.
export const PC_QUERY = '(min-width:841px) and (max-width:1023px) and (orientation:landscape)'

/**
 * What the last band change left behind. This is module state on purpose, and the reason is a
 * bug the device crew saw: the
 * shell draws its sidebar column from two trees -- the wide one, and the rail it switches to a
 * couple of seconds after the column folds, once its own `settled` catches up -- so this
 * component is unmounted and mounted again as part of that switch. Held in a `useRef`, the
 * memory came back `null`, which reads as "entering the band", so the next render called
 * `expandSidebar()`: the column folded by hand and then opened itself again two seconds later.
 * Held here it outlives the remount, and the same band change makes no call at all. It dies
 * with the page, which is the lifetime this wants: a reload is a fresh band to open.
 */
export const pcSidebarMemory = { band: null }

/**
 * What the sidebar does on one band change — and only on a band change.
 *
 * The shell collapses its sidebar below its own 1024 line, so the desktop layout needs it
 * opened by hand; the shell then only resets that state when a window crosses 1024, which
 * 841-1023 <-> portrait never does, so the phone layout would inherit a column it did not
 * ask for. Hence the pair: open on entry, close on exit, and nothing in between.
 *
 * The exit closes the column whenever it is still open, whoever opened it, and that is not
 * politeness but the fix for a leak measured on the device: below 1024 the shell reads
 * *one* flag for two different surfaces — `toggleSidebar` flips `narrowExpanded`, and the
 * same flag draws the desktop column and the phone's full-screen drawer with its own scrim.
 * A column a hand left open before the band was ever entered therefore came back on the
 * phone as the shell's drawer over a 45% black scrim. Only a band change reaches this
 * branch (`wasPc === true`, `isPc === false`), and no other band shows the shell's own
 * sidebar at all — the phone drawer is `.bt-side.bt-rail`, our own body-level element — so
 * closing here can only tidy that leak, never take away a surface the user is looking at.
 *
 * @param {boolean|null} wasPc - the band before this render; null on the first pass.
 * @param {boolean} isPc - the band now.
 * @param {boolean} collapsed - whether the shell's sidebar is collapsed right now.
 * @returns {'expand'|'collapse'|null} the one call to make, if any.
 */
export function pcSidebarStep(wasPc, isPc, collapsed) {
  // The entry call is unconditional: the slot's `expandSidebar` only toggles a collapsed
  // column, so calling it on an open one changes nothing, while skipping it on a wrong
  // `collapsed` read would leave the band without its column for good.
  if (isPc && wasPc !== true) return 'expand'
  if (!isPc && wasPc === true) return collapsed ? null : 'collapse'
  return null
}

/**
 * Whether the shell's sidebar column is collapsed right now.
 *
 * The slot's `wide` prop is not quite that below the shell's own 1024 line: it reads
 * `!collapsed || !settled`, and `settled` only catches up a few hundred ms after the
 * column folds, so `wide` can still be true while the column is on its way to the rail.
 * The frame carries the shell's own verdict (it is what the shell's own collapsed-state
 * CSS matches on), and what is on screen settles the rest. `wide` is the last resort,
 * for a first render before the frame exists.
 */
export function shellCollapsed(doc, wide) {
  const find = selector => (doc && typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null)
  if (find('[data-sidebar-collapsed]')) return true
  const column = find('[class*="_sidebarCol"]')
  if (column) {
    const box = column.getBoundingClientRect?.()
    if (!box) return !wide
    // Width alone cannot answer this on a phone: there the column keeps all 288 of its pixels
    // while it sits off canvas under the frame's 56px track (measured on the device), so a
    // width test reads "not collapsed" in the one case that matters -- and this fallback only
    // exists for the case where the frame's attribute is gone, where being wrong means calling
    // the band's collapse handle. That handle is the shell's toggle, so "collapse" is what folds
    // and also what would pull the drawer *out*. Where the column actually is settles it: a rail
    // is 56px wide, and an off-canvas column ends at or before the frame's own left edge.
    if (box.right !== undefined && box.right <= 0) return true
    return box.width < 100
  }
  return !wide
}

// The details column in the PC band. The desktop default (browser-pane.js) is 320px, which
// on this device's 859px window would leave the conversation 259 beside the 280px sidebar
// the shell opens; min(280, 33vw) is 280 there -- and 280 across the whole band, since 33vw
// only drops below the cap under 848px. The conversation then has 299 with the panel up and
// 579 without. Only the PC band changes it; a desktop window keeps 320.
export const PC_DETAILS_MAX = 280
export const PC_DETAILS_RATIO = 0.33

export function pcDetailsWidth(viewport) {
  return Math.round(Math.min(PC_DETAILS_MAX, viewport * PC_DETAILS_RATIO))
}
