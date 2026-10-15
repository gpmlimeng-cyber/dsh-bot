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
import { ChevronLeftIcon, ChevronRightIcon, FluentClockIcon, FluentDataUsageIcon, FluentPlugConnectedIcon, FluentPuzzlePieceIcon } from './icons.js'
import { useEscape, usePaneLeft } from './overlay-hooks.js'
import { useMobile } from './mobile.js'
import { t } from './i18n.js'

// The groups, in the order they are drawn, each with its own small grey heading and one row per
// card under it -- the user drew the list that way: a heading, then a white card for every row
// (the reference's 资料库 / 专家 / 技能 ...). The heading with a single row under it is kept as it
// is: a group is a group however short it is, and the day a row has a door it has a home.
//
// Only rows whose door this skin can already open are here. 模型 and Agent 预设 have none of ours:
// the model chooser is per Bot (and per Session) and lives inside a Bot's own menu, and the only
// "preset" anywhere is that Bot's permission preset, also inside its settings. They are left out
// rather than drawn as buttons that go nowhere.
export const DISCOVER_GROUPS = [
  ['Plugins', [
    ['plugins', 'Plugin manager', FluentPuzzlePieceIcon],
  ]],
  ['Connections & automation', [
    ['connectors', 'Connectors', FluentPlugConnectedIcon],
    ['schedules', 'Automation tasks', FluentClockIcon],
  ]],
  ['Models & usage', [
    ['usage', 'Usage', FluentDataUsageIcon],
  ]],
]

// The heading of each group, in drawing order, for the copy check.
export const DISCOVER_HEADINGS = DISCOVER_GROUPS.map(([heading]) => heading)

// The same list without its grouping, in drawing order, for anything that only asks which rows
// exist. Exported so the list can be checked without a DOM.
export const DISCOVER_ROWS = DISCOVER_GROUPS.flatMap(([, rows]) => rows)

// The rows whose door is a shell panel: those are the ones that need a back of ours (see below).
export const PANEL_ROWS = ['plugins', 'schedules']

export function DiscoverPage({ useUi, actions }) {
  const open = useUi(value => value.discover === true)
  const mobile = useMobile()
  const paneLeft = usePaneLeft()
  useEscape(() => actions.closeDiscover())
  if (!open || !mobile) return null
  return createPortal(h('div', { className: 'bt-discover', role: 'region', 'aria-label': t('Discover'), style: { left: paneLeft } },
    h('div', { className: 'bt-discover-head' }, h('h2', { className: 'bt-discover-title' }, t('Discover'))),
    h('div', { className: 'bt-discover-list', role: 'list' }, DISCOVER_GROUPS.map(([heading, rows]) => h('div', {
      key: heading, className: 'bt-discover-group', role: 'presentation',
    },
    h('div', { className: 'bt-discover-grouphead' }, t(heading)),
    rows.map(([key, label, Icon]) => h('div', {
      key, className: 'bt-discover-card', role: 'presentation',
    },
    h('button', {
      type: 'button', className: 'bt-discover-row', 'data-row': key,
      onClick: () => actions.openDiscoverRow(key),
    },
    h('span', { className: 'bt-discover-icon', 'aria-hidden': true }, h(Icon)),
    h('span', { className: 'bt-discover-name' }, t(label)),
    h('span', { className: 'bt-discover-go', 'aria-hidden': true }, h(ChevronRightIcon))))))))), document.body)
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
export const DISCOVER_CSS = `
html[data-bt-mobile] .bt-discover{position:fixed;inset:0;z-index:79;display:flex;flex-direction:column;box-sizing:border-box;padding:var(--bt-fade-h,calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 10px)) 12px calc(var(--bt-nav-h) + var(--bt-nav-gap));background:var(--bt-sidebar);color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
html[data-bt-mobile][data-bt-keyboard] .bt-discover{padding-bottom:12px}
html[data-bt-mobile] .bt-discover-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px}
html[data-bt-mobile] .bt-discover-title{margin:0;font-size:20px;line-height:28px;font-weight:600}
html[data-bt-mobile] .bt-discover-list{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:16px;overflow-y:auto;overscroll-behavior:contain}
/* A group is a heading and the cards under it: 8px between the cards, the list's own 16px between
   two groups, so the heading reads as belonging to what follows rather than to what came before. */
html[data-bt-mobile] .bt-discover-group{display:flex;flex-direction:column;gap:8px}
html[data-bt-mobile] .bt-discover-grouphead{padding:0 4px;color:var(--bt-ink-3);font-size:13px;line-height:18px}
/* A row is its own card: the same surface the composer's card and the floating controls wear, from
   the one shadow token. The list's 8px gap is the space between two cards, and the row clips its
   own tint at the card's corners. */
html[data-bt-mobile] .bt-discover-card{flex:none;overflow:hidden;border-radius:16px;background:var(--bt-card);box-shadow:var(--bt-float-shadow)}
html[data-bt-mobile] .bt-discover-row{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 12px;border:0;border-radius:0;background:none;color:var(--bt-ink);font:inherit;font-size:15px;line-height:21px;text-align:left;cursor:pointer;box-sizing:border-box}
html[data-bt-mobile] .bt-discover-row:hover{background:var(--bt-hover)}
html[data-bt-mobile] .bt-discover-icon{flex:none;display:inline-flex;color:var(--bt-ink)}
html[data-bt-mobile] .bt-discover-icon svg{width:20px;height:20px}
html[data-bt-mobile] .bt-discover-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-bt-mobile] .bt-discover-go{flex:none;display:inline-flex;color:var(--bt-ink-3)}
/* The second-level strip: the height the panel's column reserves for it. */
html[data-bt-mobile] .bt-subback{position:fixed;top:0;left:0;right:0;height:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 56px);box-sizing:border-box;padding:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) 12px 0;z-index:96;display:flex;align-items:center;background:var(--bt-main);pointer-events:none}
html[data-bt-mobile] .bt-subback-btn{pointer-events:auto;flex:none;width:48px;height:48px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--bt-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
html[data-bt-mobile] .bt-subback-btn:hover{background:var(--bt-hover)}
html[data-bt-mobile] .bt-subback-btn>svg{width:22px;height:22px}
`
