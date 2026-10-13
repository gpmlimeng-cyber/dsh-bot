// One mobile breakpoint for the whole skin. The shell collapses its sidebar into a
// 56px rail below 1024px (its own constant), so the skin follows that same line
// instead of guessing a phone width — below it the header pill floats in a body-level
// bar and the sidebar becomes a body-level drawer, both outside the shell's columns.
//
// Inside that line the skin has three widths, on the Compact/Medium/Expanded bands the
// platforms themselves use (Xiaomi and HarmonyOS both publish 600 and 840): a phone
// upright, a half-folded or portrait tablet, and an unfolded fold or landscape tablet.
// The shell's own rail line stays the only switch between desktop and mobile, so the
// 841-1023 band never fights the shell for the same column; these two only pick which
// size of the mobile skin is drawn.
import { useEffect, useState } from 'react'

export const MOBILE_QUERY = '(max-width:1023px)'
export const SIZE_MEDIUM_QUERY = '(min-width:600px)'
export const SIZE_EXPANDED_QUERY = '(min-width:841px)'

let query
const listeners = new Set()
let sizes

const media = () => {
  if (query === undefined) {
    query = typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(MOBILE_QUERY)
  }
  return query
}

const sizeMedia = () => {
  if (sizes === undefined) {
    sizes = typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? null
      : { medium: window.matchMedia(SIZE_MEDIUM_QUERY), expanded: window.matchMedia(SIZE_EXPANDED_QUERY) }
  }
  return sizes
}

/** The width band: compact (a phone upright), medium, or expanded. */
const readSize = () => {
  const mql = sizeMedia()
  if (!mql) return 'compact'
  return mql.expanded.matches ? 'expanded' : mql.medium.matches ? 'medium' : 'compact'
}

// Mirrored onto <html data-bt-size>, and only while the mobile layout is the one on
// screen: the attribute picks a size of the mobile skin, so leaving it on above 1024
// would invite a rule that quietly reaches the desktop. Every size rule in the sheet
// pairs it with html[data-bt-mobile] for the same reason.
const publishSize = () => {
  if (typeof document === 'undefined') return
  if (document.documentElement.dataset.btMobile === '1') document.documentElement.dataset.btSize = readSize()
  else delete document.documentElement.dataset.btSize
}

// Mirrored onto <html data-bt-mobile> so the stylesheet, the React tree and a
// real-device UI dump always agree on which layout is on screen.
const publish = (matches) => {
  if (typeof document !== 'undefined') {
    if (matches) document.documentElement.dataset.btMobile = '1'
    else delete document.documentElement.dataset.btMobile
  }
  publishSize()
  for (const listener of listeners) listener(matches === true)
}

// The top inset (the device's status bar, ~46px here) has exactly one honest source on
// Android: the adaptation layer publishes it on :root as --dsh-mobile-top-inset, from
// env(safe-area-inset-top) and the shell bridge. The shell's own --dsh-frame-chrome-top is
// never defined here at all (it exists only under html[data-platform=darwin] and
// [data-windows-titlebar]), which is why reading it always fell back to 0 and put the bar
// under the status bar. Read the layer's variable first; measure the transcript only when
// that variable is absent (e.g. the layer is not mounted). Never write either variable.
//
// A custom property computes to its raw token stream, so the layer's value arrives as
// "max(46px, 46px)" — Number.parseFloat over that is NaN, which silently fell through to
// the measurement below and published 90px (the layer's own reserved band) instead of the
// 46px status bar. Take the largest length in the token list.
const largestPx = (value) => {
  let top = 0
  for (const [, digits] of value.matchAll(/(\d*\.?\d+)px/g)) {
    const px = Number.parseFloat(digits)
    if (Number.isFinite(px) && px > top) top = px
  }
  return top
}

const publishInset = () => {
  if (typeof document === 'undefined') return
  const fromLayer = largestPx(getComputedStyle(document.documentElement).getPropertyValue('--dsh-mobile-top-inset'))
  const scroller = document.querySelector('[data-conversation-scroll]')
  const top = fromLayer > 0
    ? Math.round(fromLayer)
    : scroller === null ? 0 : Math.round(scroller.getBoundingClientRect().top)
  if (top > 0) document.documentElement.style.setProperty('--bt-top-inset', `${top}px`)
}

/** Start watching the breakpoint. Called from apply() so the flag is set before the first paint. */
export function watchMobile() {
  const mql = media()
  publish(mql?.matches === true)
  mql?.addEventListener?.('change', (event) => publish(event.matches === true))
  const bands = sizeMedia()
  bands?.medium.addEventListener?.('change', () => publishSize())
  bands?.expanded.addEventListener?.('change', () => publishSize())
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
