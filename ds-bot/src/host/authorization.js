// SuperAgent authorization: records the deliveries a Bot makes on its own account — a
// hand-off, inferred from something it was told — and leaves the ones the user asked for
// out of the log. B tier records and never blocks.
//
// The switch is the team's pref, read on every call: turning it on takes effect at once,
// and turning it off leaves no file, no line and one property read per delivery.
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Bumping this makes every policy hash already written stale; keep it out of the hash's
// inputs so the bump is visible on its own.
export const RULES_VERSION = 1

// What a credential is bound to: the team's shape, never its words. Editing a Bot's
// instructions or a group's notice must leave every recorded hash alone.
export function policyOf(state) {
  const byKey = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const bots = Object.keys(state.bots ?? {})
    .map(id => ({ id, main: (state.mainBotIds ?? []).includes(id) }))
    .sort(byKey)
  const rooms = Object.keys(state.rooms ?? {})
    .map(id => ({
      id,
      members: [...(state.rooms[id]?.members ?? [])].sort(),
      admin: state.rooms[id]?.admin ?? null,
    }))
    .sort(byKey)
  return createHash('sha256').update(JSON.stringify({ v: RULES_VERSION, bots, rooms })).digest('hex').slice(0, 16)
}

export function install(rt) {
  // On unless it was switched off: a team that never touched the switch records, as the
  // user asked. Only an explicit `false` turns it off, and reading it here (not at install)
  // is what lets a flip take effect on the next delivery.
  const on = () => rt.state?.prefs?.superagent !== false

  function note(rule, ids, startedAt, deliverUs) {
    try {
      const line = {
        ts: Date.now(),
        admitted: true,
        rule,
        policy: policyOf(rt.state),
        ...(ids.fromId === undefined ? {} : { fromId: ids.fromId }),
        ...(ids.toId === undefined ? {} : { toId: ids.toId }),
        ...(ids.roomId === undefined ? {} : { roomId: ids.roomId }),
        overhead_us: Math.max(0, Math.round((performance.now() - startedAt) * 1000 - deliverUs)),
        deliver_us: Math.round(deliverUs),
      }
      mkdirSync(rt.home, { recursive: true })
      appendFileSync(join(rt.home, 'authorization.jsonl'), `${JSON.stringify(line)}\n`)
    } catch (error) {
      // A record that cannot be written is not worth a lost message.
      rt.warn('ds-bot: authorization record failed: %s', error?.message ?? String(error))
    }
  }

  // Runs the delivery and records it afterwards. `ruleOf()` returns null for a delivery the
  // log leaves out; the call, its return value and its exception pass through untouched.
  async function measured(ids, run, ruleOf) {
    const startedAt = performance.now()
    const callAt = performance.now()
    try {
      return await run()
    } finally {
      const rule = ruleOf()
      if (rule !== null) note(rule, ids, startedAt, (performance.now() - callAt) * 1000)
    }
  }

  const deliver = rt.deliver
  rt.deliver = async (args) => {
    if (!on()) return deliver(args)
    // `fromId` says who sent it: the user's own message carries one, a Bot's hand-off
    // of something it was told does not.
    return measured(args ?? {}, () => deliver(args), () => (args?.fromId === undefined ? null : args.role === 'room' ? 'room_round' : 'message_bot'))
  }

  const postToRoom = rt.postToRoom
  rt.postToRoom = async (room, sender, text, extra = {}, files = []) => {
    if (!on()) return postToRoom(room, sender, text, extra, files)
    // Every group post comes from a Bot: this is the path a relayed instruction takes.
    return measured({ fromId: sender?.id, roomId: room?.id }, () => postToRoom(room, sender, text, extra, files), () => 'post_to_room')
  }
}
