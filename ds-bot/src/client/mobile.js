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

/** Start watching the breakpoint. Called from apply() so the flag is set before the first paint. */
export function watchMobile() {
  const mql = media()
  publish(mql?.matches === true)
  mql?.addEventListener?.('change', (event) => publish(event.matches === true))
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
