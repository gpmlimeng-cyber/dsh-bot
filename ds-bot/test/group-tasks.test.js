// Group task board: storage, six-state machine, dependencies, attempts, revisions, gate.
// Pure host logic — it imports only node:crypto, so this file runs without the harness.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install } from '../src/host/tasks.js'

const BOTS = { 'bot-a': { id: 'bot-a', name: 'Alice' }, 'bot-b': { id: 'bot-b', name: 'Bob' } }

function board() {
  const state = { rooms: { r1: { id: 'r1', name: 'Group', members: ['bot-a', 'bot-b'], tasks: [], tasksSeq: 0, tasksVersion: 0 } } }
  const rt = { roomOf: id => state.rooms[id], botOf: id => BOTS[id], save: async () => {} }
  install(rt)
  return { rt, room: state.rooms.r1 }
}

const failCode = async (fn) => {
  try { await fn(); return 'no-error' } catch (error) { return error.code ?? error.message }
}
const byNo = (view, no) => view.tasks.find(task => task.no === no)

test('a new task gets a number, rev 1 and shows up in the view', async () => {
  const { rt } = board()
  const { task } = await rt.taskAdd('r1', { title: 'Write the test', assignee: 'bot-a' })
  assert.equal(task.no, 1)
  assert.equal(task.status, 'pending')
  assert.equal(task.rev, 1)
  const view = await rt.tasksView('r1')
  assert.equal(view.counts.pending, 1)
  assert.equal(view.tasks.length, 1)
  assert.deepEqual(view.ready, [task.id])
})

test('a dependency blocks the start until the prerequisite is done', async () => {
  const { rt } = board()
  const a = (await rt.taskAdd('r1', { title: 'A', assignee: 'bot-a' })).task
  let b = (await rt.taskAdd('r1', { title: 'B', deps: [a.id], assignee: 'bot-b' })).task
  const blocked = await failCode(() => rt.taskUpdate('r1', { id: b.id, rev: b.rev, attemptId: b.attemptId, status: 'doing', by: 'bot-b' }))
  assert.equal(blocked, 'task/blocked')
  let task = byNo(await rt.tasksView('r1'), 1)
  task = (await rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId, status: 'claimed', by: 'bot-a' })).task
  task = (await rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId, status: 'doing', by: 'bot-a' })).task
  await rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId, status: 'done', by: 'bot-a' })
  const view = await rt.tasksView('r1')
  assert.ok(view.ready.includes(b.id), 'B unlocks once A is done')
})

test('reassignment bumps attempt and voids the old attempt id', async () => {
  const { rt } = board()
  let task = (await rt.taskAdd('r1', { title: 'A', assignee: 'bot-a' })).task
  task = (await rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId, assignee: 'bot-b', by: 'user' })).task
  assert.equal(task.attempt, 2)
  assert.equal(task.status, 'pending')
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: 'a_old', status: 'claimed', by: 'bot-b' })), 'task/stale')
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: task.id, rev: task.rev - 1, attemptId: task.attemptId, status: 'claimed', by: 'bot-b' })), 'task/conflict')
})

test('dependencies cannot form a cycle, and self/unknown deps are refused', async () => {
  const { rt } = board()
  const d = (await rt.taskAdd('r1', { title: 'D' })).task
  const e = (await rt.taskAdd('r1', { title: 'E' })).task
  await rt.taskUpdate('r1', { id: d.id, rev: d.rev, attemptId: d.attemptId, deps: [e.id], by: 'user' })
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: e.id, rev: e.rev, attemptId: e.attemptId, deps: [d.id], by: 'user' })), 'task/cycle')
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: e.id, rev: e.rev, attemptId: e.attemptId, deps: [e.id], by: 'user' })), 'task/deps')
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: e.id, rev: e.rev, attemptId: e.attemptId, deps: ['t_missing'], by: 'user' })), 'task/deps')
})

test('one member holds at most one claimed/doing task', async () => {
  const { rt } = board()
  const first = (await rt.taskAdd('r1', { title: 'One', assignee: 'bot-a' })).task
  await rt.taskUpdate('r1', { id: first.id, rev: first.rev, attemptId: first.attemptId, status: 'claimed', by: 'bot-a' })
  const second = (await rt.taskAdd('r1', { title: 'Two', assignee: 'bot-a' })).task
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: second.id, rev: second.rev, attemptId: second.attemptId, status: 'claimed', by: 'bot-a' })), 'task/busy')
})

test('the review gate needs a verdict; needs_revision files a repair task', async () => {
  const { rt } = board()
  let review = (await rt.taskAdd('r1', { title: 'Review X', kind: 'review', gate: true, assignee: 'bot-a' })).task
  review = (await rt.taskUpdate('r1', { id: review.id, rev: review.rev, attemptId: review.attemptId, status: 'doing', by: 'bot-a' })).task
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: review.id, rev: review.rev, attemptId: review.attemptId, status: 'done', by: 'bot-a' })), 'task/gate')
  review = (await rt.taskUpdate('r1', { id: review.id, rev: review.rev, attemptId: review.attemptId, status: 'done', verdict: 'needs_revision', acceptance: 'needs tests', by: 'bot-a' })).task
  assert.equal(review.status, 'failed')
  const repair = (await rt.tasksView('r1')).tasks.at(-1)
  assert.equal(repair.kind, 'repair')
  assert.deepEqual(repair.deps, [])
})

test('goal-owned tasks are read-only for status and assignee', async () => {
  const { rt, room } = board()
  room.tasks.push({ id: 't_goal', roomId: 'r1', no: 9, title: 'Goal stage', status: 'pending', assignee: 'bot-a', attempt: 1, attemptId: 'a_goal', rev: 1, deps: [], kind: 'work', gate: false, source: 'goal', createdAt: 1, updatedAt: 1, events: [] })
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: 't_goal', rev: 1, attemptId: 'a_goal', status: 'claimed', by: 'bot-a' })), 'task/readonly')
})

test('remove refuses dependents and non-creators, and comments only append', async () => {
  const { rt } = board()
  const a = (await rt.taskAdd('r1', { title: 'A', by: 'user' })).task
  const b = (await rt.taskAdd('r1', { title: 'B', deps: [a.id], by: 'bot-b' })).task
  assert.equal(await failCode(() => rt.taskRemove('r1', { id: a.id, rev: a.rev, by: 'user' })), 'task/deps')
  assert.equal(await failCode(() => rt.taskRemove('r1', { id: b.id, rev: b.rev, by: 'user' })), 'task/forbidden')
  const { event } = await rt.taskComment('r1', { id: a.id, text: 'note', by: 'user' })
  assert.equal(event.kind, 'comment')
  assert.equal(rt.taskEvents('r1', a.id).events.at(-1).text, 'note')
  assert.ok((await rt.taskRemove('r1', { id: b.id, rev: b.rev, by: 'bot-b' })).ok)
})

test('a request changes one class only, and mismatches are refused', async () => {
  const { rt } = board()
  const task = (await rt.taskAdd('r1', { title: 'A', assignee: 'bot-a' })).task
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId, status: 'doing', assignee: 'bot-b', by: 'user' })), 'task/invalid')
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: task.id, rev: task.rev, attemptId: task.attemptId })), 'task/invalid')
})

test('goal stages sync into the board, follow the goal, and stay read-only', async () => {
  const { rt, room } = board()
  room.goal = {
    id: 'g1', status: 'active', current: 0, stages: [
      { id: 's1', status: 'active', tasks: [{ botId: 'bot-a', task: 'Design', status: 'working' }] },
      { id: 's2', status: 'pending', tasks: [{ botId: 'bot-b', task: 'Build', status: 'pending' }] },
    ],
  }
  let view = await rt.tasksView('r1')
  assert.equal(view.tasks.length, 2)
  const [design, build] = view.tasks
  assert.equal(design.source, 'goal')
  assert.equal(design.status, 'doing')
  assert.equal(build.status, 'pending')
  assert.deepEqual(build.deps, [design.id])
  assert.equal(await failCode(() => rt.taskUpdate('r1', { id: design.id, rev: design.rev, attemptId: design.attemptId, status: 'claimed', by: 'bot-a' })), 'task/readonly')
  room.goal.stages[0].status = 'passed'
  room.goal.stages[0].tasks[0].status = 'done'
  room.goal.current = 1
  room.goal.stages[1].status = 'active'
  view = await rt.tasksView('r1')
  assert.equal(view.tasks[0].status, 'done')
  assert.ok(view.ready.includes(view.tasks[1].id), 'next stage unlocks after the previous passes')
  room.goal.stages = [room.goal.stages[0]]
  view = await rt.tasksView('r1')
  assert.equal(view.tasks.find(task => task.title === 'Build').status, 'cancelled')
})
