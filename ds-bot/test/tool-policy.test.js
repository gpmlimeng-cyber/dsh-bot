import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OPEN_TOOLS, STALLED_AFTER, TOOL_POLICY_DEFAULT, toolDecision, toolPolicyOf } from '../src/shared/tool-policy.js'
import { applySuperAgentPrefs } from '../src/shared/superagent-prefs.js'

// Off by neither: the mode a team that never touched the page has is observe, which only
// writes a line. An unknown stored value falls back to it rather than to auto.
test('the tool policy reads observe unless a known mode was saved', () => {
  assert.equal(TOOL_POLICY_DEFAULT, 'observe')
  assert.deepEqual([toolPolicyOf({}), toolPolicyOf(undefined), toolPolicyOf({ saToolPolicy: 'auto' }), toolPolicyOf({ saToolPolicy: 'off' }), toolPolicyOf({ saToolPolicy: 'nope' })], ['observe', 'observe', 'auto', 'off', 'observe'])
})

test('a mode writes all three values, null resets it, and anything else is refused', () => {
  assert.deepEqual(applySuperAgentPrefs({}, { saToolPolicy: 'auto' }), { saToolPolicy: 'auto' })
  assert.deepEqual(applySuperAgentPrefs({ saToolPolicy: 'auto' }, { saToolPolicy: null }), {})
  for (const mode of ['on', 'OFF', true, 1, 'would_deny']) {
    assert.throws(() => applySuperAgentPrefs({}, { saToolPolicy: mode }), error => error.code === 'bot/invalid', `refused: ${String(mode)}`)
  }
})

const decide = (extra) => toolDecision({ mode: 'auto', name: 'write', admission: 'inferred', ...extra })

// The table's order matters: the whitelist first, then a turn nothing was recorded for,
// then the user's own request, and only then the relayed case.
test('a relayed call is asked about, and every pass-through case is allowed first', () => {
  assert.deepEqual(decide({}), { decision: 'ask', rule: 'relay-not-authorization' })
  assert.deepEqual(decide({ admission: 'explicit' }), { decision: 'allow', rule: 'explicit' })
  assert.deepEqual(decide({ admission: undefined }), { decision: 'allow', rule: 'unknown' })
  assert.deepEqual(decide({ granted: true }), { decision: 'allow', rule: 'granted' })
  for (const name of OPEN_TOOLS) assert.deepEqual(decide({ name }), { decision: 'allow', rule: 'open' }, name)
  // A program's own transport call is allowed; the calls it makes inside are judged.
  assert.deepEqual(decide({ name: 'run_code' }), { decision: 'allow', rule: 'transport' })
  assert.deepEqual(decide({ name: 'run_code', nested: true }), { decision: 'ask', rule: 'relay-not-authorization' })
})

test('observe only writes down what auto would have asked', () => {
  assert.deepEqual(decide({ mode: 'observe' }), { decision: 'would_deny', rule: 'relay-not-authorization' })
  // Even a stalled tool is only recorded: observe never changes what runs.
  assert.deepEqual(decide({ mode: 'observe', refusals: STALLED_AFTER }), { decision: 'would_deny', rule: 'relay-not-authorization' })
  assert.deepEqual(decide({ mode: 'off' }), { decision: 'allow', rule: 'off' })
})

test('after three refusals auto stops asking and says so', () => {
  assert.equal(STALLED_AFTER, 3)
  assert.deepEqual(decide({ refusals: 2 }), { decision: 'ask', rule: 'relay-not-authorization' })
  assert.deepEqual(decide({ refusals: 3 }), { decision: 'deny', rule: 'stalled' })
})
