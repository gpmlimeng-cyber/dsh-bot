import { createElement as h, Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import { isMainOf } from './sources.js'
import { currentPart, previewOf, relativeShort } from './text.js'
import { PlusIcon, SearchIcon, GaugeIcon, PlugIcon, ClockIcon, GearIcon, PinMarkIcon, ConnectorIcon, SwitchIcon, CloudDownloadIcon } from './icons.js'
import { MAIN_LOOK } from './characters.js'
import { botState, BotMark, BotAvatar, RoomAvatar } from './mark.js'
import { reducedMotion } from './activity-row.js'
import { Shimmer, workPhrase } from './cells.js'
import { springEasing, SPRING_SHAPE } from './motion.js'
import { hostText, t } from './i18n.js'
import { showsDshRow } from './dsh-offer.js'
import { useMobile, usePortrait, usePcColumns } from './mobile.js'
import { pcSidebarMemory, pcSidebarStep, shellCollapsed } from './pc-layout.js'
import { NavToggle } from './header.js'

// -------------------------------------------------------------------------
// Sidebar

// Manual "Mark as Unread" lasts until the conversation is opened again.
function useMarkedUnread(id, active, marked, actions) {
  useEffect(() => {
    if (active && marked) actions.clearUnread(id)
  }, [active, marked])
}

const PinMark = () => h('span', { className: 'bt-pin', 'aria-hidden': true }, h(PinMarkIcon))

// A row's message count: the indexed lines of a Session and its earlier parts. The
// index is lazy and partial, so a Session it does not know yet contributes nothing,
// and a row with nothing indexed shows no number at all rather than a zero.
function countOf(roster, sessionIds) {
  const counts = roster.counts
  if (counts === undefined) return undefined
  let total = 0
  let indexed = false
  for (const id of sessionIds) {
    const value = counts[id]
    if (typeof value === 'number') { total += value; indexed = true }
  }
  return indexed ? total : undefined
}

// The stamp on a row's title line.
function RowMeta({ at }) {
  const time = at > 0 ? relativeShort(at) : ''
  if (time === '') return null
  return h('span', { className: 'bt-row-meta' }, h('span', { className: 'bt-row-time' }, time))
}

// A wide row's second line: the preview, and the message count at its end. The count
// belongs down here beside what it counts rather than up beside the stamp, where it sat
// against the name with nothing between them. With no count the line is just the
// preview, and with neither there is no line at all -- nothing keeps a seat warm.
function RowSub({ preview, count }) {
  if (!preview && count === undefined) return null
  return h('span', { className: 'bt-row-sub' },
    preview ? h('span', { className: 'bt-row-preview' }, preview) : null,
    count === undefined ? null : h('span', { className: 'bt-row-count', title: t('{count} messages', { count }) }, String(count)))
}

// Whether an approval waits for the user: for a Bot, in any of its Sessions; for a group,
// from any of its members there.
const useApproval = (useWork, match) => (useWork ? useWork(work => (work.approvals ?? []).some(match)) : false)

// Work running in group Sessions, as "botId|tool" keys so a row redraws only when it
// changes: the groups one Bot works in, or the members at work in one group.
const useGroupWork = (useWork, pick) => (useWork ? useWork(work => pick(work.rooms ?? {}).join(',')) : '')
const workKeys = text => (text === '' ? [] : text.split(',').map((key) => {
  const [id, tool] = key.split('|')
  return { id, tool: tool || undefined }
}))
const workLine = (lead, tool, more) => h(Shimmer, null, `${lead} · ${workPhrase(tool)}…${more > 0 ? ` +${more}` : ''}`)

function BotRow({ bot, roster, actions, useSessions, useSessionStatus, useSessionRetainInfo, useActivity, useWork, wide, drawer, marked }) {
  const id = bot.id
  const part = currentPart(bot)
  const preview = useSessions(list => previewOf(list, part, roster.exchangeTurns[part]))
  const at = useSessions(list => list.byId[part]?.updatedAt ?? 0)
  const running = useSessionStatus(map => map.get(part)?.running === true)
  const active = useSessionRetainInfo(part, info => (info?.retainedBy?.mainView ?? 0) > 0)
  const unread = useSessionStatus(map => map.get(part)?.completionUnread === true || map.get(part)?.pendingInteraction !== undefined) || (marked && !active)
  useMarkedUnread(id, active, marked, actions)
  const main = isMainOf(roster, id)
  const tile = roster.mainBotId === id
  const approval = useApproval(useWork, entry => entry.botId === id)
  const alert = roster.questions?.[part] !== undefined || approval
  const doing = useActivity(map => map[id])
  // Work in a group runs in a Session of its own, so the Bot's chat stays idle meanwhile.
  const groups = workKeys(useGroupWork(useWork, rooms => Object.entries(rooms).flatMap(([roomId, entries]) => entries.filter(entry => entry.botId === id).map(entry => `${roomId}|${entry.tool ?? ''}`))))
  const away = !running && groups.length > 0
  const state = botState(running || away, doing, alert)
  const awayLine = away ? workLine(roster.roomsById[groups[0].id]?.name ?? t('a group chat'), groups[0].tool, groups.length - 1) : null
  if (bot.hidden && !active && !main) return null
  const onContextMenu = (event) => {
    event.preventDefault()
    actions.openMenu({ kind: 'bot', id, x: event.clientX, y: event.clientY })
  }
  const pinned = bot.pinned === true && !tile
  const label = [bot.name, main ? t('Main Bot') : '', pinned ? t('Pinned') : '', running || away ? t('Working') : '', approval ? t('Waiting for your approval') : alert ? t('Waiting for your answer') : '', unread ? t('Unread activity') : ''].filter(Boolean).join(', ')
  // The wide column seats the Main Bot in its own tile, with the shortcuts that float
  // around it. The phone drawer renders that same wide list, so the tile followed it and
  // a 60px centred tile sat among 36px rows; the drawer wants the ordinary row, and the
  // Main Bot badge the avatar already carries is the whole of the difference that stays.
  if (tile && wide && !drawer) {
    return h('div', { className: 'bt-tile-wrap' },
      h('button', {
      type: 'button', className: 'bt-tile', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
      'data-bot-id': id, title: preview || bot.name, onClick: () => actions.openSession(id), onContextMenu,
    },
    h(BotAvatar, { bot, size: 60, state, main: true }),
    h('span', { className: 'bt-tile-name' }, bot.name)))
  }
  return h('button', {
    type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
    'data-bot-id': id, title: wide ? undefined : bot.name, onClick: () => actions.openSession(id), onContextMenu,
  },
  h(BotAvatar, { bot, size: 36, state, main }),
  pinned && !wide ? h(PinMark) : null,
  wide ? h('span', { className: 'bt-row-body' },
    h('span', { className: 'bt-row-name' }, h('span', { className: 'bt-row-title' }, bot.name), pinned ? h(PinMark) : null,
      h(RowMeta, { at })),
    h(RowSub, { preview: awayLine ?? preview, count: countOf(roster, [part, ...(bot.parts ?? [])]) })) : null,
  wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null)
}

function RoomRow({ room, roster, actions, useSessions, useSessionStatus, useSessionRetainInfo, useWork, wide, marked }) {
  const id = room.id
  const fallback = useSessions(list => previewOf(list, id))
  const preview = room.preview?.replace(/\s+/g, ' ').trim() || fallback
  const at = useSessions(list => list.byId[id]?.updatedAt ?? 0)
  const active = useSessionRetainInfo(id, info => (info?.retainedBy?.mainView ?? 0) > 0)
  const unread = useSessionStatus(map => map.get(id)?.completionUnread === true) || (marked && !active)
  useMarkedUnread(id, active, marked, actions)
  const approval = useApproval(useWork, entry => entry.roomId === id)
  const members = workKeys(useGroupWork(useWork, rooms => (rooms[id] ?? []).map(entry => `${entry.botId}|${entry.tool ?? ''}`)))
  const first = roster.byId[members[0]?.id]
  const workingLine = first ? workLine(first.name, members[0].tool, members.length - 1) : null
  if (room.hidden && !active) return null
  const pinned = room.pinned === true
  const label = [room.name, pinned ? t('Pinned') : '', members.length > 0 ? t('Working') : '', approval ? t('Waiting for your approval') : ''].filter(Boolean).join(', ')
  return h('button', {
    type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
    'data-room-id': id, onClick: () => actions.openSession(id),
    onContextMenu: (event) => { event.preventDefault(); actions.openMenu({ kind: 'room', id, x: event.clientX, y: event.clientY }) },
  },
  h(RoomAvatar, { room, roster, size: 36 }),
  pinned && !wide ? h(PinMark) : null,
  wide ? h('span', { className: 'bt-row-body' },
    h('span', { className: 'bt-row-name' }, h('span', { className: 'bt-row-title' }, room.name), pinned ? h(PinMark) : null,
      h(RowMeta, { at })),
    // A group's messages live in each member's own hidden Session, so the indexed
    // lines would count the same conversation once per member. No number, then.
    h(RowSub, { preview: workingLine ?? preview })) : null,
  wide && approval && !active ? h('span', { className: 'bt-unread bt-unread-wait', 'aria-hidden': true })
    : wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null)
}

// One expanded DSH Agent Session row: title, relative stamp, rename field, and a
// context menu for rename/archive.
function AgentSessionRow({ session, agent, actions, renaming, index }) {
  const input = useRef(null)
  useLayoutEffect(() => {
    if (!renaming) return
    input.current?.focus()
    input.current?.select()
  }, [renaming])
  if (renaming) {
    const commit = (keep) => {
      const value = input.current?.value ?? ''
      if (!keep || value.trim() === '' || value.trim() === session.title) { actions.endAgentRename(); return }
      // The editor closes only after the rename landed; a failure keeps it open.
      void (async () => {
        try {
          await actions.renameAgentSession(agent.id, session.id, value)
          actions.endAgentRename()
        } catch (error) {
          actions.reportError(error, 'agent-rename')
        }
      })()
    }
    return h('div', { className: 'bt-agent-sub-row bt-agent-edit', style: { '--i': index } },
      h('input', {
        ref: input, defaultValue: session.title, 'aria-label': t('Rename'),
        onKeyDown: (event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Enter') commit(true)
          else if (event.key === 'Escape') commit(false)
        },
        onBlur: () => commit(true),
      }))
  }
  return h('button', {
    type: 'button', className: 'bt-agent-sub-row', 'aria-current': session.active ? 'page' : undefined, style: { '--i': index },
    onClick: () => actions.openAgentSession(session.id),
    onContextMenu: (event) => {
      event.preventDefault()
      event.stopPropagation()
      actions.openMenu({ kind: 'agent-session', id: session.id, agentId: agent.id, x: event.clientX, y: event.clientY })
    },
  },
  h('span', { className: 'bt-agent-sub-title' }, session.title),
  h('span', { className: 'bt-agent-sub-time' }, session.at > 0 ? relativeShort(session.at) : ''))
}

// The DSH Agent row: a plain dsh Session list lives in the Bot workspace, so it
// sits among the Bots with the harness's own whale mark.
function AgentRow({ agent, actions, useSessions, useSessionStatus, useUi, wide, marked }) {
  const info = useSessions(list => JSON.stringify(agent.sessions.map((id) => {
    const row = list.byId[id]
    return {
      id,
      // A blank Session's title is the workspace folder name; show the label instead.
      title: row?.blank === true ? '' : (row?.displayTitle ?? row?.title ?? ''),
      at: row?.updatedAt ?? 0,
      running: row?.running === true,
      active: (row?.retainedBy?.mainView ?? 0) > 0,
    }
  }).sort((a, b) => b.at - a.at)))
  const statusInfo = useSessionStatus(map => JSON.stringify(agent.sessions.map(id => ({
    id, running: map.get(id)?.running === true, unread: map.get(id)?.completionUnread === true,
  }))))
  const statuses = Object.fromEntries(JSON.parse(statusInfo).map(entry => [entry.id, entry]))
  const sessions = JSON.parse(info).map(session => ({
    ...session,
    running: statuses[session.id]?.running ?? session.running,
    unread: statuses[session.id]?.unread ?? false,
    title: session.title === '' ? t('New session') : session.title,
  }))
  const renaming = useUi(value => value.renameAgent)
  const active = sessions.some(session => session.active)
  const running = sessions.some(session => session.running)
  const unread = sessions.some(session => session.unread) || (marked && !active)
  useMarkedUnread(agent.id, active, marked, actions)
  const preview = sessions[0]?.title ?? t('New session')
  const label = ['DSH Agent', running ? t('Working') : '', unread ? t('Unread activity') : ''].filter(Boolean).join(', ')
  const open = active && wide
  return h('div', { className: 'bt-agent' },
    h('button', {
      type: 'button', className: 'bt-row', 'aria-label': label, 'aria-current': active ? 'page' : undefined,
      'data-agent-id': agent.id, title: wide ? undefined : 'DSH Agent', onClick: () => actions.openAgent(agent.id),
      onContextMenu: (event) => { event.preventDefault(); actions.openMenu({ kind: 'agent', id: agent.id, x: event.clientX, y: event.clientY }) },
    },
    h('span', { className: `bt-agent-ava${running ? ' bt-run' : ''}` }, h(FishLogo, { size: 22 })),
    wide ? h('span', { className: 'bt-row-body' },
      h('span', { className: 'bt-row-name' }, 'DSH Agent'),
      h(RowSub, { preview })) : null,
    wide && unread && !active ? h('span', { className: 'bt-unread', 'aria-hidden': true }) : null),
    h('div', { className: 'bt-agent-sub', 'data-open': open || undefined },
      h('div', { className: 'bt-agent-sub-in' },
        h('button', { type: 'button', className: 'bt-agent-sub-row bt-agent-new', style: { '--i': 0 }, onClick: () => { void actions.newAgentSession(agent.id).catch(error => actions.reportError(error, 'agent-session')) } },
          h(PlusIcon), h('span', { className: 'bt-agent-sub-title' }, t('New session'))),
        sessions.map((session, index) => h(AgentSessionRow, {
          key: session.id, session, agent, actions, index: index + 1,
          renaming: renaming === session.id,
        })))))
}

// List rows glide to new places on a spring.
const GLIDE = springEasing(1000, 63)

function useListGlide(listRef, layout, key) {
  const tops = useRef({ layout, map: new Map() })
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const next = new Map()
    const still = reducedMotion() || tops.current.layout !== layout
    for (const row of list.querySelectorAll('[data-bot-id],[data-room-id],[data-agent-id]')) {
      const id = row.dataset.botId ?? row.dataset.roomId ?? row.dataset.agentId
      // offsetTop ignores transforms, so a glide in flight does not skew the next one.
      const top = row.offsetTop
      next.set(id, top)
      const before = tops.current.map.get(id)
      if (!still && before !== undefined && Math.abs(before - top) > 0.5) {
        row.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], GLIDE)
      }
    }
    tops.current = { layout, map: next }
  }, [layout, key])
}

export function TeamSidebar(props) {
  const { wide, useRoster, useUi, useSessions, actions } = props
  const listRef = useRef(null)
  const roster = useRoster(value => value)
  const markedUnread = useUi(value => value.unread)
  // The mobile drawer: below the shell's narrow line the rail collapses, so opening the
  // drawer renders the same wide list the desktop sidebar shows, over a scrim.
  const mobileOpen = useUi(value => value.mobileNav === true)
  const mobile = useMobile()
  const portrait = usePortrait()
  // A foldable held sideways draws the desktop layout (mobile.js), and the desktop layout
  // wants the shell's own sidebar column instead of the 56px rail the shell keeps below its
  // 1024 line. The shell hands this slot the one safe way to open it — `expandSidebar`,
  // which does nothing when the column is already up; closing is the layout service's own
  // toggle, and the exit closes whatever is still open (pc-layout.js has the why: below
  // 1024 the shell reads one flag for both its desktop column and its phone drawer). Only a
  // band change acts (pcSidebarStep), so a hand that folds the column away inside the band
  // keeps it folded.
  //
  // Where that memory lives is load-bearing (pc-layout.js, pcSidebarMemory): the shell swaps
  // this column between two trees when it folds, which unmounts this component, and a ref
  // would come back null and re-open the column the hand just folded.
  const pc = usePcColumns()
  useEffect(() => {
    const call = pcSidebarStep(pcSidebarMemory.band, pc, shellCollapsed(document, wide))
    pcSidebarMemory.band = pc
    if (call === 'expand') props.expandSidebar?.()
    if (call === 'collapse') actions.collapseSidebar?.()
  }, [pc])
  props.useRegistry(value => value)
  const updated = useSessions(list => {
    const stamps = {}
    for (const id of list.ids) stamps[id] = list.byId[id]?.updatedAt ?? 0
    return JSON.stringify(stamps)
  })
  const order = useMemo(() => {
    const stamps = JSON.parse(updated)
    const entries = [
      ...roster.bots.filter(bot => bot.id !== roster.mainBotId).map(bot => ({ kind: 'bot', item: bot, at: stamps[currentPart(bot)] ?? bot.createdAt })),
      ...roster.rooms.map(room => ({ kind: 'room', item: room, at: stamps[room.id] ?? room.createdAt })),
      // The Agent sorts by its most recent Session, falling back to when it was added.
      ...(roster.agents ?? []).map(agent => ({ kind: 'agent', item: agent, at: Math.max(0, ...agent.sessions.map(id => stamps[id] ?? 0)) || agent.createdAt })),
    ]
    return entries.sort((a, b) => Number(Boolean(b.item.pinned)) - Number(Boolean(a.item.pinned)) || b.at - a.at)
  }, [roster, updated])
  const main = roster.byId[roster.mainBotId]
  const listWide = wide || mobileOpen
  useListGlide(listRef, listWide, order.map(entry => entry.item.id).join(','))
  useLandOnMainBot(roster, useSessions, actions)
  const rowProps = { roster, actions, useSessions, useUi, useSessionStatus: props.useSessionStatus, useSessionRetainInfo: props.useSessionRetainInfo, useActivity: props.useActivity, useWork: props.useWork, wide: listWide, drawer: mobileOpen }
  const [search, setSearch] = useState('')
  // The field is a handoff, not a second search implementation: the command palette owns the
  // searching, and opening it closes the drawer (openPalette clears mobileNav), so text kept
  // in this box would be typed into something already off screen. Clearing on close also
  // keeps a stale query from greeting the next open.
  useEffect(() => { if (!mobileOpen) setSearch('') }, [mobileOpen])
  const runSearch = (value) => {
    setSearch(value)
    if (value.trim() !== '') actions.openPalette(value)
  }
  // Typing while the sidebar has focus starts a search.
  const typeToSearch = (event) => {
    if (event.defaultPrevented || event.key.length !== 1 || event.key === ' ' || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]')) return
    event.preventDefault()
    actions.openPalette(event.key)
  }
  // Touch handling for the drawer. One drag is read once and then handed to either the
  // list (vertical: it scrolls) or the close gesture (leftward past the threshold, and
  // never unless the drag is more horizontal than vertical). A drag that starts moving
  // vertically can no longer close anything — that is the reported "a swipe closed the
  // drawer" and the rule this forbids. Nothing here listens to scroll, so no amount of
  // scrolling dismisses the drawer.
  //
  // On an upright phone the drawer is the 伙伴 page of the bottom bar rather than a popup
  // beside the conversation (nav-bar.js), so the gesture is off there: a page is left
  // through the bar, and a swipe that threw it away would take the list with it by
  // accident. The scrim is off there too, by the same rule.
  const swipeClose = mobile && !portrait
  const SWIPE_CLOSE_PX = 48
  const drag = useRef(null)
  const onTouchStart = (event) => {
    const touch = event.touches[0]
    drag.current = touch ? { x: touch.clientX, y: touch.clientY, settled: false } : null
  }
  const onTouchMove = (event) => {
    const start = drag.current
    const touch = event.touches[0]
    if (start === null || start.settled || touch === undefined) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dy) >= Math.abs(dx)) { drag.current = null; return }
    if (dx <= -SWIPE_CLOSE_PX) {
      start.settled = true
      actions.closeMobileNav()
    }
  }
  const onTouchEnd = () => { drag.current = null }
  // `bt-rail` stays keyed on the shell's own width, not on the drawer state: the
  // off-canvas positioning below the shell's narrow line lives on `.bt-side.bt-rail`,
  // so the class must keep the rail form while the drawer is open (only the row
  // content follows `listWide`).
  //
  // The bottom row is the shell's own sidebar footer — the account/settings launcher and
  // Connect plugins — which the shell renders in a separate area of the sidebar column
  // (`sidebar.footer.action`), not in the section this component owns. On a phone that
  // column is off-canvas, so the footer did not travel with the drawer and the list ended
  // in empty space: that is the "bottom is missing" report. The same two components the
  // wide sidebar uses are rendered below instead, so neither copy can drift; only the
  // drawer gets this one (the wide column keeps the shell's). It sits under the list,
  // which is `flex:1`, so it stays at the bottom whatever the roster's length.
  const drawerFoot = mobile ? h('div', { className: 'bt-side-foot' },
    h(AccountLauncher, { seat: false, actions }),
    h(ConnectPlugins, { wide: true, actions })) : null
  // The PC band draws the phone drawer's top row: the same hamburger, then the search field,
  // then New (the row itself is built below). The hamburger is not a child of that row — on
  // a phone it lives in the floating bar, and the band draws that same bar box holding
  // nothing but this button, so the two bands and the column's two widths all land on the
  // same 12/10 (styles.js places `.bt-mobile-nav` inside whichever bar holds it).
  const drawerChrome = mobile || pc
  // Which way the button offers, read off the shell rather than off `wide`: below its 1024
  // line `wide` is `!collapsed || !settled`, so it stays true for the few hundred ms a fold
  // takes, and the button would offer to close a column that is already closing.
  // The hamburger sits in the column's own top-left corner as a child of the list itself
  // (first child below), not in a bar of its own: `.bt-mobile-nav` is absolute, so the
  // column's width cannot move it, and its top is the row's own top — the two are one line
  // by construction. Anchored to the floating bar's line instead it would hang at the inset
  // plus 10 while this row follows where the shell starts the column, and the shell's own
  // offset above us (18px on the device) would separate them.
  const pcFolded = shellCollapsed(document, wide)
  const pcNav = pc
    ? h(NavToggle, {
        open: !pcFolded,
        onToggle: () => (pcFolded ? props.expandSidebar?.() : actions.collapseSidebar?.()),
      })
    : null
  const drawer = h('div', {
    className: wide ? 'bt-side' : 'bt-side bt-rail', role: wide ? undefined : 'region',
    'data-mobile-open': mobileOpen || undefined, onKeyDown: typeToSearch,
    onTouchStart: swipeClose ? onTouchStart : undefined, onTouchMove: swipeClose ? onTouchMove : undefined,
    onTouchEnd: swipeClose ? onTouchEnd : undefined, onTouchCancel: swipeClose ? onTouchEnd : undefined,
  },
    pcNav,
    listWide ? h('div', { className: 'bt-side-top' },
      drawerChrome ? null : h('span', { className: 'bt-brand' }, h(BrandMark, { size: 22 }), h(BrandName)),
      h(UpdateButton, { useUpdate: props.useUpdate, actions }),
      // On a phone, and in the PC band's column, the icon button becomes the field itself
      // (styles.js carries the row's shape): same single action, the search lives in the
      // palette either way.
      drawerChrome
        ? h('div', { className: 'bt-side-search' },
            h(SearchIcon),
            h('input', {
              type: 'text', enterKeyHint: 'search', autoComplete: 'off', spellCheck: false,
              placeholder: t('Search'), value: search,
              'aria-label': t('Search'),
              onChange: event => runSearch(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter' && search.trim() !== '') actions.openPalette(search) },
            }))
        : h('button', { type: 'button', className: 'bt-round', 'aria-label': t('Search'), title: t('Search'), onClick: () => actions.openPalette() }, h(SearchIcon)),
      h('button', { type: 'button', className: 'bt-round', 'aria-label': t('New…'), title: t('New…'), onClick: () => actions.openNewChat('new') }, h(PlusIcon)))
      : h(Fragment, null,
          h(UpdateButton, { useUpdate: props.useUpdate, actions }),
          h('button', { type: 'button', className: 'bt-round', 'aria-label': t('New…'), title: t('New…'), onClick: () => actions.openNewChat('new') }, h(PlusIcon))),
    h('div', { ref: listRef, className: 'bt-list', role: 'region', 'aria-label': t('Bot list') },
      main ? h(BotRow, { ...rowProps, bot: main, marked: markedUnread[main.id] === true }) : roster.ready ? null : h('div', { className: 'bt-hint' }, t('Setting up your Main Bot…')),
      order.map(entry => (entry.kind === 'bot'
        ? h(BotRow, { key: entry.item.id, ...rowProps, bot: entry.item, marked: markedUnread[entry.item.id] === true })
        : entry.kind === 'room'
          ? h(RoomRow, { key: entry.item.id, ...rowProps, room: entry.item, marked: markedUnread[entry.item.id] === true })
          : h(AgentRow, { key: entry.item.id, ...rowProps, agent: entry.item, marked: markedUnread[entry.item.id] === true })))),
    drawerFoot)
  return h(Fragment, null,
    createPortal(h('button', { type: 'button', className: 'bt-mobile-scrim', 'data-open': mobileOpen || undefined, 'aria-label': t('Close navigation'), tabIndex: mobileOpen ? 0 : -1, onClick: actions.closeMobileNav }), document.body),
    // The drawer cannot live inside the shell's sidebar column: below the shell's
    // narrow line that column is the 56px rail, and a fixed panel inside it is still
    // clipped by whatever containing block or overflow the column brings. Portalled to
    // <body> it is clipped by nothing — the same move the scrim beside it already makes.
    mobile ? createPortal(drawer, document.body) : drawer)
}

// The update button at the sidebar's top right: a cloud while a newer DS Bot —
// or a newer verified DSH — is available, then the install's progress and
// result. Its card has one row each for the bot and DSH, with their versions,
// the release notes link, and each row's own button.
function UpdateButton({ useUpdate, actions }) {
  const update = useUpdate(value => value)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState(null)
  const [error, setError] = useState('')
  const [dshError, setDshError] = useState('')
  const button = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (event.target instanceof Element && (event.target.closest('.bt-update-pop') || button.current?.contains(event.target))) return
      setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus() } }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  const phase = update?.phase ?? 'idle'
  const dsh = update?.dsh
  const dshPhase = dsh?.phase ?? 'idle'
  const dshRow = showsDshRow(dsh, update?.app)
  if (!update?.available && !dshRow && phase === 'idle' && dshPhase === 'idle') return null
  const cloudPhase = phase === 'installing' || dshPhase === 'installing' ? 'installing' : phase !== 'idle' ? phase : dshPhase
  const toggle = () => {
    const rect = button.current?.getBoundingClientRect()
    if (rect) setBox({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)), top: rect.bottom + 6 })
    setOpen(value => !value)
  }
  const start = () => {
    setError('')
    void actions.installUpdate().catch(failure => setError(hostText(failure?.message ?? String(failure))))
  }
  const startDsh = () => {
    setDshError('')
    void actions.installDshUpdate().catch(failure => setDshError(hostText(failure?.message ?? String(failure))))
  }
  const label = phase === 'installing' ? t('Updating DS Bot…')
    : dshPhase === 'installing' ? t('Updating DSH…')
      : phase === 'installed' ? t('DS Bot {version} is installed. Restart DSH to use it.', { version: update.installed ?? update.latest })
        : dshPhase === 'installed' ? t('Restart DSH to start using DSH {version}.', { version: dsh.installed ?? dsh.verified })
          : update?.available ? t('DS Bot {version} is available', { version: update.latest })
            : t('DSH {version} is available', { version: dsh?.verified })
  const message = error || (phase === 'failed' ? update.error : '')
  const dshMessage = dshError || (dshPhase === 'failed' ? dsh?.error : '')
  const dshText = dshPhase === 'installed'
    ? t('Restart DSH to start using DSH {version}.', { version: dsh.installed ?? dsh.verified })
    : dsh?.available === false && dsh?.blockedBy
      ? t('Update DS Bot {version} first.', { version: dsh.blockedBy })
      : t('You have {version}.', { version: dsh?.current })
  return h(Fragment, null,
    h('button', {
      ref: button, type: 'button', className: 'bt-round bt-update', 'data-phase': cloudPhase, 'aria-label': label, title: label,
      'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: toggle,
    }, h(CloudDownloadIcon, { done: phase === 'installed' }), phase === 'failed' || dshPhase === 'failed' ? h('span', { className: 'bt-update-dot', 'aria-hidden': true }) : null),
    open && box ? createPortal(h('div', { className: 'bt-update-pop', role: 'dialog', 'aria-label': update?.available || phase !== 'idle' ? t('DS Bot update') : t('DSH update'), style: box },
      update?.available || phase !== 'idle' ? h(Fragment, null,
        h('div', { className: 'bt-update-title' }, phase === 'installed' ? t('Update installed') : t('DS Bot {version}', { version: update.latest })),
        h('div', { className: 'bt-update-text' }, phase === 'installed'
          ? t('Restart DSH to start using DS Bot {version}.', { version: update.installed ?? update.latest })
          : t('You have {version}.', { version: update.current })),
        message ? h('div', { className: 'bt-update-error', role: 'alert' }, t('The update did not finish: {reason}', { reason: message })) : null,
        h('div', { className: 'bt-update-actions' },
          update.notesUrl ? h('a', { className: 'bt-update-notes', href: update.notesUrl, target: '_blank', rel: 'noopener noreferrer' }, t("What's new")) : null,
          phase === 'installed' ? null : h('button', {
            type: 'button', className: 'bt-update-go', disabled: phase === 'installing', onClick: start,
          }, phase === 'installing' ? t('Updating…') : phase === 'failed' ? t('Try again') : t('Update')))) : null,
      dshRow ? h('div', { className: 'bt-update-dsh' },
        h('div', { className: 'bt-update-title' }, t('DSH {version}', { version: dsh.verified })),
        h('div', { className: 'bt-update-text' }, dshText),
        dshMessage ? h('div', { className: 'bt-update-error', role: 'alert' }, t('The update did not finish: {reason}', { reason: dshMessage })) : null,
        h('div', { className: 'bt-update-actions' },
          dsh.kind === 'app' ? (dsh.available
            ? h('button', { type: 'button', className: 'bt-update-go', onClick: () => void actions.openAppUpdates(dsh.verified).catch(() => {}) }, t('Open updates'))
            : null)
            : !dsh.available && dshPhase === 'idle' ? null
              : dshPhase === 'installed' ? null
                : h('button', {
                  type: 'button', className: 'bt-update-go', disabled: dshPhase === 'installing', onClick: startDsh,
                }, dshPhase === 'installing' ? t('Updating…') : dshPhase === 'failed' ? t('Try again') : t('Update')))) : null), document.body) : null)
}

// The footer entry to the shell's plugin panel, marked as not yet adapted: the red
// badge and a hover tip explain that plugin support lands step by step.
export function ConnectPlugins({ wide, actions }) {
  const tipId = useId()
  const [tip, setTip] = useState(false)
  const timer = useRef(0)
  const button = useRef(null)
  const [box, setBox] = useState(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!wide) return null
  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 268))
      setBox({ left, bottom: window.innerHeight - rect.top + 10 })
      setTip(true)
    }, 250)
  }
  const hide = () => { clearTimeout(timer.current); setTip(false) }
  return h('span', { className: 'bt-connect-wrap' },
    h('button', {
      ref: button, type: 'button', className: 'bt-connect bt-connect-foot', 'aria-describedby': tip ? tipId : undefined,
      onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide,
      onClick: () => actions.selectPanel('plugins'),
    },
    h(PlugIcon), t('Connect plugins'), h('span', { className: 'bt-connect-warn', 'aria-hidden': true }, '!')),
    tip && box ? createPortal(h('span', { role: 'tooltip', id: tipId, className: 'bt-connect-tip', style: box },
      t('Plugin compatibility is not fully verified.')), document.body) : null)
}

// Account seat of the Settings trigger: the visible label stays for assistive tech only.
export function YouAvatar() {
  return h('span', { className: 'bt-you-wrap' },
    h('span', { className: 'bt-you', 'aria-hidden': true }, h(BotMark, { look: MAIN_LOOK, size: 24 })),
    h('span', { style: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }, t('Settings')))
}

let openShellSettings = null
let openShellOnboarding = null
let shellShortcuts = null

export function holdShellShortcuts(shortcuts) {
  shellShortcuts = shortcuts
  return () => { if (shellShortcuts === shortcuts) shellShortcuts = null }
}

// DeepSeek Harness hands its settings opener only to the settings.launcher seat. When
// the Desktop's account menu holds that seat, its first item (Settings) is the way in;
// the Desktop on Windows and macOS takes shortcuts natively, so a synthetic key press
// reaches the shell only where the page delivers them (the Web, Linux).
export function openHarnessSettings() {
  // A frame first, so a Bot dialog that closes on this click leaves the modal stack.
  requestAnimationFrame(() => {
    if (openShellSettings) { openShellSettings(); return }
    const desktop = document.querySelector('button[aria-haspopup="menu"][data-signed-out]')
    if (desktop) openThroughMenu(desktop)
    else pressSettingsShortcut()
  })
}

// Opens one of the shell's own onboarding editors, such as the DeepSeek API key form.
export function openHarnessOnboarding(id) {
  requestAnimationFrame(() => {
    if (openShellOnboarding) openShellOnboarding(id)
    else openHarnessSettings()
  })
}

function openThroughMenu(trigger) {
  const before = new Set(document.querySelectorAll('[role="menu"]'))
  trigger.click()
  let frames = 0
  const look = () => {
    const menu = [...document.querySelectorAll('[role="menu"]')].find(node => !before.has(node))
    const item = menu?.querySelector('button[role="menuitem"]')
    if (item) item.click()
    else if (++frames < 30) requestAnimationFrame(look)
    else pressSettingsShortcut()
  }
  requestAnimationFrame(look)
}

function pressSettingsShortcut() {
  const binding = shellShortcuts?.catalog.getSnapshot().find(row => row.id === 'settings.open')?.binding
  if (!binding) return
  const held = new Set(binding.modifiers)
  window.dispatchEvent(new KeyboardEvent('keydown', {
    code: binding.code, key: binding.code === 'Comma' ? ',' : '', bubbles: true, cancelable: true,
    ctrlKey: held.has('control'), altKey: held.has('alt'), shiftKey: held.has('shift'), metaKey: held.has('meta'),
  }))
}

// The footer avatar opens an account menu above itself, with Bot settings as one
// entry. Shell panels hidden from the Bot sidebar (plugins, automation) live here too.
// `seat` is the shell's settings.launcher seat: at priority -10 the whale wins it
// over a shell account plugin's own launcher (the Desktop's "··· More"), which comes
// back in Agent mode; FooterAccount stands in while no seat exists at all.
export function AccountLauncher({ seat = true, settingsOpen, openSettings, openOnboarding, actions }) {
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    if (!seat) return undefined
    actions.seatAccount(true)
    return () => actions.seatAccount(false)
  }, [seat])
  const [box, setBox] = useState(null)
  const button = useRef(null)
  useEffect(() => { if (settingsOpen) setOpen(false) }, [settingsOpen])
  // The settings dialog links back to the shell's own settings (models, providers).
  useEffect(() => {
    if (!openSettings) return undefined
    openShellSettings = openSettings
    return () => { if (openShellSettings === openSettings) openShellSettings = null }
  }, [openSettings])
  useEffect(() => {
    if (!openOnboarding) return undefined
    openShellOnboarding = openOnboarding
    return () => { if (openShellOnboarding === openOnboarding) openShellOnboarding = null }
  }, [openOnboarding])
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (event.target instanceof Element && (event.target.closest('.bt-account-menu') || button.current?.contains(event.target))) return
      setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus() } }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  const toggle = () => {
    const rect = button.current?.getBoundingClientRect()
    if (rect) setBox({ left: rect.left, bottom: window.innerHeight - rect.top + 5 })
    setOpen(value => !value)
  }
  const groups = [
    [
      [t('Usage'), GaugeIcon, () => actions.openSettings('usage')],
      [t('Connectors'), ConnectorIcon, () => actions.openConnectors()],
      [t('Automation tasks'), ClockIcon, () => actions.selectPanel('schedules')],
      [t('Bot settings'), GearIcon, () => actions.openSettings('general')],
      // Panels other plugins registered: one row each above the separator, the same
      // action the native icon column runs. Nothing here while none are registered.
      ...(actions.panelEntries?.() ?? []).map(entry => [entry.label, PlugIcon, () => actions.selectPanel(entry.id)]),
    ],
    [
      [t('Switch to classic Agent mode'), SwitchIcon, () => actions.setSurface('agent')],
    ],
  ]
  return h(Fragment, null,
    h('button', { ref: button, type: 'button', className: 'bt-account', 'aria-label': t('Account'), 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: toggle },
      h('span', { className: 'bt-you', 'aria-hidden': true }, h(BotMark, { look: MAIN_LOOK, size: 24 }))),
    open && box ? createPortal(h('div', { className: 'bt-menu bt-menu-up bt-account-menu', role: 'menu', 'aria-label': t('Account'), style: box },
      groups.map((group, index) => h(Fragment, { key: index },
        index > 0 ? h('div', { className: 'bt-menu-sep', role: 'separator' }) : null,
        group.map(([label, Icon, run, hint]) => h('button', {
          key: label, type: 'button', role: 'menuitem',
          onClick: () => { setOpen(false); void Promise.resolve(run()).catch(error => actions.reportError(error, 'menu')) },
        }, h(Icon), h('span', { className: 'bt-menu-label' }, label), hint ? h('span', { className: 'bt-menu-hint' }, hint) : null))))), document.body) : null)
}

// Opens the Main Bot whenever the main view holds no Bot conversation, the way
// The view always lands on a Bot rather than an empty New Session page.
// When a Bot's chat moves on to a fresh part, the shell clears the view of the part
// it archived; the chat then goes on in the Bot's current part instead.
function useLandOnMainBot(roster, useSessions, actions) {
  const mainView = useSessions((list) => {
    const row = Object.values(list.byId).find(session => (session?.retainedBy?.mainView ?? 0) > 0)
    return row ? `${row.id}|${row.blank ? 1 : 0}` : ''
  })
  const lastBot = useRef(null)
  useEffect(() => {
    if (!roster.ready || !roster.mainBotId) return undefined
    const [id, blank] = mainView.split('|')
    const bot = id === '' ? undefined : roster.byId[id]
    if (bot !== undefined) {
      lastBot.current = { botId: bot.id, sessionId: id }
      if (currentPart(bot) !== id) actions.landOn(bot.id)
      return undefined
    }
    // A DSH Agent Session, blank or not, is a real destination: it stays.
    if (id !== '' && (roster.roomsById[id] || (actions.isAgentSession?.(id) ?? roster.agentOf[id] !== undefined) || blank !== '1')) {
      lastBot.current = null
      return undefined
    }
    const last = lastBot.current
    const timer = setTimeout(() => actions.landOn(roster.mainBotId, last), last ? 0 : 400)
    return () => clearTimeout(timer)
  }, [mainView, roster])
}

export function FooterAccount(props) {
  const seated = props.useUi(value => value.accountSeated === true)
  if (seated) return null
  return h('span', { className: 'bt-foot-account' }, h(AccountLauncher, { ...props, seat: false }))
}

// The only entry registered in every mode: in Agent mode the whole Bot surface is
// withdrawn, and this button in the shell's own footer is the way back.
export function BotReturn({ wide, useSurface, actions }) {
  const mode = useSurface(value => value.mode)
  if (mode !== 'agent') return null
  return h('button', { type: 'button', className: 'bt-return', 'aria-label': t('DS Bot'), title: t('DS Bot'), onClick: () => actions.setSurface('bot') },
    h(BotMark, { look: MAIN_LOOK, size: 20 }),
    wide ? h('span', { className: 'bt-return-name' }, t('DS Bot')) : null)
}

// Agent mode has none of the shell-group styles, so the return button carries its own.
export const RETURN_CSS = `
.bt-return{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:none;color:inherit;font:inherit;font-size:14px;line-height:20px;cursor:pointer;transition:background-color .12s ease}
.bt-return:hover{background:rgba(127,127,127,.14)}
.bt-return:active{transform:scale(.96)}
.bt-return .bt-mark{display:inline-flex;flex:none;line-height:0}
.bt-return .bt-mark svg{width:100%;height:100%;overflow:visible}
/* Shell styles carry --bt-ink-deepseek and Agent mode withdraws them; pin it here. */
.bt-return .bt-mark{--bt-ink-deepseek:#4D6BFE}
.bt-return-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`

export function BrandMark({ size = 24 }) {
  return h('span', { className: 'bt-brand-whale' }, h(BotMark, { look: MAIN_LOOK, size }))
}
export function BrandName() {
  return h('span', { style: { fontWeight: 600, fontSize: 14 } }, 'DS Bot')
}

// With the whale holding the settings seat, the footer row is just the account menu
// and Connect plugins; FooterAccount only shows when the seat went to no one. The
// shell's footer classes are CSS-module names, so they match on their stems.
export const SIDEBAR_CSS = `
.bt-side-top .bt-brand{cursor:default;padding-left:6px}
.bt-side-top .bt-brand:hover{background:none}
.bt-brand .bt-mark{flex:none}
.bt-pin{flex:none;display:inline-flex;color:var(--bt-ink-3)}
.bt-rail .bt-row{position:relative}
.bt-rail .bt-pin{position:absolute;top:3px;left:calc(50% + 12px)}
[class*="_footArea"]:has(.bt-foot-account)>[class*="_footerActions"],[class*="_footArea"]:has(.bt-foot-account)>[class*="_footerActions"]>div{display:contents!important}
.bt-foot-account{order:-1;flex:none;display:inline-flex}
[class*="_footArea"]:has(.bt-foot-account) .bt-connect-foot{order:0;flex:1 1 auto;min-width:0;width:auto}
[class*="_footArea"]:has(.bt-foot-account)>[class*="_settingsArea"]{order:1;flex:none}
[class*="_footArea"]:has(.bt-foot-account)>[class*="_settingsArea"] button[class*="_trigger"] [class*="_label"]{display:none!important}

/* The update cloud springs in when a newer DS Bot shows up; its arrow drops in a
   loop while the install runs. */
.bt-round.bt-update{position:relative;color:var(--bt-accent,#4D6BFE);animation:bt-update-in ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
.bt-round.bt-update svg{width:17px;height:17px}
.bt-round.bt-update[data-phase=installed]{color:var(--bt-ink-2)}
@keyframes bt-update-in{from{opacity:0;transform:scale(.6);filter:blur(4px)}}
.bt-update[data-phase=installing] .bt-cloud-arrow{animation:bt-cloud-drop 1.1s cubic-bezier(.45,0,.55,1) infinite}
@keyframes bt-cloud-drop{0%{transform:translateY(-3px);opacity:0}35%{opacity:1}70%{transform:translateY(1px);opacity:1}100%{transform:translateY(2px);opacity:0}}
.bt-update-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:#E5484D;box-shadow:0 0 0 1.5px var(--bt-sidebar)}
.bt-update-pop{position:fixed;z-index:60;width:280px;padding:14px 14px 12px;border-radius:14px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 10px 20px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);color:var(--bt-ink);box-sizing:border-box;transform-origin:top left;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;animation:bt-update-pop ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
@keyframes bt-update-pop{from{opacity:0;transform:scale(.96);filter:blur(4px)}}
.bt-update-title{font-size:14px;line-height:20px;font-weight:600}
.bt-update-text{margin-top:2px;font-size:12.5px;line-height:18px;color:var(--bt-ink-2)}
.bt-update-error{margin-top:8px;font-size:12px;line-height:17px;color:#c21d2e;overflow-wrap:anywhere;max-height:90px;overflow:auto}
.bt-update-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px}
.bt-update-notes{margin-right:auto;font-size:12.5px;color:var(--bt-ink-2);text-decoration:none}
.bt-update-notes:hover{color:var(--bt-ink);text-decoration:underline}
.bt-update-go{height:30px;padding:0 14px;border:0;border-radius:999px;background:var(--bt-accent,#4D6BFE);color:var(--bt-accent-ink,#fff);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .12s ease,transform .12s ease}
.bt-update-go:hover:not(:disabled){opacity:.9}
.bt-update-go:active:not(:disabled){transform:scale(.96)}
.bt-update-go:disabled{opacity:.6;cursor:default}
.bt-update-dsh:not(:first-child){margin-top:12px;padding-top:12px;border-top:.5px solid var(--bt-line-2)}
@media (prefers-reduced-motion:reduce){.bt-round.bt-update,.bt-update-pop,.bt-update .bt-cloud-arrow{animation:none}}

/* The DSH Agent row and its expanding Session list. The black whale is the
   harness's own mark, so the row reads as "plain dsh" next to the Bot marks. */
.bt-agent-ava{flex:none;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--bt-hover);color:var(--bt-ink)}
.bt-agent-ava.bt-run{animation:bt-agent-pulse 1.4s ease-in-out infinite}
@keyframes bt-agent-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.bt-agent-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing}}
.bt-agent-sub[data-open]{grid-template-rows:1fr}
.bt-agent-sub-in{overflow:hidden;min-height:0;margin-left:44px}
.bt-agent-sub-row{display:flex;align-items:center;gap:8px;width:100%;padding:5px 10px 5px 8px;border:0;border-radius:8px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.bt-agent-sub-row:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-agent-sub-row[aria-current=page]{background:var(--bt-hover);color:var(--bt-ink);font-weight:500}
.bt-agent-sub-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-agent-sub-time{flex:none;font-size:11px;color:var(--bt-ink-3)}
.bt-agent-new{color:var(--bt-ink-3)}
.bt-agent-new svg{width:14px;height:14px;flex:none}
.bt-agent-edit{padding:3px 10px 3px 4px}
.bt-agent-edit input{width:100%;border:0;border-radius:6px;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:13px;line-height:20px;padding:2px 8px;outline:none;box-shadow:inset 0 0 0 .5px var(--bt-line-2)}
.bt-agent-sub[data-open] .bt-agent-sub-row{animation:bt-agent-row-in .24s ease both;animation-delay:calc(var(--i, 0)*30ms)}
@keyframes bt-agent-row-in{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:blur(0)}}
@media (prefers-reduced-motion:reduce){.bt-agent-sub{transition:none}.bt-agent-sub .bt-agent-sub-row{animation:none}}
`
