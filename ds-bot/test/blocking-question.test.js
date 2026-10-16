import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../index.js'
import { fakeContext } from './fake-ctx.js'

const QUESTION = 'ask_user_question'

const team = () => ({
  version: 1,
  mainBotIds: ['chief'],
  bots: {
    chief: { id: 'chief', sessionId: 'chief', name: 'Chief', role: 'Lead', instructions: '', createdAt: 1 },
    writer: { id: 'writer', sessionId: 'writer', name: 'Writer', role: 'Write', instructions: '', createdAt: 2 },
  },
  rooms: { room: { id: 'room', name: 'Desk', members: ['chief', 'writer'], sessions: { writer: 'room-writer' }, admin: 'chief', mode: 'everyone' } },
  agents: { dsh: { id: 'dsh', name: 'DSH Agent', sessions: ['plain'], createdAt: 3 } },
  exchanges: [],
  exchangeTurns: {},
  questions: {},
  revision: 1,
})

// dsh keeps one Agent per Session and fires agent/created, waiting for its listeners,
// the first time a Session resolves one. restrict() calls are recorded per Session.
async function setup({ served = ['read', 'ask_user', QUESTION], goals } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-blocking-question-'))
  writeFileSync(join(home, 'state.json'), JSON.stringify(team()))
  const ctx = fakeContext({ services: goals === undefined ? {} : { goals } })
  const agents = new Map()
  const hidden = []
  const sent = []
  let sessions = 0
  const created = agent => Promise.all((ctx.listeners.get('agent/created') ?? []).map(listener => listener({ agent })))
  const agentFor = async (id) => {
    if (agents.has(id)) return agents.get(id)
    const agent = {
      id,
      session: { id },
      ctx: {
        tools: { restrict: (filter) => { hidden.push([id, [...filter.deny]]); return () => {} } },
        effect: execute => execute(),
      },
      followup: message => sent.push({ sessionId: id, message }),
    }
    agents.set(id, agent)
    await created(agent)
    return agent
  }
  ctx.tools.schemas = () => served.map(name => ({ name }))
  Object.assign(ctx, {
    llm: {
      listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
      listModels: async () => [{ id: 'deepseek-v4-flash' }],
      resolveModelInfo: async () => ({}),
    },
    workspaceRegistry: {
      get: () => undefined,
      resolveByPath: async () => undefined,
      create: async path => ({ id: 'w1', path }),
      archiveSession: async () => {},
    },
    sessionController: {
      create: async () => ({ sessionId: `new${++sessions}` }),
      resolveAgent: async id => ({ agent: await agentFor(id) }),
      selectModel: async () => {},
    },
    sessionTitle: { rename: async () => {} },
    sessions: { flush: async () => {} },
  })
  // The client talks to the runtime over one fetch route; capturing it lets a test answer or
  // dismiss a card the way the dock does.
  let route
  const registerFetch = ctx.connection.fetch.register
  ctx.connection.fetch.register = (options) => {
    route = options
    return registerFetch(options)
  }
  const rt = createRuntime(ctx, { home, github: false, diagnosticsFile: false })
  await rt.load()
  const post = async (endpoint, payload) => (await (await route.fetch(new Request('http://localhost/api/bot', {
    method: 'POST',
    body: JSON.stringify({ endpoint, payload }),
  }))).json()).value
  const ask = (sessionId, options = [{ label: 'Lookout' }], callId = 'call-1') => ctx.registeredTools.get('ask_user').execute(
    { question: 'Which name?', options },
    { agent: { id: sessionId }, callId, concludeTurn() {} },
  )
  const guard = (name, sessionId) => ctx.guards.map(check => check({ name, agent: sessionId === undefined ? undefined : { id: sessionId } })).find(reason => reason !== undefined)
  const hiddenIn = id => hidden.filter(([sessionId, deny]) => sessionId === id && deny.includes(QUESTION))
  const stop = async () => {
    await ctx.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
  }
  return { ctx, rt, ask, post, agentFor, hidden, hiddenIn, guard, sent, stop }
}

// DSH's goal service, holding one goal per Session; block() records what was asked.
function goalService() {
  const current = new Map()
  const blocked = []
  return {
    current,
    blocked,
    get: agent => current.get(agent.id),
    block(agent, ref, reason) {
      const goal = current.get(agent.id)
      assert.deepEqual(ref, { id: goal.id, revision: goal.revision })
      blocked.push({ sessionId: agent.id, ...reason })
      current.set(agent.id, { ...goal, revision: goal.revision + 1, phase: 'blocked' })
    },
  }
}

// What DSH logs when /goal starts a goal: a snapshot change of the Session's goal log.
const startGoal = (ctx, goals, sessionId) => {
  const goal = { id: `goal-${sessionId}`, revision: 1, objective: 'Ship it', phase: 'active', maxGoalRounds: 256 }
  goals?.current.set(sessionId, goal)
  const event = { type: 'goal/change', data: { kind: 'goal/change', version: 1, operation: 'create', goal, roundsStarted: 0, createdAt: 1, updatedAt: 1 } }
  for (const listener of ctx.listeners.get('session/event') ?? []) listener({ id: sessionId }, event)
}

const until = async (check) => {
  const end = Date.now() + 2000
  while (!check()) {
    if (Date.now() > end) throw new Error('until: the condition did not hold within 2 s')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

test('a Bot\'s own chat and its group Session lose dsh\'s blocking question tool; other Sessions keep it', async (t) => {
  const { agentFor, hidden, hiddenIn, stop } = await setup()
  t.after(stop)
  for (const id of ['chief', 'writer', 'room-writer', 'plain', 'elsewhere']) await agentFor(id)
  assert.equal(hiddenIn('chief').length, 1)
  assert.equal(hiddenIn('writer').length, 1)
  assert.equal(hiddenIn('room-writer').length, 1)
  assert.deepEqual(hiddenIn('plain'), [])
  assert.deepEqual(hiddenIn('elsewhere'), [])
  // The mask names only that tool, never ds-bot's own ask_user.
  for (const [sessionId, deny] of hidden.filter(([id]) => id !== 'plain')) assert.deepEqual([sessionId, deny], [sessionId, [QUESTION]])
})

test('ds-bot resolving a Bot\'s Agent again does not hide the tool twice', async (t) => {
  const { rt, hiddenIn, stop } = await setup()
  t.after(stop)
  await rt.resolveAgent('writer')
  await rt.resolveAgent('writer')
  await rt.deliver({ fromId: 'chief', toId: 'writer', text: 'hi', role: 'request' })
  assert.equal(hiddenIn('writer').length, 1)
})

test('a profile without the tool gets no mask, which restrict() would refuse', async (t) => {
  const { agentFor, hidden, guard, stop } = await setup({ served: ['read', 'ask_user'] })
  t.after(stop)
  await agentFor('writer')
  assert.deepEqual(hidden, [])
  // The guard still holds should a later profile serve it.
  assert.match(guard(QUESTION, 'writer'), /Bots cannot use ask_user_question/)
})

test('the guard refuses the blocking question tool in Bot Sessions only', async (t) => {
  const { guard, stop } = await setup()
  t.after(stop)
  for (const sessionId of ['chief', 'writer', 'room-writer']) assert.match(guard(QUESTION, sessionId), /Ask with ask_user in your own chat, or ask in your reply\./)
  for (const sessionId of ['plain', 'elsewhere', undefined]) assert.equal(guard(QUESTION, sessionId), undefined)
  assert.equal(guard('ask_user', 'writer'), undefined)
  assert.equal(guard('read', 'writer'), undefined)
})

// FeiZhuLulu/DeepSeek-Bot#77: a new Bot told never to use a question tool was opened
// with "use ask_user", and a model that picked dsh's ask_user_question for it held the
// Bot until the card was answered, with other Bots' messages queued behind it.
test('a new Bot that rules out question tools opens without one and cannot block on dsh\'s', async (t) => {
  const { rt, hiddenIn, guard, sent, stop } = await setup()
  t.after(stop)
  const receiver = await rt.createBot({ name: 'Receiver', instructions: 'Never use ask_user or any question tool.', createdBy: 'chief' })
  await until(() => sent.some(entry => entry.sessionId === receiver.id))
  const kickoff = sent.find(entry => entry.sessionId === receiver.id).message.content[0].text
  assert.doesNotMatch(kickoff, /ask_user|allowCustom/)
  assert.match(kickoff, /Where your instructions say otherwise, follow them\./)
  // The Agent was made before Receiver was on the team; the kickoff trims its list.
  assert.equal(hiddenIn(receiver.id).length, 1)
  assert.match(guard(QUESTION, receiver.id), /Bots cannot use ask_user_question/)
})

// Fei2411/DeepSeek-Bot#133: /goal in a group chat started DSH's goal rounds, which the
// group never answered, so round after round ran and showed the raw goal prompt.
test('a Bot\'s chat and its group Sessions lose the goal tools; other Sessions keep them', async (t) => {
  const { agentFor, hidden, stop } = await setup({ served: ['read', 'ask_user', QUESTION, 'create_goal', 'update_goal', 'get_goal'] })
  t.after(stop)
  for (const id of ['chief', 'room-writer', 'plain']) await agentFor(id)
  // A DSH Agent Session ('plain') has its own mask, which leaves the goal tools.
  assert.deepEqual(hidden.filter(([, deny]) => deny.includes('create_goal')), [
    ['chief', [QUESTION, 'create_goal', 'update_goal', 'get_goal']],
    ['room-writer', [QUESTION, 'create_goal', 'update_goal', 'get_goal']],
  ])
})

test('a goal started in a Bot chat or a group is blocked; one elsewhere runs', async (t) => {
  const goals = goalService()
  const { ctx, agentFor, stop } = await setup({ goals })
  t.after(stop)
  const ids = ['writer', 'room', 'room-writer', 'plain']
  for (const id of ids) await agentFor(id)
  for (const id of ids) startGoal(ctx, goals, id)
  // The block waits until DSH has handed the change to every listener.
  assert.deepEqual(goals.blocked, [])
  await until(() => goals.blocked.length === 3)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(goals.blocked.map(entry => entry.sessionId), ['writer', 'room', 'room-writer'])
  for (const entry of goals.blocked) assert.deepEqual([entry.code, entry.message], ['not-supported', 'DS Bot does not run goals. Ask the Bot in a message instead.'])
  assert.equal(goals.current.get('plain').phase, 'active')
})

test('without DSH\'s goal service a goal change is left alone', async (t) => {
  const { ctx, rt, agentFor, stop } = await setup()
  t.after(stop)
  const warnings = []
  rt.warn = (...args) => warnings.push(args)
  await agentFor('writer')
  startGoal(ctx, undefined, 'writer')
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(warnings, [])
})

// A member Bot works in the group from a hidden Session of its own, so a card it asks for used
// to land where the user never looks. The room carries the card now; the answer still belongs
// to the Session that asked.
test('a card asked in a group chat waits in the room and answers the Session that asked', async (t) => {
  const { rt, ask, post, sent, stop } = await setup()
  t.after(stop)
  assert.match(await ask('room-writer'), /card is on screen/)
  const card = rt.state.questions.room
  assert.equal(card.mirrorOf, 'room-writer')
  assert.equal(card.question, 'Which name?')
  // No call: a group transcript does not draw the member's hidden call, so the dock takes it.
  assert.equal(card.callId, undefined)
  const waiting = rt.state.questions['room-writer']
  assert.equal(waiting.id, card.id)
  assert.equal(waiting.mirroredTo, 'room')
  await post('answer-question', { sessionId: 'room', questionId: card.id, answer: { selected: ['Lookout'] } })
  assert.deepEqual(rt.state.questions, {})
  assert.deepEqual(sent.map(entry => entry.sessionId), ['room-writer'])
  assert.match(sent[0].message.content[0].text, /"selected":\["Lookout"\]/)
})

test('a card in a Bot\'s own chat stays on its own Session, with no copy in any room', async (t) => {
  const { rt, ask, post, sent, stop } = await setup()
  t.after(stop)
  await ask('writer')
  const card = rt.state.questions.writer
  assert.equal(card.mirrorOf, undefined)
  assert.equal(card.mirroredTo, undefined)
  assert.equal(card.callId, 'call-1')
  assert.equal(rt.state.questions.room, undefined)
  await post('answer-question', { sessionId: 'writer', questionId: card.id, answer: { selected: ['Lookout'] } })
  assert.deepEqual(rt.state.questions, {})
  assert.deepEqual(sent.map(entry => entry.sessionId), ['writer'])
})

test('dismissing a room\'s card, or deleting the room, leaves no copy behind', async (t) => {
  const { rt, ask, post, stop } = await setup()
  t.after(stop)
  await ask('room-writer')
  await post('dismiss-question', { sessionId: 'room' })
  assert.deepEqual(rt.state.questions, {})
  await ask('room-writer')
  assert.equal(Object.keys(rt.state.questions).length, 2)
  await rt.deleteRoom('room')
  assert.deepEqual(rt.state.questions, {})
})

// One card per Session is what the dock can show: a second one would sit on the hidden Session
// where nobody sees it, so the tool says so instead.
test('a second card in one group chat is refused, leaving the first one alone', async (t) => {
  const { rt, ask, stop } = await setup()
  t.after(stop)
  await ask('room-writer')
  const before = JSON.stringify(rt.state.questions)
  assert.match(await ask('room-writer'), /already waiting in this group chat/)
  assert.equal(JSON.stringify(rt.state.questions), before)
})
