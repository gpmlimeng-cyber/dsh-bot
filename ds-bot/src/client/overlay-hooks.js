import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMobile } from './mobile.js'

// -------------------------------------------------------------------------
// Overlays: new chat, bot exchange, details drawer, context menu

// Escape closes only the newest open layer, so a dialog over the details pane does
// not take the pane down with it.
const escapeLayers = []
const onEscapeKey = (event) => { if (event.key === 'Escape') escapeLayers.at(-1)?.current() }
export function useEscape(onClose) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (escapeLayers.length === 0) window.addEventListener('keydown', onEscapeKey)
    escapeLayers.push(ref)
    return () => {
      escapeLayers.splice(escapeLayers.indexOf(ref), 1)
      if (escapeLayers.length === 0) window.removeEventListener('keydown', onEscapeKey)
    }
  }, [])
}

// New chat and Bot exchanges show in place of the conversation, right of the sidebar.
// The shell resizes that column (collapsing the sidebar, or dragging its edge), so a
// single measurement on mount goes stale and leaves the pane short of the column.
//
// That measurement is a wide layout's idea and only a wide layout's. On a phone those
// panes are the screen, and the column being measured is what is *left* of them -- the
// rail plus the conversation's own width -- so reading it pushed every one of these
// layers to the right: 发现's page came up at x≈300 on a 608-wide window with the left
// third empty, the title with it. Nothing in the pane itself was wrong. Mobile reads 0
// and does not look at the column at all.
export function usePaneLeft() {
  const mobile = useMobile()
  const [paneLeft, setPaneLeft] = useState(280)
  useLayoutEffect(() => {
    if (mobile) return undefined
    const column = document.querySelector('[class*="_footArea"]')?.parentElement
    if (!column) return undefined
    const measure = () => setPaneLeft(current => {
      const next = Math.round(column.getBoundingClientRect().right)
      return next === current ? current : next
    })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    return () => observer.disconnect()
  }, [mobile])
  return mobile ? 0 : paneLeft
}
