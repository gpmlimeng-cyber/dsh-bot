// The Bot panel: one right-hand column holding a Bot's details or its browser.
// A tab strip on top flips between them — the Bot page collapses to a tab, each
// browser tab is a tab of its own. Browser pages are Electron webviews kept in a
// body-level layer by bot-browsers.js; the panel draws the strip and the toolbar
// and reports the rectangle the shown webview covers.
import { createElement as h, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotMark } from './mark.js'
import { STORAGE } from './storage.js'
import { SPRING_SHAPE, springEasing } from './motion.js'
import { DetailsDrawer } from './details-drawer.js'
import { FilePreview } from './file-preview.js'
import { DeliveredList, DeliveredPreview } from './deliverables.js'
import { useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives'
import { isPcLayout, useMobile, usePcColumns } from './mobile.js'
import { pcDetailsWidth } from './pc-layout.js'
import { t } from './i18n.js'

export const PANEL_LINGER_MS = 300
const WIDTH_KEY = STORAGE.browserWidth
// One width for the panel, shared by both views. The Bot page keeps it within
// DETAILS_WIDTH..DETAILS_MAX, so a wider browser comes back to DETAILS_MAX and a
// narrower one keeps its width; the browser takes any width from MIN_WIDTH.
const DEFAULT_WIDTH = 520
const DETAILS_WIDTH = 320
const DETAILS_MAX = 520
const MIN_WIDTH = 360
// The conversation keeps at least this much room beside the panel.
const MIN_CHAT = 420
// How long the Bot's mark shows that it read the page.
const READ_FLASH_MS = 2400
const EMPTY_PAGE = { url: '', title: '', favicon: null, loading: false, canGoBack: false, canGoForward: false, error: null, excerpt: '' }
const EMPTY_TABS = { ids: [], active: null }
// The indicator's leading edge runs the fast spring, the trailing one the slow
// spring — the capsule stretches into the move, then settles.
const SPRING_LEAD = springEasing(576, 39.4)
const SPRING_TRAIL = springEasing(144, 19.7)

const icon = paths => function BrowserIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    paths.map((d, index) => h('path', { key: index, d })))
}
export const GlobeIcon = icon(['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M3 10h14', 'M10 3c2 2.2 2.9 4.5 2.9 7S12 14.8 10 17c-2-2.2-2.9-4.5-2.9-7S8 5.2 10 3z'])
const BackIcon = icon(['M12.5 4.5L7 10l5.5 5.5'])
const ForwardIcon = icon(['M7.5 4.5L13 10l-5.5 5.5'])
const ReloadIcon = icon(['M15.5 10a5.5 5.5 0 1 1-1.6-3.9', 'M15.5 3.5v3.5H12'])
const StopIcon = icon(['M5.5 5.5l9 9M14.5 5.5l-9 9'])
const CloseIcon = icon(['M5.5 5.5l9 9M14.5 5.5l-9 9'])
const PlusTabIcon = icon(['M10 5v10M5 10h10'])
const LockIcon = icon(['M6.5 9V7a3.5 3.5 0 0 1 7 0v2', 'M5.5 9h9v7h-9z'])
const FolderIcon = icon(['M3.5 6.5A1.5 1.5 0 0 1 5 5h3.6l1.4 1.5H15a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14z'])

/** A page's favicon, or the globe while there is none or it fails to load. */
export function Favicon({ src, className }) {
  const [failed, setFailed] = useState(null)
  if (!src || failed === src) return h('span', { className: `${className} bt-ptab-globe` }, h(GlobeIcon))
  return h('img', { className, src, alt: '', 'aria-hidden': true, onError: () => setFailed(src) })
}

// null until the user sets a width: the Bot page then opens at DETAILS_WIDTH and the
// browser at DEFAULT_WIDTH.
const savedWidth = (low) => {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(value) && value >= low ? value : null
  } catch { return null }
}
// The details view's floor is the band's own: 320 on a desktop window, and the PC band's
// own min(300px, 34vw) on a folded screen, where the shell's sidebar column sits beside it
// (pc-layout.js). Passing the desktop floor there would clamp the panel straight back up.
const detailsLow = (viewport, pc) => (pc ? pcDetailsWidth(viewport) : DETAILS_WIDTH)
const widthRange = (view, viewport, low) => (view === 'details'
  ? [low, Math.min(DETAILS_MAX, viewport - MIN_CHAT)]
  : [MIN_WIDTH, viewport - MIN_CHAT])
const fitWidth = (width, [low, high]) => Math.round(Math.max(low, Math.min(width, high)))

// The conversation column's right margin lives in one rule of our own, matched on the
// column's exact class. A custom property on <body> would restyle the whole page, tens
// of milliseconds a write. A changed rule still restyles the column's subtree, so a drag
// writes the column's own inline style each frame and the rule once, on release.
const room = { rule: null, selector: '' }
const roomRule = () => {
  const live = room.rule?.parentStyleSheet?.ownerNode?.isConnected
  if (live && room.selector) return room.rule
  const column = document.querySelector('[class*="_centerCol"]')
  const selector = column ? [...column.classList].filter(name => name.includes('_centerCol')).map(name => `.${CSS.escape(name)}`).join(',') : ''
  if (live && !selector) return room.rule
  const declarations = room.rule?.style.cssText ?? ''
  room.rule?.parentStyleSheet?.ownerNode?.remove()
  const style = document.createElement('style')
  style.dataset.dshBot = 'chat-room'
  style.textContent = `${selector || '[class*="_centerCol"]'}{${declarations}}`
  document.head.append(style)
  room.rule = style.sheet.cssRules[0]
  room.selector = selector
  return room.rule
}
let roomHold = 0
const chatRoom = {
  /** The column's right margin in px, or null for the shell's own. */
  set(width) {
    const { style } = roomRule()
    if (width === null) style.removeProperty('margin-right')
    else style.setProperty('margin-right', `${width}px`, 'important')
  },
  /** While on, a margin change lands at once instead of gliding. */
  hold(on) {
    cancelAnimationFrame(roomHold)
    if (on) { roomRule().style.setProperty('transition', 'none', 'important'); return }
    // Two frames, so the last held write is on screen before the glide comes back.
    roomHold = requestAnimationFrame(() => { roomHold = requestAnimationFrame(() => roomRule().style.removeProperty('transition')) })
  },
  /** The columns themselves, for a drag's per-frame writes. */
  columns() {
    roomRule()
    return room.selector ? [...document.querySelectorAll(room.selector)] : []
  },
}
// The address as the bar shows it while not editing: no scheme, no trailing slash.
const shortAddress = url => String(url ?? '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const tabLabel = page => page.title || shortAddress(page.url) || t('New tab')

// The strip across the panel's top: the Bot's own tab first (the details view,
// collapsed), then one tab per browser page, then new-tab, the Files tab and close.
function PanelStrip({ bot, subject, view, ids, active, reading, onView, actions, useBrowserPages }) {
  const pages = useBrowserPages(map => map)
  const wrap = useRef(null)
  const ind = useRef(null)
  const spot = useRef(null)
  const under = useRef(null)
  // The capsule sits under the active tab; its two edges move on different springs.
  useLayoutEffect(() => {
    const box = wrap.current
    const capsule = ind.current
    if (!box || !capsule) return undefined
    const node = view === 'details' ? box.querySelector('.bt-ptab-bot')
      : view === 'files' ? box.querySelector('.bt-ptab-files')
        : box.querySelector(`[data-tab="${active}"]`)
    under.current = node
    if (!node) { capsule.style.opacity = '0'; spot.current = null; return undefined }
    // The Bot tab is pinned at the strip's start; showing it scrolls the pages back
    // so the capsule and the pinned tab line up.
    if (view === 'details') box.scrollLeft = 0
    else node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const to = { left: node.offsetLeft, right: box.offsetWidth - node.offsetLeft - node.offsetWidth }
    const from = spot.current
    spot.current = to
    capsule.style.opacity = '1'
    capsule.style.left = `${to.left}px`
    capsule.style.right = `${to.right}px`
    if (from === null || (from.left === to.left && from.right === to.right) || reducedMotion()) return undefined
    const ahead = to.left > from.left ? 'right' : 'left'
    const behind = ahead === 'right' ? 'left' : 'right'
    const lead = capsule.animate([{ [ahead]: `${from[ahead]}px` }, { [ahead]: `${to[ahead]}px` }], { duration: SPRING_LEAD.duration, easing: SPRING_LEAD.easing })
    const trail = capsule.animate([{ [behind]: `${from[behind]}px` }, { [behind]: `${to[behind]}px` }], { duration: SPRING_TRAIL.duration, easing: SPRING_TRAIL.easing })
    return () => { lead.cancel(); trail.cancel() }
  })
  // A drag resizes the strip without a render; the capsule's right edge keeps to its tab.
  useEffect(() => {
    const box = wrap.current
    if (!box) return undefined
    const observer = new ResizeObserver(() => {
      const node = under.current
      const capsule = ind.current
      if (!node?.isConnected || !capsule || spot.current === null) return
      spot.current = { left: node.offsetLeft, right: box.offsetWidth - node.offsetLeft - node.offsetWidth }
      capsule.style.left = `${spot.current.left}px`
      capsule.style.right = `${spot.current.right}px`
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  return h('div', { className: 'bt-ptabs', role: 'tablist', 'aria-label': t('Panel tabs') },
    h('div', { className: 'bt-ptabs-in', ref: wrap },
      h('button', {
        type: 'button', role: 'tab', 'aria-selected': view === 'details', className: 'bt-ptab bt-ptab-bot',
        title: bot.name, onClick: () => onView('details'),
      },
        h(BotMark, { bot, size: 20, state: reading ? 'searching' : 'idle' }),
        view === 'details' ? h('span', { className: 'bt-ptab-name' }, bot.name) : null),
      ids.map((tabId) => {
        const page = pages[tabId] ?? EMPTY_PAGE
        const on = view === 'browser' && tabId === active
        return h('button', {
          key: tabId, type: 'button', role: 'tab', 'aria-selected': on, 'data-tab': tabId, className: 'bt-ptab',
          title: page.url || t('New tab'),
          onClick: () => { actions.browserActivate(bot.id, tabId); onView('browser') },
          onAuxClick: (event) => { if (event.button === 1) { event.preventDefault(); void actions.browserCloseTab(bot.id, tabId) } },
        },
          h(Favicon, { src: page.favicon, className: 'bt-ptab-fav' }),
          h('span', { className: 'bt-ptab-title' }, tabLabel(page)),
          h('span', {
            className: 'bt-ptab-x', role: 'button', 'aria-label': t('Close tab'), title: t('Close tab'),
            onClick: (event) => { event.stopPropagation(); void actions.browserCloseTab(bot.id, tabId) },
          }, '×'))
      }),
      h('span', { ref: ind, className: 'bt-ptab-ind', 'aria-hidden': true })),
    // New tab and Close stay outside the scrolling tabs, so a narrow panel keeps both.
    h('button', { type: 'button', className: 'bt-ptab-new', 'aria-label': t('New tab'), title: t('New tab'), onClick: () => actions.browserNewTab(subject) }, h(PlusTabIcon)),
    // The Files tab: the panel's own view, no browser needed.
    h('button', {
      type: 'button', role: 'tab', 'aria-selected': view === 'files', className: 'bt-ptab bt-ptab-files',
      title: t('Files'), onClick: () => onView('files'),
    }, h(FolderIcon), view === 'files' ? h('span', { className: 'bt-ptab-name' }, t('Files')) : null),
    h('button', { type: 'button', className: 'bt-icon-btn bt-ptab-close', 'aria-label': t('Close panel'), title: t('Close panel'), onClick: () => actions.closePanel() }, h(CloseIcon)))
}

// The browser view: toolbar (back, forward, reload/stop, address) over the frame
// the guest webview covers.
function BrowserView({ bot, tabId, leaving, landed, actions, useBrowserPages }) {
  const page = useBrowserPages(pages => pages[tabId ?? '']) ?? EMPTY_PAGE
  const frame = useRef(null)
  const input = useRef(null)
  const [draft, setDraft] = useState(null)

  // The guest goes on screen once the panel has landed and settled on its width,
  // and only over a page: the empty and error states are the panel's own.
  const showGuest = landed && !leaving && Boolean(page.url) && !page.error
  useLayoutEffect(() => {
    const element = frame.current
    if (!element || leaving || !tabId) { void actions.browserShow(null); return undefined }
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = 0
      const box = element.getBoundingClientRect()
      void actions.browserShow(tabId, showGuest ? { left: box.left, top: box.top, width: box.width, height: box.height } : null)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    // Measured inside the observer callback, where layout is fresh: the guest moves in
    // the same frame as the panel edge instead of one behind it.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [tabId, showGuest, leaving])

  // A fresh tab starts on its address bar.
  useEffect(() => {
    setDraft(null)
    if (landed && !page.url) input.current?.focus()
  }, [tabId, landed])

  const go = (event) => {
    event.preventDefault()
    const text = draft ?? ''
    if (text.trim() === '') return
    setDraft(null)
    input.current?.blur()
    void actions.browserNavigate(tabId, text).then((opened) => { if (opened) actions.browserFocus(tabId) })
  }

  const editing = draft !== null
  const secure = /^https:/i.test(page.url)
  return h('div', { className: 'bt-panel-view bt-panel-browser', 'aria-label': t("{name}'s browser", { name: bot.name }) },
    h('div', { className: 'bt-browser-bar' },
      h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Back'), title: t('Back'), disabled: !page.canGoBack, onClick: () => actions.browserCommand(tabId, 'back') }, h(BackIcon)),
      h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Forward'), title: t('Forward'), disabled: !page.canGoForward, onClick: () => actions.browserCommand(tabId, 'forward') }, h(ForwardIcon)),
      h('button', {
        type: 'button', className: 'bt-icon-btn', disabled: !page.url,
        'aria-label': page.loading ? t('Stop') : t('Reload'), title: page.loading ? t('Stop') : t('Reload'),
        onClick: () => actions.browserCommand(tabId, page.loading ? 'stop' : 'reload'),
      }, h(page.loading ? StopIcon : ReloadIcon)),
      h('form', { className: 'bt-browser-address', onSubmit: go, 'data-editing': editing || undefined },
        h('span', { className: 'bt-browser-scheme', 'aria-hidden': true }, h(secure && !editing ? LockIcon : GlobeIcon)),
        h('input', {
          ref: input, type: 'text', spellCheck: false, autoComplete: 'off', 'aria-label': t('Address'),
          placeholder: t('Search or enter address'),
          value: editing ? draft : shortAddress(page.url),
          onFocus: (event) => { setDraft(page.url); const target = event.target; requestAnimationFrame(() => target.select()) },
          onBlur: () => setDraft(null),
          onChange: event => setDraft(event.target.value),
          onKeyDown: (event) => { if (event.key === 'Escape') { event.stopPropagation(); setDraft(null); event.currentTarget.blur() } },
        })),
      page.loading ? h('span', { className: 'bt-browser-progress', 'aria-hidden': true }) : null),
    h('div', { ref: frame, className: 'bt-browser-frame', 'data-guest': showGuest || undefined },
      page.error
        ? h('div', { className: 'bt-browser-empty' },
            h('div', { className: 'bt-browser-empty-title' }, t('This page didn’t load')),
            h('div', { className: 'bt-browser-empty-text' }, t(page.error)),
            page.url ? h('button', { type: 'button', className: 'bt-browser-retry', onClick: () => { void actions.browserNavigate(tabId, page.url) } }, t('Try again')) : null)
        : !page.url
          ? h('div', { className: 'bt-browser-empty' },
              h(BotMark, { bot, size: 48, state: 'idle', live: true }),
              h('div', { className: 'bt-browser-empty-title' }, t("{name}'s browser", { name: bot.name })),
              h('div', { className: 'bt-browser-empty-text' }, t('Open a page here and {name} can read it with you. Logins and cookies stay with {name}; other Bots never see them.', { name: bot.name })))
          : null))
}

/**
 * One aside for the Bot's details and browser. `pane` is
 * `{ id, view: 'details'|'browser', renaming, tab }`; `id` is the Session id the
 * panel follows. Without the Desktop bridge the browser view never shows.
 */
export function BotPanel({ pane, leaving, roster, actions, useSessions, useSessionStatus, useActivity, useWork, useBrowserTabs, useBrowserPages }) {
  const bot = roster.byId[pane.id]
  const canBrowse = Boolean(bot && roster.browser === true && actions.browserShow)
  // A delivered file's own page comes first: it needs no Bot and no browser, and its
  // shape is the panel's own (full screen on a phone, the right column on a desktop).
  // The list of everything delivered does too, and draws the same title bar.
  const view = pane.view === 'preview' && pane.preview
    ? 'preview'
    : pane.view === 'products' ? 'products'
      : pane.view === 'browser' && canBrowse ? 'browser' : pane.view === 'files' ? 'files' : 'details'
  const tabState = useBrowserTabs(map => (bot ? (map[bot.id] ?? EMPTY_TABS) : EMPTY_TABS))
  const active = tabState.active
  const page = useBrowserPages(pages => (active ? pages[active] : null) ?? EMPTY_PAGE)
  const root = useRef(null)
  // The panel is the phone's screen and the wide window's right-hand column, so the key follows the
  // same rule as the other panes (test/ux-rules.test.js, the host pair): on a phone the shell's modal
  // machinery owns Escape, the focus trap and the focus handed back when the panel closes -- and it
  // reads the panel through `root` below, so the role and aria-modal on that element are part of the
  // same wiring, not decoration. A wide window keeps our own key, which details-drawer.js registers
  // for the view that always had it, and the panel is not marked a dialog there at all.
  //
  // `mobile` alone, not per view: the views share one element, so a hook that came and went with the
  // tab would hand the focus back to the opener every time the user switched to the browser tab.
  const mobile = useMobile()
  useModalLayer(root, mobile, () => actions.closeOverlay())
  const fly = useRef(null)
  const [landed, setLanded] = useState(false)
  const [settling, setSettling] = useState(false)
  const pc = usePcColumns()
  const [width, setWidth] = useState(() => savedWidth(detailsLow(window.innerWidth, isPcLayout())))
  const [viewport, setViewport] = useState(() => window.innerWidth)
  // While dragging or while the window resizes, width changes land at once.
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const instant = dragging || resizing
  const [reading, setReading] = useState(false)

  const detailLow = detailsLow(viewport, pc)
  const panelWidth = fitWidth(width ?? (view === 'details' ? detailLow : DEFAULT_WIDTH), widthRange(view, viewport, detailLow))
  // Once the browser or the Files tab has shown, the Bot page keeps its width (up to
  // DETAILS_MAX).
  useLayoutEffect(() => { if (view !== 'details' && width === null) setWidth(DEFAULT_WIDTH) }, [view, width])
  useLayoutEffect(() => { chatRoom.hold(instant) }, [instant])
  // A view switch that changes the width holds the guest back and pins both views to
  // the final width until the panel edge has settled. It is set while rendering, so the
  // switch's own commit is already pinned and the flying mark measures where its target
  // ends up, not where it sits before the pin.
  const [last, setLast] = useState({ view, width: panelWidth })
  if (last.view !== view || last.width !== panelWidth) {
    setLast({ view, width: panelWidth })
    if (last.view !== view) setSettling(last.width !== panelWidth && !instant)
  }
  // Such a switch gives the conversation its new width at once, so it reflows once
  // instead of every frame of the glide. Opening and closing glide it with the panel.
  const shownView = useRef(view)
  useLayoutEffect(() => {
    const switched = settling && shownView.current !== view
    shownView.current = view
    if (switched) chatRoom.hold(true)
    chatRoom.set(leaving ? null : panelWidth)
    if (switched) chatRoom.hold(false)
  }, [view, panelWidth, leaving])
  useEffect(() => () => { chatRoom.set(null); chatRoom.hold(false) }, [])
  useEffect(() => {
    let timer
    const onResize = () => {
      setResizing(true)
      setViewport(window.innerWidth)
      clearTimeout(timer)
      timer = setTimeout(() => setResizing(false), 160)
    }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize) }
  }, [])
  useEffect(() => {
    if (!settling) return undefined
    const timer = setTimeout(() => setSettling(false), SPRING_SHAPE.duration + 40)
    return () => clearTimeout(timer)
  }, [settling, view])
  useEffect(() => {
    const timer = setTimeout(() => setLanded(true), 360)
    return () => clearTimeout(timer)
  }, [])

  // A Bot's strip restores as soon as the panel opens for it.
  useEffect(() => { if (canBrowse) actions.browserEnsure(bot.id) }, [bot?.id, canBrowse])
  // With the last tab closed the browser view folds back into the details view.
  useEffect(() => {
    if (view === 'browser' && (active === null || !tabState.ids.includes(active))) actions.setPanelView('details')
  }, [view, active, tabState.ids.length])
  // The guest leaves the screen while another view is up, and on close.
  useEffect(() => {
    if (view !== 'browser' || leaving) void actions.browserShow?.(null)
  }, [view, leaving])
  useEffect(() => () => { void actions.browserShow?.(null) }, [])

  useEffect(() => {
    if (!page.readAt || Date.now() - page.readAt > READ_FLASH_MS) return undefined
    setReading(true)
    const timer = setTimeout(() => setReading(false), READ_FLASH_MS)
    return () => clearTimeout(timer)
  }, [page.readAt])

  // A view switch flies the Bot's mark between the drawer avatar and the strip,
  // and the outgoing view fades out over the incoming one at its own width.
  const beginSwitch = (next) => {
    if (reducedMotion()) return
    const panel = root.current
    const outgoing = panel?.querySelector('.bt-panel-view')
    if (outgoing) {
      const ghostEl = document.createElement('div')
      ghostEl.className = 'bt-panel-ghost'
      ghostEl.style.width = `${outgoing.offsetWidth}px`
      ghostEl.append(outgoing.cloneNode(true))
      outgoing.parentElement.append(ghostEl)
      void ghostEl.animate([
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.985)' },
      ], { duration: 160, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).finally(() => ghostEl.remove())
    }
    const source = next === 'browser'
      ? panel?.querySelector('.bt-drawer-id .bt-mark')
      : panel?.querySelector('.bt-ptab-bot .bt-mark')
    if (source) fly.current = { node: source.cloneNode(true), from: source.getBoundingClientRect() }
  }
  const switchView = (next) => {
    if (next === view || leaving) return
    beginSwitch(next)
    actions.setPanelView(next)
  }
  // Every path into the browser view (globe, card, +) animates the same collapse.
  const panelActions = { ...actions }
  for (const name of ['openBrowser', 'browserNewTab', 'browserPick']) {
    if (actions[name]) panelActions[name] = (...args) => { if (view !== 'browser') beginSwitch('browser'); return actions[name](...args) }
  }
  useLayoutEffect(() => {
    const move = fly.current
    if (!move) return
    fly.current = null
    const target = view === 'details'
      ? root.current?.querySelector('.bt-drawer-id .bt-mark')
      : root.current?.querySelector('.bt-ptab-bot .bt-mark')
    if (!target || move.from.width === 0) return
    // A strip that has just appeared still grows from zero height; the target is
    // measured where it stands once the strip is full height.
    const growing = root.current.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'bt-strip-in')
    const at = growing.map(animation => animation.currentTime)
    for (const animation of growing) animation.currentTime = animation.effect.getComputedTiming().endTime
    const to = target.getBoundingClientRect()
    growing.forEach((animation, index) => { animation.currentTime = at[index] })
    const clone = move.node
    Object.assign(clone.style, {
      position: 'fixed', left: `${move.from.left}px`, top: `${move.from.top}px`,
      width: `${move.from.width}px`, height: `${move.from.height}px`, margin: '0',
      transformOrigin: '0 0', zIndex: document.documentElement.dataset.btMobile ? '97' : '80', pointerEvents: 'none', visibility: '',
    })
    document.body.append(clone)
    target.style.visibility = 'hidden'
    const scale = to.width / move.from.width
    const anim = clone.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${to.left - move.from.left}px, ${to.top - move.from.top}px) scale(${scale})` },
    ], { duration: SPRING_SHAPE.duration, easing: SPRING_SHAPE.easing, fill: 'forwards' })
    void anim.finished.catch(() => {}).finally(() => { clone.remove(); target.style.visibility = '' })
  }, [view, pane.id])

  // A drag writes the width into the panel's and the column's own inline styles each
  // frame (each restyles one element) and renders once, on release.
  // The sheet's handle drags how tall the sheet stands (a phone only: its width is always the
  // screen's). The band a finger grabs is 44px tall while the pill it draws stays 4, a drag well
  // past the shortest height closes the sheet the way the scrim does, and nothing is remembered --
  // the sheet opens at its own height every time.
  const SHEET_MIN_VH = 30
  const SHEET_MAX_VH = 85
  const SHEET_CLOSE_SLACK = 32
  const startSheetDrag = (event) => {
    const panel = root.current
    if (!panel || (event.button ?? 0) !== 0) return
    const vh = window.innerHeight
    const min = Math.round(vh * SHEET_MIN_VH / 100)
    const max = Math.round(vh * SHEET_MAX_VH / 100)
    const from = panel.getBoundingClientRect().height
    const startY = event.clientY
    let wanted = from
    let moved = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
    panel.dataset.draggingSheet = ''
    const move = (moveEvent) => {
      if (Math.abs(moveEvent.clientY - startY) > 3) moved = true
      wanted = Math.round(from + (startY - moveEvent.clientY))
      panel.style.height = `${Math.max(0, wanted)}px`
    }
    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      delete panel.dataset.draggingSheet
      // A tap on the handle is not a drag: it changes nothing, not even the clamp below.
      if (!moved) return
      if (wanted < min - SHEET_CLOSE_SLACK) { actions.closeProducts?.(); return }
      panel.style.height = `${Math.min(Math.max(wanted, min), max)}px`
    }
    move(event)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const startResize = (event) => {
    if (event.button !== 0 || leaving) return
    event.preventDefault()
    const panel = root.current
    const grip = event.currentTarget
    grip.setPointerCapture?.(event.pointerId)
    const range = widthRange(view, window.innerWidth, detailsLow(window.innerWidth, pc))
    const from = { x: event.clientX, width: panelWidth }
    let next = panelWidth
    setDragging(true)
    setSettling(false)
    chatRoom.hold(true)
    const columns = chatRoom.columns()
    for (const column of columns) column.style.setProperty('transition', 'none', 'important')
    const onMove = (move) => {
      next = fitWidth(from.width + from.x - move.clientX, range)
      panel.style.width = `${next}px`
      if (columns.length === 0) chatRoom.set(next)
      for (const column of columns) column.style.setProperty('margin-right', `${next}px`, 'important')
    }
    const ends = ['pointerup', 'pointercancel', 'lostpointercapture']
    const onEnd = (end) => {
      if (end.type === 'pointerup') onMove(end)
      grip.removeEventListener('pointermove', onMove)
      for (const name of ends) grip.removeEventListener(name, onEnd)
      // Hand the width back to the rule and the panel's variable in the same frame.
      chatRoom.set(next)
      for (const column of columns) { column.style.removeProperty('margin-right'); column.style.removeProperty('transition') }
      panel.style.setProperty('--bt-panel-w', `${next}px`)
      panel.style.removeProperty('width')
      setDragging(false)
      if (next === from.width) return
      setWidth(next)
      try { localStorage.setItem(WIDTH_KEY, String(next)) } catch { /* storage unavailable */ }
    }
    grip.addEventListener('pointermove', onMove)
    for (const name of ends) grip.addEventListener(name, onEnd)
  }

  const hasStrip = canBrowse && tabState.ids.length > 0
  // The Files tab needs no browser, so the strip shows even without one. Its own
  // view is chosen by `view === 'files'`, which the panel falls back from only when
  // the subject disappears. A preview draws its own title bar instead of the strip.
  const showStrip = view !== 'preview' && view !== 'products' && (hasStrip || view === 'files')
  // The list of everything the team handed over is a sheet from the foot on a phone (its own CSS),
  // so it brings the scrim a sheet is dismissed with; the desktop column draws none (display:none).
  return h(Fragment, null,
    view === 'products' ? h('div', { className: 'bt-scrim bt-panel-scrim', onClick: () => actions.closeProducts?.() }) : null,
    h('aside', {
    ref: root, className: 'bt-panel', ...(mobile ? { role: 'dialog', 'aria-modal': true } : null), 'data-view': view, 'aria-label': `${view === 'files' ? t('Files') : view === 'preview' ? t('File preview') : view === 'products' ? t('All deliverables') : view === 'browser' && bot ? t("{name}'s browser", { name: bot.name }) : t('Conversation details')}`,
    // A leaving panel is out of the accessibility tree and holds no focus. `aria-hidden`
    // cannot say that here: the tap that closed the panel leaves the focus on one of its own
    // buttons, and a browser refuses to hide a subtree that still holds the focus -- it logs
    // "Blocked aria-hidden on an element because its descendant retained focus", keeps
    // announcing the panel, and leaves the focus on a control that is on its way out.
    // `inert` is the browser's own answer: it hides the subtree and lets the focus go.
    'data-leaving': leaving || undefined, inert: leaving ? '' : undefined, 'data-settling': settling || undefined,
    'data-instant': instant || undefined, 'data-dragging': dragging || undefined, style: { '--bt-panel-w': `${panelWidth}px` },
    onAnimationEnd: (event) => { if (event.target === event.currentTarget) setLanded(true) },
  },
    leaving ? null : h('div', { className: 'bt-panel-grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': t('Resize panel'), onPointerDown: startResize }),
    // What says the sheet came from below; a phone's rule draws it, nothing else sees it.
    view === 'products'
      ? h('div', {
          className: 'bt-sheet-grip', role: 'separator', 'aria-orientation': 'horizontal',
          'aria-label': t('Resize the sheet'), onPointerDown: startSheetDrag,
        },
        h('span', { className: 'bt-sheet-handle', 'aria-hidden': true }),
        // The way out sits in the sheet's top-right corner, on the handle's own row: the handle
        // stays centred there and the title below is left-aligned, which is what the user asked for.
        // It takes no part in the drag (a press on it stops before the row's own handler).
        h('button', {
          type: 'button', className: 'bt-sheet-close', 'aria-label': t('Close'), title: t('Close'),
          onPointerDown: (event) => event.stopPropagation(),
          onClick: () => actions.closeProducts?.(),
        }, h(CloseIcon)))
      : null,
    // On a phone the panel is full screen and already carries a close button in the corner
    // the desktop layout puts its own controls, so it adds none of its own.
    // Over the whole window while dragging: the cursor stays a resize cursor and the
    // pages underneath (the chat, the guest) see no pointer.
    dragging ? createPortal(h('div', { className: 'bt-drag-shield', 'aria-hidden': true }), document.body) : null,
    showStrip ? h(PanelStrip, { bot, subject: pane.id, view, ids: tabState.ids, active, reading, onView: switchView, actions: panelActions, useBrowserPages }) : null,
    view === 'browser' && bot
      ? h(BrowserView, { key: `browser:${active}`, bot, tabId: active, leaving, landed: landed && !settling, actions, useBrowserPages })
      : view === 'preview'
        ? h('div', { key: `preview:${pane.preview?.path ?? ''}`, className: 'bt-panel-view' },
            h(DeliveredPreview, { file: pane.preview, actions: panelActions, onClose: () => actions.closePreview?.() }))
        : view === 'products'
          ? h('div', { key: 'products', className: 'bt-panel-view' },
              h(DeliveredList, { actions: panelActions, onClose: () => actions.closeProducts?.() }))
          : view === 'files'
        ? h(FilePreview, { key: 'files', actions: panelActions })
        : h('div', { key: `details:${pane.id}:${pane.renaming ? 'rename' : ''}:${pane.tab ?? ''}`, className: 'bt-panel-view' },
            h(DetailsDrawer, {
              sessionId: pane.id, startRenaming: pane.renaming, startTab: pane.tab, hasStrip,
              roster, actions: panelActions, useSessions, useSessionStatus, useActivity, useWork, useBrowserTabs, useBrowserPages,
            }))))
}

// The 全部产物 sheet, in a block of its own because it must be installed whether or not this profile
// has the desktop browser shell: BROWSER_CSS below is installed only when a webview bridge exists
// (index.js), and a phone without one still draws this panel.
export const PANEL_SHEET_CSS = `
/* 全部产物 on a phone is a sheet from the foot rather than the column that stands beside the
   conversation: full width, glued to the bottom, two rounded top corners and a handle that says
   where it came from, as tall as its list asks for up to 85% of the screen and scrolling inside.
   The desktop column is untouched -- every rule of the sheet is on the phone.
   The :not() is load-bearing: in the expanded band this panel is the right-hand column, not a sheet,
   and that is the selector saying so. On a phone it also puts the sheet above the page rule that makes
   every mobile band full width (styles.js) -- the band that once tied with a plain selector (the panel
   floated at 70vw there) is gone, so the extra attribute is belt and braces rather than the tie-breaker
   it was first written for. Kept either way: dropping it would draw a sheet in the column's band. */
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-panel[data-view=products]{top:auto;bottom:0;left:0!important;right:0!important;width:100%!important;height:auto;max-height:85vh;padding-top:0;border-left:0;border-radius:18px 18px 0 0;box-shadow:0 -12px 40px -12px rgba(0,0,0,.3);overflow:hidden;animation:bt-products-in .26s cubic-bezier(.2,0,0,1)}
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-panel[data-view=products][data-leaving]{animation:bt-products-out .2s cubic-bezier(.4,0,1,1) forwards}
/* The band a thumb grabs is 44 tall and draws nothing; the pill inside it is the 4px the eye sees.
   touch-action:none keeps the page's own scroll out of the gesture. */
html[data-bt-mobile] .bt-sheet-grip{position:relative;flex:none;display:flex;align-items:center;justify-content:center;height:44px;touch-action:none;cursor:grab}
/* The close of the sheet: the top-right corner of the row the handle sits in -- 48px of finger and
   the title-bar icon key's own press shape, out of the drag's way, and only on the phone (a desktop
   column closes through its back arrow). */
.bt-sheet-close{display:none}
html[data-bt-mobile] .bt-sheet-close{display:inline-flex;position:absolute;right:6px;top:50%;transform:translateY(-50%);z-index:2;align-items:center;justify-content:center;width:48px;height:48px;padding:0;border:0;border-radius:12px;background:none;color:var(--bt-ink-2);cursor:pointer;touch-action:manipulation}

@media (hover:hover){
html[data-bt-mobile] .bt-sheet-close:hover{background:var(--bt-hover);color:var(--bt-ink)}
}
/* The press, for a finger: it is gone the moment the finger is, which is what makes it different
   from the hover highlight an Android tap leaves stuck behind it. */
html[data-bt-mobile] .bt-sheet-close:active{background:var(--bt-active);color:var(--bt-ink)}
html[data-bt-mobile] .bt-sheet-close svg{width:22px;height:22px}
/* On the sheet the title row holds the name alone: the arrow is the preview page's, and the close
   is up in the corner above it. */
html[data-bt-mobile] .bt-sheet-head .bt-preview-back{display:none}
html[data-bt-mobile] .bt-sheet-grip:active{cursor:grabbing}
html[data-bt-mobile] .bt-sheet-handle{width:36px;height:4px;border-radius:999px;background:var(--bt-line-2)}
/* While a finger is on it the sheet follows that finger exactly: nothing eases behind it. */
html[data-bt-mobile] .bt-panel[data-dragging-sheet]{animation:none;transition:none}
/* The sheet's title bar reads left to right: the name from the edge, the close at the other one
   (the panel's own arrow stays where a preview's head is). */
html[data-bt-mobile] .bt-sheet-head{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;height:auto;min-height:56px;padding:0 12px}
html[data-bt-mobile] .bt-sheet-head .bt-preview-name{position:static;transform:none;flex:none;min-width:0;text-align:left;font-size:15px;line-height:21px}
/* The second line: what the page is, one step quieter and on the name's own left edge. */
html[data-bt-mobile] .bt-sheet-head .bt-preview-hint{font-size:12px;line-height:16px;color:var(--bt-ink-2)}
/* The scrim a sheet is dismissed with: the skin's own .bt-scrim class (its colour and fade live in
   styles.js, declared once) placed by this rule, under the sheet (96) and over the bar (95, which
   the scrim follows in the document). A desktop column draws none: its rule says so. */
.bt-panel-scrim{display:none}
html[data-bt-mobile] .bt-panel-scrim{display:block;position:fixed;inset:0;z-index:95}
/* The sheet's own pair, named for the sheet. @keyframes are resolved by document order, not by
   selector weight: the skin defines bt-sheet-in/out for .bt-exchange (styles.js:576-577), and while
   both sheets shared those names this one's direction was decided by whichever stylesheet happened
   to be injected last -- the same trap the selector above avoids with its extra attribute. A name
   defined once cannot be read from the wrong place. */
@keyframes bt-products-in{from{transform:translateY(100%)}to{transform:none}}
@keyframes bt-products-out{from{transform:none}to{transform:translateY(100%)}}
@media (prefers-reduced-motion:reduce){html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-panel[data-view=products]{animation:bt-fade .12s ease-out}}
/* The panel's own view column, and the state it is in while a drag settles. Both are used on every
   profile -- a phone draws the panel too -- so they live here rather than in the block that needs
   the desktop browser shell. The ghost column above them (browser-pane.js) is the pc layout's. */
.bt-panel-view{flex:1;min-height:0;display:flex;flex-direction:column;animation:bt-panel-view-in .22s cubic-bezier(.16,1,.3,1)}
@keyframes bt-panel-view-in{from{opacity:0}}
.bt-panel[data-settling]{overflow:hidden}
.bt-panel[data-settling]>.bt-ptabs,.bt-panel[data-settling]>.bt-panel-view{flex-shrink:0;align-self:flex-end;box-sizing:border-box;width:calc(var(--bt-panel-w,320px) - .5px)}
`

export const BROWSER_CSS = `
.bt-panel{--bt-panel-view-fade:${SPRING_SHAPE.duration}ms}
.bt-ptabs{position:relative;display:flex;align-items:center;height:44px;flex:none;border-bottom:.5px solid var(--bt-line);padding:0 6px;gap:0;animation:bt-strip-in ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
@keyframes bt-strip-in{from{height:0;opacity:0}}
.bt-ptabs-in{position:relative;display:flex;align-items:center;gap:2px;flex:1;min-width:0;height:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:4px 2px;scroll-padding-left:48px;mask-image:linear-gradient(to right,#000,#000 calc(100% - 10px),transparent)}
.bt-ptabs-in>.bt-ptab-bot{position:sticky;left:0;z-index:2;background:var(--bt-main)}
.bt-ptabs-in>.bt-ptab-bot[aria-selected=true]{background:transparent}
.bt-ptabs-in::-webkit-scrollbar{display:none}
.bt-ptab{position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px;height:32px;max-width:180px;padding:0 8px;flex:none;border:0;border-radius:9px;background:none;color:var(--bt-ink-2);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;transition:color .12s ease}

@media (hover:hover){
.bt-ptab:hover{color:var(--bt-ink)}
}
.bt-ptab[aria-selected=true]{color:var(--bt-ink)}
.bt-ptab-bot{padding:0 7px}
.bt-ptab-bot .bt-mark{flex:none}
.bt-ptab-name{max-width:96px;overflow:hidden;text-overflow:ellipsis;font-weight:500;animation:bt-ptab-label .18s ease}
@keyframes bt-ptab-label{from{opacity:0;filter:blur(4px);max-width:0}}
.bt-ptab-fav{width:14px;height:14px;flex:none;border-radius:3px;object-fit:cover;color:var(--bt-ink-3)}
.bt-ptab-globe{display:inline-flex}
.bt-ptab-globe svg{width:14px;height:14px}
.bt-ptab-title{max-width:140px;overflow:hidden;text-overflow:ellipsis}
.bt-ptab-x{flex:none;width:16px;height:16px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;color:var(--bt-ink-3);opacity:0;transition:opacity .12s ease,background-color .12s ease}
.bt-ptab[aria-selected=true] .bt-ptab-x{opacity:1}
@media (hover:hover){
.bt-ptab:hover .bt-ptab-x{opacity:1}
}

@media (hover:hover){
.bt-ptab-x:hover{background:var(--bt-active);color:var(--bt-ink)}
}
.bt-ptab-new{position:relative;z-index:1;flex:none;width:28px;height:32px;border:0;border-radius:9px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}

@media (hover:hover){
.bt-ptab-new:hover{color:var(--bt-ink)}
}
.bt-ptab-new svg{width:15px;height:15px}
.bt-ptab-files{position:relative;z-index:1;flex:none;padding:0 7px;gap:5px}
.bt-ptab-files svg{width:15px;height:15px;flex:none}
.bt-ptab-ind{position:absolute;top:4px;bottom:4px;border-radius:9px;background:var(--bt-hover);opacity:0;pointer-events:none;z-index:0;transition:opacity .15s ease}
.bt-ptab-close{flex:none;margin-left:2px}
.bt-panel-ghost{position:absolute;top:44px;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:2}
.bt-panel-ghost>.bt-panel-view{position:absolute;inset:0}
/* While the panel changes width its views keep their final width on the right edge, so
   only the panel edge moves and nothing inside reflows frame by frame. */

.bt-panel-browser{position:relative}
.bt-browser-bar{position:relative;display:flex;align-items:center;gap:2px;height:52px;padding:0 10px 0 12px;flex:none;border-bottom:.5px solid var(--bt-line)}
.bt-browser-bar .bt-icon-btn:disabled{opacity:.35;cursor:default;background:none}
.bt-browser-address{flex:1;min-width:0;display:flex;align-items:center;gap:6px;height:32px;margin:0 4px;padding:0 12px;border-radius:999px;background:var(--bt-hover);border:.5px solid transparent;transition:background-color .12s ease,border-color .12s ease,box-shadow .12s ease}

@media (hover:hover){
.bt-browser-address:hover{background:var(--bt-active)}
}
.bt-browser-address[data-editing]{background:var(--bt-main);border-color:var(--bt-line-2);box-shadow:0 2px 8px -1px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)}
.bt-browser-scheme{display:inline-flex;color:var(--bt-ink-2);flex:none}
.bt-browser-scheme svg{width:14px;height:14px}
.bt-browser-address input{flex:1;min-width:0;border:0;background:none;outline:none;color:var(--bt-ink);font:inherit;font-size:13px;line-height:18px;padding:0;text-overflow:ellipsis}
.bt-browser-address input::placeholder{color:var(--bt-ink-2)}
.bt-browser-progress{position:absolute;left:0;right:0;bottom:-1px;height:2px;overflow:hidden;pointer-events:none}
.bt-browser-progress::after{content:"";position:absolute;inset:0;width:40%;background:var(--bt-accent);border-radius:2px;animation:bt-browser-load 1.1s cubic-bezier(.4,0,.2,1) infinite}
@keyframes bt-browser-load{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
.bt-browser-frame{position:relative;flex:1;min-height:0;background:var(--bt-main)}
.bt-browser-frame[data-guest]{background:#fff}
.bt-browser-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px;text-align:center;animation:bt-foot-in .3s ease}
.bt-browser-empty-title{font-size:15px;line-height:22px;font-weight:500;margin-top:6px}
.bt-browser-empty-text{max-width:300px;font-size:13px;line-height:19px;color:var(--bt-ink-2);overflow-wrap:anywhere}
.bt-browser-retry{margin-top:6px;height:32px;padding:0 14px;border-radius:999px;border:.5px solid var(--bt-line-2);background:var(--bt-main);color:var(--bt-ink);font:inherit;font-size:13px;cursor:pointer}

@media (hover:hover){
.bt-browser-retry:hover{background:var(--bt-hover)}
}
.bt-bcards{display:flex;flex-direction:column;gap:12px}
.bt-bcard{position:relative;border:.5px solid var(--bt-line-2);border-radius:12px;overflow:hidden;background:var(--bt-main);animation:bt-bcard-in .24s cubic-bezier(.16,1,.3,1) both;transition:border-color .12s ease,box-shadow .12s ease}
@keyframes bt-bcard-in{from{opacity:0;filter:blur(4px);transform:translateY(4px)}}
.bt-bcard[data-active]{border-color:var(--bt-accent);box-shadow:0 0 0 1px var(--bt-accent)}
.bt-bcard-shot{position:relative;display:block;width:100%;aspect-ratio:16/10;border:0;background:var(--bt-hover);padding:0;cursor:pointer}
.bt-bcard-blank{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--bt-ink-2);font-size:12px}
.bt-bcard-blank svg{width:20px;height:20px}
.bt-bcard-preview{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:14px 16px;text-align:left;background:linear-gradient(to bottom,var(--bt-main),var(--bt-hover));overflow:hidden}
.bt-bcard-ptitle{font-size:13px;line-height:18px;font-weight:600;color:var(--bt-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bt-bcard-excerpt{font-size:12px;line-height:17px;color:var(--bt-ink-2);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.bt-bcard-row{display:flex;align-items:center;gap:7px;padding:8px 10px;min-width:0}
.bt-bcard-fav{width:14px;height:14px;flex:none;border-radius:3px;color:var(--bt-ink-3)}
.bt-bcard-row svg.bt-bcard-fav{width:14px;height:14px}
.bt-bcard-title{flex:1;min-width:0;font-size:12.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--bt-ink)}
.bt-bcard-host{flex:none;font-size:11px;line-height:15px;color:var(--bt-ink-2);max-width:38%;overflow:hidden;text-overflow:ellipsis}
.bt-bcard-x{position:absolute;top:6px;right:6px;width:22px;height:22px;border:0;border-radius:7px;background:color-mix(in srgb,var(--bt-main) 88%,transparent);color:var(--bt-ink-2);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;opacity:0;transition:opacity .12s ease;backdrop-filter:blur(4px)}

@media (hover:hover){
.bt-bcard:hover .bt-bcard-x{opacity:1}
}
/* On a phone the close is there without being hovered -- a touch device has no hover, and a key that
   only shows on hover reads as a key that is not there (audit F1). It is 44px of finger with the same
   22px chip drawn in the middle: padding plus background-clip keep the chip its own size, the -5px
   offset hands the box's extra size outward, and opacity is 1 for good. Its blur goes with it -- 4px
   of backdrop-filter behind a 22px chip was a GPU cost for nothing. */
html[data-bt-mobile] .bt-bcard-x{top:-5px;right:-5px;width:44px;height:44px;padding:11px;box-sizing:border-box;background-clip:content-box;opacity:1;backdrop-filter:none}
.bt-bcard-new{display:flex;align-items:center;justify-content:center;gap:6px;height:40px;border:.5px dashed var(--bt-line-2);border-radius:12px;background:none;color:var(--bt-ink-2);font:inherit;font-size:12.5px;cursor:pointer}

@media (hover:hover){
.bt-bcard-new:hover{color:var(--bt-ink);border-color:var(--bt-ink-3)}
}
.bt-bcard-new svg{width:14px;height:14px}
.bt-browser-empty-mark{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
@media (prefers-reduced-motion:reduce){.bt-ptabs,.bt-panel-view,.bt-bcard,.bt-ptab-name{animation:none}}
`
