import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeCalls, summaryLine } from '../src/shared/turn-summary.js'

const call = (name, args) => ({ name, arguments: args })

test('a turn sums its calls by class and counts a file once by path', () => {
  const { counts, files } = summarizeCalls([
    call('read', { path: '/a.md' }), call('read', { path: '/a.md' }), call('edit', { path: '/b.md' }),
    call('bash', { command: 'ls' }), call('show_view', {}), call('mystery_tool', {}),
  ])
  assert.deepEqual(counts, { read: 2, write: 1, run: 1, show: 1, other: 1 })
  assert.deepEqual(files, ['/a.md', '/b.md'], 'the same path twice is one file')
})

test('the summary line names what happened, and nothing when nothing did', () => {
  assert.equal(summaryLine(summarizeCalls([call('read', { path: 'a' }), call('read', { path: 'a' }), call('bash', {})])), '2 read · 1 run · 1 files')
  assert.equal(summaryLine(summarizeCalls([])), '')
  // A call with no readable name is not a call.
  assert.deepEqual(summarizeCalls([{ arguments: {} }]).counts, { read: 0, write: 0, run: 0, show: 0, other: 0 })
})
