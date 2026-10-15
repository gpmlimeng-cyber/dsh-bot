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

// --- Fluent System Icons (MIT) · artwork from @fluentui/svg-icons v1.1.344 ---------------
// The four pages of the phone's bottom bar, each in both weights: `*_regular` while the page
// is not the current one and `*_filled` while it is. Lead's call, and the pack agrees: this
// is the family the platform's own product icons come from (IconChatOutlineRegular and
// friends), @fluentui/svg-icons is MIT, and every one of these four is published both ways.
// It is one family for the bar, so nothing reads as a mix; Phosphor and Ionicons were tried
// as stand-ins along the way and their reference files are kept outside the repo.
//
// Both weights are filled geometry -- the regular file is the same drawing with its outline
// turned into a ring -- so the frame carries the colour and there is no stroke to pin: at a
// 24px box the ring this pack draws is 1.5px, the weight the rest of the skin's glyphs use.
//
// Fluent is MIT-licensed; its notice travels with its artwork, in the form a bundler keeps:
/*! Fluent System Icons (MIT) · Copyright (c) 2020 Microsoft Corporation · @fluentui/svg-icons v1.1.344 */
const FLUENT_NAV_BOX = 24
const fluentNavIcon = (d, box = FLUENT_NAV_BOX) => function FluentNavIcon() {
  return h('svg', { width: box, height: box, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }, h('path', { d }))
}

// 任务: the rounded bubble with its tail at the lower left, as the screenshots draw it.
export const FluentChatIcon = fluentNavIcon('M12 2a10 10 0 1 1-4.59 18.89L3.6 21.96a1.25 1.25 0 0 1-1.54-1.54l1.06-3.83A10 10 0 0 1 12 2m0 1.5a8.5 8.5 0 0 0-7.43 12.64l.15.27-1.1 3.98 3.98-1.11.27.15A8.5 8.5 0 1 0 12 3.5M8.75 13h4.5a.75.75 0 0 1 .1 1.5h-4.6a.75.75 0 0 1-.1-1.5zh4.5zm0-3.5h6.5a.75.75 0 0 1 .1 1.5h-6.6a.75.75 0 0 1-.1-1.5zh6.5z')
export const FluentChatFilledIcon = fluentNavIcon('M12 2a10 10 0 1 1-4.64 18.86l-4.3 1.12a.85.85 0 0 1-1.03-1.04l1.11-4.29A10 10 0 0 1 12 2m1.25 11h-4.6a.75.75 0 0 0 0 1.5h4.7a.75.75 0 0 0 0-1.5zm2-3.5h-6.6a.75.75 0 0 0 0 1.5h6.7a.75.75 0 0 0 0-1.5z')
// 伙伴: the agent's own icon -- the user asked this page for whatever their app draws for one.
export const FluentBotIcon = fluentNavIcon('M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zm0 1.5H6.25a.75.75 0 0 0-.75.75v.9c0 .66.29 1.29.79 1.71Q8.17 20.5 12 20.5q3.83-.01 5.72-1.64c.5-.43.78-1.05.78-1.7v-.91a.75.75 0 0 0-.75-.75M11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zm4.35 3h-8.5a.75.75 0 0 0-.75.75v4.5c0 .42.34.75.75.75h8.5c.41 0 .75-.33.75-.75v-4.5a.75.75 0 0 0-.75-.75m-6.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5')
export const FluentBotFilledIcon = fluentNavIcon('M17.75 14C19 14 20 15 20 16.25v.9c0 1.1-.47 2.14-1.3 2.85q-2.36 2-6.7 2t-6.7-2A3.8 3.8 0 0 1 4 17.16v-.91C4 15 5.01 14 6.25 14zM11.9 2h.1c.38 0 .7.28.74.65l.01.1v.75h3.5c1.24 0 2.25 1 2.25 2.25v4.5c0 1.25-1 2.25-2.25 2.25h-8.5c-1.24 0-2.25-1-2.25-2.25v-4.5c0-1.24 1-2.25 2.25-2.25h3.5v-.75c0-.38.28-.7.65-.74L12 2zM9.75 6.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5')
// 发现: the compass the screenshots draw.
export const FluentCompassIcon = fluentNavIcon('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20m0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M7.08 8.7c-.4-1.01.6-2.02 1.63-1.62l.2.09 3.75 1.42a4.8 4.8 0 0 1 2.75 2.75l.16.43 1.63 3.79a1.25 1.25 0 0 1-1.64 1.64l-3.76-1.61-.46-.18a4.8 4.8 0 0 1-2.75-2.75L7.21 9.03zm3 3.48c.32.8.95 1.44 1.74 1.78l.52.23 2.98 1.13-1.14-3-.22-.5a3.3 3.3 0 0 0-1.78-1.74L8.7 8.7z')
export const FluentCompassFilledIcon = fluentNavIcon('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20M8.56 7.43a.88.88 0 0 0-1.13 1.13l1.5 3.97a4.4 4.4 0 0 0 2.54 2.53l3.97 1.5a.88.88 0 0 0 1.13-1.12l-1.51-3.96a4.4 4.4 0 0 0-2.53-2.54z')
// 我的: the round-headed figure the screenshots draw.
export const FluentPersonIcon = fluentNavIcon('M17.75 14C19 14 20 15 20 16.25v.57c0 .9-.32 1.76-.9 2.44Q16.74 22.01 12 22q-4.74.01-7.1-2.74a3.8 3.8 0 0 1-.9-2.43v-.58C4 15 5.01 14 6.25 14zm0 1.5H6.25a.75.75 0 0 0-.75.75v.58c0 .53.2 1.05.54 1.46C7.3 19.76 9.26 20.5 12 20.5q4.09 0 5.96-2.21c.35-.41.54-.93.54-1.47v-.57a.75.75 0 0 0-.75-.75M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7')
export const FluentPersonFilledIcon = fluentNavIcon('M17.75 14C19 14 20 15 20 16.25v.92q-.01.88-.5 1.6Q17.13 22 12 22q-5.15 0-7.49-3.24a2.8 2.8 0 0 1-.5-1.6v-.91C4 15 5 14 6.24 14zM12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10')

// 发现 page's own four rows (discover-page.js): the Fluent artwork for each door, at the same
// 24-unit box the nav icons use. Copied from microsoft/fluentui-system-icons, 24px regular --
// 插件 'puzzle piece' (Fluent's current name for 扩展), 连接器 'plug connected', 定时任务 'clock',
// 用量 'data usage' -- rather than drawn here; the notice above covers this artwork too.
// 插件
export const FluentPuzzlePieceIcon = fluentNavIcon('M13 2.00423C14.5977 2.00423 15.9037 3.25315 15.994 4.82327L15.999 4.999L18.25 5C19.1172 5 19.837 5.63072 19.9758 6.45858L19.9942 6.60663L20 6.75018L19.9991 10.5012L18.0015 10.5013C17.2579 10.5013 16.6353 11.0445 16.5215 11.7403L16.5062 11.8725L16.5015 12.0013C16.5015 12.7449 17.0446 13.3675 17.7405 13.4813L17.8727 13.4965L18.0014 13.5013L19.9991 13.5012L20 17.2526C20 18.1708 19.2929 18.9238 18.3934 18.9968L18.2499 19.0026L15.999 19.002L15.9949 19.1747C15.9106 20.6305 14.7881 21.8078 13.3567 21.9774L13.1763 21.9933L13 21.9984C11.4023 21.9984 10.0963 20.7495 10.0051 19.1779L10 19.002L7.75 19.0026C6.88283 19.0026 6.16298 18.3719 6.02417 17.5443L6.0058 17.3963L6 17.2528L5.999 15.001L5.836 14.9962C4.38017 14.9119 3.20285 13.7894 3.03326 12.3581L3.01736 12.1776L3.01227 12.0013C3.01227 10.4036 4.26119 9.09765 5.83593 9.0064L5.999 9.001L6 6.75C6 5.88283 6.63072 5.16298 7.45831 5.02418L7.60631 5.0058L7.74981 5L9.999 4.999L10.0051 4.82796C10.0894 3.37214 11.2119 2.19482 12.6432 2.02523L12.8237 2.00933L13 2.00423ZM13 3.50423C12.2203 3.50423 11.5795 4.09912 11.5069 4.86039L11.5 5.00497L11.4985 6.49904L7.75 6.5C7.63165 6.5 7.53251 6.58223 7.5066 6.69279L7.5 6.75018L7.49909 10.5012L6.01227 10.5013C5.18384 10.5013 4.51227 11.1729 4.51227 12.0013C4.51227 12.781 5.10716 13.4218 5.86775 13.4944L6.01219 13.5013L7.49909 13.5012L7.5 17.2526C7.5 17.371 7.58223 17.4701 7.69261 17.496L7.7499 17.5026L11.4985 17.5021L11.5 18.9984C11.5 19.8268 12.1716 20.4984 13 20.4984C13.7797 20.4984 14.4204 19.9035 14.4931 19.1434L14.5 18.9991L14.4985 17.5021L18.25 17.5026C18.3683 17.5026 18.4675 17.4204 18.4934 17.3101L18.5 17.2528L18.499 15L17.9762 15.0009L17.7968 14.9944C16.2855 14.8922 15.0927 13.6769 15.0068 12.1532L15.0019 11.976L15.0084 11.7967C15.1105 10.2854 16.3258 9.09259 17.827 9.00631L18.0014 9.00131L18.499 9.001L18.5 6.75C18.5 6.65532 18.4474 6.57294 18.3697 6.5305L18.3072 6.5066L18.2498 6.5L14.4985 6.49904L14.5 5.00423C14.5 4.17581 13.8284 3.50423 13 3.50423Z')
// 连接器
export const FluentPlugConnectedIcon = fluentNavIcon('M19.4898 5.57084C20.2796 6.58684 20.7499 7.8635 20.7499 9.25001C20.7499 11.5333 19.4745 13.5187 17.5972 14.5327C16.9481 14.8833 16.1671 14.6672 15.6454 14.1455L9.85438 8.35451C9.33268 7.8328 9.1166 7.05181 9.46723 6.40265C10.4812 4.52541 12.4666 3.25001 14.7499 3.25001C16.1364 3.25001 17.4132 3.72034 18.4292 4.51016L20.7197 2.21967C21.0126 1.92678 21.4874 1.92678 21.7803 2.21967C22.0732 2.51256 22.0732 2.98744 21.7803 3.28033L19.4898 5.57084ZM17.4732 12.8331C18.5534 12.0106 19.2499 10.7106 19.2499 9.25001C19.2499 6.76473 17.2352 4.75001 14.7499 4.75001C13.2893 4.75001 11.9893 5.44648 11.1668 6.52671C10.9008 6.87593 10.9812 7.35998 11.2916 7.67036L16.3295 12.7083C16.6399 13.0187 17.124 13.0991 17.4732 12.8331ZM3.28033 21.7803L5.57072 19.4899C6.58673 20.2797 7.86339 20.75 9.24989 20.75C11.5332 20.75 13.5186 19.4746 14.5325 17.5973C14.8832 16.9482 14.6671 16.1672 14.1454 15.6455L8.35438 9.85448C7.83268 9.33278 7.05168 9.1167 6.40253 9.46733C4.52528 10.4813 3.24989 12.4667 3.24989 14.75C3.24989 16.1366 3.72022 17.4133 4.51005 18.4293L2.21967 20.7197C1.92678 21.0126 1.92678 21.4874 2.21967 21.7803C2.51256 22.0732 2.98744 22.0732 3.28033 21.7803ZM7.67023 11.2917L12.7082 16.3296C13.0186 16.64 13.0989 17.1241 12.833 17.4733C12.0105 18.5535 10.7105 19.25 9.24989 19.25C6.76461 19.25 4.74989 17.2353 4.74989 14.75C4.74989 13.2894 5.44635 11.9894 6.52659 11.1669C6.87581 10.9009 7.35985 10.9813 7.67023 11.2917Z')
// 定时任务
export const FluentClockIcon = fluentNavIcon('M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9931 6.64827C11.9435 6.28233 11.6295 6 11.25 6C10.836 6 10.5 6.336 10.5 6.75V12.75L10.5069 12.8517C10.5565 13.2177 10.8705 13.5 11.25 13.5H15.25L15.3517 13.4931C15.7177 13.4435 16 13.1295 16 12.75C16 12.336 15.664 12 15.25 12H12V6.75L11.9931 6.64827Z')
// 用量
export const FluentDataUsageIcon = fluentNavIcon('M18.25 2.99609C19.7688 2.99609 21 4.22731 21 5.74609V18.2461C21 19.7649 19.7688 20.9961 18.25 20.9961H5.75C4.23122 20.9961 3 19.7649 3 18.2461V5.74609C3 4.22731 4.23122 2.99609 5.75 2.99609H18.25ZM18.25 4.49609H5.75C5.05964 4.49609 4.5 5.05574 4.5 5.74609V18.2461C4.5 18.9364 5.05964 19.4961 5.75 19.4961H18.25C18.9404 19.4961 19.5 18.9364 19.5 18.2461V5.74609C19.5 5.05574 18.9404 4.49609 18.25 4.49609ZM7.75 8.9994C8.1297 8.9994 8.44349 9.28034 8.49315 9.64485L8.5 9.74618V16.2526C8.5 16.6651 8.16421 16.9994 7.75 16.9994C7.3703 16.9994 7.05651 16.7185 7.00685 16.354L7 16.2526V9.74618C7 9.33374 7.33579 8.9994 7.75 8.9994ZM16.25 6.9994C16.6297 6.9994 16.9435 7.27381 16.9932 7.62983L17 7.72881V16.27C17 16.6728 16.6642 16.9994 16.25 16.9994C15.8703 16.9994 15.5565 16.725 15.5068 16.369L15.5 16.27V7.72881C15.5 7.32597 15.8358 6.9994 16.25 6.9994ZM11.9751 11.9961C12.3458 11.9925 12.6549 12.2628 12.707 12.6168L12.7146 12.7153L12.75 16.2626C12.754 16.6637 12.4293 16.9921 12.0249 16.9962C11.6542 16.9997 11.3451 16.7295 11.293 16.3755L11.2854 16.277L11.25 12.7296C11.246 12.3285 11.5707 12.0001 11.9751 11.9961Z')
