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
 * What the last band change left behind, and whether this plugin opened the column for that
 * band. This is module state on purpose, and the reason is a bug the device crew saw: the
 * shell draws its sidebar column from two trees -- the wide one, and the rail it switches to a
 * couple of seconds after the column folds, once its own `settled` catches up -- so this
 * component is unmounted and mounted again as part of that switch. Held in a `useRef`, the
 * memory came back `null`, which reads as "entering the band", so the next render called
 * `expandSidebar()`: the column folded by hand and then opened itself again two seconds later.
 * Held here it outlives the remount, and the same band change makes no call at all. It dies
 * with the page, which is the lifetime this wants: a reload is a fresh band to open.
 */
export const pcSidebarMemory = { band: null, opened: false }

/**
 * What the sidebar does on one band change — and only on a band change.
 *
 * The shell collapses its sidebar below its own 1024 line, so the desktop layout needs it
 * opened by hand; the shell then only resets that state when a window crosses 1024, which
 * 841-1023 <-> portrait never does, so the phone layout would inherit a column it did not
 * ask for. Hence the pair: open on entry, close on exit, and nothing in between.
 *
 * `opened` is whether this plugin is the one that opened it. A column the user opened by
 * hand is never closed by us, and one the user closed by hand inside the band stays closed
 * (`wasPc === isPc` means no transition, so no call at all).
 *
 * @param {boolean|null} wasPc - the band before this render; null on the first pass.
 * @param {boolean} isPc - the band now.
 * @param {boolean} collapsed - whether the shell's sidebar is collapsed right now.
 * @param {boolean} opened - whether this plugin opened the column for the current band.
 * @returns {{call: 'expand'|'collapse'|null, opened: boolean}}
 */
export function pcSidebarStep(wasPc, isPc, collapsed, opened) {
  // The entry call is unconditional: the slot's `expandSidebar` only toggles a collapsed
  // column, so calling it on an open one changes nothing, while skipping it on a wrong
  // `collapsed` read would leave the band without its column for good. What we remember is
  // the pre-call state, which is what decides the exit.
  if (isPc && wasPc !== true) return { call: 'expand', opened: collapsed === true }
  if (!isPc && wasPc === true) return { call: opened && !collapsed ? 'collapse' : null, opened: false }
  return { call: null, opened: isPc ? opened : false }
}

/**
 * Whether the shell's sidebar column is collapsed right now.
 *
 * The slot's `wide` prop is not quite that below the shell's own 1024 line: it reads
 * `!collapsed || !settled`, and `settled` only catches up a few hundred ms after the
 * column folds, so `wide` can still be true while the column is on its way to the rail.
 * The frame carries the shell's own verdict (it is what the shell's own collapsed-state
 * CSS matches on), and the column's rendered width settles the rest. `wide` is the last
 * resort, for a first render before the frame exists.
 */
export function shellCollapsed(doc, wide) {
  const find = selector => (doc && typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null)
  if (find('[data-sidebar-collapsed]')) return true
  const column = find('[class*="_sidebarCol"]')
  if (column) return (column.getBoundingClientRect?.().width ?? 0) < 100
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
