// Icons for the shell's own surfaces. What is not drawn here is copied, at the foot of the
// file: the deliverables screens draw Lucide's glyphs, and the phone's bottom bar draws
// Ionicons', each with its own notice.
/*! Lucide (ISC) · path data from lucide-static v1.57.0 */
import { createElement as h } from 'react'

export function PlusIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', 'aria-hidden': true }, h('path', { d: 'M10 3.5v13M3.5 10h13', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
}
export function SearchIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', 'aria-hidden': true }, h('circle', { cx: 8.5, cy: 8.5, r: 5.5, stroke: 'currentColor', strokeWidth: 1.6, fill: 'none' }), h('path', { d: 'M13 13l4 4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
}
export function MenuIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', 'aria-hidden': true },
    h('path', { d: 'M4 6h12M4 10h12M4 14h8' }))
}
export function PeopleIcon() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': true },
    h('circle', { cx: 7.5, cy: 7, r: 3 }), h('path', { d: 'M2 16.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5' }),
    h('path', { d: 'M13 4.3a3 3 0 0 1 0 5.4M15 12.4c1.6.6 2.6 2 3 4.1' }))
}
export function ArrowUpIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', 'aria-hidden': true }, h('path', { d: 'M10 16V4M5 9l5-5 5 5', stroke: 'currentColor', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }))
}
export function MicIcon({ size = 16 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', 'aria-hidden': true },
    h('rect', { x: 7, y: 2.5, width: 6, height: 10, rx: 3, fill: 'currentColor', stroke: 'none' }),
    h('path', { d: 'M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5' }))
}
// The voice-chat glyph: five bars of a level meter.
export function WaveIcon({ size = 16 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': true },
    [[3, 7.5, 5], [6.5, 4.5, 11], [10, 2.5, 15], [13.5, 5.5, 9], [17, 8, 4]].map(([x, y, height]) => h('rect', { key: x, x: x - 1, y, width: 2, height, rx: 1 })))
}

export function ShareIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M10 12.5V3M6.5 6.5L10 3l3.5 3.5M4 11v4.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V11' }))
}
export function CloseIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', 'aria-hidden': true }, h('path', { d: 'M5 5l10 10M15 5L5 15', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
}

const CHEVRON_LEFT = 'M12.5 4.5L7 10l5.5 5.5'
export const ChevronLeftIcon = () => h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: CHEVRON_LEFT }))
export const ChevronRightIcon = () => h('svg', { width: 14, height: 14, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M7.5 4.5L13 10l-5.5 5.5' }))

const lineIcon = paths => function LineIcon() {
  return h('svg', { width: 15, height: 15, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    paths.map((d, index) => h('path', { key: index, d })))
}

// The classic cloud with a down arrow; `done` swaps the arrow for a check. The arrow
// is its own group so it can move while an update installs.
const CLOUD = 'M6.5 15.25H5.75a3.25 3.25 0 0 1-.55-6.45 4.75 4.75 0 0 1 9.2-1.1 3.75 3.75 0 0 1 .1 7.55H13.5'
export function CloudDownloadIcon({ done = false }) {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: CLOUD }),
    done
      ? h('path', { d: 'M7.75 13.25l1.75 1.75 3-3.25' })
      : h('g', { className: 'bt-cloud-arrow' }, h('path', { d: 'M10 9.75v7' }), h('path', { d: 'M7.75 14.5L10 16.75l2.25-2.25' })))
}
export const SmileIcon = lineIcon(['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'M7.3 11.6a3.4 3.4 0 0 0 5.4 0', 'M7.75 8.25h.01M12.25 8.25h.01'])
export const ReplyIcon = lineIcon(['M8 5L4 9l4 4', 'M4 9h7.5a4.5 4.5 0 0 1 4.5 4.5V15'])
export const DotsIcon = lineIcon(['M5 10h.01M10 10h.01M15 10h.01'])
// The phone bar's overflow glyph: three solid dots. The stroked DotsIcon above draws each
// mark as a 1.5-unit round cap, which at its 15px size is a ~1.1px pinprick — invisible on
// a phone — so the bar asks for its own, larger dots rather than restyling the shared icon.
export function DotsBoldIcon({ size = 18 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': true },
    [4.5, 10, 15.5].map(cx => h('circle', { key: cx, cx, cy: 10, r: 2 })))
}
export const SwitchIcon = lineIcon(['M4 7h9.5M10.5 3.5L14 7l-3.5 3.5', 'M16 13H6.5M9.5 9.5L6 13l3.5 3.5'])
const CHECK_PATHS = ['M4.5 10.5l3.5 3.5 7.5-8']
export const CheckIcon = lineIcon(CHECK_PATHS)
export const ArrowDownIcon = lineIcon(['M10 4v12', 'M5 11l5 5 5-5'])
export const DownloadIcon = lineIcon(['M10 3.5v9', 'M6.5 9.5L10 13l3.5-3.5', 'M4 16h12'])
export const GaugeIcon = lineIcon(['M3.5 13.5a6.5 6.5 0 1 1 13 0', 'M10 13.5l3-4', 'M10 13.5h.01'])
export const PlugIcon = lineIcon(['M7 3v4M13 3v4', 'M5 7h10v2.5a5 5 0 0 1-10 0z', 'M10 14.5V17'])
export const CalendarIcon = lineIcon(['M5.5 5h9A1.5 1.5 0 0 1 16 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-8A1.5 1.5 0 0 1 5.5 5z', 'M4 8.75h12', 'M7.25 3.5v3M12.75 3.5v3'])
export const ConnectorIcon = lineIcon(['M7 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', 'M18 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', 'M7 10h6'])
export const PaperclipIcon = lineIcon(['M15.5 9.5l-5.6 5.6a3.4 3.4 0 0 1-4.8-4.8l6.1-6.1a2.25 2.25 0 0 1 3.2 3.2l-6 6a1.1 1.1 0 0 1-1.6-1.6l5.5-5.5'])
export const ClockIcon = lineIcon(['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'M10 6.5V10l2.5 1.5'])
// Six broad, shallow teeth around a wide hub: it reads as a gear even at 15px.
export const GearIcon = lineIcon(['M10 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z', 'M7.85 4.4l.29-1.87a7.7 7.7 0 0 1 3.72 0l.29 1.87a6 6 0 0 1 1.63.94l1.76-.69a7.7 7.7 0 0 1 1.86 3.23l-1.47 1.18a6 6 0 0 1 0 1.88l1.47 1.18a7.7 7.7 0 0 1-1.86 3.23l-1.76-.69a6 6 0 0 1-1.63.94l-.29 1.87a7.7 7.7 0 0 1-3.72 0l-.29-1.87a6 6 0 0 1-1.63-.94l-1.76.69a7.7 7.7 0 0 1-1.86-3.23l1.47-1.18a6 6 0 0 1 0-1.88L2.6 7.88a7.7 7.7 0 0 1 1.86-3.23l1.76.69a6 6 0 0 1 1.63-.94z'])
export const PinIcon = lineIcon(['M12.5 3l4.5 4.5-3 1.5-2.5 2.5.5 3.5-1.5 1.5L7 13 3.5 16.5', 'M7 13l-3.5-3.5L5 8l3.5.5L11 6l1.5-3'])
// The mark beside a pinned chat's name: a solid pushpin, head up and to the right.
export function PinMarkIcon() {
  return h('svg', { width: 12, height: 12, viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': true },
    h('g', { transform: 'rotate(45 10 10)' },
      h('path', { d: 'M8 2.5h4a.9.9 0 0 1 0 1.8h-.4v4.1c0 1.4 1.1 2.6 2.6 3.1l.7.3v1.5H5.1v-1.5l.7-.3c1.5-.5 2.6-1.7 2.6-3.1V4.3H8a.9.9 0 0 1 0-1.8z' }),
      h('path', { d: 'M9.35 13.3h1.3v3.6L10 18l-.65-1.1z' })))
}
export const UnreadIcon = lineIcon(['M10 3.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13.5h12L14.5 11V8', 'M8.3 16a1.8 1.8 0 0 0 3.4 0', 'M15.5 3.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z'])
export const PencilIcon = lineIcon(['M9 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3', 'M14.3 3.7a1.6 1.6 0 0 1 2.3 2.3L10.5 12l-3 .8.8-3z'])
export const InfoIcon = lineIcon(['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'M10 9.25v4', 'M10 6.6h.01'])
export const StarLineIcon = lineIcon(['M10 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.7z'])
const COPY_PATHS = ['M8.5 7h6A1.5 1.5 0 0 1 16 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 14.5v-6A1.5 1.5 0 0 1 8.5 7z', 'M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4H13']
export const CopyIcon = lineIcon(COPY_PATHS)
export const HideIcon = lineIcon(['M3 3l14 14', 'M8.6 5.2A7.6 7.6 0 0 1 10 5c4.5 0 7 5 7 5a12.6 12.6 0 0 1-2 2.6M12.2 14.5A6.8 6.8 0 0 1 10 15c-4.5 0-7-5-7-5a12.4 12.4 0 0 1 3-3.4', 'M8.5 8.5a2 2 0 0 0 3 3'])
export const TrashIcon = lineIcon(['M3.5 5.5h13', 'M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5', 'M5 5.5l.7 10A1.5 1.5 0 0 0 7.2 17h5.6a1.5 1.5 0 0 0 1.5-1.5l.7-10', 'M8.5 9v4.5M11.5 9v4.5'])
export const DuplicateIcon = lineIcon(['M7 7h8.5v9.5H7z', 'M4.5 13V3.5H13', 'M11.25 9.5v4.5M9 11.75h4.5'])
export const SlidersIcon = lineIcon(['M4 6.5h5M12.5 6.5H16M4 13.5h4M11.5 13.5H16', 'M10.5 4.5v4M9.5 11.5v4'])
// A notebook with a ribbon: what a Bot remembers.
export const MemoryIcon = lineIcon(['M5.5 3.5h8A1.5 1.5 0 0 1 15 5v10a1.5 1.5 0 0 1-1.5 1.5h-8z', 'M5.5 3.5v13', 'M8.5 7.5h3.5M8.5 10.5h2.5', 'M12 3.5v4l1-.8 1 .8'])
export const FolderIcon = lineIcon(['M3 6A1.5 1.5 0 0 1 4.5 4.5h3.2l1.8 2h6A1.5 1.5 0 0 1 17 8v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z'])
// Defined here, after the icons: SettingsDialog only reads them at render time.
// Two speech bubbles, the back one peeking out: a group chat.
export const ChatsIcon = lineIcon(['M3.5 5.5A1.5 1.5 0 0 1 5 4h7a1.5 1.5 0 0 1 1.5 1.5V10A1.5 1.5 0 0 1 12 11.5H8L5 14v-2.5A1.5 1.5 0 0 1 3.5 10z', 'M13.5 7.5H15A1.5 1.5 0 0 1 16.5 9v4.5A1.5 1.5 0 0 1 15 15v2l-2.5-2h-3A1.5 1.5 0 0 1 8 13.5V13'])
export const SETTINGS_ICONS = { general: GearIcon, bots: PeopleIcon, groups: ChatsIcon, usage: GaugeIcon }

// --- Lucide (ISC) · path data from lucide-static v1.57.0 -------------------
// Copied glyph data, not drawings of ours. Lucide's grid is the reason to take it: one
// 24x24 viewBox, one round cap and join, so every glyph shares a corner and a set of
// proportions instead of each being a shape somebody eyeballed. The data below is byte-for-
// byte what lucide-static ships; the boxes and the stroke are ours.
//
// One stroke, in pixels: the shell's own controls draw 1.5px on screen, and Lucide's own 2 units
// would scale with the box (3.5px in the 42px box these first wore). So it is pinned per shape --
// vector-effect is not an inherited property, and putting it on the frame around the glyph would
// do nothing.
//
// One box, derived the same way for each glyph: a glyph's longest run of ink lands on the 13px
// the pill's own icons measure (a screenshot of that pill, not a canvas: 12-13px of ink at
// 1.2-1.5px of stroke). ink = units * box / 24 + stroke, so the boxes differ where the glyphs do:
// the chevron's 12 units of height want 23px, the ellipsis' 16-unit row 17px.
//
// The ellipsis works at that size for a reason worth keeping: its dots are outlined circles of
// r=1, and the hole left in one is 2 * box / 24 - stroke. At the 42px box these first wore that
// hole was 2px wide (three rings, not dots); at 17px it is negative -- the 1.5px stroke closes
// over the middle -- so the dots come out solid at every size we would actually draw.
//
// Lucide is ISC-licensed; its notice travels with its path data, in the form a bundler keeps:
/*! Lucide (ISC) · path data from lucide-static v1.57.0 */
const LUCIDE_STROKE = 1.5
const LUCIDE_CHEVRON_BOX = 23
const LUCIDE_ELLIPSIS_BOX = 17
const LUCIDE_MENU_BOX = 15
const lucideIcon = (children, box, stroke = LUCIDE_STROKE) => function LucideIcon() {
  return h('svg', {
    width: box, height: box, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }, children.map(([tag, attributes], index) => h(tag, { key: index, vectorEffect: 'non-scaling-stroke', ...attributes })))
}

// m15 18-6-6 6-6 -- 6x12 units, so a 23px box paints 7.3x13.0 of ink. The bar's back arrow.
export const LucideChevronLeftIcon = lucideIcon([['path', { d: 'm15 18-6-6 6-6' }]], LUCIDE_CHEVRON_BOX)
// Three r=1 circles, 16x2 units: a 17px box paints 2.9px dots in a 12.8px row, and at 17px the
// 1.5px stroke is wider than the circle's own diameter, so the dots come out solid. Both the bar
// and the card open their menu with this one glyph.
export const LucideEllipsisIcon = lucideIcon([
  ['circle', { cx: 12, cy: 12, r: 1 }],
  ['circle', { cx: 19, cy: 12, r: 1 }],
  ['circle', { cx: 5, cy: 12, r: 1 }],
], LUCIDE_ELLIPSIS_BOX)
// The three the exits menu draws, at the box the shell's menus draw their own icons in. The
// platform's Menu then pins every icon it is handed to its own 14px (Menu.module.css,
// .itemIcon svg), so these three are the platform's size to set -- the one thing still ours is
// the 1.5px stroke, which travels on the glyph.
export const LucideExternalLinkIcon = lucideIcon([
  ['path', { d: 'M15 3h6v6' }],
  ['path', { d: 'M10 14 21 3' }],
  ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
], LUCIDE_MENU_BOX)
export const LucideCopyIcon = lucideIcon([
  ['rect', { width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 }],
  ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
], LUCIDE_MENU_BOX)
export const LucideCheckIcon = lucideIcon([['path', { d: 'M20 6 9 17l-5-5' }]], LUCIDE_MENU_BOX)

// --- Ionicons (MIT) · artwork from ionicons v8.1.0 --------------------------------
// The four pages of the phone's bottom bar, in both weights: the outline while a page is
// not the current one and the solid drawing while it is. The user's screenshots are this
// set -- a solid bubble with its tail at the lower left, a compass, a round-headed figure --
// and Ionicons publishes every glyph both ways, which is what the two states need. (The
// platform's own pack is a different family and ships ten Filled glyphs, none of them a page
// of ours; Fluent stood in for one round before the screenshots were readable as Ionicons.)
//
// A pair is two files: `X-outline.svg` strokes its path on the 512 grid and `X.svg` fills
// one, so the frame carries the fill colour and each shape keeps the attributes its own file
// gives it. Nothing is pinned: Ionicons' 32 units of stroke on this grid render 1.5px at the
// 24px box the bar draws, which is the weight the rest of the skin's glyphs use.
//
// Ionicons is MIT-licensed; its notice travels with its artwork, in the form a bundler keeps:
/*! Ionicons (MIT) · Copyright (c) 2015-present Ionic (http://ionic.io/) · ionicons v8.1.0 */
const IONICON_BOX = 24
const ionicon = (children, box = IONICON_BOX, grid = '0 0 512 512') => function Ionicon() {
  return h('svg', { width: box, height: box, viewBox: grid, fill: 'currentColor', 'aria-hidden': true },
    children.map(([tag, attributes], index) => h(tag, { key: index, ...attributes })))
}
// 任务: the bubble whose tail leaves at the lower left, as the screenshot draws it.
export const IonChatbubbleIcon = ionicon([
  ['path', { d: 'M87.49 380c1.19-4.38-1.44-10.47-3.95-14.86a45 45 0 0 0-2.54-3.8 199.8 199.8 0 0 1-33-110C47.65 139.09 140.73 48 255.83 48 356.21 48 440 117.54 459.58 209.85a199 199 0 0 1 4.42 41.64c0 112.41-89.49 204.93-204.59 204.93-18.3 0-43-4.6-56.47-8.37s-26.92-8.77-30.39-10.11a31.1 31.1 0 0 0-11.12-2.07 30.7 30.7 0 0 0-12.09 2.43l-67.83 24.48a16 16 0 0 1-4.67 1.22 9.6 9.6 0 0 1-9.57-9.74 16 16 0 0 1 .6-3.29Z', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeMiterlimit: 10, strokeWidth: '32px' }],
])
export const IonChatbubbleFilledIcon = ionicon([
  ['path', { d: 'M76.83 480a25.69 25.69 0 0 1-25.57-25.74 29.1 29.1 0 0 1 1.2-7.63L70.88 380c.77-2.46-.1-4.94-1.23-6.9l-.22-.4c-.08-.13-.46-.66-.73-1.05s-.58-.81-.86-1.22l-.19-.27A215.66 215.66 0 0 1 32 251.37c-.18-57.59 22.35-112 63.46-153.28C138 55.47 194.9 32 255.82 32A227.4 227.4 0 0 1 398 81.84c39.45 31.75 66.87 76 77.21 124.68a213.5 213.5 0 0 1 4.78 45c0 58.93-22.64 114.28-63.76 155.87-41.48 42-97.18 65.06-156.83 65.06-21 0-47.87-5.36-60.77-9-15.52-4.34-30.23-10-31.85-10.6a15.1 15.1 0 0 0-5.37-1 14.75 14.75 0 0 0-5.8 1.15l-.85.33-67.48 24.38A29.4 29.4 0 0 1 76.83 480m10.65-100' }],
])
// 发现: the compass the screenshot draws.
export const IonCompassIcon = ionicon([
  ['path', { d: 'M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192Z', fill: 'none', stroke: 'currentColor', strokeMiterlimit: 10, strokeWidth: '32px' }],
  ['path', { d: 'm350.67 150.93-117.2 46.88a64 64 0 0 0-35.66 35.66l-46.88 117.2a8 8 0 0 0 10.4 10.4l117.2-46.88a64 64 0 0 0 35.66-35.66l46.88-117.2a8 8 0 0 0-10.4-10.4M256 280a24 24 0 1 1 24-24 24 24 0 0 1-24 24' }],
])
export const IonCompassFilledIcon = ionicon([
  ['circle', { cx: 256, cy: 256, r: 24 }],
  ['path', { d: 'M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48m105.07 113.33-46.88 117.2a64 64 0 0 1-35.66 35.66l-117.2 46.88a8 8 0 0 1-10.4-10.4l46.88-117.2a64 64 0 0 1 35.66-35.66l117.2-46.88a8 8 0 0 1 10.4 10.4' }],
])
// 我的: the round-headed figure the screenshot draws.
export const IonPersonIcon = ionicon([
  ['path', { d: 'M344 144c-3.92 52.87-44 96-88 96s-84.15-43.12-88-96c-4-55 35-96 88-96s92 42 88 96', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '32px' }],
  ['path', { d: 'M256 304c-87 0-175.3 48-191.64 138.6C62.39 453.52 68.57 464 80 464h352c11.44 0 17.62-10.48 15.65-21.4C431.3 352 343 304 256 304Z', fill: 'none', stroke: 'currentColor', strokeMiterlimit: 10, strokeWidth: '32px' }],
])
export const IonPersonFilledIcon = ionicon([
  ['path', { d: 'M332.64 64.58C313.18 43.57 286 32 256 32c-30.16 0-57.43 11.5-76.8 32.38-19.58 21.11-29.12 49.8-26.88 80.78C156.76 206.28 203.27 256 256 256s99.16-49.71 103.67-110.82c2.27-30.7-7.33-59.33-27.03-80.6M432 480H80a31 31 0 0 1-24.2-11.13c-6.5-7.77-9.12-18.38-7.18-29.11C57.06 392.94 83.4 353.61 124.8 326c36.78-24.51 83.37-38 131.2-38s94.42 13.5 131.2 38c41.4 27.6 67.74 66.93 76.18 113.75 1.94 10.73-.68 21.34-7.18 29.11A31 31 0 0 1 432 480' }],
])

// --- Fluent System Icons (MIT) · artwork from @fluentui/svg-icons v1.1.344 --------------
// One glyph only: the Bot head the 伙伴 page wears. The user asked that page for the icon
// their app draws for an agent, and the platform's own product set has that shape --
// IconAgentPresetOutlineRegular -- but outlines only, with no Filled sibling anywhere in the
// pack (its ten Filled glyphs are CheckCircle, Close, CloseCircle, Dislike, Like, Nowrap,
// Pin, Stop, TriangleRight, Wrap). Fluent does publish the head both ways, which is what the
// selected/unselected state needs, so it stands in exactly as Lead directed.
//
// This is the bar's second family, and the exception is deliberate: the other three pages
// take Ionicons because that is what the user's screenshots draw, and nothing in Ionicons is
// a robot. Both are 24-grid artwork, and the states read the same way -- one shape at two
// weights -- so the bar stays coherent even though the files come from two places.
/*! Fluent System Icons (MIT) · Copyright (c) 2020 Microsoft Corporation · @fluentui/svg-icons v1.1.344 */
export const FluentBotIcon = ionicon([['path', { d: 'M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zm0 1.5H6.25a.75.75 0 0 0-.75.75v.9c0 .66.29 1.29.79 1.71Q8.17 20.5 12 20.5q3.83-.01 5.72-1.64c.5-.43.78-1.05.78-1.7v-.91a.75.75 0 0 0-.75-.75M11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zm4.35 3h-8.5a.75.75 0 0 0-.75.75v4.5c0 .42.34.75.75.75h8.5c.41 0 .75-.33.75-.75v-4.5a.75.75 0 0 0-.75-.75m-6.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5' }]], 24, '0 0 24 24')
export const FluentBotFilledIcon = ionicon([['path', { d: 'M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zM11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zM9.75 6.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5' }]], 24, '0 0 24 24')
