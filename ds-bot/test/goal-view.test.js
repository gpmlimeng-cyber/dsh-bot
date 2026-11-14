import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../index.js'
import { fakeContext } from './fake-ctx.js'

// The room's goal as goals.js keeps it: stages with their tasks, the current
// index, and the words the admin and the user left behind.
const GOAL = {
  id: 'goal-1',
  revision: 7,
  status: 'complete',
  title: 'Merge upstream 1.0.16',
  objective: 'Bring the fork up to the upstream release',
  acceptance: 'CI is green',
  constraints: ['No force push'],
  current: 2,
  brief: 'what the user asked for',
  summary: 'what the admin delivered',
  evidence: 'the merge commit and its CI run',
  reason: '',
  stages: [
    {
      title: 'Merge and align',
      acceptance: 'the merge commit exists',
      status: 'passed',
      evidence: 'a374b8ab',
      reworks: 1,
      feedback: 'align the version first',
      tasks: [{ botId: 'a', id: 'task-1', task: 'merge', status: 'done', rework: 1, feedback: 'version was off' }],
    },
    {
      title: 'Independent check',
      acceptance: 'the tests agree',
      status: 'active',
      tasks: [{ botId: 'c', id: 'task-2', task: 'verify', status: 'working' }],
    },
  ],
}

const TEAM = {
  version: 1,
  mainBotIds: ['a'],
  revision: 3,
  bots: {
    a: { id: 'a', name: 'Chief', role: 'Boss', sessionId: 'a', createdAt: 1 },
    b: { id: 'b', name: 'Writer', role: 'Write', sessionId: 'b', createdAt: 2 },
    c: { id: 'c', name: 'Tester', role: 'Test', sessionId: 'c', createdAt: 3 },
  },
  rooms: { r1: { id: 'r1', name: 'Ops', named: true, admin: 'a', members: ['a', 'b', 'c'], mode: 'admin', createdAt: 1, goal: GOAL } },
  exchanges: [],
  questions: {},
}

function start(team = TEAM) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-goal-view-'))
  writeFileSync(join(home, 'state.json'), JSON.stringify(team))
  const ctx = fakeContext({ services: {} })
  ctx.sessionController = {
    resolveAgent: async sessionId => ({ agent: { session: { id: sessionId, seq: 100 } } }),
    page: async () => ({ records: [], hasMore: false }),
  }
  const routes = {}
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = (options) => {
    routes[options.path] = options
    return register(options)
  }
  apply(ctx, { home })
  const call = async (endpoint, payload) => {
    const response = await routes['/api/bot'].fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))
    return response.json()
  }
  const stop = async () => {
    await ctx.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
  return { call, stop }
}

test('goal-view gives the goal in the shape the app reads', async (t) => {
  const { call, stop } = start()
  t.after(stop)
  await call('state')
  const answer = await call('goal-view', { roomId: 'r1' })
  assert.equal(answer.ok, true)
  assert.equal(answer.value.roomId, 'r1')
  const goal = answer.value.goal
  // Exactly the fields DsBotGroupGoal.fromJson reads.
  assert.deepEqual(Object.keys(goal).sort(), [
    'acceptance', 'brief', 'constraints', 'current', 'evidence', 'id', 'idle',
    'objective', 'reason', 'revision', 'stageCount', 'stages', 'status', 'summary', 'title',
  ])
  assert.equal(goal.id, 'goal-1')
  assert.equal(goal.revision, 7)
  assert.equal(goal.status, 'complete')
  assert.equal(goal.stageCount, 2)
  assert.equal(goal.current, 2)
  assert.deepEqual(goal.constraints, ['No force push'])
  assert.deepEqual(Object.keys(goal.stages[0]).sort(), ['acceptance', 'evidence', 'feedback', 'reworks', 'status', 'tasks', 'title'])
  assert.equal(goal.stages[0].reworks, 1)
  assert.deepEqual(Object.keys(goal.stages[0].tasks[0]).sort(), ['bot', 'botId', 'feedback', 'rework', 'status', 'task'])
  // A task names its Bot by id and by name, as the panel draws it.
  assert.equal(goal.stages[1].tasks[0].botId, 'c')
  assert.equal(goal.stages[1].tasks[0].bot, 'Tester')
  assert.equal(goal.stages[0].tasks[0].rework, 1)
})

test('goal-view answers null for a room without a goal', async (t) => {
  const { call, stop } = start({ ...TEAM, rooms: { r1: { ...TEAM.rooms.r1, goal: undefined } } })
  t.after(stop)
  await call('state')
  const answer = await call('goal-view', { roomId: 'r1' })
  assert.equal(answer.ok, true)
  assert.equal(answer.value.goal, null)
})

test('goal-view refuses an unknown room the way the app expects', async (t) => {
  const { call, stop } = start()
  t.after(stop)
  await call('state')
  const answer = await call('goal-view', { roomId: 'nope' })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'bot/not-found')
})
