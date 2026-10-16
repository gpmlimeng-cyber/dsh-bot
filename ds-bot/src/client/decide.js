import { createElement as h } from 'react'
import { DECISION_MAX, DECISION_MIN, parseDecision, stripDecision } from './decide-text.js'

export { DECISION_MAX, DECISION_MIN, parseDecision, stripDecision }

/**
 * The bar. It renders only in the session the ask came from: a decision made in one room must not
 * follow the user into another.
 * @param sessionId - the room's session, handed in by the composer dock slot.
 */
export function DecisionDock({ sessionId, useUi, actions }) {
  const decision = useUi(value => value.decision)
  if (decision === null || decision.sessionId !== sessionId) return null
  return h('div', { className: 'bt-decide', role: 'group', 'aria-label': decision.title },
    h('div', { className: 'bt-decide-title' }, decision.title),
    h('div', { className: 'bt-decide-opts' }, decision.options.map(label => h('button', {
      key: label, type: 'button', className: 'bt-decide-opt',
      onClick: () => { void actions.answerDecision(sessionId, label) },
    }, label))))
}
