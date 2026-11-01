import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { install, policyOf } from '../src/host/authorization.js'

// A team of two Bots in one room, with the two entries the gate wraps.
function bench(prefs = {}, { fail = false } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-authz-'))
  const calls = []
  const rt = {
    home,
    warn: () => {},
    state: {
      prefs,
      mainBotIds: ['chief'],
      bots: { chief: { id: 'chief', instructions: 'lead' }, dev: { id: 'dev', instructions: 'build' } },
      rooms: { room1: { members: ['chief', 'dev'], admin: 'chief' } },
    },
    deliver: async (args) => {
      calls.push(['deliver', args])
      if (fail) throw new Error('delivery failed')
      return { ok: true }
    },
    postToRoom: async (...all) => {
      calls.push(['postToRoom', all])
      return 'posted'
    },
  }
  install(rt)
  const path = join(home, 'authorization.jsonl')
  const lines = () => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [])
  return { rt, calls, lines, path, done: () => rmSync(home, { recursive: true, force: true }) }
}

const handoff = { fromId: 'dev', toId: 'chief', role: 'reply', text: 'the data is ready' }
const fromUser = { toId: 'dev', roomId: 'room1', role: 'room', text: 'check the data' }

test('the switch starts on: a team that never touched it records', async () => {
  const b = bench()
  try {
    await b.rt.deliver(handoff)
    const [line] = b.lines()
    assert.ok(line, 'the default team recorded nothing')
    assert.equal(line.admitted, true)
    assert.equal(line.rule, 'message_bot')
    assert.equal(line.fromId, 'dev')
    assert.equal(line.toId, 'chief')
    assert.equal(line.roomId, undefined)
    assert.match(line.policy, /^[0-9a-f]{16}$/)
    assert.equal(typeof line.ts, 'number')
    assert.ok(Number.isFinite(line.deliver_us) && line.deliver_us >= 0)
    assert.ok(Number.isFinite(line.overhead_us) && line.overhead_us >= 0)
    // The message's words never reach the log.
    assert.equal(JSON.stringify(line).includes('the data is ready'), false)
  } finally { b.done() }
})

test('the user’s own message is not recorded', async () => {
  const b = bench()
  try {
    await b.rt.deliver(handoff)
    await b.rt.deliver(fromUser)
    assert.equal(b.lines().length, 1)
  } finally { b.done() }
})

test('a group post is recorded as the relay it is', async () => {
  const b = bench()
  try {
    await b.rt.postToRoom({ id: 'room1' }, { id: 'dev' }, 'relayed', { member: true })
    const [line] = b.lines()
    assert.equal(line.rule, 'post_to_room')
    assert.equal(line.fromId, 'dev')
    assert.equal(line.roomId, 'room1')
    assert.equal(line.toId, undefined)
  } finally { b.done() }
})

test('switched off: nothing is recorded, no file appears, and the call passes through whole', async () => {
  const b = bench({ superagent: false })
  try {
    assert.deepEqual(await b.rt.deliver(handoff), { ok: true })
    assert.equal(await b.rt.postToRoom({ id: 'room1' }, { id: 'dev' }, 'hello', { progress: true }, ['f']), 'posted')
    assert.deepEqual(b.calls, [
      ['deliver', handoff],
      ['postToRoom', [{ id: 'room1' }, { id: 'dev' }, 'hello', { progress: true }, ['f']]],
    ])
    assert.equal(existsSync(b.path), false, 'off still created the log')
    assert.deepEqual(b.lines(), [])
  } finally { b.done() }
})

test('switched off: a failed delivery keeps its exception and its message', async () => {
  const b = bench({ superagent: false }, { fail: true })
  try {
    await assert.rejects(b.rt.deliver(handoff), /delivery failed/)
    assert.equal(existsSync(b.path), false)
  } finally { b.done() }
})

test('the switch flips without reinstalling the gate', async () => {
  const b = bench()
  try {
    await b.rt.deliver(handoff)
    assert.equal(b.lines().length, 1, 'the default did not record')
    b.rt.state.prefs.superagent = false
    await b.rt.deliver(handoff)
    assert.equal(b.lines().length, 1, 'switching off still recorded')
    b.rt.state.prefs.superagent = true
    await b.rt.deliver(handoff)
    assert.equal(b.lines().length, 2, 'switching back on did not record')
    // Deleting the key returns to the default, which records too.
    delete b.rt.state.prefs.superagent
    await b.rt.deliver(handoff)
    assert.equal(b.lines().length, 3)
  } finally { b.done() }
})

test('the policy hash follows the team’s shape, not its words', () => {
  const b = bench()
  try {
    const before = policyOf(b.rt.state)
    b.rt.state.bots.dev.instructions = 'build it differently'
    b.rt.state.rooms.room1.members = [...b.rt.state.rooms.room1.members]
    assert.equal(policyOf(b.rt.state), before, 'instruction text reached the hash')
    b.rt.state.rooms.room1.members = ['chief']
    const after = policyOf(b.rt.state)
    assert.notEqual(after, before)
    b.rt.state.mainBotIds = ['dev']
    assert.notEqual(policyOf(b.rt.state), after)
  } finally { b.done() }
})
