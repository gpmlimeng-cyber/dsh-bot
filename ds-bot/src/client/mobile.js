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

// The top inset (the device's status bar, ~46px here) has exactly one honest source on
// Android: the adaptation layer publishes it on :root as --dsh-mobile-top-inset, from
// env(safe-area-inset-top) and the shell bridge. The shell's own --dsh-frame-chrome-top is
// never defined here at all (it exists only under html[data-platform=darwin] and
// [data-windows-titlebar]), which is why reading it always fell back to 0 and put the bar
// under the status bar. Read the layer's variable first; measure the transcript only when
// that variable is absent (e.g. the layer is not mounted). Never write either variable.
const publishInset = () => {
  if (typeof document === 'undefined') return
  const published = getComputedStyle(document.documentElement).getPropertyValue('--dsh-mobile-top-inset').trim()
  const fromLayer = Number.parseFloat(published)
  const scroller = document.querySelector('[data-conversation-scroll]')
  const top = Number.isFinite(fromLayer) && fromLayer > 0
    ? Math.round(fromLayer)
    : scroller === null ? 0 : Math.round(scroller.getBoundingClientRect().top)
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
