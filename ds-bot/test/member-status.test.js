import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/member-status.js', import.meta.url))],
  bundle: true, format: 'cjs', platform: 'node', write: false,
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports,
  require: (name) => {
    const platform = {
      react: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }), useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: () => {}, useRef: initial => ({ current: initial }), useLayoutEffect: () => {}, Fragment: 'fragment' },
      'react-dom': {},
      '@deepseek-ai/dsh-client-ui-primitives': {},
    }
    if (!(name in platform)) throw new Error(`no platform module ${name}`)
    return platform[name]
  },
})
const { busyMembers, summaryText, splitBusy, MemberDock, dockPlan } = module.exports
// Values from the bundle's realm compare by content only.
const plain = value => JSON.parse(JSON.stringify(value))
// Renders the dock's own parts of an element tree, and lists its rows' labels.
const expand = (node) => {
  if (Array.isArray(node)) return node.flatMap(expand)
  if (node === null || typeof node !== 'object') return node
  if (['WorkRow', 'SummaryLine'].includes(node.type?.name)) return expand(node.type({ ...node.props, children: node.children }))
  return { ...node, children: node.children.map(expand) }
}
const rowLabels = (node) => {
  if (Array.isArray(node)) return node.flatMap(rowLabels)
  if (node === null || typeof node !== 'object') return []
  return [...(node.props.className === 'bt-mw-row' ? [node.props['aria-label']] : []), ...rowLabels(node.children)]
}

test('the members line names who waits for an approval first, then who is at work', () => {
  const names = { a: 'Anvil', b: 'Flint', c: 'Prism', d: 'Quill', e: 'King', f: 'Comet' }
  const roster = { byId: Object.fromEntries(Object.entries(names).map(([id, name]) => [id, { id, name }])) }
  const room = { members: ['e', 'd', 'a', 'b', 'c', 'f'] }
  const work = {
    bots: { d: { since: 1, tool: 'edit' }, a: { since: 1, tool: 'pwsh' }, f: { since: 1 } },
    approvals: [{ botId: 'a' }, { botId: 'b' }, { botId: 'c' }],
  }
  const busy = busyMembers(room, work, roster)
  assert.deepEqual(plain(busy.map(entry => [entry.bot.name, entry.state])), [['Anvil', 'ask'], ['Flint', 'ask'], ['Prism', 'ask'], ['Quill', 'work'], ['Comet', 'work']])
  assert.deepEqual(plain(summaryText(busy)), { waiting: 'Anvil, Flint and 1 more are waiting for your approval', doing: 'Quill · Writing changes… +1' })
  assert.deepEqual(plain(summaryText(busy.slice(1, 3))), { waiting: 'Flint and Prism are waiting for your approval', doing: '' })
  assert.deepEqual(plain(summaryText(busy.slice(4))), { waiting: '', doing: 'Comet · Thinking about it…' })
  assert.equal(busyMembers(room, { bots: {}, approvals: [] }, roster).length, 0)
})

const names = { a: 'Anvil', b: 'Flint', c: 'Prism', d: 'Quill' }
// These rows started just now: an elapsed label only appears after a minute of work.
const NOW = Date.now()
const team = {
  byId: Object.fromEntries(Object.entries(names).map(([id, name]) => [id, { id, name }])),
  roomsById: { r1: { id: 'r1', name: 'Ops', members: ['a', 'b', 'c', 'd'] }, r2: { id: 'r2', name: 'Docs', members: ['a', 'b'] } },
}
const dock = (sessionId, work) => expand(MemberDock({ sessionId, useRoster: pick => pick(team), useWork: pick => pick(work), actions: {} }))

test('a member at work in the group gets a row; the speaker, work elsewhere and approvals do not', () => {
  const work = {
    // Anvil runs in its own chat too; its work here wins.
    bots: { a: { since: NOW, tool: 'pwsh' }, b: { since: NOW, roomId: 'r2', tool: 'edit' } },
    rooms: { r1: [{ botId: 'a', since: NOW, tool: 'write' }, { botId: 'd', since: NOW, speaking: true }], r2: [{ botId: 'b', since: NOW, tool: 'edit' }] },
    approvals: [{ botId: 'c', roomId: 'r1' }],
  }
  const busy = busyMembers(team.roomsById.r1, work, team)
  const { rows, rest } = splitBusy(busy)
  assert.deepEqual(plain(rows.map(entry => [entry.bot.name, entry.doing.tool, entry.doing.roomId])), [['Anvil', 'write', 'r1']])
  assert.deepEqual(plain(rest.map(entry => [entry.bot.name, entry.state])), [['Prism', 'ask'], ['Flint', 'work']])
  assert.deepEqual(rowLabels(dock('r1', work)), ['Anvil · Writing changes…'])
  assert.equal(busyMembers(team.roomsById.r2, work, team).length, 2)
})

test('a Bot\'s own chat shows the groups it is at work in, unless its own chat runs', () => {
  const away = { bots: { a: { since: NOW, roomId: 'r1', tool: 'pwsh' } }, rooms: { r1: [{ botId: 'a', since: NOW, tool: 'pwsh' }], r2: [{ botId: 'a', since: NOW }] }, approvals: [] }
  assert.deepEqual(rowLabels(dock('a', away)), ['in Ops · Running shell commands…', 'in Docs · Thinking about it…'])
  assert.deepEqual(rowLabels(dock('a', { ...away, bots: { a: { since: NOW } } })), [])
  assert.equal(dock('b', away), null)
})

// The phone's list: one row until it is opened. The four-row stack was measured on the phone
// the user reported eating a third of the conversation, so the rule is a height rule -- one
// 32px row plus its 6px margin stays inside the 40px the ask allows.
test('an upright phone shows one row and a count, and opens to the full list', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const rest = [{ id: 'd' }]
  // Desktop, and a phone held sideways: every row, no control, and `more` is not a number.
  for (const phone of [false]) {
    assert.deepEqual(plain(dockPlan(rows, rest, false, phone)), { first: rows[0], others: rows.slice(1), summary: rest, more: 0 })
  }
  // Closed on the phone: the first row alone, the three behind it counted, the summary kept
  // out of the stack (its members are what the count leads to).
  assert.deepEqual(plain(dockPlan(rows, rest, false, true)), { first: rows[0], others: [], summary: [], more: 3 })
  // Opened: exactly what the desktop draws, with the control saying how to close it.
  assert.deepEqual(plain(dockPlan(rows, rest, true, true)), { first: rows[0], others: rows.slice(1), summary: rest, more: 3 })
  // One row and nothing else: nothing to open, so no control.
  assert.deepEqual(plain(dockPlan(rows.slice(0, 1), [], false, true)), { first: rows[0], others: [], summary: [], more: 0 })
  // No rows at all: the summary line already stands for everyone, so it stays as it is.
  assert.deepEqual(plain(dockPlan([], rest, false, true)), { first: null, others: [], summary: rest, more: 0 })
})

test('the closed line is one row of the dock, with the control beside it', () => {
  const source = readFileSync(new URL('../src/client/member-status.js', import.meta.url), 'utf8')
  // The row is a button that opens the details; the control is its sibling, not its child.
  assert.ok(source.includes("className: 'bt-mw-dock-first'"), 'the row and its control share one line')
  assert.ok(source.includes("className: 'bt-mw-more'"), 'the control is its own element')
  assert.ok(source.includes("'aria-expanded': expanded"), 'and reports whether the list is open')
  // Gated on the phone layout the rest of the skin uses, and closed again when work ends.
  assert.ok(source.includes('const phone = usePortrait()'), 'the phone layout decides it')
  assert.ok(source.includes('if (open && count <= 1) setOpen(false)'), 'the list closes itself when the run ends')
  // Height: the row is 32px and the stack gives it 6px of margin below.
  assert.ok(source.includes('.bt-mw-row{') && source.includes('height:32px'), 'the row is 32px')
  assert.ok(source.includes('margin:0 auto 6px'), 'and the stack keeps 6px under it')
  assert.ok(32 + 6 <= 40, 'one line stays inside the 40px the ask allows')
  // House rule: a rule only a phone can use hangs on the phone flag, never on the bare class.
  const ownRules = source.split('\n').filter(rule => /^(html\[data-bt-mobile\] )?\.bt-mw-(dock-first|more)\b/.test(rule))
  assert.ok(ownRules.length >= 3, `the rules are there: ${ownRules.length}`)
  for (const line of ownRules) assert.ok(line.startsWith('html[data-bt-mobile] '), line)
})
