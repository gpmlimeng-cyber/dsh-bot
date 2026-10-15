// 伙伴: the team's contacts, as a page of its own rather than as the conversation's
// sidebar. The user pointed at WeChat's address book -- a title, a search field, one row per
// person -- and this keeps only the parts that pay for themselves: no A-Z rail (that needs a
// pinyin table), no collapsible groups, no add-a-friend actions. Whoever is on the team is
// whoever the roster says, so nothing here fetches anything.
//
// A row opens that Bot's own chat and lands back on the conversation; the page closes first,
// so the bar and the main view agree on which of the four pages is on screen.
import { createElement as h, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotMark } from './mark.js'
import { ChevronRightIcon, PlusIcon, SearchIcon } from './icons.js'
import { useMobile } from './mobile.js'
import { t } from './i18n.js'

// The list the page draws: every Bot by name, narrowed by what is typed. Exported so the
// order and the filter can be checked without a DOM.
export function peersList(bots, query) {
  const wanted = query.trim().toLowerCase()
  const byName = [...(bots ?? [])].sort((a, b) => (a?.name ?? '').localeCompare(b?.name ?? ''))
  return wanted === '' ? byName : byName.filter(bot => (bot?.name ?? '').toLowerCase().includes(wanted))
}

export function PeersPage({ useRoster, useUi, actions }) {
  const roster = useRoster(value => value)
  const open = useUi(value => value.peers === true)
  const [query, setQuery] = useState('')
  const mobile = useMobile()
  if (!open || !mobile) return null
  const shown = peersList(roster.bots, query)
  // Back to the conversation first, then the Bot's chat: one tap leaves this page, it does
  // not stack a second one on it. A details pane goes with it: a row opens a conversation, not a
  // settings screen, and openSession does not close one that was already up -- on the phone that
  // pane is full-screen (z 96, over the bar), so it is what the user sees instead of the chat.
  const openBot = (id) => {
    actions.closePeers()
    actions.selectPanel(null)
    actions.closePanel()
    actions.openSession(id)
  }
  return createPortal(h('div', { className: 'bt-peers', role: 'region', 'aria-label': t('Peers') },
    h('div', { className: 'bt-peers-top' },
      // 新建, and it is the drawer's own entry rather than a second door of its own: the same label
      // the sidebar and the conversation's header carry, and the same action, which opens the picker
      // (new-chat.js, mode 'new') with its create-Bot / create-group / pick-a-chat rows. The page is
      // closed on the way there: openNewChat clears `peers`, so nothing stacks on it.
      //
      // The title row it sits in is 我的's own (styles.js): the same 52px bar with the name centred
      // in it by that page's own rule, and the one control this page has at its right end.
      h('div', { className: 'bt-settings-top' },
        h('h2', null, t('Peers')),
        h('button', {
          type: 'button', className: 'bt-round bt-peers-new',
          'aria-label': t('New…'), title: t('New…'),
          onClick: () => actions.openNewChat('new'),
        }, h(PlusIcon))),
      h('div', { className: 'bt-side-search' },
        h(SearchIcon),
        h('input', {
          type: 'search', enterKeyHint: 'search', autoComplete: 'off', spellCheck: false,
          placeholder: t('Search'), value: query, 'aria-label': t('Search'),
          onChange: event => setQuery(event.target.value),
        }))),
    shown.length === 0
      ? h('div', { className: 'bt-peers-empty', role: 'status' }, t('No Bots match'))
      // The wrapper carries the list item, the way the members list does: a button that
      // declared itself a list item would stop being announced as a button.
      : h('div', { className: 'bt-peers-list', role: 'list' }, shown.map(bot => h('div', {
        key: bot.id, className: 'bt-peers-item', role: 'listitem',
      },
      h('button', {
        type: 'button', className: 'bt-peers-row', 'data-bot-id': bot.id, onClick: () => openBot(bot.id),
      },
      h(BotMark, { bot, size: 36 }),
      h('span', { className: 'bt-peers-name' }, bot.name),
      bot.role ? h('span', { className: 'bt-tag' }, bot.role) : null,
      h('span', { className: 'bt-peers-go', 'aria-hidden': true }, h(ChevronRightIcon))))))), document.body)
}

// The page covers the screen and carries the status bar's inset itself, from the status bar's own
// lower edge: this page has no veil over the conversation to clear, so the head starts right there
// rather than under the strip's height (--bt-fade-h, which only the conversation reserves). Its
// foot stops where the phone's bottom bar begins. Every rule is gated on the phone layout.
export const PEERS_CSS = `
html[data-bt-mobile] .bt-peers{position:fixed;inset:0;z-index:79;display:flex;flex-direction:column;box-sizing:border-box;padding:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) 12px calc(var(--bt-nav-h) + var(--bt-nav-gap));background:var(--bt-sidebar);color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
/* Typing in the search box raises the keyboard, and the bar (hidden underneath it, but still
   reserving its height) would leave the same dead band the user reported under the composer:
   give the room back while the flag is up. The flag is mobile.js's; the bar's own rule hides
   the bar itself. */
html[data-bt-mobile][data-bt-keyboard] .bt-peers{padding-bottom:12px}
html[data-bt-mobile] .bt-peers-top{flex:none;display:flex;flex-direction:column;gap:10px;padding-bottom:8px}
/* The title row is 我的's own (styles.js: .bt-settings-top): the 52px bar with the name centred in
   it, out of the flow so the control beside it cannot pull it off centre. The button is a control
   of the chrome, so its surface (fill, hairline, radius, shadow) is the one shared declaration in
   styles.js -- the same control the drawer's + and the conversation pill read. Only size and layout
   live here. */
html[data-bt-mobile] .bt-peers-new{flex:0 0 40px;width:40px;height:40px;margin-left:auto}
html[data-bt-mobile] .bt-peers-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}
html[data-bt-mobile] .bt-peers-row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 10px;border:0;border-radius:12px;background:none;color:var(--bt-ink);font:inherit;font-size:15px;line-height:21px;text-align:left;cursor:pointer;box-sizing:border-box}
html[data-bt-mobile] .bt-peers-row:hover{background:var(--bt-hover)}
html[data-bt-mobile] .bt-peers-row>.bt-mark{flex:none}
html[data-bt-mobile] .bt-peers-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-bt-mobile] .bt-peers-go{flex:none;display:inline-flex;color:var(--bt-ink-3)}
html[data-bt-mobile] .bt-peers-empty{padding:24px 12px;font-size:14px;line-height:21px;color:var(--bt-ink-3)}
/* The page carries its own title, and the pill belongs to the conversation behind it. */
html[data-bt-mobile] body:has(.bt-peers) .bt-mobile-bar{display:none}
`
