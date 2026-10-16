// The page colour is the one value the user asked us to take from their screenshot rather
// than from the platform, and it has since been re-pointed: it is now the colour the shell
// paints behind the status bar (#f1f3f1), so the interface matches the band instead of the
// band having to be reached for. White cards and white bubbles on top of it, and the shell's
// phone's bottom bar wearing the page colour. The dark theme paints nothing with it,
// so the only thing keeping dark untouched is that the paint is gated on the light theme --
// which is what these two assertions are for.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { THEMES, allThemes, registerTheme, shellTokens, themeCss, themeVars } from '../src/client/themes.js'
import { luminance } from '../src/client/inks.js'

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
    ['--bt-brand', '--bt-danger', '--bt-danger-bright', '--bt-danger-deep', '--bt-float-shadow', '--bt-good-deep', '--bt-green',
      '--bt-line-weak', '--bt-nav-ink', '--bt-nav-on', '--bt-news', '--bt-press', '--bt-rec', '--bt-spectrum',
      '--bt-star', '--bt-unread', '--bt-warn', '--bt-warn-ink', '--bt-warn-ink-2', '--bt-warn-ink-dark', '--bt-warn-soft'], 'fallback only')
  assert.deepEqual(Object.keys(theme).filter(token => !light.has(token)), ['--bt-accent-ink'], 'palette only')
})

// The bottom bar's pair is the one surface the user reads all day and the palette cannot derive
// (it is sampled from their own app), so a theme may name it -- and one that says nothing keeps
// the base sheet's values, which is what "no existing theme moves a pixel" means here.
test('a theme may name the bottom bar\'s pair, and a theme that says nothing leaves it alone', () => {
  // The four that predate the pair: they name none of it, so the base sheet's values stand (the fifth,
  // WorkBuddy, is the theme that does name it -- it is held to the floor in the test below).
  for (const id of ['deepseek', 'mono', 'paper', 'moonlight']) {
    const theme = THEMES[id]
    for (const dark of [false, true]) {
      const vars = themeVars(dark ? theme.dark : theme.light, dark)
      assert.equal('--bt-nav-ink' in vars, false, `${id} ${dark ? 'dark' : 'light'}`)
      assert.equal('--bt-nav-on' in vars, false, `${id} ${dark ? 'dark' : 'light'}`)
    }
  }
  const named = themeVars({ ...THEMES.deepseek.light, navInk: '#8a8a8a', navOn: '#101010' }, false)
  assert.equal(named['--bt-nav-ink'], '#8a8a8a')
  assert.equal(named['--bt-nav-on'], '#101010')
  // And they land in the theme's own layer, which is the one that outranks the fallback.
  const css = themeCss({ label: 'x', light: { ...THEMES.deepseek.light, navOn: '#101010' }, dark: THEMES.deepseek.dark })
  assert.match(css, /html body\{[^}]*--bt-nav-on:#101010/, 'the light layer carries it')
  assert.doesNotMatch(css.split('\n')[1], /--bt-nav-on/, 'and a mode that says nothing does not')
  // An optional key is still held to the same shape as the eight, and a refused registration
  // leaves nothing behind (it throws before the theme is stored).
  assert.throws(() => registerTheme('optional-check', { label: 'x', light: { ...THEMES.deepseek.light, navInk: 'grey' }, dark: THEMES.deepseek.dark }),
    /light\.navInk must be a #rrggbb color/)
})

// WorkBuddy names the bar's pair, and both of its values are adjustments: the app's own unselected ink
// measured 4.35:1 in dark and 2.82:1 in light, under the floor this skin holds control text to. The
// pair is the one theme value a reader can check arithmetically, so it is checked here.
test('the theme that names the bottom bar\'s pair clears the floor, in both modes', () => {
  const contrast = (one, two) => {
    const [ink, paper] = [luminance(one), luminance(two)].sort((a, b) => b - a)
    return (ink + 0.05) / (paper + 0.05)
  }
  const workbuddy = THEMES.workbuddy
  assert.ok(workbuddy, 'the theme is registered')
  for (const [mode, dark] of [[workbuddy.light, false], [workbuddy.dark, true]]) {
    for (const key of ['navInk', 'navOn']) {
      // The bar wears the page colour, so the page colour is the paper under both.
      const ratio = contrast(mode[key], mode.bg)
      assert.ok(ratio >= 4.5, `${key} ${dark ? 'dark' : 'light'}: ${ratio.toFixed(2)}:1`)
    }
  }
})

// A theme for an app with no dark mode ships none: no dark block, so the base sheet's own -- the
// default theme's dark values -- stands in. That is the fallback the user asked for instead of a
// dark mode invented from the light one.
test('a light-only theme leaves the dark layer to the default theme', () => {
  const lightOnly = themeCss({ label: 'x', light: THEMES.deepseek.light })
  assert.ok(lightOnly.split('\n').some(line => line.startsWith('html body{')), 'the light layer is drawn')
  assert.equal(lightOnly.split('\n').some(line => line.startsWith('html body[data-ds-dark-theme]{')), false,
    'and nothing dark: the base sheet\'s own dark values are what the dark shell reads')
  assert.ok(themeCss(THEMES.deepseek).split('\n').some(line => line.startsWith('html body[data-ds-dark-theme]{')),
    'a theme with both modes is untouched')
  assert.deepEqual(shellTokens({ light: THEMES.deepseek.light }), shellTokens(THEMES.deepseek),
    'the shell tokens fall back the same way, rather than throwing on the missing mode')
  const release = registerTheme('light-only-check', { label: 'x', light: THEMES.deepseek.light })
  try {
    assert.equal(allThemes()['light-only-check'].dark, undefined, 'it registers with light alone')
  } finally {
    release()
  }
  assert.equal('light-only-check' in allThemes(), false, 'and the check leaves no theme behind')
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
  // The user asked for the frame to disappear while the card keeps floating: no border at all,
  // one light shadow. The half-pixel border is paid back into the padding (7.5 + 0.5 = 8), so
  // the card's box -- and the 8px above the bar measured on the device -- do not move.
  assert.ok(composer.includes('border:0!important'), 'no frame, on any side')
  assert.ok(composer.includes('box-shadow:var(--bt-float-shadow)!important'), 'the shared float, not a copy of its value')
  assert.ok(composer.includes('padding:8px!important'), 'with the border\'s half-pixel paid back')
  assert.ok(!composer.includes('border-color'), 'and nothing left for a hover border to colour')
})

// One floating object, one surface: the composer's card and every floating control in the chrome
// -- the pill, the phone bar's two controls, the drawer's search field and round buttons -- are
// told to match, and a copied value drifts the moment either is touched. They read one fill and
// one shadow, both declared once, and this is what keeps it that way.
test('every floating control reads the composer card\'s skin', () => {
  const sheet = read('styles.js')
  const declared = sheet.split('\n').filter(line => line.includes('--bt-float-shadow:'))
  assert.equal(declared.length, 1, `declared once, found ${declared.length}`)
  assert.ok(declared[0].startsWith('body{'), 'in the skin\'s own token block, so both bands and both themes see it')
  assert.ok(declared[0].includes('0 2px 8px rgba(20,20,20,.08),0 1px 2px rgba(20,20,20,.04)'), 'two soft layers, no ring')
  const readers = sheet.split('\n').filter(line => line.includes('box-shadow:var(--bt-float-shadow'))
  assert.equal(readers.length, 3, `three readers -- the chrome's controls, the composer card and the scroll-to-bottom button -- found ${readers.length}`)
  assert.ok(readers.some(line => line.startsWith('[data-composer-card]{')), 'the composer card')
  // The button the shell floats above the composer wore the same half-pixel ring the capsule did; it
  // reads this shadow too now, which is why the count above is three.
  assert.ok(readers.some(line => line.startsWith('[class*="_toBottomSlot"]>button{') && line.includes('!important')), 'the scroll-to-bottom button, keeping the !important that holds the shell\'s own elevation out')
  // The chrome's own declaration, carrying every floating control in one selector list (which
  // spans several lines, so take the block rather than the one line the shadow sits on).
  const lines = sheet.split('\n')
  const start = lines.findIndex(line => line.includes('.bt-pill,.bt-mobile-nav,.bt-mobile-acts,.bt-side-search'))
  const skin = lines.slice(start, start + 4).join('\n')
  for (const control of ['.bt-pill', '.bt-mobile-nav', '.bt-mobile-acts', '.bt-side-search']) {
    assert.ok(skin.includes(control), `${control} reads the skin: ${skin.slice(0, 120)}`)
  }
  assert.ok(skin.includes('html[data-bt-mobile] .bt-side.bt-rail .bt-side-top .bt-round'), 'the drawer\'s round buttons too')
  assert.ok(!skin.includes('html[data-bt-mobile] .bt-peers-new'), 'and not the 伙伴 title-bar key: it sits on the bar rather than floating over a page')
  // The user asked for the top row to look like the input card: white, no edge, no blur.
  assert.ok(skin.includes('background:var(--bt-card)') && skin.includes('border:0'), 'white and edgeless')
  assert.ok(skin.includes('border-radius:999px'), 'still a full round')
  assert.ok(skin.includes('backdrop-filter:none') && !skin.includes('blur('), 'and no blur')
  // Nothing carries the values a second time outside the declaration itself.
  const copies = sheet.split('\n').filter(line => !line.includes('--bt-float-shadow:') && line.includes('rgba(20,20,20,.08) 0 2px 8px'))
  assert.equal(copies.length, 0, `one copy of the value, in the token: found ${copies.length}`)
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

// The band behind the status bar is painted by the shell, and the page cannot reach it. The
// skin no longer tries to read the shell's colour back: it asks for the surface
// (status-bar.js) and draws its own strip, which starts from the page's own design colour --
// solid at the top edge, thinning to nothing -- so the join between a fixed shell band and our
// paint is a gradient rather than an edge (nav-bar.js). The reader that sampled <html>'s
// inline background went with its last consumer, and this keeps it from creeping back.
test('the strip fades out of the page\'s own colour, and the shell\'s is never read', () => {
  const sheet = read('styles.js')
  assert.ok(!sheet.includes('--bt-shell-bg') && !sheet.includes('publishShellBackground'), 'no reader, no token')
  const index = read('index.js')
  assert.ok(!index.includes('--bt-shell-bg') && !index.includes('publishShellBackground'), 'and nothing wires one')
  // The strip is the page's own colour thinning to nothing -- never the shell's: the page's
  // design colour is the one it fades out of.
  assert.ok(nav.includes('linear-gradient(to bottom,var(--bt-main) 0'), 'the strip is the page\'s own colour, solid at the top edge')
  assert.ok(nav.includes('transparent var(--bt-fade-h))'), 'and fades to nothing at its own foot')
  assert.ok(read('themes.js').includes("light: { bg: '#fcfcfc', sidebar: '#fcfcfc'"), 'and the page keeps the design colour')
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


