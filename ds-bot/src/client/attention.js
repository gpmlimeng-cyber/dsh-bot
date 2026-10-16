// The "Needs you" entry: one button in the conversation header, shown only while
// something waits for the user, and one popover listing every item by urgency. Each
// row opens the conversation the item belongs to; the popover holds no controls of
// its own — answers, approvals and keys are given where the cards already live.
// One view of one device: nothing here tracks revisions or other windows.
import { createElement as h, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from './i18n.js'

const BellIcon = () => h('svg', { width: 14, height: 14, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
  h('path', { d: 'M15.5 13.5H4.5c.8-.9 1.5-1.6 1.5-4.5a4 4 0 0 1 8 0c0 2.9.7 3.6 1.5 4.5z' }),
  h('path', { d: 'M8.3 16a1.8 1.8 0 0 0 3.4 0' }))
const ChevronIcon = () => h('svg', { width: 12, height: 12, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
  h('path', { d: 'M7.5 4.5L13 10l-5.5 5.5' }))

/**
 * Everything that waits for the user, most urgent first. Every source is data the
 * host already sends; each item carries the Session id its conversation opens with
 * (`open`) and the name it is shown under.
 * @param {{questions?:Object, secretRequests?:Object}} roster the team view
 * @param {{approvals?:{sessionId?:string, botId:string, tool:string}[]}} work running turns and approvals
 * @param {Object} unread per Session id, whether replies landed unseen
 * @param {{byId:Object, roomsById:Object}} indexed the roster's Session index
 */
export function needsYou(roster, work, unread, indexed, decision = null) {
  const nameOf = (id) => {
    const bot = indexed.byId[id]
    if (bot !== undefined) return { name: bot.name, id: bot.id }
    const room = indexed.roomsById[id]
    if (room !== undefined) return { name: room.name, id: room.id }
    return { name: t('Bot'), id }
  }
  const items = []
  // A decision the room admin asked for takes the first seat: it is the one thing here the user
  // has to answer for the team to move, and it is also what makes the bell appear at all when
  // nothing else is waiting (index.js holds one at a time; cells.js only reads the admin's own).
  if (decision !== null && decision !== undefined) {
    const { name, id } = nameOf(decision.sessionId)
    items.push({ kind: 'decision', open: decision.sessionId, title: decision.title, where: name, botId: id, options: decision.options ?? [] })
  }
  for (const [sessionId, question] of Object.entries(roster.questions ?? {})) {
    // A card a Bot asked in a group chat sits in the room as well; the waiting copy marks itself,
    // so the same question is listed once, under the room.
    if (question.mirroredTo !== undefined) continue
    const { name, id } = nameOf(sessionId)
    items.push({
      kind: 'question',
      open: sessionId,
      title: question.question || t('Waiting for your answer'),
      where: name,
      botId: id,
    })
  }
  for (const approval of work.approvals ?? []) {
    const at = approval.sessionId ?? approval.botId
    const { name, id } = nameOf(at)
    items.push({
      kind: 'approval',
      open: approval.roomId ?? approval.sessionId ?? approval.botId,
      title: approval.tool ? t('{tool} waits for approval', { tool: approval.tool }) : t('Waiting for your approval'),
      where: name,
      botId: id,
    })
  }
  for (const [botId, requests] of Object.entries(roster.secretRequests ?? {})) {
    for (const request of requests ?? []) {
      if (request.status !== 'pending') continue
      const { name, id } = nameOf(request.sessionId ?? botId)
      items.push({
        kind: 'secret',
        open: request.sessionId ?? botId,
        title: t('The key {name} is waiting', { name: request.name }),
        where: name,
        botId: id,
      })
    }
  }
  for (const id of Object.keys(unread ?? {})) {
    if (unread[id] !== true || indexed.byId[id] === undefined && indexed.roomsById[id] === undefined) continue
    const { name } = nameOf(id)
    items.push({ kind: 'unread', open: id, title: t('Someone replied'), where: name, botId: id })
  }
  const rank = { decision: 0, question: 1, approval: 2, secret: 3, unread: 4 }
  return items.sort((one, two) => rank[one.kind] - rank[two.kind] || one.where.localeCompare(two.where))
}

// One popover, fixed under the header's right edge. `anchor` is the button; the items
// and their labels come from `needsYou`. Dismiss on outside press or Escape, like the
// message menus do.
function NeedsYouPop({ anchor, items, onClose, onOpen, onDecide }) {
  const pop = useRef(null)
  useEffect(() => {
    const onDown = (event) => {
      if (pop.current?.contains(event.target) || anchor.current?.contains(event.target)) return
      onClose()
    }
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true) }
  }, [onClose, anchor])
  const box = anchor.current?.getBoundingClientRect()
  const top = (box?.bottom ?? 0) + 6
  const right = window.innerWidth - (box?.right ?? 0)
  const label = { decision: t('Waiting for your decision'), question: t('Waiting for your answer'), approval: t('Waiting for your approval'), secret: t('Waiting for a key'), unread: t('Someone replied') }
  return createPortal(h('div', { className: 'bt-attention-pop', ref: pop, role: 'dialog', 'aria-label': t('Needs you'), style: { top: `${top}px`, right: `${right}px` } },
    // A decision is the one row that does not open something: its options are the answer, so the
    // row itself is not a button and each option is one.
    items.map(item => item.kind === 'decision'
      ? h('div', { key: `decision:${item.open}:${item.title}`, className: 'bt-attention-row bt-attention-decide', 'data-kind': 'decision' },
          h('span', { className: 'bt-attention-kind' }, label.decision),
          h('span', { className: 'bt-attention-title' }, item.title),
          h('span', { className: 'bt-attention-where' }, item.where),
          h('div', { className: 'bt-attention-opts', role: 'group', 'aria-label': item.title },
            (item.options ?? []).map(option => h('button', {
              key: option, type: 'button', className: 'bt-attention-opt',
              onClick: () => onDecide(item.open, option),
            }, option))))
      : h('button', {
      key: `${item.kind}:${item.open}:${item.title}`,
      type: 'button', className: 'bt-attention-row', 'data-kind': item.kind,
      onClick: () => { onClose(); onOpen(item.open) },
    },
      h('span', { className: 'bt-attention-kind' }, label[item.kind]),
      h('span', { className: 'bt-attention-title' }, item.title),
      h('span', { className: 'bt-attention-where' }, item.where),
      h('span', { className: 'bt-attention-go', 'aria-hidden': true }, h(ChevronIcon)))),
    items.length === 0 ? h('div', { className: 'bt-attention-empty' }, t('Nothing needs your attention')) : null),
  document.body)
}

/**
 * The header's "Needs you N" button, gone entirely at N = 0. `useRoster`, `useWork`
 * and `useUi` are the injected sources; `actions.openSession` is where a row lands.
 */
export function NeedsYou({ useRoster, useWork, useUi, actions, inBar = false }) {
  const roster = useRoster(value => value)
  const approvals = useWork(work => work.approvals ?? [])
  const unread = useUi(state => state.unread ?? {})
  const decision = useUi(state => state.decision ?? null)
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  // Cached, so the store selector keeps a stable reference between reads: a fresh
  // object per read is the one shape useSyncExternalStore cannot take.
  const rosterView = useRoster(value => value)
  const indexed = useMemo(() => ({ byId: rosterView.byId, roomsById: rosterView.roomsById }), [rosterView.byId, rosterView.roomsById])
  const items = needsYou(roster, { approvals }, unread, indexed, decision)
  if (items.length === 0) return null
  return h(Fragment, null,
    h('button', {
      ref: anchor, type: 'button',
      // In the phone's bar this is a seat of the right-hand group, so it wears that group's two
      // classes: the frame's skin (styles.js) plus its own count. In the shell's header it keeps
      // its own pill.
      className: inBar ? 'bt-mobile-act bt-attention' : 'bt-attention',
      'aria-expanded': open,
      'aria-haspopup': 'dialog', 'aria-label': t('Needs you'),
      title: t('Needs you'), onClick: () => setOpen(value => !value),
    },
      h(BellIcon),
      h('span', { className: 'bt-attention-count' }, items.length > 9 ? '9+' : String(items.length))),
    open ? h(NeedsYouPop, {
      anchor, items, onClose: () => setOpen(false), onOpen: id => actions.openSession(id),
      // The answer is the user's own message in that room (index.js: actions.send), so it goes
      // through the same door every send does, and the pop closes behind it.
      onDecide: (sessionId, option) => { setOpen(false); void actions.answerDecision(sessionId, option) },
    }) : null)
}

export const ATTENTION_CSS = `
.bt-attention{position:relative;flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px 0 8px;border:0;border-radius:999px;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:background-color .12s ease}

@media (hover:hover){
.bt-attention:hover{background:var(--bt-active)}
}
.bt-attention[aria-expanded=true]{background:var(--bt-active)}
.bt-attention svg{width:13px;height:13px;flex:none;color:var(--bt-ink-2)}
.bt-attention-count{font-variant-numeric:tabular-nums;font-weight:600}
/* A phone's bar draws its right-hand controls as one frame (styles.js: .bt-mobile-acts): this is
   the third seat of that group, so it drops the pill -- the frame carries the skin -- and keeps
   the finger's 44x40 and the group's own press answer. The count becomes a chip on the bell
   instead of a word beside it, which is what makes it one seat rather than a second pill. */
.bt-mobile-acts .bt-attention{position:relative;width:44px;height:40px;padding:0;gap:0;border:0;border-radius:0;background:none;box-shadow:none;color:var(--bt-ink);pointer-events:auto}

html[data-bt-mobile] .bt-mobile-acts .bt-attention{height:44px}
@media (hover:hover){
.bt-mobile-acts .bt-attention:hover{background:var(--bt-hover)}
}
.bt-mobile-acts .bt-attention[aria-expanded=true]{background:var(--bt-active)}
.bt-mobile-acts .bt-attention:active{transform:scale(.96)}
.bt-mobile-acts .bt-attention svg{width:18px;height:18px;color:currentColor}
.bt-mobile-acts .bt-attention-count{position:absolute;top:3px;right:5px;min-width:15px;height:15px;padding:0 4px;border-radius:999px;background:var(--bt-star);color:#fff;font-size:10px;line-height:15px;font-weight:600;text-align:center;box-sizing:border-box}
.bt-attention-pop{position:fixed;z-index:70;min-width:240px;max-width:340px;padding:6px;border-radius:12px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 10px 20px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:2px;transform-origin:top right;animation:bt-attention-in .16s cubic-bezier(.2,0,0,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-sizing:border-box}
@keyframes bt-attention-in{from{opacity:0;transform:translateY(-4px) scale(.98)}}
/* A row is a tap target of its own -- it opens the thing that waits -- so it holds the same 44px
   floor as the options inside a decision. It measured 33px on the target, under our own line. */
.bt-attention-row{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:7px 8px;border:0;border-radius:8px;background:none;color:var(--bt-ink);font:inherit;text-align:left;cursor:pointer}

@media (hover:hover){
.bt-attention-row:hover{background:var(--bt-hover)}
}
.bt-attention-kind{flex:none;font-size:10.5px;line-height:14px;padding:2px 6px;border-radius:6px;background:var(--bt-tag-bg);color:var(--bt-tag-ink);white-space:nowrap}
.bt-attention-row[data-kind=question] .bt-attention-kind{background:color-mix(in srgb,var(--bt-accent) 14%,transparent);color:var(--bt-accent)}
.bt-attention-row[data-kind=approval] .bt-attention-kind{background:color-mix(in srgb,var(--bt-star) 16%,transparent);color:color-mix(in srgb,var(--bt-star) 80%,var(--bt-ink))}
.bt-attention-title{flex:1;min-width:0;font-size:12.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* A decision's row: the title line on top, then the options the user actually taps. Each option is
   a 44px box -- the floor this skin holds every control to, scanned by the touch-target lint like
   any other rule. */
.bt-attention-decide{flex-direction:column;align-items:stretch;gap:6px;cursor:default}
.bt-attention-decide .bt-attention-kind{background:color-mix(in srgb,var(--bt-accent) 14%,transparent);color:var(--bt-accent)}
.bt-attention-opts{display:flex;flex-wrap:wrap;gap:8px}
.bt-attention-opt{min-height:44px;padding:0 16px;border:.5px solid var(--bt-line-2);border-radius:999px;background:var(--bt-main);color:var(--bt-ink);font:inherit;font-size:13px;cursor:pointer}
.bt-attention-where{flex:none;max-width:32%;font-size:11px;line-height:15px;color:var(--bt-ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-attention-go{flex:none;display:inline-flex;color:var(--bt-ink-3)}
.bt-attention-go svg{width:11px;height:11px}
.bt-attention-empty{padding:14px 12px;font-size:12.5px;line-height:17px;color:var(--bt-ink-2);text-align:center}
@media (prefers-reduced-motion:reduce){.bt-attention-pop{animation:none}}
`
