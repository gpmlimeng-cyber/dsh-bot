// The shell's status bar bridge. The shell paints the strip behind the status bar itself, in a
// colour it owns (and has changed once already), which is why the page could never match it
// exactly; the bridge is how the page stops it from painting at all. Once it is transparent the
// page owns the whole surface and draws its own frosted strip over what scrolls under it
// (nav-bar.js: .bt-topfade).
//
// The protocol is the shell's: set(mode, color, appearance), page calls outrank the
// <meta name="theme-color"> the presenter writes, and repeated calls are idempotent. A shell
// without the bridge simply keeps painting its own band -- older builds have no such object --
// so every step here is a no-op when it is missing, and a bridge that throws must not take the
// skin down with it.
export const STATUS_BAR_MODE = ['transparent', '', 'auto']

export function publishStatusBarMode(report) {
  if (typeof window === 'undefined') return false
  const bridge = window.dshStatusBarBridge
  if (bridge === null || typeof bridge !== 'object' || typeof bridge.set !== 'function') return false
  try {
    bridge.set(...STATUS_BAR_MODE)
    return true
  } catch (error) {
    // Reported, never thrown: the status bar is chrome, and the conversation is the product.
    if (typeof report === 'function') report(error)
    return false
  }
}

// The shell injects that object into the page's own context, and on a cold start the ask that
// happens as this plugin applies can be answered without taking effect: measured on the device,
// the strip stayed solid until the page was reloaded, and a direct call from the page then moved
// it in both directions. So the page does not stop at its first answer -- it asks once, then
// again a few times over the next seconds. The call is idempotent by the shell's own protocol, so
// the repeats cost nothing, and the ladder belongs to the page rather than to a theme render:
// it is laid down once, and every later render simply asks again.
const ASK_AGAIN_MS = [250, 750, 2000, 4000]
let ladderScheduled = false

/** Ask for the surface, and ask again over the next seconds in case the first one was too early. */
export function askForStatusBar(report) {
  const landed = publishStatusBarMode(report)
  if (!ladderScheduled) {
    ladderScheduled = true
    for (const delay of ASK_AGAIN_MS) setTimeout(() => { publishStatusBarMode(report) }, delay)
  }
  return landed
}
