// Where the mode row (the surface switcher and the band's own three controls) lives. A
// desktop window keeps it in the caption band.
//
// The band is the window's drag region on a desktop, and Chromium gives a drag region's
// clicks to the window instead of the page. A button inside that region can take them back
// with -webkit-app-region: no-drag; one floating above it cannot, because hit testing never
// reaches it. So on a desktop the row goes inside the band element when the shell has one,
// and back to the body when it does not.
export function bandHost(document) {
  try {
    for (const element of document.querySelectorAll('header, [class*="_title"], [class*="_titlebar"], [class*="_caption"], [class*="_drag"], [class*="_window"]')) {
      const rect = element.getBoundingClientRect()
      if (rect.top > 6 || rect.bottom > 96 || rect.height <= 0) continue
      if (readAppRegion(element) === 'drag') return element
    }
  } catch { /* a document without layout keeps the body */ }
  return null
}

function readAppRegion(element) {
  try {
    return getComputedStyle(element).getPropertyValue('-webkit-app-region').trim()
  } catch {
    return ''
  }
}

// There is no drawer form any more: the phone layout was a separate plugin this one no
// longer ships, so the row always lives in the window's caption band (or the body).
export function drawerSlot() {
  return null
}

export function modeRowSlot(document) {
  return bandHost(document) ?? document.body
}

// Moves the row into `slot` in the given order, once. Prepending in reverse keeps the order
// the caller means, and a row already there is left alone so a repaint never doubles it.
export function placeModeRow(document, nodes, target) {
  const slot = target ?? modeRowSlot(document)
  const wanted = nodes.filter(node => node !== null && node !== undefined)
  if (wanted.length > 0 && wanted.every(node => node.parentNode === slot)) return slot
  for (const node of [...wanted].reverse()) {
    if (node.parentNode !== slot) slot.insertBefore(node, slot.firstChild)
  }
  return slot
}
