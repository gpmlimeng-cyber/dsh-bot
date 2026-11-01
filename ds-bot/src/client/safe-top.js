// How tall the system bar is over the page.
//
// The page is edge to edge (the layout sets viewport-fit=cover), but this WebView
// reports `env(safe-area-inset-top)` as 0, so a fixed layer that starts at the viewport
// top lands inside the status bar. The one element that is already placed below it is the
// host's own conversation header, so its top edge is measured and published as
// `--bt-safe-top`; layers that must clear the bar read that variable.
const VARIABLE = '--bt-safe-top'

function measure() {
  const root = document.documentElement
  const header = document.querySelector('[data-phase] header') ?? document.querySelector('header[data-window-drag]')
  const top = header?.getBoundingClientRect?.().top
  if (typeof top === 'number' && top > 0) root.style.setProperty(VARIABLE, `${Math.round(top)}px`)
  else root.style.removeProperty(VARIABLE)
}

export function installSafeTop() {
  if (typeof document === 'undefined') return undefined
  measure()
  const observer = new MutationObserver(() => measure())
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', measure)
    window.removeEventListener('orientationchange', measure)
    document.documentElement.style.removeProperty(VARIABLE)
  }
}
