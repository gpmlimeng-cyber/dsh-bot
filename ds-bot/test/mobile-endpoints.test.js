// The two endpoints the phone app reads but the web view never needed: `room-chat` and
// `notices`. Their fields come from dsh_client's `DsBotRoomPage` and `DsBotNotices`, so
// these keep the answers to that shape and to the three cases every new endpoint owes:
// a client from another run, a missing field, and input the host does not know.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install as installChannel, CAPABILITIES } from '../src/host/channel.js'
import { install as installMobile } from '../src/host/mobile.js'

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
    sessionController: { prompt: async request => { prompts.push(request) } },
    connection: { fetch: { register: route => { routes.push(route); return () => {} } } },
  }
  const prompts = []
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
    pastOwners: new Map(),
    ensureCapabilities: async () => {},
    roomProgress: new Map(),
  }
  installMobile(rt)
  installChannel(rt)
  return { routes, rt, rooms, bots, prompts }
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







test('the advertised capabilities cover the two new reads, and an unknown endpoint stays an answer', async () => {
  assert.equal(CAPABILITIES.includes('room-chat'), true)
  assert.equal(CAPABILITIES.includes('notices'), true)
  const { routes } = runtime()
  const unknown = await ask(routes, 'room-chat-history', { roomId: ROOM_ID })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'bot/not-found')
});

test('a file with no text still reaches the session', async () => {
  const { routes, prompts } = runtime()
  const answer = await ask(routes, 'send', { sessionId: 's-writer', text: '', fileReceiptIds: ['r1', 'r2'] })
  assert.equal(answer.ok, true, answer.error?.message)
  assert.deepEqual(prompts[0].content, [{ type: 'file', receiptId: 'r1' }, { type: 'file', receiptId: 'r2' }])
});

test('a message with no text and no attachments is nothing to send', async () => {
  const { routes, prompts } = runtime()
  const answer = await ask(routes, 'send', { sessionId: 's-writer', text: '  ', images: [], fileReceiptIds: [] })
  assert.deepEqual(answer, { ok: false, error: { code: 'bot/invalid', message: 'Nothing to send', details: {} } })
  assert.equal(prompts.length, 0)
});

test('an image without data or a media type is dropped, not sent as a broken block', async () => {
  const { routes, prompts } = runtime()
  const answer = await ask(routes, 'send', {
    sessionId: 's-writer',
    text: 'look',
    images: [
      { mediaType: 'image/png' },
      { data: 'AAAA' },
      { mediaType: 'image/png', data: '' },
      null,
      { mediaType: 'image/png', data: 'AAAA', name: 'shot.png' },
    ],
  })
  assert.equal(answer.ok, true, answer.error?.message)
  assert.deepEqual(prompts[0].content, [
    { type: 'text', text: 'look' },
    { type: 'image', mediaType: 'image/png', data: 'AAAA', name: 'shot.png' },
  ])
});

test('more inline images than one message carries is refused', async () => {
  const { routes, prompts } = runtime()
  const images = Array.from({ length: 21 }, () => ({ mediaType: 'image/png', data: 'AAAA' }))
  const answer = await ask(routes, 'send', { sessionId: 's-writer', text: 'all of these', images })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.message, 'Too many images')
  assert.equal(prompts.length, 0)
});





// The group page and notices are read from the group Session's events now (mobile.js
// `roomChat`), not from the room log this file used to build: the cases above were
// written for that older shape and are being rewritten against a session fixture.

test('a group page keeps the 0.2.7 item shape a phone reads', async () => {
  const { routes } = runtime()
  const page = await value(routes, 'room-chat', { roomId: ROOM_ID })
  assert.equal(page.roomId, ROOM_ID)
  assert.deepEqual(page.items.map(item => item.kind), ['user', 'bot', 'event'])
  assert.deepEqual(page.items[0], { kind: 'user', id: '1', text: 'Kick off the plan', name: 'User' })
  assert.equal(page.items[1].botId, 'writer')
  assert.equal(page.items[1].name, 'Writer')
  assert.equal(page.items[1].color, 'blue')
  assert.equal(page.items[2].event, 'missed')
  assert.equal(page.cursor, null)
  assert.equal(page.running, false)
  // The Session-shaped answer is not there on a Host that cannot page one — and its
  // absence must not take the old answer down.
  assert.equal(page.sessionItems, undefined)
});

test('a line with files and a long body keeps files, images and whole', async () => {
  const { routes, rooms } = runtime()
  rooms[ROOM_ID].log = [
    {
      seq: 1,
      who: 'Writer',
      botId: 'writer',
      text: 'see the attachments',
      images: [{ attachmentId: 'a1', name: 'a.png', mediaType: 'image/png' }],
      files: [{ attachmentId: 'f1', name: 'notes.txt', mediaType: 'text/plain' }],
      length: 900,
    },
  ]
  const page = await value(routes, 'room-chat', { roomId: ROOM_ID })
  const item = page.items[0]
  assert.equal(item.images, 2)
  assert.deepEqual(item.files, [
    { id: 'a1', name: 'a.png', mediaType: 'image/png' },
    { id: 'f1', name: 'notes.txt', mediaType: 'text/plain' },
  ])
  assert.deepEqual(item.whole, { length: 900 })
});

test('a group page pages back by beforeSeq, newest page first', async () => {
  const { routes, rooms } = runtime()
  rooms[ROOM_ID].log = Array.from({ length: 65 }, (_, index) => ({ seq: index + 1, who: 'User', text: `m${index + 1}` }))
  const first = await value(routes, 'room-chat', { roomId: ROOM_ID })
  assert.equal(first.items.length, 60)
  assert.equal(first.items[0].text, 'm6')
  assert.deepEqual(first.cursor, { beforeSeq: 6 })
  const older = await value(routes, 'room-chat', { roomId: ROOM_ID, cursor: first.cursor })
  assert.equal(older.items.length, 5)
  assert.equal(older.items[0].text, 'm1')
  assert.equal(older.cursor, null)
});

test('a group page that cannot read the Session still answers, and says why', async () => {
  const { routes, rt } = runtime()
  const logs = []
  rt.warn = (...args) => logs.push(args)
  const page = await value(routes, 'room-chat', { roomId: ROOM_ID })
  assert.equal(page.items.length, 3)
  assert.equal(page.sessionItems, undefined)
  assert.equal(logs.length, 1)
  assert.match(String(logs[0][0]), /room-chat could not page/)
});
