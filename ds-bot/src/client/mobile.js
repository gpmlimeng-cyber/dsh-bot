// One mobile breakpoint for the whole skin. The shell collapses its sidebar into a
// 56px rail below 1024px (its own constant), so the skin follows that same line
// instead of guessing a phone width — below it the header pill floats in a body-level
// bar and the sidebar becomes a body-level drawer, both outside the shell's columns.
//
// Inside that line the skin has three widths, on the Compact/Medium/Expanded bands the
// platforms themselves use (Xiaomi and HarmonyOS both publish 600 and 840): a phone
// upright, a half-folded or portrait tablet, and an unfolded fold or landscape tablet.
// These two only pick which size of the mobile skin is drawn.
//
// The shell's rail line is the switch between the two layouts, with one exception: a
// foldable held sideways. Unfolded it lands in the 841-1023 band (859x608 on the device
// this was built against), and that is a desktop window in all but name — a sheet and a
// full-screen panel waste it, and the PC layout is what was asked for there. So the
// 841-1023 window is the desktop one while it is wider than it is tall; the mobile skin's
// expanded band belongs to the portrait window of the same width (a 900x1200 tablet),
// where there is no room beside the shell's rail. Up to 840 nothing changes: a phone,
// however it is held, and a half-folded screen keep the mobile skin.
import { useEffect, useState } from 'react'
import { PC_QUERY } from './pc-layout.js'

export const MOBILE_QUERY = '(max-width:840px), (max-width:1023px) and (orientation:portrait)'
export const SIZE_MEDIUM_QUERY = '(min-width:600px)'
export const SIZE_EXPANDED_QUERY = '(min-width:841px)'
// The phone's bottom navigation is upright only. MOBILE_QUERY covers a 425px phone in
// either orientation, and the bar would eat 56 of the ~250px a landscape phone has for
// the conversation, so the bar reads this second line as well.
export const PORTRAIT_QUERY = '(orientation: portrait)'

let query
const listeners = new Set()
const portraitListeners = new Set()
let sizes
let pcQuery
let portraitQuery

const media = () => {
  if (query === undefined) {
    query = typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(MOBILE_QUERY)
  }
  return query
}

const portraitMedia = () => {
  if (portraitQuery === undefined) {
    portraitQuery = typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(PORTRAIT_QUERY)
  }
  return portraitQuery
}

// The desktop window a foldable draws when it is held sideways (see pc-layout.js). It is
// the exact complement of MOBILE_QUERY inside 1024px — every width is either <=840, or
// 841-1023 portrait (mobile), or 841-1023 landscape (this), or >=1024 (desktop) — but it
// is read on its own query all the same: a desktop window resized across 1024 in
// landscape changes this band without changing the other, and a stale flag would then
// keep the phone layout's rules on or off.
const pcMedia = () => {
  if (pcQuery === undefined) {
    pcQuery = typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(PC_QUERY)
  }
  return pcQuery
}

/** Whether the PC layout band is the one on screen right now. */
export const isPcLayout = () => pcMedia()?.matches === true

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
  publishPortrait()
  for (const listener of listeners) listener(matches === true)
}

// Mirrored onto <html data-bt-portrait>: the mobile layout AND an upright window. Every
// rule of the bottom bar — the bar itself, the 56px it reserves, the peers page it turns
// the drawer into, and the hamburger it replaces — hangs on this one attribute, so the
// sheet, the tree and a UI dump cannot disagree. It is never published outside
// data-bt-mobile, the same reason data-bt-size is not: a rule for the phone's bar must
// not be able to reach the desktop.
const publishPortrait = () => {
  if (typeof document === 'undefined') return
  const on = document.documentElement.dataset.btMobile === '1' && portraitMedia()?.matches === true
  if (on) document.documentElement.dataset.btPortrait = '1'
  else delete document.documentElement.dataset.btPortrait
  for (const listener of portraitListeners) listener(on)
}

/** Whether the phone's bottom navigation is the one on screen right now (read-only). */
export const isPortraitNav = () => typeof document !== 'undefined' && document.documentElement.dataset.btPortrait === '1'

// Mirrored onto <html data-bt-pc>, the one flag every rule of the PC layout hangs on, so
// the stylesheet and a real-device dump agree on which layout is on screen. Nothing is
// published while the phone layout is up: the two are complements of each other.
const publishPc = () => {
  if (typeof document === 'undefined') return
  if (isPcLayout()) document.documentElement.dataset.btPc = '1'
  else delete document.documentElement.dataset.btPc
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

// Whether the soft keyboard is up, mirrored onto <html data-bt-keyboard>. The platform has no
// flag for it: @dsh-android/dsh-client-ui-responsive pins the frame's height to the visual
// viewport while the IME is open (keyboard-boundary.ts) because Android 16 edge-to-edge does
// not shrink the layout viewport, and it leaves the inset it works from on :root. So this
// reads both things it does leave behind -- its --dsh-android-ime-bottom, and the gap between
// the layout and visual viewports (innerHeight stays put on this device, vv.height does not)
// -- and the stylesheet hides the bar and gives back the room it reserved.
const KEYBOARD_MIN_PX = 80

// Exported so the decision can be run against a real device's numbers (test/bottom-nav.test.js)
// instead of only read as source: both signals belong to the platform, and a parse that quietly
// gives 0 leaves the bar reserving its 56px under the keyboard.
//
// Two things keep this from taking the bar off a page nobody is typing on. The shell's inset
// decides wherever it is published, and its zero is final: that variable is written for this
// window (composer-insets.css lifts the composer with it). The visual-viewport gap is only a
// guess at the same thing and is not scoped to this window -- on the device a keyboard raised
// in the other half of a split screen shrank this page's viewport by exactly the keyboard's
// 288dp (608 -> 320) while the page itself stayed whole. And either signal only counts while
// this page is the one in use: that is what the tab bar serves, and the bar belongs to the
// half of the screen the user is looking at. The gap stays as the fallback for a host that
// publishes no inset at all (a plain browser).
export const keyboardUp = () => {
  const declared = getComputedStyle(document.documentElement).getPropertyValue('--dsh-android-ime-bottom')
  const raised = declared.trim() !== ''
    ? largestPx(declared) > 0
    : window.visualViewport !== null && window.visualViewport !== undefined && window.innerHeight - window.visualViewport.height > KEYBOARD_MIN_PX
  return raised && document.hasFocus()
}

const publishKeyboard = () => {
  if (typeof document === 'undefined') return
  if (typeof window === 'undefined' || !window.visualViewport) return
  if (keyboardUp()) document.documentElement.dataset.btKeyboard = '1'
  else delete document.documentElement.dataset.btKeyboard
}

/** Start watching the breakpoint. Called from apply() so the flag is set before the first paint. */
export function watchMobile() {
  const mql = media()
  publish(mql?.matches === true)
  mql?.addEventListener?.('change', (event) => publish(event.matches === true))
  // The PC band is published and watched on its own: it is the complement of the line
  // above, but a window can cross into it without that line moving at all.
  const pc = pcMedia()
  publishPc()
  pc?.addEventListener?.('change', () => publishPc())
  const bands = sizeMedia()
  bands?.medium.addEventListener?.('change', () => publishSize())
  bands?.expanded.addEventListener?.('change', () => publishSize())
  // Turning the phone changes neither of the widths above, so the bottom bar's own line
  // is watched on its own too.
  portraitMedia()?.addEventListener?.('change', () => publishPortrait())
  // The transcript is mounted after this plugin applies, so measure on the next frames
  // rather than once, and again whenever the window changes shape.
  const tick = () => { if (mql?.matches === true) publishInset() }
  const onViewport = () => { tick(); publishKeyboard() }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(onViewport)
    for (const delay of [300, 1200, 3000]) setTimeout(onViewport, delay)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onViewport)
      // The keyboard moves the visual viewport without resizing the window on this platform.
      window.visualViewport?.addEventListener?.('resize', onViewport)
      window.visualViewport?.addEventListener?.('scroll', onViewport)
      // The decision now includes whether this page is the one in use (keyboardUp), and gaining
      // or losing the window is not a resize: without these, a page that came back from another
      // window would keep whatever the flag was when it left.
      window.addEventListener('focus', onViewport)
      window.addEventListener('blur', onViewport)
      document.addEventListener?.('visibilitychange', onViewport)
      // The shell writes its IME inset into the root's own style (--dsh-android-ime-bottom, the
      // variable the whole skin reads for the keyboard), so the keyboard's transition is
      // observable on the root itself: re-decide the flag the moment it moves. Without this the
      // flag waits for the next viewport event, and on the device it was seen sitting stale for a
      // few seconds after a keyboard closed -- the bar still away with the keyboard already gone.
      if (typeof MutationObserver === 'function') {
        new MutationObserver(() => publishKeyboard()).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
      }
    }
  }
  return mql?.matches === true
}

/** Reactive view of the same breakpoint, for the components that portal. */
export function useMobile() {
  const [mobile, setMobile] = useState(media()?.matches === true)
  useEffect(() => {
    const mql = media()
    if (!mql) return undefined
    listeners.add(setMobile)
    setMobile(mql.matches === true)
    return () => { listeners.delete(setMobile) }
  }, [])
  return mobile
}

/** Reactive view of the bottom bar's line, for the bar and the page it turns the drawer into. */
export function usePortrait() {
  const [portrait, setPortrait] = useState(() => isPortraitNav())
  useEffect(() => {
    portraitListeners.add(setPortrait)
    setPortrait(isPortraitNav())
    return () => { portraitListeners.delete(setPortrait) }
  }, [])
  return portrait
}

/** Reactive view of the PC layout band, for the sidebar column and the panel's width. */
export function usePcColumns() {
  const [pc, setPc] = useState(() => isPcLayout())
  useEffect(() => {
    const mql = pcMedia()
    if (!mql?.addEventListener) return undefined
    const on = (event) => setPc(event.matches === true)
    mql.addEventListener('change', on)
    setPc(mql.matches === true)
    return () => mql.removeEventListener('change', on)
  }, [])
  return pc
}
