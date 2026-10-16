import { createElement as h, Fragment, useEffect, useRef, useState } from 'react'
import { SHELL_OVERLAY } from './shell-overlay.js'
import { inkText } from './inks.js'
import { dayLabel } from './text.js'
import { colorOf, BotMark } from './mark.js'
import { Bubbles } from './cells.js'
import { useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEscape, usePaneLeft } from './overlay-hooks.js'
import { useMobile } from './mobile.js'
import { t } from './i18n.js'

const SHEET_EXIT_MS = 220
export function ExchangeDialog({ pair, roster, actions }) {
  const [entries, setEntries] = useState(null)
  const [leaving, setLeaving] = useState(false)
  // The sheet slides back down before it unmounts.
  const close = () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => actions.closeOverlay(), SHEET_EXIT_MS)
  }
  // Two keys, one per shape, and the pair is deliberate (test/ux-rules.test.js asserts it): a phone
  // draws this sheet as the screen and the shell's modal machinery owns Escape, the focus trap and
  // the focus handed back on close -- it reads the dialog through the ref below. A wide window draws
  // it as the column beside a live sidebar, and there our own stack keeps the key it always had.
  const mobile = useMobile()
  const dialogRef = useRef(null)
  useModalLayer(dialogRef, mobile, close)
  useEscape(mobile ? () => {} : close)
  useEffect(() => {
    let stop = false
    let timer
    let seen = null
    const load = async () => {
      const result = await actions.exchange(pair[0], pair[1])
      if (stop) return
      const key = JSON.stringify(result ?? [])
      if (key !== seen) { seen = key; setEntries(result ?? []) }
      timer = setTimeout(load, document.hidden ? 8000 : 2000)
    }
    void load()
    return () => { stop = true; clearTimeout(timer) }
  }, [pair[0], pair[1]])
  const left = roster.byId[pair[0]]
  const right = roster.byId[pair[1]]
  let lastDay = 0
  const paneLeft = usePaneLeft()
  return h('div', { className: 'bt-pane bt-exchange', style: { left: paneLeft }, 'data-leaving': leaving || undefined },
    h('div', { ref: dialogRef, className: 'bt-dialog', role: 'dialog', 'aria-modal': true, ...SHELL_OVERLAY, 'aria-label': t('Bot exchange') },
      h('div', { className: 'bt-head' }, h('span', { className: 'bt-pill', style: { cursor: 'default' } },
        left ? h(BotMark, { bot: left, size: 22 }) : null, left?.name ?? '?',
        h('span', { className: 'bt-swap' }, '⇄'),
        right ? h(BotMark, { bot: right, size: 22 }) : null, right?.name ?? '?')),
      h('div', { className: 'bt-dialog-log', role: 'log', 'aria-label': t('Bot exchange transcript') },
        entries === null ? h('div', { className: 'bt-hint' }, t('Loading…'))
          : entries.length === 0 ? h('div', { className: 'bt-hint' }, t('No messages yet'))
            : entries.map((entry) => {
              const bot = roster.byId[entry.from] ?? { id: entry.from, name: t('You'), color: 'gray' }
              const showDay = entry.time - lastDay > 30 * 60 * 1000
              lastDay = entry.time
              return h(Fragment, { key: entry.id },
                showDay ? h('time', { className: 'bt-time' }, dayLabel(entry.time)) : null,
                h('div', { className: 'bt-group-msg' },
                  h('span', { className: 'bt-group-name', style: { color: inkText(colorOf(bot)) } }, bot.name),
                  h(Bubbles, { texts: [entry.text], roster, selfId: bot.id, actions, lead: h('span', { className: 'bt-lead' }, h(BotMark, { bot: bot, size: 22 })) })))
            })),
      h('div', { className: 'bt-dialog-foot' }, h('button', { type: 'button', className: 'bt-soft', onClick: close }, t('Close Chat')))))
}
