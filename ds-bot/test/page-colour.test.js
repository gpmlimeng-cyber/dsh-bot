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

test('the light page is the sampled #f8f8f8, with white cards and bubbles on it', () => {
  assert.ok(light, 'the light theme declares the page colour')
  assert.ok(light.includes('--bt-page:#f8f8f8'), light)
  assert.ok(light.includes('--bt-card:#ffffff'), 'cards stay white -- the layering the screenshot draws')
  assert.ok(light.includes('--bt-bubble:#ffffff'), 'and so do the bubbles')
  assert.ok(light.includes('--bt-sidebar:#f8f8f8'), 'the lists that are pages too')
  assert.ok(!light.includes('#f1f3f1'), 'the platform base colour is not written here')
})

test('the page is painted where the platform painted its own, and only in the light theme', () => {
  const paint = 'body:not([data-ds-dark-theme]) [data-dsh-frame],\nbody:not([data-ds-dark-theme]) [data-dsh-frame]>[class*="centerCol"]{background:var(--bt-page)}'
  assert.ok(read('styles.js').includes(paint), 'the frame and the conversation column are painted, in one gated rule')
  assert.ok(!paint.includes('!important'), 'nothing here has to fight the platform')
  // Dark keeps the platform's own base: the token is declared for the bar, not for a paint.
  assert.ok(dark.includes('--bt-page:#1f1f1f'), dark)
})

test('the bar wears the page colour, opaque', () => {
  const bar = nav.split('\n').find(line => line.includes('.bt-nav{'))
  assert.ok(bar.includes('background:var(--bt-page)'), bar)
  assert.ok(!bar.includes('color-mix') && !bar.includes('transparent'), 'no mix, no see-through')
})
