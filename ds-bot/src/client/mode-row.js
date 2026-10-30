// Where the mode row (the surface switcher and the band's own three controls) lives. A
// desktop window keeps it in the caption band; a phone has no band, and a fixed row would
// float over whatever the page shows first, so there it takes the drawer's first row and
// scrolls out of sight with the drawer.
//
// The drawer's marker belongs to dsh-web-mobile; without the plugin there is no drawer
// form at all, so the row stays in the band (a safe failure: one row, in the band).
export function modeRowSlot(document) {
  if (document.querySelector('[data-mobile-nav="frame"]') === null) return document.body
  return document.querySelector('.bt-side') ?? document.body
}

// Moves the row into `slot` in the given order, once. Prepending in reverse keeps the order
// the caller means, and a row already there is left alone so a repaint never doubles it.
export function placeModeRow(document, nodes) {
  const slot = modeRowSlot(document)
  const wanted = nodes.filter(node => node !== null && node !== undefined)
  if (wanted.length > 0 && wanted.every(node => node.parentNode === slot)) return slot
  for (const node of [...wanted].reverse()) {
    if (node.parentNode !== slot) slot.insertBefore(node, slot.firstChild)
  }
  return slot
}
