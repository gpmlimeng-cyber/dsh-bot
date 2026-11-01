import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { install as installChannel, CAPABILITIES } from '../src/host/channel.js'
import { install as installFeed } from '../src/host/feed.js'
import { API_MIN, API_MAX } from '../src/host/constants.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const pluginVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

// The two host modules register Fetch routes; this runtime starts them without a store,
// so a test asks the route the way the phone app does.
function runtime() {
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
  const rt = {
    ctx,
    state: { revision: 7, mainBotIds: [], prefs: {}, agents: {}, rooms: {}, bots: [] },
    refresh: async () => {},
    readOnly: () => undefined,
    memoryEnabled: true,
    load: async () => {},
    save: async () => {},
    catalog: async () => {},
    loadSecrets: async () => {},
    chatOwners: new Map(),
    selfOf: () => undefined,
  }
  installChannel(rt)
  installFeed(rt)
  return { routes, rt }
}

async function ask(routes, payload) {
  const route = routes.find(entry => entry.path === '/api/bot')
  const request = { json: async () => ({ endpoint: 'hello', payload }), signal: new AbortController().signal }
  const answer = await (await route.fetch(request)).json()
  assert.equal(answer.ok, true, answer.error?.message)
  return answer.value
}

test('hello answers the version both sides speak', async () => {
  const { routes } = runtime()
  const answer = await ask(routes, { client: { name: 'dsh-go', version: '0.1.0', platform: 'android' }, api: [API_MAX] })
  assert.equal(answer.api, API_MAX)
  assert.equal(answer.apiMin, API_MIN)
  assert.equal(answer.apiMax, API_MAX)
  assert.equal(answer.plugin.version, pluginVersion)
  assert.equal(answer.boot.length > 0, true)
  assert.equal(Number.isInteger(answer.seq), true)
  assert.equal(answer.revision, 7)
  assert.equal(answer.readOnly, null)
  assert.equal(answer.memory, true)
  assert.equal(answer.capabilities.includes('chat'), true)
})

test('a version this host does not speak is answered with no api, not a guess', async () => {
  const { routes } = runtime()
  const answer = await ask(routes, { api: [API_MAX + 1] })
  assert.equal(answer.api, null)
  // The range is still told, so the client can say which side is old.
  assert.equal(answer.apiMin, API_MIN)
  assert.equal(answer.apiMax, API_MAX)
})

test('a client that sends no version still learns the range', async () => {
  const { routes } = runtime()
  const answer = await ask(routes, {})
  assert.equal(answer.api, null)
  assert.equal(answer.apiMin, API_MIN)
})

test('the advertised capabilities are exactly the switch cases', () => {
  const source = readFileSync(new URL('../src/host/channel.js', import.meta.url), 'utf8')
  const cases = new Set([...source.matchAll(/case '([a-z0-9-]+)':/g)].map(match => match[1]))
  assert.deepEqual([...CAPABILITIES].sort(), [...cases].sort())
})

test('the feed opens with hello carrying api, boot and seq', async () => {
  const { routes } = runtime()
  const route = routes.find(entry => entry.path === '/api/bot/feed')
  const response = await route.fetch({ signal: new AbortController().signal })
  const reader = response.body.getReader()
  const { value } = await reader.read()
  await reader.cancel()
  const text = new TextDecoder().decode(value)
  const line = text.split('\n').find(part => part.startsWith('data: '))
  const data = JSON.parse(line.slice('data: '.length))
  assert.equal(data.api, API_MAX)
  assert.equal(data.revision, 7)
  assert.equal(typeof data.boot, 'string')
  assert.equal(Number.isInteger(data.seq), true)
  assert.equal(text.startsWith('event: hello'), true)
})
