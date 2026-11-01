import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install } from '../src/host/channel.js'

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function runtime(bots) {
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
  const empty = () => ({})
  const rt = {
    ctx,
    state: { revision: 3, mainBotIds: [], prefs: {}, agents: {}, rooms: {}, bots },
    refresh: async () => {},
    readOnly: () => undefined,
    memoryEnabled: true,
    load: async () => {},
    save: async () => {},
    bootstrap: async () => {},
    catalog: async () => {},
    loadSecrets: async () => {},
    chatOf: id => `${id}-chat`,
    archivesView: empty,
    workView: empty,
    roomWorkView: empty,
    approvalsView: () => [],
    secretsView: empty,
    capabilityLibraryView: () => [],
    cachedCatalog: () => [],
    cachedDefault: () => null,
    browserEnabled: false,
    noteFailure: () => {},
  }
  // A missing host helper answers empty: the test only reads the avatar projection.
  install(new Proxy(rt, { get: (target, key) => (key in target ? target[key] : () => ({})) }))
  return { routes }
}

async function ask(routes, endpoint, payload) {
  const route = routes.find(entry => entry.path === '/api/bot')
  const request = { json: async () => ({ endpoint, payload }), signal: new AbortController().signal }
  return (await route.fetch(request)).json()
}

test('a list asked with avatars: "ref" sends the reference, not the photo', async () => {
  const { routes } = runtime({ b1: { id: 'b1', name: 'Ada', avatar: { image: PHOTO, shape: 'circle' } } })
  const answer = await ask(routes, 'state', { avatars: 'ref' })
  assert.equal(answer.ok, true, answer.error?.message)
  const avatar = answer.value.bots[0].avatar
  assert.equal(avatar.image, undefined)
  assert.match(avatar.imageRef, /^avatar:[0-9a-f]{16}$/)
  assert.equal(avatar.shape, 'circle')
})

test('without the flag the photo travels as before', async () => {
  const { routes } = runtime({ b1: { id: 'b1', name: 'Ada', avatar: { image: PHOTO } } })
  const answer = await ask(routes, 'state', {})
  assert.equal(answer.value.bots[0].avatar.image, PHOTO)
  assert.equal(answer.value.bots[0].avatar.imageRef, undefined)
})

test('the avatar endpoint answers the same reference the list named', async () => {
  const { routes } = runtime({ b1: { id: 'b1', name: 'Ada', avatar: { image: PHOTO } } })
  const list = await ask(routes, 'state', { avatars: 'ref' })
  const answer = await ask(routes, 'avatar', { botId: 'b1' })
  assert.equal(answer.ok, true, answer.error?.message)
  assert.equal(answer.value.image, PHOTO)
  assert.equal(answer.value.ref, list.value.bots[0].avatar.imageRef)
})

test('a Bot without a photo answers two nulls, not an error', async () => {
  const { routes } = runtime({ b1: { id: 'b1', name: 'Ada', avatar: { shape: 'whale' } } })
  const answer = await ask(routes, 'avatar', { botId: 'b1' })
  assert.equal(answer.ok, true)
  assert.equal(answer.value.image, null)
  assert.equal(answer.value.ref, null)
})

test('an unknown Bot is refused by name', async () => {
  const { routes } = runtime({})
  const answer = await ask(routes, 'avatar', { botId: 'nope' })
  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'bot/not-found')
})
