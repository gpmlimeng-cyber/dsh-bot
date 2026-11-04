// Minimal coverage for the local features that carry no test of their own. Each case pins
// behaviour or wiring, not pixels: colour, sizes and spacing stay the reviewer's business.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GAZE } from '../src/client/gaze.js'
import { dismissDrawerIfOpen, holdDrawerDismiss } from '../src/client/drawer-dismiss.js'

const source = name => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test('the Gaze picker ships four usable faces', () => {
  assert.equal(GAZE.length, 4)
  assert.equal(new Set(GAZE.map(face => face.id)).size, 4, 'two faces share an id')
  for (const face of GAZE) {
    const image = face.image
    assert.ok(typeof face.id === 'string' && face.id !== '', 'a face has no id')
    assert.match(image, /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, `${face.id}: not an inline PNG`)
    const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64')
    assert.deepEqual(png.subarray(0, PNG_MAGIC.length), PNG_MAGIC, `${face.id}: not a PNG`)
  }
})

test('drawer entries close the drawer, everything else leaves it alone', () => {
  const collapsed = []
  const release = holdDrawerDismiss(() => collapsed.push('collapsed'))
  try {
    // Only a caller that says it came from the drawer may collapse it: the shell reports no
    // open flag, so guessing would toggle a closed drawer open.
    dismissDrawerIfOpen(false)
    dismissDrawerIfOpen(undefined)
    assert.deepEqual(collapsed, [])
    dismissDrawerIfOpen(true)
    assert.deepEqual(collapsed, ['collapsed'])
  } finally {
    release()
  }
  // A missing holder is a no-op rather than a wrong toggle.
  dismissDrawerIfOpen(true)
  assert.deepEqual(collapsed, ['collapsed'])
})

test('the phone sheet is covered by a catcher that closes it', () => {
  const css = source('styles.js')
  // The desktop keeps the pane as it was, so both the sheet and its catcher exist only
  // under the phone frame.
  assert.match(css, /\.bt-sheet-catcher,\.bt-sheet-grip\{display:none\}/)
  assert.match(css, /html:has\(\[data-mobile-nav="frame"\]\) \.bt-sheet-catcher\{[^}]*display:block/)
  const catchers = source('new-chat.js').match(/className: 'bt-sheet-catcher', onClick: close/g) ?? []
  assert.equal(catchers.length, 2, 'each new-chat sheet renders one catcher that closes it')
})
