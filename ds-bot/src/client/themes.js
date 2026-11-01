import { ACCENT_INKS, INKS, isHex, luminance } from './inks.js'
import { SHAPES, markupCache, maskCache } from './characters.js'
import { createSource } from './sources.js'
import { SA_FOLD_AT, isFoldAt } from '../shared/fold-at.js'

// -------------------------------------------------------------------------
// Themes. A theme names eight colors per mode; every `--bt-*` variable and the shell
// tokens derive from them, so a registered theme recolors the whole team UI.

const THEME_KEYS = ['bg', 'sidebar', 'bubble', 'card', 'text', 'user', 'userText', 'accent']
const THEMES = {
  deepseek: {
    label: 'DeepSeek',
    light: { bg: '#fcfcfc', sidebar: '#f7f7f7', bubble: '#eeeeee', card: '#ffffff', text: '#141414', user: '#070707', userText: '#fcfcfc', accent: '#4d6bfe' },
    dark: { bg: '#141414', sidebar: '#1b1b1b', bubble: '#262626', card: '#1f1f1f', text: '#f2f2f2', user: '#f2f2f2', userText: '#141414', accent: '#5b7bff' },
  },
  mono: {
    label: 'Mono',
    light: { bg: '#ffffff', sidebar: '#f9f9f9', bubble: '#f0f0f0', card: '#ffffff', text: '#0d0d0d', user: '#0d0d0d', userText: '#ffffff', accent: '#0d0d0d' },
    dark: { bg: '#0f0f0f', sidebar: '#171717', bubble: '#242424', card: '#1c1c1c', text: '#f4f4f4', user: '#f4f4f4', userText: '#0f0f0f', accent: '#f4f4f4' },
  },
  paper: {
    label: 'Paper',
    light: { bg: '#faf9f5', sidebar: '#f3f0e8', bubble: '#ebe7dc', card: '#ffffff', text: '#1f1e1b', user: '#2b2a26', userText: '#faf9f5', accent: '#d97757' },
    dark: { bg: '#1f1e1b', sidebar: '#262521', bubble: '#34322d', card: '#2a2925', text: '#f3f0e8', user: '#f3f0e8', userText: '#1f1e1b', accent: '#e08a6d' },
  },
  // The Codex palette as shipped in its own theme files: light is surface #ffffff with ink
  // #1a1c1f, dark is surface #181818 with ink #ffffff;
  // both carry accent #339cff and their own diff and skill inks. Its bot bubble is a
  // neutral grey, so the user's own turns take an accent-tinted surface to stay apart.
  codex: {
    label: 'Codex',
    light: { bg: '#ffffff', sidebar: '#f9f9fa', bubble: '#f3f4f6', card: '#ffffff', text: '#1a1c1f', user: '#e4eefb', userText: '#1a1c1f', accent: '#339cff' },
    dark: { bg: '#181818', sidebar: '#1f1f1f', bubble: '#262626', card: '#202020', text: '#ffffff', user: '#22303f', userText: '#ffffff', accent: '#339cff' },
    css: 'html body{--bt-green:#00a240;--bt-danger:#ba2623;--bt-skill:#924ff7}html body[data-ds-dark-theme]{--bt-green:#40c977;--bt-danger:#fa423e;--bt-skill:#ad7bf9}',
  },
  moonlight: {
    label: 'Moonlight',
    light: { bg: '#f7f9fc', sidebar: '#eef2f8', bubble: '#e5ebf5', card: '#ffffff', text: '#121826', user: '#1e3a8a', userText: '#ffffff', accent: '#1e86ff' },
    dark: { bg: '#0b1020', sidebar: '#10172a', bubble: '#1a2340', card: '#141c33', text: '#e8edf7', user: '#3b6fd8', userText: '#ffffff', accent: '#4f9dff' },
  },
}
// Text on the accent: near-black or white, whichever has the higher WCAG contrast.
// (L + .05)² > 1.05 × (L(#141414) + .05) is "dark ink reads better".
const DARK_INK = '#141414'
const accentInk = accent => ((luminance(accent) + 0.05) ** 2 > 1.05 * (luminance(DARK_INK) + 0.05) ? DARK_INK : '#ffffff')
const rgba = (hex, alpha) => `rgba(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(',')},${alpha})`
function themeVars(mode, dark, accent = mode.accent) {
  return {
    '--bt-ink': mode.text, '--bt-ink-2': rgba(mode.text, 0.6), '--bt-ink-3': rgba(mode.text, 0.36),
    '--bt-bubble': mode.bubble, '--bt-sidebar': mode.sidebar, '--bt-main': mode.bg, '--bt-card': mode.card,
    '--bt-line': rgba(mode.text, 0.08), '--bt-line-2': rgba(mode.text, 0.15),
    '--bt-hover': dark ? 'rgba(160,160,160,.12)' : 'rgba(119,119,119,.09)',
    '--bt-active': dark ? 'rgba(160,160,160,.2)' : 'rgba(119,119,119,.17)',
    '--bt-accent': accent, '--bt-accent-ink': accentInk(accent),
    '--bt-user': mode.user, '--bt-user-ink': mode.userText,
    '--bt-tag-bg': rgba(mode.text, dark ? 0.09 : 0.06), '--bt-tag-ink': rgba(mode.text, 0.58),
  }
}
const declarations = vars => Object.entries(vars).map(([name, value]) => `${name}:${value}`).join(';')
// A preset accent is saved as its light value; in dark mode it takes the preset's dark
// value, as Bot names do, so Charcoal does not vanish on a dark background. A custom
// accent is the same in both modes. A preset is matched the way Settings marks it.
const darkAccent = (accent) => {
  const ink = ACCENT_INKS.find(id => INKS[id][0] === accent)
  return ink === undefined ? accent : INKS[ink][1]
}
// `html body` outranks the base sheet's `body` rules without !important.
export const themeCss = (theme, accent) => `html body{${declarations(themeVars(theme.light, false, accent ?? theme.light.accent))}}
html body[data-ds-dark-theme]{${declarations(themeVars(theme.dark, true, darkAccent(accent) ?? theme.dark.accent))}}
${theme.css ?? ''}`
export const shellTokens = ({ light, dark }) => ({
  '--dsw-alias-bg-base': { light: light.bg, dark: dark.bg },
  '--dsw-specific-sidebar-fill': { light: light.sidebar, dark: dark.sidebar },
  '--dsw-specific-input-major': { light: light.bg, dark: dark.sidebar },
  '--dsw-alias-label-primary': { light: light.text, dark: dark.text },
  '--dsw-alias-label-secondary': { light: rgba(light.text, 0.74), dark: rgba(dark.text, 0.74) },
  '--dsw-alias-label-tertiary': { light: rgba(light.text, 0.6), dark: rgba(dark.text, 0.6) },
})

// Other plugins add character shapes and themes through `window.dshBot`, or queue
// calls on `window.dshBotQueue` before this plugin loads. A shape draws only its
// body; the eyes are cut out where `eyes.at` says, so it gets every state motion free.
const customThemes = {}
export const registry = createSource(0)
const isPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
export function registerShape(id, shape) {
  if (typeof id !== 'string' || !/^[a-z][\w-]{0,31}$/.test(id)) throw new Error('Shape ids are lowercase words')
  if (typeof shape?.body !== 'function' || typeof shape.body('#000') !== 'string') throw new Error('A shape needs body(paint) returning SVG markup')
  const at = shape.eyes?.at
  if (!Array.isArray(at) || at.length !== 2 || !at.every(isPoint)) throw new Error('A shape needs eyes.at: two [x, y] points')
  const size = Number.isFinite(shape.size) && shape.size > 0 ? shape.size : 100
  const pick = (key, fallback) => (Number.isFinite(shape.eyes[key]) ? shape.eyes[key] : fallback)
  const eyes = at.map(([x, y]) => [x, y, pick('w', size * 0.1), pick('h', size * 0.23), pick('tilt', -27)])
  const previous = SHAPES[id]
  SHAPES[id] = {
    label: String(shape.label ?? id),
    size,
    body: shape.body,
    eyes,
    ...(typeof shape.wrap === 'string' ? { wrap: shape.wrap } : {}),
  }
  const refresh = () => {
    markupCache.clear()
    maskCache.delete(id)
    registry.set(value => value + 1)
  }
  refresh()
  return () => {
    if (previous) SHAPES[id] = previous
    else delete SHAPES[id]
    refresh()
  }
}
export function registerTheme(id, theme) {
  if (typeof id !== 'string' || !/^[a-z][\w-]{0,31}$/.test(id)) throw new Error('Theme ids are lowercase words')
  for (const mode of ['light', 'dark']) {
    for (const key of THEME_KEYS) if (!isHex(theme?.[mode]?.[key])) throw new Error(`Theme ${mode}.${key} must be a #rrggbb color`)
  }
  const previous = customThemes[id]
  customThemes[id] = { label: String(theme.label ?? id), light: theme.light, dark: theme.dark, css: typeof theme.css === 'string' ? theme.css : '' }
  registry.set(value => value + 1)
  return () => {
    if (previous) customThemes[id] = previous
    else delete customThemes[id]
    registry.set(value => value + 1)
  }
}
export const allThemes = () => ({ ...THEMES, ...customThemes })

// How chat messages are drawn; a value the plugin does not know reads as the default.
// A width is a percent of the column: the bubbles' in either layout, the text's in the
// flat one.
export const MESSAGE_WIDTH = { min: 50, max: 100, step: 5 }
const percent = (value, initial) => (Number.isInteger(value) && value >= MESSAGE_WIDTH.min && value <= MESSAGE_WIDTH.max ? value : initial)
// Typeface. Two faces ship with the plugin (both variable, both OFL 1.1) beside the system
// face the shell already asks for; CJK falls back to the system font in either case.
export const FONT_CHOICES = {
  system: { label: 'System' },
  geist: { label: 'Geist', stack: '"Geist Variable",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif' },
  inter: { label: 'Inter', stack: '"Inter Variable",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif' },
}
export const fontOf = prefs => (FONT_CHOICES[prefs?.font] ? prefs.font : 'system')
// The choice rides on a variable, so every --bt-font rule keeps working unchanged.
export const fontCss = (id) => {
  const face = FONT_CHOICES[id]
  return face?.stack ? `html body{--bt-font-choice:${face.stack}}` : ''
}
// Reading text size. It rides the shell's own content tokens, so markdown, code and our
// bubbles all follow one number; the default is the shell's 14px and needs no rule.
export const SIZE_CHOICES = { s: { label: 'Small', px: 13 }, m: { label: 'Standard', px: 14 }, l: { label: 'Large', px: 15 }, xl: { label: 'Largest', px: 16 } }
export const sizeOf = prefs => (SIZE_CHOICES[prefs?.size] ? prefs.size : 'm')
export const sizeCss = (id) => {
  const px = (SIZE_CHOICES[id] ?? SIZE_CHOICES.m).px
  if (px === 14) return ''
  const small = `min(calc(${px}px - 1px),max(13px,calc(${px}px - 2px)))`
  // The attribute lifts the rule above the shell's own `html body` block, which loads later.
  return `html body[data-bt-size]{--dsh-content-font-size:${px}px;--dsh-content-font-delta:calc(${px}px - 14px);--dsh-content-font-size-secondary:${small};--dsh-content-font-delta-secondary:calc(${small} - 13px)}`
}
// Spacing density. The attribute drives the rules in the base sheet, so switching it costs
// one attribute write rather than a new stylesheet.
export const DENSITY_CHOICES = { tight: { label: 'Compact' }, normal: { label: 'Standard' }, roomy: { label: 'Roomier' } }
export const densityOf = prefs => (DENSITY_CHOICES[prefs?.density] ? prefs.density : 'normal')
// A phone look, not a colour: `ours` keeps this plugin's own rows and bubbles, `app` follows
// the mobile app's chat shape. Kept on this device only, like the size and density.
export const SKIN_CHOICES = { ours: { label: 'Classic' }, app: { label: 'App style' } }
// No pick yet means the phone wears the app's own shape and the desktop keeps ours; an
// explicit pick always wins, whichever way the device goes.
export const skinOf = (prefs, { phone = false } = {}) => (SKIN_CHOICES[prefs?.skin] ? prefs.skin : phone ? 'app' : 'ours')
export const layoutOf = prefs => (prefs?.layout === 'flat' ? 'flat' : 'bubble')
export const thinkingShown = prefs => prefs?.thinking === true
export const widthOf = prefs => percent(prefs?.width, 90)
// SuperAgent switches are on unless someone wrote `false`: a missing key, an older state
// or a deleted one all read as on, which is the default the settings page shows.
export const saOn = (prefs, key) => prefs?.[key] !== false
// A group line folds past this, unless the page set another threshold in range. The bounds
// and the default live in shared/fold-at.js, which the host's own check reads too.
export { FOLD_AT_BOUNDS, SA_FOLD_AT, isFoldAt } from '../shared/fold-at.js'
export const foldAtOf = (prefs) => (isFoldAt(prefs?.saFoldAt) ? { chars: prefs.saFoldAt.chars, lines: prefs.saFoldAt.lines } : SA_FOLD_AT)

export const flatWidthOf = prefs => percent(prefs?.flatWidth, 100)
