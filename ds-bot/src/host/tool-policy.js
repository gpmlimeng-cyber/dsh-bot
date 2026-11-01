// C tier: decide, at the moment a tool is about to run, whether the work behind it was
// the user's own request. `observe` writes down what `auto` would have asked and changes
// nothing; `auto` asks the user through the existing approval bridge. The refusal point is
// this hook alone.
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DENIAL, toolDecision, toolPolicyOf } from '../shared/tool-policy.js'
import { policyOf } from './authorization.js'

export function install(rt) {
  // Consecutive refusals per Session and tool: `pre-execute` decides, but only the
  // approval bridge learns the answer, so both sides read and write this map.
  const refusals = new Map()
  // One approval covers the rest of the turn, keyed by Session and invalidated when the
  // team's shape changes.
  const grants = new Map()
  const keyOf = (sessionId, tool) => `${sessionId}\n${tool}`
  const countOf = (sessionId, tool) => refusals.get(keyOf(sessionId, tool)) ?? 0

  const granted = (sessionId) => {
    const grant = grants.get(sessionId)
    if (grant === undefined) return false
    if (grant.policy === policyOf(rt.state)) return true
    grants.delete(sessionId)
    return false
  }

  function note(line) {
    try {
      mkdirSync(rt.home, { recursive: true })
      appendFileSync(join(rt.home, 'authorization-tools.jsonl'), `${JSON.stringify({ ts: Date.now(), policy: policyOf(rt.state), ...line })}\n`)
    } catch (error) {
      // A record that cannot be written is not worth a stopped tool.
      rt.warn('ds-bot: tool policy record failed: %s', error?.message ?? String(error))
    }
  }

  // The approval bridge reports back here: an allowed call clears the count, a refusal or
  // a timeout adds to it, so a user who never answers still reaches the stall brake.
  function settleTool(sessionId, tool, outcome) {
    if (sessionId === undefined) return
    if (outcome === 'allowed-once') {
      refusals.delete(keyOf(sessionId, tool))
      grants.set(sessionId, { at: Date.now(), policy: policyOf(rt.state) })
      return
    }
    if (outcome === 'rejected' || outcome === 'timeout') {
      refusals.set(keyOf(sessionId, tool), countOf(sessionId, tool) + 1)
      note({ admitted: 'inferred', rule: outcome === 'timeout' ? 'tool_timeout' : 'tool_refused', tool, decision: 'refused', mode: toolPolicyOf(rt.state?.prefs), agentId: sessionId, refuse_count: countOf(sessionId, tool) })
    }
  }

  Object.assign(rt, { settleTool })

  rt.ctx.on('tools/pre-execute', async (exec, next) => {
    const sessionId = exec.agent?.session?.id ?? exec.agent?.id
    if (sessionId === undefined) return next()
    const mode = toolPolicyOf(rt.state?.prefs)
    const verdict = toolDecision({
      mode,
      name: exec.name,
      nested: exec.parent !== undefined,
      admission: rt.admissionOf?.(sessionId),
      granted: granted(sessionId),
      refusals: countOf(sessionId, exec.name),
    })
    if (verdict.decision === 'allow') {
      if (verdict.rule === 'explicit' || verdict.rule === 'granted') refusals.delete(keyOf(sessionId, exec.name))
      return next()
    }
    note({
      admitted: rt.admissionOf?.(sessionId) ?? null,
      rule: verdict.rule,
      tool: exec.name,
      decision: verdict.decision,
      mode,
      agentId: sessionId,
      refuse_count: countOf(sessionId, exec.name),
    })
    if (verdict.decision === 'would_deny') return next()
    if (verdict.decision === 'deny') return { kind: 'deny', reason: DENIAL(exec.name), info: { name: exec.name, code: 'bot/tool-policy', reason: verdict.rule } }
    return { kind: 'ask', reason: `This work was relayed by another Bot and the user has not approved ${exec.name}.` }
  }, { prepend: true })
}
