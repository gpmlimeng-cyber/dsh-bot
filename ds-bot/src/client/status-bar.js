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

// The shell injects that object into the page's own context, and it can arrive after this plugin
// has applied -- the theme render below runs as the plugin comes up, which is why one unanswered
// ask cannot be the last word. So the page asks again for a few seconds while the bridge is
// missing, stopping at the first answer; a call that lands is idempotent, and a shell that never
// grows a bridge is left alone just as before. (Only the missing case is retried: once the bridge
// has answered, the mode is the theme's business and nothing here repeats it.)
const ASK_AGAIN_MS = [250, 750, 2000, 4000]

/** Ask for the surface, and keep asking while the shell has not injected its bridge yet. */
export function askForStatusBar(report) {
  let waiting = true
  const ask = () => {
    if (!waiting) return false
    if (!publishStatusBarMode(report)) return false
    waiting = false
    return true
  }
  const landed = ask()
  for (const delay of ASK_AGAIN_MS) setTimeout(ask, delay)
  return landed
}
