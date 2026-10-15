// The page colour is the one value the user asked us to take from their screenshot rather
// than from the platform, and it has since been re-pointed: it is now the colour the shell
// paints behind the status bar (#f1f3f1), so the interface matches the band instead of the
// band having to be reached for. White cards on top of it, the frozen #eee bubbles, and the
// phone's bottom bar wearing the page colour. The dark theme paints nothing with it,
// so the only thing keeping dark untouched is that the paint is gated on the light theme --
// which is what these two assertions are for.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { THEMES, themeVars } from '../src/client/themes.js'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const styles = read('styles.js').split('\n')
const nav = read('nav-bar.js')

// `rgba(20,20,20,.6)` and `rgba(20,20,20,0.6)` are the same colour written two ways, and the
// two layers are written by hand in different files, so compare the colours, not the text.
const norm = (value) => {
  const call = /^rgba?\(([^)]*)\)$/i.exec(value.replace(/\s+/g, ''))
  if (!call) return value.trim().toLowerCase()
  return `rgba(${call[1].split(',').map(Number).join(',')})`
}
const declarations = (rule) => new Map(rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'))
  .split(';').filter(Boolean).map(pair => [pair.slice(0, pair.indexOf(':')), pair.slice(pair.indexOf(':') + 1)]))

// The two layers carry one value per token. themeCss emits `html body{...}`, which outranks
// the base sheet's `body{...}`, so the base sheet is the palette's pre-theme fallback: it
// must agree with it token for token, or it is holding a value nothing reads -- or, worse, a
// value that changes the moment somebody edits the palette. That is the bug this catches:
// --bt-tag-ink sat at .56 against the palette's .58 for a while, and the dark hairlines at
// white against the palette's ink-coloured ones.
test('both layers carry the same value for every token they share', () => {
  for (const [rule, mode, dark] of [
    [styles.find(line => line.startsWith('body{--bt-nav-ink:')), THEMES.deepseek.light, false],
    [styles.find(line => line.startsWith('body[data-ds-dark-theme]{')), THEMES.deepseek.dark, true],
  ]) {
    const base = declarations(rule)
    const theme = themeVars(mode, dark)
    const shared = [...base.keys()].filter(token => token in theme)
    assert.ok(shared.length >= 12, `the two layers overlap on ${shared.length} tokens`)
    for (const token of shared) {
      assert.equal(norm(base.get(token)), norm(theme[token]), `${token}: the fallback says ${base.get(token)}, the palette says ${theme[token]}`)
    }
  }
})

// The exceptions, named rather than assumed: these live in the base sheet alone, so there is
// no second value anywhere to disagree with. A token that quietly drops out of the palette,
// or a new one added only here, shows up as a change to this list.
test('the tokens that live in one layer only are the documented ones', () => {
  const light = declarations(styles.find(line => line.startsWith('body{--bt-nav-ink:')))
  const theme = themeVars(THEMES.deepseek.light, false)
  assert.deepEqual([...light.keys()].filter(token => !(token in theme)).sort(),
    ['--bt-green', '--bt-line-weak', '--bt-nav-ink', '--bt-nav-on', '--bt-star'], 'fallback only')
  assert.deepEqual(Object.keys(theme).filter(token => !light.has(token)), ['--bt-accent-ink'], 'palette only')
})

const light = styles.find(line => line.startsWith('body{--bt-nav-ink:'))
const dark = styles.find(line => line.startsWith('body[data-ds-dark-theme]{--bt-nav-ink:'))

// The page's colour lives in the theme palette, because that layer is the one that wins:
// themeCss emits `html body{...}`, which outranks the base sheet's `body{...}` -- so the base
// block is its pre-theme fallback and the two must carry the same numbers.
test('the page colour lives in the palette, and the base sheet agrees with it', () => {
  const themes = read('themes.js')
  assert.ok(themes.includes("light: { bg: '#f1f3f1', sidebar: '#f1f3f1', bubble: '#eeeeee'"), "the default light palette carries the band colour, the list base and the frozen bubbles")
  assert.ok(themes.includes("'--bt-bubble': mode.bubble, '--bt-sidebar': mode.sidebar, '--bt-main': mode.bg"), 'and the palette reaches the tokens the skin uses')
  // The base sheet is that palette's pre-theme fallback, so the two agree token for token.
  for (const token of ['--bt-main:#f1f3f1', '--bt-sidebar:#f1f3f1', '--bt-bubble:#eeeeee']) {
    assert.ok(styles.find(line => line.startsWith('body{')).includes(token), `the fallback carries ${token}`)
  }
})

test('the light page is the status band colour, with white cards on it', () => {
  assert.ok(light, 'the light theme declares the page colour')
  assert.ok(light.includes('--bt-main:#f1f3f1'), light)
  assert.ok(light.includes('--bt-card:#ffffff'), 'cards stay white -- the layering the screenshot draws')
  assert.ok(light.includes('--bt-sidebar:#f1f3f1'), 'the lists that are pages too')
  // The band's colour is the page's colour now, by the user's own call: #f1f3f1 used to be
  // the platform's, waiting to be overwritten. Asserted positively so a re-sample shows up.
  assert.ok(light.includes('#f1f3f1'), 'the page carries the colour of the band itself')
  // The bubbles are the frozen #eee: one round made them white for the grey page and was
  // withdrawn before the user ever ran that build, so the freeze is what ships.
  assert.ok(light.includes('--bt-bubble:#eeeeee'), 'the bubbles keep the frozen grey')
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
