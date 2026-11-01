import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TIER_EXPANDED, TIER_MEDIUM, TIER_SHORT, tierOf } from '../src/client/tier.js'

// The width decides between the three tiers; a short window is compact whatever its width,
// because a phone on its side has width but only a few lines to give a column.
test('the window has three width tiers, and a short one is compact', () => {
  assert.deepEqual(
    [tierOf(TIER_MEDIUM - 1, 900), tierOf(TIER_MEDIUM, 900), tierOf(TIER_EXPANDED - 1, 900), tierOf(TIER_EXPANDED, 900)],
    ['compact', 'medium', 'medium', 'expanded'],
  )
  assert.equal(tierOf(915, TIER_SHORT - 1), 'compact', 'a phone on its side stays compact')
  assert.equal(tierOf(700, TIER_SHORT), 'medium', 'at the height limit the width decides again')
  assert.equal(tierOf(915, TIER_SHORT), 'expanded')
  assert.equal(tierOf(400, TIER_SHORT - 1), 'compact')
})
