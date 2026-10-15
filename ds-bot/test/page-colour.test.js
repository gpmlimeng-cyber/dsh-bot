// The page colour is the one value the user asked us to take from their screenshot rather
// than from the platform: page #f8f8f8, cards and bubbles white on top of it, and the
// phone's bottom bar wearing the page colour. The dark theme paints nothing with it, so the
// only thing keeping dark untouched is that the paint is gated on the light theme -- which
// is what these two assertions are for.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const styles = read('styles.js').split('\n')
const nav = read('nav-bar.js')

const light = styles.find(line => line.startsWith('body{--bt-nav-ink:'))
const dark = styles.find(line => line.startsWith('body[data-ds-dark-theme]{--bt-nav-ink:'))

// The page's colour lives in the theme palette, because that layer is the one that wins:
// themeCss emits `html body{...}`, which outranks the base sheet's `body{...}` -- so the base
// block is its pre-theme fallback and the two must carry the same numbers.
test('the page colour lives in the palette, and the base sheet agrees with it', () => {
  const themes = read('themes.js')
  assert.ok(themes.includes("light: { bg: '#f8f8f8', sidebar: '#f8f8f8', bubble: '#ffffff'"), 'the default light palette carries the sampled page, the list base and the white bubbles')
  assert.ok(themes.includes("'--bt-bubble': mode.bubble, '--bt-sidebar': mode.sidebar, '--bt-main': mode.bg"), 'and the palette reaches the tokens the skin uses')
  // The base sheet is that palette's pre-theme fallback, so the two agree token for token.
  for (const token of ['--bt-main:#f8f8f8', '--bt-sidebar:#f8f8f8', '--bt-bubble:#ffffff']) {
    assert.ok(styles.find(line => line.startsWith('body{')).includes(token), `the fallback carries ${token}`)
  }
})

test('the light page is the sampled #f8f8f8, with white cards on it', () => {
  assert.ok(light, 'the light theme declares the page colour')
  assert.ok(light.includes('--bt-main:#f8f8f8'), light)
  assert.ok(light.includes('--bt-card:#ffffff'), 'cards stay white -- the layering the screenshot draws')
  assert.ok(light.includes('--bt-sidebar:#f8f8f8'), 'the lists that are pages too')
  assert.ok(!light.includes('#f1f3f1'), 'the platform base colour is not written here')
  // The bubbles were #eee until the page went grey: on #f8f8f8 a white bubble carries the
  // layering the screenshots show.
  assert.ok(light.includes('--bt-bubble:#ffffff'), 'the bubbles are white on the grey page')
})

// The bar's two colours are not ours to choose: they were sampled off the user's
// screenshots, one per state, and both the glyph and its label wear the same one.
test('the bar wears the sampled pair, and the input is white like the cards', () => {
  assert.ok(light.includes('--bt-nav-ink:#949494'), light)
  assert.ok(light.includes('--bt-nav-on:#171717'), light)
  // The dark theme keeps the skin's own ink pair: nothing there changes.
  assert.ok(dark.includes('--bt-nav-ink:rgba(242,242,242,.36)') && dark.includes('--bt-nav-on:#f2f2f2'), dark)
  // The input the user types in is a card: the sampled #ffffff, not the page's near-white main.
  const composer = styles.find(line => line.startsWith('[data-composer-card]{'))
  assert.ok(composer.includes('background:var(--bt-card)!important'), composer.slice(0, 200))
  assert.ok(!composer.includes('background:var(--bt-main)'), 'and not the main surface colour')
})

test('the page is painted where the platform painted its own, and only in the light theme', () => {
  // html cannot be a descendant of body, so it is gated with :has; everything else is.
  const paint = 'html:not(:has(body[data-ds-dark-theme])){background:var(--bt-main)!important}\nbody:not([data-ds-dark-theme]){background:var(--bt-main)!important}\nbody:not([data-ds-dark-theme]) [data-dsh-frame],\nbody:not([data-ds-dark-theme]) [data-dsh-frame]>[class*="centerCol"]{background:var(--bt-main)}'
  assert.ok(read('styles.js').includes(paint), 'html, body, the frame and the conversation column are painted, all gated on the light theme')
  // html and body fight the platform's own inline colour, so they carry the flag; the frame
  // is ours to paint and does not need it.
  assert.equal((paint.match(/!important/g) ?? []).length, 2, 'only the two the platform writes inline carry the flag')
  // Dark keeps the platform's own base: the token is declared for the bar, not for a paint.
  assert.ok(dark.includes('--bt-main:#141414'), dark)
})

// The platform writes the base token inline on <body>, and three surfaces read it: the
// frame, the body itself and the composer's fade. An inline declaration beats a normal rule,
// so the skin overrides the token exactly once -- and this test is what keeps it at once.
test('the platform base token is overridden exactly once, on the light theme', () => {
  const overrides = styles.filter(line => /\{--dsw-[\w-]+:/.test(line))
  assert.equal(overrides.length, 1, `one --dsw-* override in the whole skin, found ${overrides.length}`)
  const [rule] = overrides
  assert.ok(rule.startsWith('body:not([data-ds-dark-theme]){'), `light theme only: ${rule}`)
  assert.ok(rule.includes('--dsw-alias-bg-base:var(--bt-main)'), rule)
  assert.ok(rule.includes('!important'), 'an inline declaration needs the flag to be beaten')
})

// The shell reads the page colour from <meta name="theme-color">, and the platform's own
// presenter had already written the old one before this skin's colour took effect. Ours goes
// first in <head> (a consumer reads the first matching tag), and it is removed in dark so the
// platform's value stands there.
test('the page colour reaches the shell through the meta tag, light theme only', () => {
  const styles = read('styles.js')
  const helper = styles.slice(styles.indexOf('export function publishThemeColor'))
  assert.ok(helper.includes("document.head.prepend(meta)"), 'ours leads the platform\'s tag')
  assert.ok(helper.includes("meta.dataset.btThemeColor = ''"), 'and is marked as ours, so the presenter keeps its own')
  assert.ok(helper.includes("getPropertyValue('--bt-main')"), 'the value is the page token, not a second copy of the colour')
  assert.ok(helper.includes("hasAttribute('data-ds-dark-theme')") && helper.includes('own.remove()'), 'dark removes ours and leaves the platform\'s')
  // Wired where the theme is applied, and watched, because the platform flips the flag itself.
  const index = read('index.js')
  assert.ok(index.includes('import { SHELL_CSS, CONVERSATION_CSS, installStyles, installCompiledStyles, publishThemeColor }'), 'imported')
  assert.ok(index.includes('      publishThemeColor()\n'), 'applied with the theme')
  assert.ok(index.includes("new MutationObserver(publishThemeColor)") && index.includes("attributeFilter: ['data-ds-dark-theme']"), 'and re-applied when the platform flips dark')
  assert.ok(index.includes("document.head.querySelector('meta[data-bt-theme-color]')?.remove()"), 'removed when the surface withdraws')
})

test('the bar wears the page colour, opaque', () => {
  const bar = nav.split('\n').find(line => line.includes('.bt-nav{'))
  assert.ok(bar.includes('background:var(--bt-main)'), bar)
  assert.ok(!bar.includes('color-mix') && !bar.includes('transparent'), 'no mix, no see-through')
})
