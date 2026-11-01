// C tier: what a Bot may run on work that reached it from another Bot, without the user
// having asked for it. The mode and the table live here so the host's guard and the
// settings page cannot drift; `auto` is in the data layer only until the ask path is
// verified, so the page offers `off` and `observe`.

export const TOOL_POLICY_MODES = ['off', 'observe', 'auto']
export const TOOL_POLICY_DEFAULT = 'observe'
// Read-only tools an inferred turn keeps: asking the user, and showing a card. Without
// these a refusal leaves the model no way to ask, and it retries.
export const OPEN_TOOLS = ['ask_user', 'show_view']
// Consecutive refusals after which asking turns into a plain denial, so a missing user
// cannot leave the turn waiting for an answer that never comes.
export const STALLED_AFTER = 3

export const toolPolicyOf = prefs => (TOOL_POLICY_MODES.includes(prefs?.saToolPolicy) ? prefs.saToolPolicy : TOOL_POLICY_DEFAULT)

// `admission` is what the delivery that started this turn was recorded as:
// 'explicit' (the user's own request), 'inferred' (relayed by a Bot), or undefined when
// nothing was recorded — a private chat is explicit even without a record, as B tier
// records only what a Bot started.
export function toolDecision({ mode, name, nested = false, admission, granted = false, refusals = 0 }) {
  const effective = mode === 'auto' || mode === 'observe' ? mode : 'off'
  if (effective === 'off') return { decision: 'allow', rule: 'off' }
  if (OPEN_TOOLS.includes(name)) return { decision: 'allow', rule: 'open' }
  // A program's own transport call carries the work its inner calls do; those are judged.
  if (name === 'run_code' && !nested) return { decision: 'allow', rule: 'transport' }
  if (admission === undefined) return { decision: 'allow', rule: 'unknown' }
  if (admission === 'explicit') return { decision: 'allow', rule: 'explicit' }
  if (granted) return { decision: 'allow', rule: 'granted' }
  if (effective === 'observe') return { decision: 'would_deny', rule: 'relay-not-authorization' }
  if (refusals >= STALLED_AFTER) return { decision: 'deny', rule: 'stalled' }
  return { decision: 'ask', rule: 'relay-not-authorization' }
}

export const DENIAL = name => `Denied by policy: this work was relayed by another Bot and the user has not approved ${name}. Stop retrying it; call ask_user to ask, or wait for the user's own request.`
