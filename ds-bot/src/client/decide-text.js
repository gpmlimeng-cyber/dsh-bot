// The decision bar: a choice the user taps above the composer.
//
// The room's admin (Lead) can ask for a decision in a group reply, written as a fenced block:
//
//     ```ds-decide
//     { "title": "先做哪个？", "options": ["A", "B", "C"] }
//     ```
//
// The block is never drawn as text. GroupReplies pulls it out -- only from the room admin's own
// reply -- hands it to the ui store, and this bar renders it above the composer, where the user's
// hand already is; a tap posts the chosen label as the user's own message in that room
// (actions.answerDecision) and the bar goes. It deliberately does not live in the transcript: the
// user asked for a place to tap, not for a card that pushes the conversation around and scrolls away.
//
// Anything malformed -- no fence, broken JSON, a title missing, one option or five -- stays ordinary
// text. A protocol that cannot be read must never swallow a message.

const FENCE = /```ds-decide[ \t]*\r?\n([\s\S]*?)```/
/** How many options a decision bar may carry: fewer is not a choice, more is a menu. */
export const DECISION_MIN = 2
export const DECISION_MAX = 4

/**
 * Read the decision out of one reply.
 * @param text - the reply's markdown.
 * @returns the title, options and the text without the block, or null when it is not a decision.
 */
export function parseDecision(text) {
  const found = FENCE.exec(typeof text === 'string' ? text : '')
  if (found === null) return null
  let data
  try { data = JSON.parse(found[1]) } catch { return null }
  const title = typeof data?.title === 'string' ? data.title.trim() : ''
  const options = (Array.isArray(data?.options) ? data.options : [])
    .map(option => (typeof option === 'string' ? option : option?.label))
    .filter(label => typeof label === 'string' && label.trim() !== '')
    .map(label => label.trim())
  if (title === '' || options.length < DECISION_MIN || options.length > DECISION_MAX) return null
  // The key identifies the same ask across re-renders (the store keeps one bar at a time).
  return { title, options, rest: text.replace(found[0], '').trim(), key: `${title}\u0000${options.join('\u0000')}` }
}

/** The block itself never reaches the transcript -- but only a block that reads comes out: a
 *  malformed one stays whole, because the bar cannot show it and dropping it would lose words. */
export function stripDecision(text) {
  return parseDecision(text)?.rest ?? text
}
