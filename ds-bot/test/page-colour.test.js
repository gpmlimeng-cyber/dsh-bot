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

const light = styles.find(line => line.startsWith('body{--bt-page:'))
const dark = styles.find(line => line.startsWith('body[data-ds-dark-theme]{--bt-page:'))

test('the light page is the sampled #f8f8f8, with white cards on it', () => {
  assert.ok(light, 'the light theme declares the page colour')
  assert.ok(light.includes('--bt-page:#f8f8f8'), light)
  assert.ok(light.includes('--bt-card:#ffffff'), 'cards stay white -- the layering the screenshot draws')
  assert.ok(light.includes('--bt-sidebar:#f8f8f8'), 'the lists that are pages too')
  assert.ok(!light.includes('#f1f3f1'), 'the platform base colour is not written here')
  // The bubbles are deliberately not part of this: that app draws them the same colour as
  // its page, and copying that would flatten ours into it.
  assert.ok(light.includes('--bt-bubble:#eeeeee'), 'the bubbles keep the grey they had')
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
  const paint = 'html:not(:has(body[data-ds-dark-theme])){background:var(--bt-page)}\nbody:not([data-ds-dark-theme]){background:var(--bt-page)}\nbody:not([data-ds-dark-theme]) [data-dsh-frame],\nbody:not([data-ds-dark-theme]) [data-dsh-frame]>[class*="centerCol"]{background:var(--bt-page)}'
  assert.ok(read('styles.js').includes(paint), 'html, body, the frame and the conversation column are painted, all gated on the light theme')
  assert.ok(!paint.includes('!important'), 'nothing here has to fight the platform')
  // Dark keeps the platform's own base: the token is declared for the bar, not for a paint.
  assert.ok(dark.includes('--bt-page:#1f1f1f'), dark)
})

test('the bar wears the page colour, opaque', () => {
  const bar = nav.split('\n').find(line => line.includes('.bt-nav{'))
  assert.ok(bar.includes('background:var(--bt-page)'), bar)
  assert.ok(!bar.includes('color-mix') && !bar.includes('transparent'), 'no mix, no see-through')
})
