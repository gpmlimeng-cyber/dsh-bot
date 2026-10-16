// The decision bar's protocol and its one render point. The user asked for "a place I can tap in
// the group chat, not a card": the room's admin writes a ```ds-decide block in a reply, the block
// comes out of the transcript, and a bar above the composer offers the options. A tap posts the
// chosen label as the user's own message in that room (actions.answerDecision -> the host's own
// `send`, exactly the path every one of our sends takes), so the team sees it and the transcript is
// the audit trail.
//
// What this file pins:
//   * the block is read from a reply, but only reached by the *admin's* own reply: anyone else's
//     block must stay text, so a member cannot put words in the user's mouth;
//   * a malformed block (no title, one option, five options, bad JSON) is not a decision -- it
//     stays ordinary text, because a protocol that cannot be read must not swallow a message;
//   * the option buttons carry the skin's 44px floor (styles.js) and the bar is registered in the
//     composer's own dock above the input.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DECISION_MAX, DECISION_MIN, parseDecision, stripDecision } from '../src/client/decide-text.js'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const fence = payload => `先说一句。\n\n\`\`\`ds-decide\n${JSON.stringify(payload)}\n\`\`\`\n`

test('a well-formed block becomes a decision, and leaves the rest of the reply alone', () => {
  const decision = parseDecision(fence({ title: '先做哪个？', options: ['A', 'B'] }))
  assert.equal(decision.title, '先做哪个？')
  assert.deepEqual(decision.options, ['A', 'B'])
  assert.equal(decision.rest, '先说一句。', 'the prose around the block survives')
  assert.equal(stripDecision(fence({ title: 't', options: ['A', 'B'] })), '先说一句。', 'and the block itself never reaches the transcript')
  assert.equal(stripDecision('no block here'), 'no block here', 'a reply without one is untouched')
})

test('anything malformed stays ordinary text', () => {
  const cases = {
    'no block': 'just a message',
    'broken json': '```ds-decide\n{ oops }\n```',
    'no title': fence({ options: ['A', 'B'] }),
    'blank title': fence({ title: '  ', options: ['A', 'B'] }),
    [DECISION_MIN - 1 + ' option']: fence({ title: 't', options: ['A'] }),
    [DECISION_MAX + 1 + ' options']: fence({ title: 't', options: ['A', 'B', 'C', 'D', 'E'] }),
    'empty options': fence({ title: 't', options: ['', '  '] }),
    'options not a list': fence({ title: 't', options: 'A' }),
  }
  for (const [what, text] of Object.entries(cases)) {
    assert.equal(parseDecision(text), null, `${what} must not read as a decision`)
    assert.equal(stripDecision(text), text, `${what} must reach the transcript unchanged`)
  }
})

test('only the room admin\'s own reply can raise the bar', () => {
  const cells = read('cells.js')
  // The gate is written where the replies are read: a member's block is never parsed as a decision.
  assert.ok(cells.includes('item.reply.kind === undefined && item.reply.botId === room.admin'), 'the admin is the one whose block counts')
  assert.ok(cells.includes('actions.proposeDecision?.(sessionId, ask)'), 'and it is the ui store the bar reads, not local state')
  assert.ok(/useEffect\(\(\) => \{ if \(ask !== null\)/.test(cells), 'raised in an effect, never during render')
  assert.ok(cells.includes('texts.map(stripDecision)'), 'the block comes out of what the transcript draws')
})

test('the ask lands in the bell the user already has, not in a new surface', () => {
  // The user's own correction: the top-right "needs you" button is already the place they look, so
  // the decision joins it instead of a bar of its own above the composer. It takes the first seat
  // (it is what makes the bell appear when nothing else is waiting), its row carries the options as
  // tappable 44px boxes, and the answer goes through our own send.
  const attention = read('attention.js')
  assert.ok(attention.includes('export function needsYou(roster, work, unread, indexed, decision = null)'), 'the bell\'s items take the decision')
  assert.ok(attention.includes("kind: 'decision', open: decision.sessionId"), 'as an item of its own kind, bound to its room')
  assert.ok(attention.includes('const rank = { decision: 0, question: 1, approval: 2, secret: 3, unread: 4 }'), 'first: everything else here can wait')
  assert.ok(attention.includes("'Waiting for your decision'"), 'and it says what it is')
  assert.ok(attention.includes("? h('div', { key: `decision:${item.open}:${item.title}`, className: 'bt-attention-row bt-attention-decide'"), 'the row itself is not a button: the options are')
  assert.ok(attention.includes('onClick: () => onDecide(item.open, option)'), 'each option answers')
  assert.ok(attention.includes('void actions.answerDecision(sessionId, option)'), 'through the same action as before')
  const index = read('index.js')
  assert.ok(index.includes('answerDecision: async (sessionId, label) => {'), 'which sends as the user')
  assert.ok(index.includes('await actions.send(sessionId, label)'), 'our own host send, the path every send takes')
  assert.ok(!index.includes("id: 'bot-decision'"), 'no bar above the composer any more')
  assert.ok(!readdirSync(new URL('../src/client/', import.meta.url)).includes('decide.js'), 'and no second component left behind')
  const styles = read('attention.js')
  const option = styles.split('\n').find(line => line.includes('.bt-attention-opt{'))
  assert.ok(option && option.includes('min-height:44px'), 'the option is a 44px box: the floor this skin holds every control to')
})
