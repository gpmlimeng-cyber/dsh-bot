// The page colour is the one value the user asked us to take from their screenshot rather
// than from the platform, and it has since been re-pointed: it is now the colour the shell
// paints behind the status bar (#f1f3f1), so the interface matches the band instead of the
// band having to be reached for. White cards and white bubbles on top of it, and the shell's
// phone's bottom bar wearing the page colour. The dark theme paints nothing with it,
// so the only thing keeping dark untouched is that the paint is gated on the light theme --
// which is what these two assertions are for.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
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
  assert.ok(themes.includes("light: { bg: '#fcfcfc', sidebar: '#fcfcfc', bubble: '#ffffff'"), "the default light palette carries the design colour, the list base and the white bubbles")
  assert.ok(themes.includes("'--bt-bubble': mode.bubble, '--bt-sidebar': mode.sidebar, '--bt-main': mode.bg"), 'and the palette reaches the tokens the skin uses')
  // The base sheet is that palette's pre-theme fallback, so the two agree token for token.
  for (const token of ['--bt-main:#fcfcfc', '--bt-sidebar:#fcfcfc', '--bt-bubble:#ffffff']) {
    assert.ok(styles.find(line => line.startsWith('body{')).includes(token), `the fallback carries ${token}`)
  }
})

test('the light page is the skin design colour, with white cards on it', () => {
  assert.ok(light, 'the light theme declares the page colour')
  assert.ok(light.includes('--bt-main:#fcfcfc'), light)
  assert.ok(light.includes('--bt-card:#ffffff'), 'cards stay white -- the layering the screenshot draws')
  assert.ok(light.includes('--bt-sidebar:#fcfcfc'), 'the lists that are pages too')
  // The shell's band is a fixed colour the page cannot paint (measured: forcing the page's
  // surfaces magenta moved nothing above CSS 46). The page keeps its own design colour and the
  // 10px fade covers the join; this is what the user asked for, twice.
  assert.ok(!light.includes('#f1f3f1'), 'the shell band colour is not the page colour')
  // White bubbles: the page is DS Bot's own #fcfcfc, a shade deeper than the #f8f8f8 they were
  // first drawn against, and on it the white bubble is the layering that holds up. The
  // freeze said #eee for a while and this is the third call on the same token -- which is why
  // both layers are pinned together here and neither can move alone.
  assert.ok(light.includes('--bt-bubble:#ffffff'), 'the bubbles are white on the band colour')
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
  const paint = read('styles.js')
  const painted = [
    'body:not([data-ds-dark-theme]){background:var(--bt-main)!important}',
    'body:not([data-ds-dark-theme]) [data-dsh-frame],',
    'body:not([data-ds-dark-theme]) [data-dsh-frame]>[class*="centerCol"]{background:var(--bt-main)}',
  ]
  for (const rule of painted) assert.ok(paint.includes(rule), `html, body, the frame and the conversation column are painted: ${rule}`)
  const flags = painted.join('\n').match(/!important/g) ?? []
  // Only <body> carries the flag: the platform writes the base TOKEN inline there and a normal
  // rule cannot outrank it. <html> needs none, because its own inline declaration is the colour
  // this skin reads and adopts -- the rule under it only covers the case where there is none.
  assert.equal(flags.length, 1, 'only where an inline declaration has to be beaten')
  // Dark keeps the platform's own base: the token is declared for the bar, not for a paint.
  assert.ok(dark.includes('--bt-main:#141414'), dark)
})

// The band behind the status bar is painted by the shell, and the page cannot reach it -- but
// the shell puts its colour where the page CAN read it: a background on <html>, written inline
// and not the platform's own base token. So the page takes its colour from there instead of
// sampling it once and drifting the next time the band moves (it moved once already today).
test('the page colour is read from the shell, in the light theme, with the sample as fallback', () => {
  const styles = read('styles.js')
  const reader = styles.slice(styles.indexOf('export function publishShellBackground'), styles.indexOf('export function installStyles'))
  assert.ok(reader.includes("root.style.getPropertyValue('background-color')"), 'the inline declaration, read from the element')
  assert.ok(reader.includes("root.style.getPropertyValue('background')"), 'including the shorthand form')
  assert.ok(!reader.includes('getComputedStyle'), 'never the computed value, which would be our own paint')
  assert.ok(reader.includes("setProperty('--bt-shell-bg', declared)"), 'published as the token the sheet reads')
  assert.ok(reader.includes("dataset.btShellBg = ''") && reader.includes('removeProperty'), 'and dropped again when there is nothing to read')
  // The sheet takes it as the page's own colour, so every surface that already reads
  // --bt-main / --bt-sidebar follows in one step; the palette's sample stands as the fallback.
  // The shell colour feeds the top fade and nothing else: the page's own colour is the design's.
  assert.ok(!styles.includes('--bt-main:var(--bt-shell-bg)'), 'the shell colour does not decide the page colour')
  assert.ok(nav.includes('color-mix(in srgb,var(--bt-main) 72%,transparent)'), 'it is the frosted strip\'s tint')
  assert.ok(read('themes.js').includes("light: { bg: '#fcfcfc', sidebar: '#fcfcfc'"), 'and the page keeps the design colour')
  // Wired where the theme is applied, and watched: the platform rewrites that declaration on
  // its own, and the watch lives on <html> where the declaration is.
  const index = read('index.js')
  assert.ok(index.includes('      publishShellBackground()\n'), 'applied with the theme')
  assert.ok(index.includes('new MutationObserver(() => { publishShellBackground() })') && index.includes("attributeFilter: ['data-ds-dark-theme']"), 'and re-applied when the platform flips dark')
  assert.ok(index.includes("themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })"), 'and watched, because the platform rewrites it')
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

// One <meta name="theme-color"> has to be enough. The skin used to add its own ahead of the
// platform's presenter's, so that a consumer reading the first match saw the page's colour --
// and it left two tags behind. Measured on the device: the shell ignores that tag entirely
// (changing it to #00ff00 moved nothing, at load or later), so the override bought nothing and
// the duplicate stayed. The skin adds none now, and this is what keeps it from coming back.
test('the skin adds no theme-color tag of its own', () => {
  const styles = read('styles.js')
  const index = read('index.js')
  assert.ok(!styles.includes('publishThemeColor'), 'no helper')
  assert.ok(!styles.includes("meta.name = 'theme-color'") && !styles.includes('bt-theme-color'), 'and nothing that writes one')
  assert.ok(!index.includes('bt-theme-color') && !index.includes('publishThemeColor'), 'not wired in either')
  // The platform's presenter owns the tag; the skin's page colour reaches the surfaces through
  // the base token it overrides, which is the one route the device proved works.
  assert.ok(styles.includes('--dsw-alias-bg-base:var(--bt-main)'), 'the working route is still the base token')
})

test('the bar wears the page colour, opaque', () => {
  const bar = nav.split('\n').find(line => line.includes('.bt-nav{'))
  assert.ok(bar.includes('background:var(--bt-main)'), bar)
  assert.ok(!bar.includes('color-mix') && !bar.includes('transparent'), 'no mix, no see-through')
})

// The reader runs for real against a stand-in for the platform's inline declaration, because
// its one hard rule -- read the INLINE value, never the computed one -- is what keeps it from
// reading its own paint back and looping.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/styles.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom'],
})
const loadReader = (inline) => {
  const declared = new Map(Object.entries(inline))
  let writes = 0
  const style = {
    getPropertyValue: (name) => declared.get(name) ?? '',
    setProperty: (name, value) => { writes += 1; declared.set(name, value) },
    removeProperty: (name) => { writes += 1; declared.delete(name) },
  }
  const root = { style, dataset: {} }
  const document = { documentElement: root, head: { querySelector: () => null, prepend: () => {} } }
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, document,
    require: (name) => {
      if (name === 'react') return { createElement: () => null, useState: v => [v, () => {}], useEffect: () => {}, useLayoutEffect: () => {}, useRef: v => ({ current: v }), Fragment: 'fragment' }
      if (name === 'react-dom') return { createPortal: () => null }
      throw new Error(`no platform module ${name}`)
    },
  })
  return { read: module.exports.publishShellBackground, declared, root, writes: () => writes }
}

test('the shell colour is read from the inline declaration and published', () => {
  const shorthand = loadReader({ background: 'rgb(241, 243, 241)' })
  shorthand.read()
  assert.equal(shorthand.declared.get('--bt-shell-bg'), 'rgb(241, 243, 241)')
  assert.ok('btShellBg' in shorthand.root.dataset, 'and the sheet is told there is one')
  // Reading again writes nothing: the reader's own write is on the attribute it watches, so a
  // repeated write would be a change with nothing in it, and a watch loop with it.
  shorthand.read()
  shorthand.read()
  assert.equal(shorthand.writes(), 1, 'the same value is written once and left alone')

  const longhand = loadReader({ 'background-color': '#f1f3f1' })
  longhand.read()
  assert.equal(longhand.declared.get('--bt-shell-bg'), '#f1f3f1', 'the long form too')

  // Nothing readable, or something that is not a colour: the palette's sample stands. The
  // two keywords matter most -- an edge-to-edge shell says `transparent` about the surface it
  // has stopped painting, and treating that as the page's colour would take the page's own
  // background away.
  for (const inline of [
    {}, { background: 'url(bg.png) center' }, { background: 'none' },
    { background: 'transparent' }, { 'background-color': 'transparent' },
  ]) {
    const empty = loadReader(inline)
    empty.read()
    assert.equal(empty.declared.get('--bt-shell-bg'), undefined, `nothing published for ${JSON.stringify(inline)}`)
    assert.ok(!('btShellBg' in empty.root.dataset), 'and the attribute is gone with it')
  }
  const stale = loadReader({ 'background-color': '#123456' })
  stale.read()
  stale.declared.set('background-color', 'none')
  stale.read()
  assert.equal(stale.declared.get('--bt-shell-bg'), undefined, 'a colour taken away is unpublished')
})
