// One mobile breakpoint for the whole skin. The shell collapses its sidebar into a
// 56px rail below 1024px (its own constant), so the skin follows that same line
// instead of guessing a phone width — below it the header pill floats in a body-level
// bar and the sidebar becomes a body-level drawer, both outside the shell's columns.
import { useEffect, useState } from 'react'

export const MOBILE_QUERY = '(max-width:1023px)'

let query
const listeners = new Set()

const media = () => {
  if (query === undefined) {
    query = typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(MOBILE_QUERY)
  }
  return query
}

// Mirrored onto <html data-bt-mobile> so the stylesheet, the React tree and a
// real-device UI dump always agree on which layout is on screen.
const publish = (matches) => {
  if (typeof document !== 'undefined') {
    if (matches) document.documentElement.dataset.btMobile = '1'
    else delete document.documentElement.dataset.btMobile
  }
  for (const listener of listeners) listener(matches === true)
}

// The shell publishes its top inset (the device's status bar, ~46px here) as
// --dsh-frame-chrome-top, but only on frame elements it owns: a panel portalled to
// <body> cannot read it and falls back to 0, which is how the floating bar ended up
// under the status bar. Measure where the transcript itself starts instead and publish
// that as our own variable — the shell's variable is never written to.
const publishInset = () => {
  if (typeof document === 'undefined') return
  const scroller = document.querySelector('[data-conversation-scroll]')
  const top = scroller === null ? 0 : Math.round(scroller.getBoundingClientRect().top)
  if (top > 0) document.documentElement.style.setProperty('--bt-top-inset', `${top}px`)
}

/** Start watching the breakpoint. Called from apply() so the flag is set before the first paint. */
export function watchMobile() {
  const mql = media()
  publish(mql?.matches === true)
  mql?.addEventListener?.('change', (event) => publish(event.matches === true))
  // The transcript is mounted after this plugin applies, so measure on the next frames
  // rather than once, and again whenever the window changes shape.
  const tick = () => { if (mql?.matches === true) publishInset() }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(tick)
    for (const delay of [300, 1200, 3000]) setTimeout(tick, delay)
    if (typeof window !== 'undefined') window.addEventListener('resize', tick)
  }
  return mql?.matches === true
}

/** Reactive view of the same breakpoint, for the components that portal. */
export function useMobile() {
  const [mobile, setMobile] = useState(() => media()?.matches === true)
  useEffect(() => {
    const mql = media()
    if (!mql) return undefined
    listeners.add(setMobile)
    setMobile(mql.matches === true)
    return () => { listeners.delete(setMobile) }
  }, [])
  return mobile
}
