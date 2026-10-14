import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { DICTIONARY } from '../src/client/i18n.js'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/attention.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom'],
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports,
  require: name => {
    const platform = {
      react: {
        createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
        Fragment: Symbol('Fragment'),
        useState: initial => [initial, () => {}],
        useEffect: () => {},
        useRef: current => ({ current }),
      },
      'react-dom': { createPortal: node => node },
    }
    if (!(name in platform)) throw new Error(`no platform module ${name}`)
    return platform[name]
  },
})
const { needsYou } = module.exports

const indexed = {
  byId: { s1: { id: 's1', name: 'Chief', sessionId: 's1' }, s2: { id: 's2', name: 'Writer', sessionId: 's2' } },
  roomsById: { r1: { id: 'r1', name: 'Ops' } },
}

test('needs you collects all four kinds, most urgent first', () => {
  const roster = {
    questions: { s2: { question: '用哪种格式？' } },
    secretRequests: { s1: [{ status: 'pending', name: 'GITHUB_TOKEN', sessionId: 's1' }, { status: 'canceled', name: 'OLD', sessionId: 's1' }] },
  }
  const work = { approvals: [{ sessionId: 'r1', botId: 's1', tool: 'pwsh' }] }
  const unread = { s1: true, s2: false, ghost: true }
  const items = needsYou(roster, work, unread, indexed)
  assert.deepEqual(JSON.parse(JSON.stringify(items.map(item => [item.kind, item.where]))), [
    ['question', 'Writer'],
    ['approval', 'Ops'],
    ['secret', 'Chief'],
    ['unread', 'Chief'],
  ])
  // The canceled key request is not an item; an unread id that names no known
  // conversation is not one either.
  assert.equal(items.filter(item => item.kind === 'secret').length, 1)
  assert.equal(items.some(item => item.where === 'ghost'), false)
  // A row opens the conversation the item belongs to.
  assert.deepEqual(JSON.parse(JSON.stringify(items.map(item => item.open))), ['s2', 'r1', 's1', 's1'])
})

test('needs you is empty when nothing waits', () => {
  assert.equal(needsYou({}, {}, {}, indexed).length, 0)
  assert.equal(needsYou({ questions: {}, secretRequests: { s1: [] } }, { approvals: [] }, { s1: false }, indexed).length, 0)
})

test('every label the list shows has a Chinese entry', () => {
  const zh = DICTIONARY.zh
  for (const key of ['Needs you', 'Nothing needs your attention', 'Waiting for a key', 'Someone replied',
    '{tool} waits for approval', 'The key {name} is waiting']) {
    assert.equal(typeof zh[key], 'string', key)
  }
})
