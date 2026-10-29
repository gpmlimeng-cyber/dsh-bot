// The shell's sidebar column doubles as the narrow-screen drawer, and no documented API
// reports whether it is open (`ctx.layout` offers toggleSidebar only, and the sidebar slot
// takes `wide`/`expandSidebar` but no open flag). So the caller says where the click came
// from: only an entry inside the drawer passes `fromDrawer`, and only then does the drawer
// collapse. A stale or missing holder makes this a no-op rather than a wrong toggle.
let collapse = null

export function holdDrawerDismiss(fn) {
  collapse = fn
  return () => { if (collapse === fn) collapse = null }
}

export function dismissDrawerIfOpen(fromDrawer) {
  if (fromDrawer === true) collapse?.()
}
