// The phone drops the note a picture's reading leaves in a line's text; the words
// around it must come through exactly as logged.
import assert from 'node:assert/strict'
import test from 'node:test'

import { stripImageReadings } from '../src/host/image-notes.js'

const note = '[Image "shot.jpg", read by a vision model:]\nA cat on a sofa.\n[End of image "shot.jpg"]'
const failed = '[Image "shot.jpg": it could not be read right now. Ask the user what it shows if it matters.]'

test('a line with readings loses exactly those notes', () => {
  assert.equal(stripImageReadings(`look at this\n${note}`, [note]), 'look at this')
})

test('an older line falls back to the note’s shape', () => {
  assert.equal(stripImageReadings(`look at this\n${note}`, undefined), 'look at this')
})

test('a note the text does not carry is left alone', () => {
  const text = 'plain words'
  assert.equal(stripImageReadings(text, []), text)
  assert.equal(stripImageReadings(text, [note]), text)
})

test('blank lines in the words are kept', () => {
  assert.equal(stripImageReadings(`first\n\nsecond\n${note}`, [note]), 'first\n\nsecond')
})

test('a picture that could not be read is dropped too', () => {
  assert.equal(stripImageReadings(`look\n${failed}`, undefined), 'look')
})
