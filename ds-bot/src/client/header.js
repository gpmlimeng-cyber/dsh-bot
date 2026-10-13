import { createElement as h, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currentPart, latestMemoryChange } from './text.js'
import { ArrowUpIcon, CloseIcon, ArrowDownIcon, MemoryIcon, MenuIcon, PlusIcon, DotsBoldIcon } from './icons.js'
import { botState, BotAvatar, RoomAvatar } from './mark.js'
import { useMobile } from './mobile.js'
import { ActivityIndicator } from './activity-row.js'
import { clockLabel, openingTurn, unseenSince } from './cells.js'
import { t } from './i18n.js'

// -------------------------------------------------------------------------
// Conversation header

// The pill's tail: a → that springs in on hover, flipping to ← while details are open.
const GoArrow = () => h('svg', { width: 14, height: 14, viewBox: '-12 -12 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M-7 0H7M2 -5L7 0L2 5' }))

// How long the pill says "Memory updated" after the change reaches this window.
const MEMORY_NOTICE_MS = 3_200
const noNews = select => select({})

// True while the latest memory change of the Bots in this conversation is news.
function useMemoryNotice(ids, useMemoryNews) {
  const seen = useMemoryNews(map => Math.max(0, ...ids.map(id => map?.[id]?.seen ?? 0)))
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const left = seen + MEMORY_NOTICE_MS - Date.now()
    setShown(seen > 0 && left > 0)
    if (seen === 0 || left <= 0) return undefined
    const timer = setTimeout(() => setShown(false), left)
    return () => clearTimeout(timer)
  }, [seen])
  return shown
}

// The notice the pill stretches to show. Its width is measured, so the pill's spring
// runs between two real widths.
function MemoryNotice({ shown }) {
  const inner = useRef(null)
  const [width, setWidth] = useState(0)
  const label = t('Memory updated')
  useLayoutEffect(() => { if (shown) setWidth(inner.current?.scrollWidth ?? 0) }, [label, shown])
  return h('span', { className: 'bt-pill-mem', 'aria-hidden': true, style: { '--bt-mem-w': `${width}px` } },
    h('span', { className: 'bt-pill-mem-in', ref: inner }, h('span', { className: 'bt-pill-mem-ico' }, h(MemoryIcon)), label))
}

export function HeaderPill({ sessionId, useRoster, useSessions, useSessionStatus, useSession, useActivity, useMemoryNews, useTurnClock, useUi, useLive, actions }) {
  const roster = useRoster(value => value)
  const title = useSessions(list => list.byId[sessionId]?.displayTitle ?? list.byId[sessionId]?.title ?? '')
  const firstTurns = useSessions((list) => {
    const outline = list.projectionsBySession?.[sessionId]?.values?.turnOutline ?? list.byId[sessionId]?.projectionValues?.turnOutline
    return Array.isArray(outline) ? outline.slice(0, 8).map(entry => entry.turn).join(',') : ''
  })
  const hiddenTurns = roster.exchangeTurns?.[sessionId]
  const visit = useUi(state => state.visits?.[sessionId])
  // The opening separator has no turn before it, so the transcript column draws it,
  // unless the opening is unread: then the first trigger draws it under the divider.
  const opening = useTurnClock((state) => {
    const first = openingTurn(state[sessionId], firstTurns, hiddenTurns)
    return first && !unseenSince(visit, first.start) ? clockLabel(first.start) : ''
  })
  useEffect(() => {
    if (opening) document.body.style.setProperty('--bt-first-sep', JSON.stringify(opening))
    else document.body.style.removeProperty('--bt-first-sep')
    return () => document.body.style.removeProperty('--bt-first-sep')
  }, [opening])
  const running = useSessionStatus(map => map.get(sessionId)?.running === true)
  const owner = roster.byId[sessionId]?.id ?? sessionId
  const doing = useActivity(map => map[owner])
  const bot = roster.byId[sessionId]
  const room = roster.roomsById[sessionId]
  const detailsOpen = useUi(state => state.details === sessionId)
  const name = bot?.name ?? room?.name ?? ''
  const useNews = useMemoryNews ?? noNews
  const memoryIds = bot ? [bot.id] : room?.members ?? []
  const notice = useMemoryNotice(memoryIds, useNews)
  // While the notice shows, the pill opens the memory of the Bot that changed.
  const changed = useNews(map => latestMemoryChange(map, memoryIds))
  // The composer placeholder is not localizable per Session, so CSS reads it from here.
  useEffect(() => {
    document.body.style.setProperty('--bt-placeholder', JSON.stringify(name ? t('Message {name}', { name }) : t('Message')))
  }, [name, t('Message')])
  useEffect(() => {
    actions.beginVisit(sessionId)
    return () => actions.endVisit(sessionId)
  }, [sessionId])
  // Group chats have no voice mode, so the composer CSS needs to know the Session kind.
  useEffect(() => {
    if (room) document.body.dataset.btRoom = ''
    else delete document.body.dataset.btRoom
    return () => { delete document.body.dataset.btRoom }
  }, [Boolean(room)])
  const memoryNotice = notice && changed !== null && roster.memory !== false
  const mobile = useMobile()
  const mobileNavOpen = useUi(value => value.mobileNav === true)
  // The menu the "more" button opens lives in the shared overlay state, so the button's
  // aria-expanded can follow it no matter who opened or closed it.
  const moreOpen = useUi(value => value.menu !== null)
  // TEMPORARY diagnostic: the only readable channel right now is the accessibility
  // tree, so the counts the device crew cannot dump go into the button's own label.
  const [probe, setProbe] = useState('')
  useEffect(() => {
    if (!mobile) return undefined
    const timer = setTimeout(() => {
      const rect = document.querySelector('.bt-mobile-bar .bt-mobile-nav')?.getBoundingClientRect()
      const headers = [...document.querySelectorAll('header')].filter((el) => el.getBoundingClientRect().width > 0)
      const head = headers[0]?.getBoundingClientRect()
      const cls = headers[0] === undefined ? 'none' : String(headers[0].className).replace(/_?[a-z0-9]{5,}_?/gi, '').slice(0, 14) || 'anon'
      const scroller = document.querySelector('[data-conversation-scroll]')?.getBoundingClientRect()
      const shellVar = getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-chrome-top').trim() || 'unset'
      const layerVar = getComputedStyle(document.documentElement).getPropertyValue('--dsh-mobile-top-inset').trim() || 'unset'
      const bar = getComputedStyle(document.documentElement).getPropertyValue('--bt-top-inset').trim() || 'unset'
      const scrim = document.querySelector('.bt-mobile-scrim') !== null
      const pill = document.querySelector('.bt-mobile-bar .bt-pill')?.getBoundingClientRect()
      // The composer is frozen at its flat 22px, and a screenshot cannot show a radius:
      // report it as a number, without styling anything (the capsule rules are gone).
      const card = document.querySelector('[data-composer-card]')
      const cardRadius = card === null ? 'na' : getComputedStyle(card).borderTopLeftRadius
      const cardHeight = card === null ? 'na' : Math.round(card.getBoundingClientRect().height)
      // The pill and the bar's right frame are meant to read ONE skin declaration (see
      // styles.js), and the accessibility tree is the only channel this crew can read:
      // report equality compactly, and on a mismatch name each property with both values.
      const skinOf = (el) => {
        if (el === null) return null
        const style = getComputedStyle(el)
        return {
          bw: style.borderTopWidth, bc: style.borderTopColor, br: style.borderTopLeftRadius,
          bg: style.backgroundColor, h: style.height, sh: style.boxShadow,
        }
      }
      const pillSkin = skinOf(document.querySelector('.bt-mobile-bar .bt-pill'))
      const frameSkin = skinOf(document.querySelector('.bt-mobile-bar .bt-mobile-acts'))
      let skin = 'na'
      if (pillSkin !== null && frameSkin !== null) {
        const keys = Object.keys(pillSkin)
        const off = keys.filter(key => pillSkin[key] !== frameSkin[key])
        skin = off.length === 0
          ? `eq${keys.length}(${pillSkin.bw},${pillSkin.bc},${pillSkin.br},${pillSkin.bg},${pillSkin.h},shadow)`
          : off.map(key => `${key}:pill=${pillSkin[key]}|frame=${frameSkin[key]}`).join(';')
      }
      setProbe(`nav${document.querySelectorAll('.bt-mobile-nav').length}bar${document.querySelectorAll('.bt-mobile-bar').length}`
        + `mk${document.querySelectorAll('.bt-head-mark').length}scr${scrim ? 1 : 0}`
        + ` self=${rect === undefined ? 'na' : `${Math.round(rect.left)},${Math.round(rect.top)}`}`
        + ` hdr${headers.length}:${cls}${head === undefined ? '' : `@${Math.round(head.top)}`}`
        + ` sc=${scroller === undefined ? 'na' : Math.round(scroller.top)}`
        + ` pillc=${pill === undefined ? 'na' : Math.round(pill.left + pill.width / 2)}/${Math.round(window.innerWidth / 2)}`
        + ` cardR=${cardRadius}/${cardHeight}`
        + ` topbar${document.querySelectorAll('[data-dsh-mobile-topbar]').length}`
        + ` skin=${skin}`
        + ` var=${shellVar} lay=${layerVar} bt=${bar}`)
    }, 1500)
    return () => clearTimeout(timer)
  }, [mobile])
  const head = h('div', { className: 'bt-head' },
    h('button', {
      type: 'button', className: 'bt-pill', 'aria-expanded': detailsOpen, 'data-memory': memoryNotice ? 'updated' : undefined,
      'aria-label': memoryNotice ? t('Memory updated. Open {name}\'s memory', { name: roster.byId[changed]?.name ?? name }) : t('View conversation details'),
      onClick: () => (memoryNotice ? actions.openMemory(changed) : actions.toggleDetails(sessionId)),
    },
    bot ? h(BotAvatar, { bot, size: 24, state: botState(running, doing, roster.questions?.[currentPart(bot)] !== undefined), badge: false })
      : room ? h(RoomAvatar, { room, roster, size: 24 }) : null,
    h('span', { className: 'bt-pill-name' }, bot?.name ?? room?.name ?? (title || t('New chat'))),
    h(MemoryNotice, { shown: memoryNotice }),
    h('span', { className: 'bt-pill-go', 'aria-hidden': true }, h(GoArrow))),
    h('span', { className: 'bt-sr', role: 'status' }, memoryNotice ? t('Memory updated') : ''),
    h(NewMessagePills, { key: sessionId, sessionId, useSessions, useUi, useTurnClock }),
    h(ActivityIndicator, { key: `activity:${sessionId}`, sessionId, useRoster, useSessionStatus, useSession, useLive, actions }))
  if (!mobile) return head
  // The right-hand group mirrors the hamburger: a new chat, then the subject's own menu.
  // The menu is the very one the sidebar rows open (actions.openMenu), so it reuses the
  // existing actions instead of adding a second set; a subject we cannot name (a Session
  // that belongs to no Bot, group or Agent we know) simply gets no menu button.
  const agent = (roster.agents ?? []).find(entry => entry.sessions?.includes(sessionId))
  const menuTarget = bot ? { kind: 'bot', id: sessionId }
    : room ? { kind: 'room', id: sessionId }
      : agent === undefined ? null : { kind: 'agent-session', id: sessionId, agentId: agent.id }
  const openMore = (event) => {
    if (menuTarget === null) return
    const box = event.currentTarget.getBoundingClientRect()
    // Anchored to the button's bottom-right; ContextMenu clamps it back into the viewport,
    // so a phone-width dropdown stays fully on screen.
    actions.openMenu({ ...menuTarget, x: Math.round(box.right - 8), y: Math.round(box.bottom + 6) })
  }
  // Below the shell's own narrow line the pill leaves the shell's header altogether:
  // the header is display:none there (so no title row is left on screen) and the pill
  // floats from <body>, where no column, overflow or stacking context can swallow it.
  // The mark stays behind in the header so its CSS can still find the row to hide.
  return h(Fragment, null,
    h('span', { className: 'bt-head-mark', 'aria-hidden': true }),
    createPortal(h('div', { className: 'bt-mobile-bar' },
      h('button', {
        type: 'button', className: 'bt-mobile-nav', 'aria-expanded': mobileNavOpen,
        // The label follows the state, like the scrim's: an unchanged "Open navigation"
        // while the drawer is up tells a screen reader the wrong thing, and made the
        // device crew's own verification ambiguous.
        'aria-label': `${mobileNavOpen ? t('Close navigation') : t('Open navigation')}${probe === '' ? '' : ` ${probe}`}`,
        onClick: () => actions.toggleMobileNav(),
      }, h(MenuIcon)),
      head,
      h('div', { className: 'bt-mobile-acts' },
        h('button', {
          type: 'button', className: 'bt-mobile-act',
          'aria-label': t('New…'), title: t('New…'), onClick: () => actions.openNewChat('new'),
        }, h(PlusIcon)),
        menuTarget === null ? null : h('button', {
          type: 'button', className: 'bt-mobile-act', 'aria-haspopup': 'menu',
          'aria-expanded': moreOpen, 'aria-label': t('More'), title: t('More'), onClick: openMore,
        }, h(DotsBoldIcon, { size: 18 })))), document.body))
}

// New-message pills. "N new messages ↓" takes Back to bottom's place when
// replies land while the user is scrolled up; "N new messages ↑" points at an unread
// divider above the viewport until it has been seen. The shell shows Back to bottom
// only while unpinned, so its presence is the pinned signal.
function useTranscriptView() {
  const [view, setView] = useState(null)
  useEffect(() => {
    let frame = 0
    let watched = null
    const observer = new MutationObserver(() => schedule())
    const measure = () => {
      frame = 0
      const scroller = document.querySelector('[data-conversation-scroll]')
      if (scroller !== watched) {
        observer.disconnect()
        watched = scroller
        if (scroller) observer.observe(scroller, { childList: true, subtree: true })
      }
      if (!scroller) { setView(null); return }
      const box = scroller.getBoundingClientRect()
      // Below the shell's narrow line the header is display:none (an empty rect), and
      // the floating bar is what covers the transcript instead.
      const headerRect = document.querySelector('header[class*="_header"], .bt-mobile-bar')?.getBoundingClientRect()
      const headerBottom = headerRect !== undefined && headerRect.height > 0 ? headerRect.bottom : box.top + 50
      const sep = scroller.querySelector('.bt-new-sep')
      let divider = null
      if (sep) {
        const at = sep.getBoundingClientRect()
        divider = at.bottom <= headerBottom ? 'above' : at.top >= box.bottom ? 'below' : 'in-view'
      }
      const composer = parseFloat(getComputedStyle(scroller).getPropertyValue('--dsh-composer-height')) || 152
      const next = {
        unpinned: scroller.querySelector('[class*="_toBottomSlot"]>button') !== null,
        divider,
        center: Math.round(box.left + box.width / 2),
        top: Math.round(headerBottom + 8),
        bottom: Math.round(window.innerHeight - box.bottom + composer + 8),
      }
      setView(prev => (prev && Object.keys(next).every(key => prev[key] === next[key]) ? prev : next))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [])
  return view
}

function NewMessagePills({ sessionId, useSessions, useUi, useTurnClock }) {
  const replies = useSessions((list) => {
    const outline = list.projectionsBySession?.[sessionId]?.values?.turnOutline ?? list.byId[sessionId]?.projectionValues?.turnOutline
    return Array.isArray(outline) ? outline.reduce((count, entry) => count + (entry.response ? 1 : 0), 0) : 0
  })
  const visit = useUi(state => state.visits?.[sessionId])
  const unread = useTurnClock((state) => {
    if (typeof visit?.seen !== 'number') return 0
    let count = 0
    for (const entry of Object.values(state[sessionId] ?? {})) {
      if (entry.first !== undefined && entry.first > visit.seen && entry.first <= visit.entered) count += 1
    }
    return count
  })
  const view = useTranscriptView()
  const unpinned = view?.unpinned === true
  const [release, setRelease] = useState({ base: null, dismissed: false })
  const [above, setAbove] = useState({ seen: false, dismissed: false })
  useEffect(() => { setRelease({ base: unpinned ? replies : null, dismissed: false }) }, [unpinned])
  useEffect(() => { if (view?.divider === 'in-view') setAbove(state => (state.seen ? state : { ...state, seen: true })) }, [view?.divider])
  const fresh = release.base === null ? 0 : replies - release.base
  const showDown = unpinned && fresh > 0 && !release.dismissed
  const showUp = view?.divider === 'above' && !above.seen && !above.dismissed
  useEffect(() => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    if (!scroller) return undefined
    scroller.toggleAttribute('data-bt-news', showDown)
    return () => scroller.removeAttribute('data-bt-news')
  }, [showDown])
  if (!view || (!showDown && !showUp)) return null
  const label = count => (count === 1 ? t('1 new message') : count > 0 ? t('{count} new messages', { count }) : t('New messages'))
  const pill = (direction, count, style, onJump, onDismiss) => h('div', { className: 'bt-news', 'data-direction': direction, style },
    h('button', { type: 'button', className: 'bt-news-jump', onClick: onJump },
      h('span', { className: 'bt-news-ico' }, h(direction === 'up' ? ArrowUpIcon : ArrowDownIcon)), label(count)),
    h('button', {
      type: 'button', className: 'bt-news-x', 'aria-label': t('Dismiss new messages'),
      onClick: (event) => { event.stopPropagation(); onDismiss() },
    }, h(CloseIcon)))
  const toLatest = () => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    const back = scroller?.querySelector('[class*="_toBottomSlot"]>button')
    if (back) back.click()
    else scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }
  const toDivider = () => document.querySelector('[data-conversation-scroll] .bt-new-sep')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return createPortal(h(Fragment, null,
    showUp ? pill('up', unread, { left: view.center, top: view.top }, toDivider, () => setAbove(state => ({ ...state, dismissed: true }))) : null,
    showDown ? pill('down', fresh, { left: view.center, bottom: view.bottom }, toLatest, () => setRelease(state => ({ ...state, dismissed: true }))) : null),
  document.body)
}
