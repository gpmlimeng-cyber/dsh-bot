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

// --- Phosphor (MIT) · artwork from @phosphor-icons/core v2.1.1 --------------------------
// The four pages of the phone's bottom bar, each in both weights: `assets/regular/` while
// the page is not the current one and `assets/fill/` while it is. Phosphor publishes every
// glyph both ways, which is what the state needs -- the user's screenshots draw exactly that
// (an outlined tab beside a solid one). It is also one family for all four pages, so the bar
// is not a mix: the platform's own pack cannot supply a filled page of ours at all, and
// Ionicons and Fluent each lacked one of the four shapes.
//
// The regular weight is drawn as filled artwork too (a ring is a path with a hole), so the
// frame carries the colour and there is no stroke to pin: at a 24px box the 16 units of ring
// on Phosphor's 256 grid render 1.5px, the weight the rest of the skin's glyphs use.
//
// Phosphor is MIT-licensed; its notice travels with its artwork, in the form a bundler keeps:
/*! Phosphor Icons (MIT) · Copyright (c) 2023 Phosphor Icons · @phosphor-icons/core v2.1.1 */
const PHOSPHOR_BOX = 24
const phosphorIcon = (d, box = PHOSPHOR_BOX) => function PhosphorIcon() {
  return h('svg', { width: box, height: box, viewBox: '0 0 256 256', fill: 'currentColor', 'aria-hidden': true }, h('path', { d }))
}

// 任务: the rounded bubble with its tail at the lower left, as the screenshots draw it.
export const PhosphorChatIcon = phosphorIcon('M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216Z')
export const PhosphorChatFilledIcon = phosphorIcon('M232,64V192a16,16,0,0,1-16,16H83l-32.6,28.16-.09.07A15.89,15.89,0,0,1,40,240a16.05,16.05,0,0,1-6.79-1.52A15.84,15.84,0,0,1,24,224V64A16,16,0,0,1,40,48H216A16,16,0,0,1,232,64Z')
// 伙伴: the agent's own icon -- the user asked this page for whatever their app draws for one.
export const PhosphorRobotIcon = phosphorIcon('M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-52-56H92a28,28,0,0,0,0,56h72a28,28,0,0,0,0-56Zm-24,16v24H116V152ZM80,164a12,12,0,0,1,12-12h8v24H92A12,12,0,0,1,80,164Zm84,12h-8V152h8a12,12,0,0,1,0,24ZM72,108a12,12,0,1,1,12,12A12,12,0,0,1,72,108Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,108Z')
export const PhosphorRobotFilledIcon = phosphorIcon('M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48ZM172,96a12,12,0,1,1-12,12A12,12,0,0,1,172,96ZM96,184H80a16,16,0,0,1,0-32H96ZM84,120a12,12,0,1,1,12-12A12,12,0,0,1,84,120Zm60,64H112V152h32Zm32,0H160V152h16a16,16,0,0,1,0,32Z')
// 发现: the compass the screenshots draw.
export const PhosphorCompassIcon = phosphorIcon('M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z')
export const PhosphorCompassFilledIcon = phosphorIcon('M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm51.58,57.79-32,64a4.08,4.08,0,0,1-1.79,1.79l-64,32a4,4,0,0,1-5.37-5.37l32-64a4.08,4.08,0,0,1,1.79-1.79l64-32A4,4,0,0,1,179.58,81.79Z')
// 我的: the round-headed figure the screenshots draw.
export const PhosphorUserIcon = phosphorIcon('M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z')
export const PhosphorUserFilledIcon = phosphorIcon('M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z')
