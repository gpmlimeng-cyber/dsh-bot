// 伙伴: the team's contacts, as a page of its own rather than as the conversation's
// sidebar. The user pointed at WeChat's address book -- a title, a search field, one row per
// person -- and this keeps only the parts that pay for themselves: no A-Z rail (that needs a
// pinyin table), no collapsible sections, no add-a-friend actions. Whoever is on the team is
// whoever the roster says, so nothing here fetches anything.
//
// The group chats are a door rather than a list: they have a page of their own (我的 -> 群聊,
// settings.js, which lists them and offers 新建群聊), and this page opens it instead of drawing a
// second copy of it -- the same rule the rest of this skin follows.
//
// A Bot's row opens that Bot's own settings page: an address book's entry for a person is that
// person's page, not their chat, and it is the page its 「编辑 Bot」 menu entry opens -- name, label,
// model and folder. The page closes first (the layer is drawn under it on a phone), and both door
// and row come back to this list rather than past it: the way back is the `back` the layer carries
// (index.js).
import { createElement as h, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotMark } from './mark.js'
import { modelOf } from './model-ref.js'
import { ChevronRightIcon, PlusIcon, SearchIcon, SETTINGS_ICONS } from './icons.js'
import { useMobile } from './mobile.js'
import { isMainOf } from './sources.js'
import { t } from './i18n.js'

// The list the page draws: every Bot by name, narrowed by what is typed. Exported so the
// order and the filter can be checked without a DOM.
export function peersList(bots, query) {
  const wanted = query.trim().toLowerCase()
  const byName = [...(bots ?? [])].sort((a, b) => (a?.name ?? '').localeCompare(b?.name ?? ''))
  return wanted === '' ? byName : byName.filter(bot => (bot?.name ?? '').toLowerCase().includes(wanted))
}

// The two values a row's description line carries as text, exported for the same reason the list
// is: what a line says should be checkable without a DOM.
//
// The model is read the way 我的 -> Bot settings reads it (modelOf): the served model's own name,
// falling back to the id's last segment, and nothing at all when the Bot has no model yet.
export function peersModel(bot, roster) {
  return modelOf(bot, roster)?.name ?? null
}

// The folder keeps only its last segment -- a workspace is a path, and the path is a sentence
// where the name wants a word (the settings page shows the whole one, with room to read it).
export function peersFolder(workDir) {
  const tail = (workDir ?? '').replace(/\/+$/, '').split('/').filter(Boolean).pop()
  return tail ?? null
}

export function PeersPage({ useRoster, useUi, actions }) {
  const roster = useRoster(value => value)
  const open = useUi(value => value.peers === true)
  const [query, setQuery] = useState('')
  const mobile = useMobile()
  if (!open || !mobile) return null
  const shown = peersList(roster.bots, query)
  // A page of Settings, opened from here: the list steps aside for it (the layer is drawn under this
  // one, z 60 against 79, so it could not be seen over it), and the action remembers that the way
  // back is this list rather than the conversation. One door, two pages under it -- a Bot's own page
  // (我的 -> Bot, one Bot) and the group chats' list (我的 -> 群聊) -- and neither is redrawn here.
  const openPage = (page, id = null) => {
    actions.openPeerPage(page, id)
  }
  // One section per kind of contact, in 我的 -> 全部设置's own shape: the heading over the card, the
  // rows inside it (styles.js, the phone's group rules). A section with no rows is not drawn at all,
  // so a search that matches one side shows that side rather than a heading over nothing.
  const section = (label, rows) => h('section', { className: 'bt-settings-group' },
    h('h3', { className: 'bt-settings-group-head' }, label),
    h('div', { className: 'bt-settings-group-card', role: 'list' }, rows))
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
    // The page's one scroller: the group chats' door, then the people. The wrapper carries the list
    // item, the way the members list does: a button that declared itself a list item would stop
    // being announced as a button.
    //
    // The door is a row like any other -- one line, because it names a page rather than a contact --
    // and it wears the icon 我的 -> 群聊's own row wears for it (SETTINGS_ICONS), so the two read as
    // the same door. It is drawn whatever the search says: it is not a contact to match against, and
    // the list behind it has a search box of its own.
    h('div', { className: 'bt-peers-list' },
      section(t('Group chats'), [h('div', { key: 'groups', className: 'bt-peers-item', role: 'listitem' },
        h('button', {
          type: 'button', className: 'bt-peers-row', 'data-page': 'groups', onClick: () => openPage('groups'),
        },
        h('span', { className: 'bt-peers-icon', 'aria-hidden': true }, h(SETTINGS_ICONS.groups)),
        h('span', { className: 'bt-peers-body' },
          h('span', { className: 'bt-peers-name-row' }, h('span', { className: 'bt-peers-name' }, t('Group chats')))),
        h('span', { className: 'bt-peers-go', 'aria-hidden': true }, h(ChevronRightIcon))))]),
      shown.length > 0 ? section(t('Peers'), shown.map(bot => {
        const model = peersModel(bot, roster)
        // The folder it works in: its own when it has one, and the team workspace's own word when
        // it has none (which is the usual case -- a Bot works in the team's folder unless someone
        // gave it another). That word is the settings row's own (folder-menu.js), so the two read
        // the same; the real path behind it is a host call, and a list line does not make one.
        const folder = peersFolder(bot.workDir) ?? t('Team workspace')
        return h('div', { key: bot.id, className: 'bt-peers-item', role: 'listitem' },
          h('button', {
            type: 'button', className: 'bt-peers-row', 'data-bot-id': bot.id, onClick: () => openPage('bots', bot.id),
          },
          h(BotMark, { bot, size: 36 }),
          h('span', { className: 'bt-peers-body' },
            h('span', { className: 'bt-peers-name-row' },
              h('span', { className: 'bt-peers-name' }, bot.name),
              bot.role ? h('span', { className: 'bt-tag' }, bot.role) : null,
              isMainOf(roster, bot.id) ? h('span', { className: 'bt-tag' }, t('Main Bot')) : null),
            h('span', { className: 'bt-peers-desc' },
              model ? h('span', { className: 'bt-peers-text' }, model) : null,
              // The two values are told apart by one mark, and it is a mark rather than a value: it
              // keeps its own width, so a long model and a long folder are what give way (each with
              // its own ellipsis) and the mark between them is never what is cut. It is drawn only
              // when there are two values to tell apart, and the group's one-value line has none.
              model ? h('span', { className: 'bt-peers-sep', 'aria-hidden': true }, '·') : null,
              h('span', { className: 'bt-peers-text' }, folder))),
          h('span', { className: 'bt-peers-go', 'aria-hidden': true }, h(ChevronRightIcon))))
      })) : null,
      shown.length === 0
        ? h('div', { className: 'bt-peers-empty', role: 'status' }, t('Nothing matches'))
        : null)), document.body)
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
/* The 群聊 door's glyph, in the box a Bot's avatar takes (36px) so every row's text starts at the
   same x, and at the 24px 我的 -> 全部设置 draws its own row icons at -- the same icon, the same
   size, so the two doors read as one. */
html[data-bt-mobile] .bt-peers-icon{flex:none;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-2)}
html[data-bt-mobile] .bt-peers-icon>svg{width:24px;height:24px}
/* The two lines a row reads in: the name with its labels, then the description under it. The pair
   takes what the chevron leaves, and neither line ever wraps: a line that runs out of room cuts its
   own text with an ellipsis instead of becoming two. The name gives way first (it is the flexible
   one); the labels keep their width and the chevron keeps its box, and what is left over is clipped
   rather than pushed into the row's neighbours. */
html[data-bt-mobile] .bt-peers-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
html[data-bt-mobile] .bt-peers-name-row{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden}
html[data-bt-mobile] .bt-peers-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The description line: the second level of the two, in the skin's own small second-level colour,
   and one line of values whatever it holds. */
html[data-bt-mobile] .bt-peers-desc{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow:hidden;font-size:12px;line-height:16px;color:var(--bt-ink-3)}
/* A value is the part that gives way: the labels and the chevron keep their width, and the model
   and the folder ellipsise -- the folder last, since it is the one that can be longest. */
html[data-bt-mobile] .bt-peers-text{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The mark between two values is not one of them: it takes exactly the width of the glyph, so
   nothing about it can be squeezed or dropped when the two values are long. */
html[data-bt-mobile] .bt-peers-sep{flex:none}
/* The chevron is the row's edge, not a thing floating at the end of the text: it is pushed to the
   right end of the row by its own margin, it keeps its own width, and the text side is what gives
   way. So every row shows it at the same x -- whatever the name, the model or the folder says --
   and it stays vertically centred on a row of two lines rather than riding the first one. */
html[data-bt-mobile] .bt-peers-go{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-3)}
html[data-bt-mobile] .bt-peers-empty{padding:24px 12px;font-size:14px;line-height:21px;color:var(--bt-ink-3)}
/* The page carries its own title, and the pill belongs to the conversation behind it. */
html[data-bt-mobile] body:has(.bt-peers) .bt-mobile-bar{display:none}
`
