// 发现: a page of its own, a list of the things this skin and the shell keep behind it, rather
// than the plugin manager opened straight away (which is what the tab used to do). Every row is a
// door that already exists -- the plugin manager panel, the connectors, capabilities, automation
// tasks and secrets screens, the usage page -- so nothing here invents a route; the row that opens
// a shell panel carries our own back strip, because a panel draws no back of its own, and the
// settings rows step back to this list on their way out (index.js, closeSettings).
//
// One surface at a time, like the peers page: opening this page closes the others, and the rows
// close it on the way to what they open.
import { createElement as h, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, FluentClockIcon, FluentDataUsageIcon, FluentKeyIcon, FluentOptionsIcon, FluentPlugConnectedIcon, FluentPuzzlePieceIcon } from './icons.js'
import { useEscape, usePaneLeft } from './overlay-hooks.js'
import { useMobile } from './mobile.js'
import { t } from './i18n.js'

// The cards, in the order they are drawn, and the rows inside each one: key, label, icon. A card is
// one group the user reads as one block -- no heading, one surface, one hairline between the rows
// (the CSS below) -- so the grouping is the card itself: 插件 ｜ 连接器·能力·定时任务·密钥 ｜ 用量.
//
// Only rows whose door this skin can already open are here, and every one of them is a page the
// settings dialog already draws (settings.js, SETTINGS_GROUPS) or a panel the shell registers. 模型
// and Agent 预设 have neither: the model chooser is per Bot (and per Session) and lives inside a
// Bot's own menu, and the only "preset" anywhere is that Bot's permission preset, also inside its
// settings. They are left out rather than drawn as buttons that go nowhere, and the card keeps the
// rows that do have a screen.
export const DISCOVER_CARDS = [
  [
    ['plugins', 'Plugin manager', FluentPuzzlePieceIcon],
  ],
  [
    ['connectors', 'Connectors', FluentPlugConnectedIcon],
    ['capabilities', 'Capabilities', FluentOptionsIcon],
    ['schedules', 'Automation tasks', FluentClockIcon],
    ['secrets', 'Secrets', FluentKeyIcon],
  ],
  [
    ['usage', 'Usage', FluentDataUsageIcon],
  ],
]

// The same list without its grouping, in drawing order, for anything that only asks which rows
// exist. Exported so the list can be checked without a DOM.
export const DISCOVER_ROWS = DISCOVER_CARDS.flat()

// The rows whose door is a shell panel: those are the ones that need a back of ours (see below).
export const PANEL_ROWS = ['plugins', 'schedules']

export function DiscoverPage({ useUi, actions }) {
  const open = useUi(value => value.discover === true)
  const mobile = useMobile()
  const paneLeft = usePaneLeft()
  useEscape(() => actions.closeDiscover())
  if (!open || !mobile) return null
  // The whole page is 我的 -> 全部设置's own structure: the same layer, dialog, centred 52px head,
  // scrolling body, group cards and item rows, so the two pages are one design rather than two that
  // resemble each other. The list only brings its own rows and the two things the user asked for on
  // top of that page's spec (DISCOVER_CSS, below).
  return createPortal(h('div', { className: 'bt-settings-layer bt-discover', style: { left: paneLeft } },
    h('div', { className: 'bt-scrim', onMouseDown: () => actions.closeDiscover() }),
    h('div', { className: 'bt-settings', role: 'dialog', 'aria-modal': true, 'aria-label': t('Discover'), 'data-screen': 'list' },
      h('div', { className: 'bt-settings-top' }, h('h2', null, t('Discover'))),
      h('div', { className: 'bt-settings-scroll' }, DISCOVER_CARDS.map((rows, card) => h('section', {
        key: `card:${card}`, className: 'bt-settings-group',
      },
      h('div', { className: 'bt-settings-group-card' }, rows.map(([key, label, Icon]) => h('button', {
        key, type: 'button', className: 'bt-settings-item', 'data-row': key,
        onClick: () => actions.openDiscoverRow(key),
      },
      h(Icon),
      h('span', { className: 'bt-settings-name' }, t(label)),
      h('span', { className: 'bt-set-go', 'aria-hidden': true }, h(ChevronRightIcon)))))))))), document.body)
}

// The strip a second-level panel carries. The plugin manager and the automation tasks page are
// the shell's own panels and draw no back, so this is it: 56px tall, a 48px control, the page's
// own colour under it. While it is up the panel's column reserves its height (styles.js, the
// html[data-bt-subpage] rule), so the panel's own head starts below the strip rather than under it.
export function DiscoverBack({ useUi, actions }) {
  const panel = useUi(value => (PANEL_ROWS.includes(value.discoverPanel) ? value.discoverPanel : null))
  const mobile = useMobile()
  // One layer at a time: this strip and Escape both go back to the list, and the list's own
  // Escape is what leaves the page (the page, above).
  useEscape(() => actions.closeDiscoverRow())
  useEffect(() => {
    if (panel === null) return undefined
    document.documentElement.dataset.btSubpage = '1'
    return () => { delete document.documentElement.dataset.btSubpage }
  }, [panel])
  if (panel === null || !mobile) return null
  return createPortal(h('div', { className: 'bt-subback' },
    h('button', {
      type: 'button', className: 'bt-subback-btn', 'aria-label': t('Back to the list'),
      onClick: () => actions.closeDiscoverRow(),
    }, h(ChevronLeftIcon))), document.body)
}

// The page and the strip. Every rule is gated on the phone layout, the same gate the component
// reads, so nothing here can reach the desktop.
// The page and the strip. The page itself is 我的 -> 全部设置's own structure and sheet (the layer,
// the dialog, the 52px head with its centred title, the scrolling body, the group cards and the item
// rows all come from styles.js), so nothing about its look is restated here: what is left is the two
// things the user asked for on top of that page, and the strip a shell panel needs. Every rule is
// gated on the phone layout, the same gate the component reads.
export const DISCOVER_CSS = `
/* Nothing of the page's own look is declared here: the layer, the dialog, the head and its centred
   title, the scrolling body, the group cards, their corners and border, the rows' height and type,
   the icons' size and colour, the chevrons and the spacing all come from the settings page's own
   rules in styles.js. What is left is the strip a shell panel's second level needs -- that level is
   not the settings layer, so it also needs its own line to keep the conversation's top row out. */
html[data-bt-mobile] body:has(.bt-subback) .bt-mobile-bar{display:none}
html[data-bt-mobile] .bt-subback{position:fixed;top:0;left:0;right:0;height:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 56px);box-sizing:border-box;padding:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) 12px 0;z-index:96;display:flex;align-items:center;background:var(--bt-main);pointer-events:none}
html[data-bt-mobile] .bt-subback-btn{pointer-events:auto;flex:none;width:48px;height:48px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--bt-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
html[data-bt-mobile] .bt-subback-btn:hover{background:var(--bt-hover)}
html[data-bt-mobile] .bt-subback-btn>svg{width:22px;height:22px}
`
