// Minimal coverage for the local features that carry no test of their own. Each case pins
// behaviour or wiring, not pixels: colour, sizes and spacing stay the reviewer's business.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GAZE } from '../src/client/gaze.js'

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
