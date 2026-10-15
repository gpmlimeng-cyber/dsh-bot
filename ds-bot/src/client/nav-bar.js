// The phone's bottom navigation: four pages under the thumb, drawn only in the mobile
// layout and only upright (mobile.js publishes <html data-bt-portrait> for exactly that
// pair). A phone held sideways keeps its ~250px of conversation height instead.
//
// The bar is a navigator over two different surfaces, never a second copy of either:
//
//   任务 (Tasks)    the conversation. It is the shell's main slot with no panel selected,
//                   so `layout.selectPanel(null)` is the whole of it.
//   伙伴 (Peers)    the Bot list — the sidebar's own wide list, which on an upright phone
//                   is the full-page form of the drawer the hamburger used to open. Same
//                   component, same state (`ui.mobileNav`); only its box differs, and the
//                   stylesheet below is that difference.
//   发现 (Discover) the plugin manager's main panel, id "plugins" (dsh-client-ui-plugin-
//                   manager). It is not drawn when the shell has no such panel registered:
//                   `layout.selectPanel` throws on an unknown id, so the tab may not exist
//                   without the check the nav source makes.
//   我的 (Me)        this plugin's Settings layer, which the mobile skin already draws as
//                   a full screen (styles.js, the data-bt-mobile .bt-settings block).
//
// Two of the four are the shell's main panel and two are this plugin's overlays, so the
// bar reads both sources (nav-bar's `useNav` for the panel, `useUi` for the overlays) and
// never keeps a selection of its own. Every tab closes the other overlays before it acts:
// two pages must never stack.
import { createElement as h } from 'react'
import { createPortal } from 'react-dom'
import {
  IonChatbubbleFilledIcon, IonChatbubbleIcon,
  IonCompassFilledIcon, IonCompassIcon,
  IonPeopleFilledIcon, IonPeopleIcon,
  IonPersonFilledIcon, IonPersonIcon,
} from './icons.js'
import { useMobile, usePortrait } from './mobile.js'
import { t } from './i18n.js'

// Order on screen, left to right: the tasks first. The labels are the accessible names —
// a real-device UI dump reads them, and so does a screen reader — and they are translated
// at render time like every other string here, so the bar names its pages in the language
// the rest of the interface is in (Chinese must not be hard-coded into the labels).
//
// Each page carries two drawings of one shape, from Ionicons (icons.js): the outline while
// the page is not the current one and the solid one while it is, which is the state the user
// asked for and the reason the bar never thickens a stroke to fake it. 任务 takes its
// chatbubble (a round bubble whose tail leaves at the lower left -- the shape the user's
// screenshots draw), 发现 its compass and 我的 its round-headed person, both also from those
// screenshots; 伙伴 takes the same set's people, since that screenshot's second tab is a
// scheduled-tasks page with no shape of its own to copy.
const TABS = [
  ['tasks', 'Tasks', IonChatbubbleIcon, IonChatbubbleFilledIcon],
  ['peers', 'Peers', IonPeopleIcon, IonPeopleFilledIcon],
  ['plugins', 'Discover', IonCompassIcon, IonCompassFilledIcon],
  ['me', 'Me', IonPersonIcon, IonPersonFilledIcon],
]

export function BottomNav({ useUi, useNav, actions }) {
  const ui = useUi(value => value)
  const nav = useNav(value => value)
  const mobile = useMobile()
  const portrait = usePortrait()
  if (!mobile || !portrait) return null
  // Exactly one tab is current, and it is read rather than remembered: Settings and the
  // peers page are this plugin's own overlays and win over the page behind them; below
  // them the shell's panel decides. A main panel that is neither the conversation nor
  // "plugins" (the shell's scheduled-tasks page, opened from its own list) leaves every
  // tab unlit rather than claiming the conversation is on screen.
  const active = ui.settings ? 'me'
    : ui.mobileNav ? 'peers'
      : nav.panel === 'plugins' ? 'plugins'
        : nav.panel === null ? 'tasks' : null
  const go = (id) => {
    // The page already on screen is left where it is: a tab bar picks a page, and tapping
    // the one you are on does not navigate (the app the user copied behaves that way, and
    // the exits for a page are the other three tabs).
    if (active === id) return
    if (id === 'tasks') {
      actions.closeMobileNav()
      actions.closeSettings()
      actions.selectPanel(null)
      return
    }
    if (id === 'peers') {
      actions.closeSettings()
      actions.openMobileNav()
      return
    }
    if (id === 'plugins') {
      actions.closeMobileNav()
      actions.closeSettings()
      actions.selectPanel('plugins')
      return
    }
    actions.closeMobileNav()
    actions.openSettings('general')
  }
  return createPortal(h('nav', { className: 'bt-nav', 'aria-label': t('Pages') },
    TABS.filter(([id]) => id !== 'plugins' || nav.plugins).map(([id, label, Icon, IconFilled]) => h('button', {
      key: id, type: 'button', className: 'bt-nav-tab',
      'data-active': active === id || undefined,
      // Which drawing is on screen, for a real-device dump: the two states differ in the
      // path, and a reader of the tree should not have to parse the SVG to tell them apart.
      'data-icon': active === id ? 'filled' : 'outline',
      'aria-label': t(label), 'aria-current': active === id ? 'page' : undefined,
      onClick: () => go(id),
    },
    h(active === id ? IconFilled : Icon),
    h('span', { className: 'bt-nav-tab-text', 'aria-hidden': true }, t(label))))), document.body)
}

// The bar's own box, the height it takes from the pages under it, and the rules that turn
// the phone's drawer into the peers page. Every rule is gated on the same pair the
// component reads, so nothing here can reach the desktop or a phone held sideways.
//
// The 56px is declared once, as --bt-nav-h: the bar's height and the three pages that give
// it back their foot all read the same token, so a later change to the height cannot move
// one and leave the others behind. --bt-nav-gap is the same idea for the device's own
// bottom inset, and it takes the same pair the platform's own full-bleed layers take
// (@dsh-android/dsh-client-ui-responsive: composer-insets and the drawer's foot both use
// `max(env(safe-area-inset-bottom), var(--dsh-android-system-bottom))`, which is what
// stopped the settings entry landing on the gesture pill, apk #153). On Android
// edge-to-edge env(safe-area-inset-bottom) is 0 and the shell's variable carries the
// gesture bar, so a bar that read only env() would sit under it. The soft keyboard's own
// inset (--dsh-android-ime-bottom) is deliberately NOT in here: whether the bar should
// ride above the keyboard is a product decision, and it is being measured on the device
// before anything is written for it.
export const NAV_CSS = `
html[data-bt-mobile][data-bt-portrait]{--bt-nav-h:56px;--bt-nav-gap:max(env(safe-area-inset-bottom,0px),var(--dsh-android-system-bottom,0px))}
/* The bar. 56px of page plus the gesture bar, and no line and no shadow above it: the
   user asked for the bar the screenshot draws, which separates itself with its surface
   alone -- and that surface is the page's own colour (--bt-page, sampled from the same
   screenshot: page #f8f8f8, bar #f8f8f8, cards white). Nothing scrolls under this bar
   anyway: the conversation column, the peers page and the Settings screen all give it its
   56px back, so there is nothing for a frost to show through. */
html[data-bt-mobile][data-bt-portrait] .bt-nav{position:fixed;left:0;right:0;bottom:0;z-index:95;display:flex;box-sizing:border-box;height:calc(var(--bt-nav-h) + var(--bt-nav-gap));padding-bottom:var(--bt-nav-gap);background:var(--bt-page);color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
/* One tab: the glyph over its name, both centred. The touch target is the whole cell, so
   it is at least the bar's height wide whatever the label's length. */
html[data-bt-mobile][data-bt-portrait] .bt-nav-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0;border:0;background:none;color:var(--bt-ink-3);font-family:inherit;font-size:11px;line-height:14px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .12s ease}
/* The drawings carry their own 24px box (their grid is Ionicons' 512, icons.js), so nothing
   here sizes them; only the flex row's power to squeeze them is taken away. */
html[data-bt-mobile][data-bt-portrait] .bt-nav-tab svg{flex:none}
html[data-bt-mobile][data-bt-portrait] .bt-nav-tab[data-active]{color:var(--bt-ink)}
/* The selected page is the ink of the tab bar's own text at its heavier weight, not the
   accent: the screenshot the user asked for draws its selected page in black and its
   unselected ones in a light grey, and an accent-blue tab beside a black one would read as
   two different states. --bt-ink is that black, and follows the theme in the dark one. */
html[data-bt-mobile][data-bt-portrait] .bt-nav-tab[data-active] .bt-nav-tab-text{font-weight:600}
html[data-bt-mobile][data-bt-portrait] .bt-nav-tab-text{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The conversation column gives the bar its height back. centerCol is a stretched grid
   item with overflow:hidden, so its own padding is what shortens the column: the
   transcript scroller and the composer ride up together, and nothing sits under the bar.
   The same selector already carries the status bar's padding-top (styles.js:969). */
html[data-bt-mobile][data-bt-portrait] [data-dsh-frame]>[class*="centerCol"]{padding-bottom:calc(var(--bt-nav-h) + var(--bt-nav-gap))!important}
/* Settings is one of the four pages, so the bar stays over it — and the layer stops at
   the bar's top edge instead, which is what keeps its last rows reachable. */
html[data-bt-mobile][data-bt-portrait] .bt-settings-layer{bottom:calc(var(--bt-nav-h) + var(--bt-nav-gap))}
/* Over the pages that are not tabs the bar steps out of the way, the same set the top bar
   hides over (styles.js, the bt-pane/bt-panel/bt-mem-layer/bt-palette-layer rule) minus
   the two that ARE tabs. */
html[data-bt-mobile][data-bt-portrait] body:has(.bt-pane) .bt-nav,
html[data-bt-mobile][data-bt-portrait] body:has(.bt-panel) .bt-nav,
html[data-bt-mobile][data-bt-portrait] body:has(.bt-mem-layer) .bt-nav,
html[data-bt-mobile][data-bt-portrait] body:has(.bt-palette-layer) .bt-nav{display:none}
/* 伙伴 is a page: the same list fills the screen — no scrim to tap, no shadow, no border
   — and it leaves the bar's height at its own foot. The top row starts at the page's own
   edge: the 52px that used to clear the floating hamburger has nothing to clear now.
   The page also starts at the screen's top edge (top:0) and carries the status bar's inset
   in its own padding, rather than starting below it: with the floating bar hidden on this
   page, the band above the page showed the conversation behind it — the seam the user
   reported — and the inset plus the base rule's own 10px puts the top row exactly where it
   was. The 12px side padding comes from the base rule and is left alone. */
html[data-bt-mobile][data-bt-portrait] .bt-side.bt-rail{top:0;padding-top:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) + 10px);width:100%;padding-bottom:calc(var(--bt-nav-h) + var(--bt-nav-gap));border-right:0;box-shadow:none}
html[data-bt-mobile][data-bt-portrait] .bt-side.bt-rail[data-mobile-open] .bt-side-top{padding-left:0}
html[data-bt-mobile][data-bt-portrait] .bt-mobile-scrim{display:none}
/* The hamburger goes with the drawer: the 伙伴 tab is what opens the list now, and two
   entries to one page is the duplication this replaces. It is hidden rather than removed
   from the flow — the bar centres its three tracks, and taking the box away would slide
   the pill off the screen's centre. The whole bar goes while the peers page is up: that
   page carries its own top row, and the pill belongs to the conversation behind it. */
html[data-bt-mobile][data-bt-portrait] .bt-mobile-nav{opacity:0;visibility:hidden;pointer-events:none}
html[data-bt-mobile][data-bt-portrait] body:has(.bt-side.bt-rail[data-mobile-open]) .bt-mobile-bar{display:none}
/* A popup menu goes over the bar, not under it. The shell's menus clamp themselves to the
   viewport (context-menu.js: innerHeight - 8), which knows nothing about a 56px bar, so a
   long-press on one of the last rows would leave its lower items behind the bar — the bar
   is on top and takes the taps there, so they would simply be unreachable. The bar keeps
   95 over the pages it belongs to (the peers page 79, Settings 60) and only the transient
   menu outranks it. */
html[data-bt-mobile][data-bt-portrait] .bt-menu{z-index:96}
`
