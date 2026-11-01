// The two endpoints the phone app reads but the web view never needed: `room-chat` and
// `notices`. Their fields come from dsh_client's `DsBotRoomPage` and `DsBotNotices`, so
// these keep the answers to that shape and to the three cases every new endpoint owes:
// a client from another run, a missing field, and input the host does not know.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install as installChannel, CAPABILITIES } from '../src/host/channel.js'
import { BOOT_ID } from '../src/host/boot.js'
import { HISTORY_PAGE } from '../src/host/constants.js'

const ROOM_ID = 'room'

function runtime({ revision = 12 } = {}) {
  const routes = []
  const ctx = {
    on: () => () => {},
    effect: fn => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
    get: () => undefined,
    provide: () => {},
    tool: () => {},
    sessions: { flush: async () => {} },
    connection: { fetch: { register: route => { routes.push(route); return () => {} } } },
  }
  const bots = { writer: { id: 'writer', name: 'Writer', color: 'blue', sessionId: 's-writer' } }
  const rooms = {
    [ROOM_ID]: {
      id: ROOM_ID,
      name: 'Launch plan',
      seq: 3,
      members: ['writer'],
      log: [
        { seq: 1, who: 'User', text: 'Kick off the plan' },
        { seq: 2, who: 'Writer', botId: 'writer', text: 'Here is a draft' },
        { seq: 3, who: 'DS Bot', kind: 'notice', reason: 'missed', text: '' },
      ],
    },
  }
  const rt = {
    ctx,
    state: { revision, mainBotIds: [], prefs: {}, agents: {}, rooms, bots, questions: {}, views: {} },
    refresh: async () => {},
    readOnly: () => undefined,
    memoryEnabled: true,
    load: async () => {},
    save: async () => {},
    catalog: async () => {},
    loadSecrets: async () => {},
    chatOwners: new Map([['s-writer', 'writer']]),
    chatOf: id => (bots[id]?.sessionId ?? id),
    selfOf: () => undefined,
    roomOf: id => (id === undefined ? undefined : rooms[id]),
    botOf: id => (id === undefined ? undefined : bots[id]),
    roomProgress: new Map(),
  }
  installChannel(rt)
  return { routes, rt, rooms, bots }
}

async function ask(routes, endpoint, payload) {
  const route = routes.find(entry => entry.path === '/api/bot')
  const request = { json: async () => ({ endpoint, payload }), signal: new AbortController().signal }
  return (await route.fetch(request)).json()
}

const value = async (routes, endpoint, payload) => {
  const answer = await ask(routes, endpoint, payload)
  assert.equal(answer.ok, true, answer.error?.message)
  return answer.value
}

test('a page of a group chat says who spoke, and what the round did', async () => {
  const { routes } = runtime()
  const page = await value(routes, 'room-chat', { roomId: ROOM_ID })
  assert.equal(page.roomId, ROOM_ID)
  assert.deepEqual(page.items.map(item => item.kind), ['user', 'bot', 'event'])
  assert.deepEqual(page.items.map(item => item.id), ['1', '2', '3'])
  assert.equal(page.items[0].name, 'User')
  assert.equal(page.items[1].botId, 'writer')
  assert.equal(page.items[1].name, 'Writer')
  assert.equal(page.items[1].color, 'blue')
  // The notice carries why it happened, which is the event the phone draws.
  assert.equal(page.items[2].event, 'missed')
  assert.equal(page.cursor, null)
  assert.equal(page.running, false)
});

test('an older page names the line before it, and the round it is in', async () => {
  const { routes, rooms, rt } = runtime()
  const log = []
  for (let seq = 1; seq <= HISTORY_PAGE + 20; seq++) log.push({ seq, who: 'User', text: `line ${seq}` })
  rooms[ROOM_ID].log = log
  rooms[ROOM_ID].seq = log.length
  rt.roomProgress.set('call-1', { roomId: ROOM_ID, replies: {}, speaking: 'Writer' })

  const newest = await value(routes, 'room-chat', { roomId: ROOM_ID })
  assert.equal(newest.items.length, HISTORY_PAGE)
  assert.equal(newest.items.at(-1).id, String(log.length))
  assert.deepEqual(newest.cursor, { beforeSeq: log.length - HISTORY_PAGE + 1 })
  assert.equal(newest.running, true)
  assert.equal(newest.speaking, 'Writer')

  const older = await value(routes, 'room-chat', { roomId: ROOM_ID, cursor: newest.cursor })
  assert.equal(older.items.length, 20)
  assert.equal(older.items.at(-1).id, String(log.length - HISTORY_PAGE))
  assert.equal(older.cursor, null)
});

test('a group chat the host has not got is an answer, not a crash', async () => {
  const { routes } = runtime()
  assert.deepEqual(await ask(routes, 'room-chat', {}), {
    ok: false,
    error: { code: 'bot/invalid', message: 'No group chat named', details: {} },
  })
  const gone = await ask(routes, 'room-chat', { roomId: 'nowhere' })
  assert.equal(gone.ok, false)
  assert.equal(gone.error.code, 'bot/not-found')
});

test('a field this host does not know is ignored, as on every other endpoint', async () => {
  const { routes } = runtime()
  const page = await value(routes, 'room-chat', { roomId: ROOM_ID, cursor: null, from: 'a later client' })
  assert.equal(page.items.length, 3)
});

test('notices answer the host start and revision the client has already read', async () => {
  const { routes, rt } = runtime({ revision: 12 })
  rt.state.questions['s-writer'] = { id: 'q1', question: 'Which release?', askedAt: 1700000000000 }
  rt.state.views['s-writer'] = { id: 'v1', title: 'Pick a plan' }

  // Nothing new since the revision this client already saw.
  assert.deepEqual(await value(routes, 'notices', { boot: BOOT_ID, since: 12 }), { boot: BOOT_ID, seq: 12, reset: false, notices: [] })

  const fresh = await value(routes, 'notices', { boot: BOOT_ID, since: 11 })
  assert.equal(fresh.boot, BOOT_ID)
  assert.equal(fresh.seq, 12)
  assert.equal(fresh.reset, false)
  const kinds = fresh.notices.map(notice => notice.kind).sort()
  assert.deepEqual(kinds, ['group', 'question', 'view'])
  const question = fresh.notices.find(notice => notice.kind === 'question')
  assert.equal(question.botId, 'writer')
  assert.equal(question.name, 'Writer')
  assert.equal(question.sessionId, 's-writer')
  assert.equal(question.text, 'Which release?')
  assert.equal(question.time, 1700000000000)
  const group = fresh.notices.find(notice => notice.kind === 'group')
  assert.equal(group.roomId, ROOM_ID)
  assert.equal(group.title, 'Launch plan')
});

test('a client from another host start, or from the future, is told to read the team again', async () => {
  const { routes } = runtime({ revision: 12 })
  const otherStart = await value(routes, 'notices', { boot: 'another-run', since: 12 })
  assert.equal(otherStart.reset, true)
  assert.equal(otherStart.notices.length > 0, true)
  // A revision this host never reached cannot be a picture of the team either.
  const future = await value(routes, 'notices', { boot: BOOT_ID, since: 99 })
  assert.equal(future.reset, true)
  assert.equal(future.seq, 12)
});

test('the advertised capabilities cover the two new reads, and an unknown endpoint stays an answer', async () => {
  assert.equal(CAPABILITIES.includes('room-chat'), true)
  assert.equal(CAPABILITIES.includes('notices'), true)
  const { routes } = runtime()
  const unknown = await ask(routes, 'room-chat-history', { roomId: ROOM_ID })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'bot/not-found')
});
