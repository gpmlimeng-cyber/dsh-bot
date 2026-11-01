// The two mobile reads the web view never needed: one page of a group chat, and the
// notices a client that is not looking should hear about.
//
// `notices` is a snapshot of the team as it stands, not an event log: every notice is
// stamped with the state revision it was read at, and a client that already answered
// for that revision gets nothing new. Kinds the host can only learn from live events
// (a finished round, a message in a Bot's own chat, an approval) arrive over the feed
// instead; adding them here needs a log of its own.
import { BOOT_ID } from './boot.js'
import { HISTORY_PAGE, NOTICE_MAX } from './constants.js'

// The room log keeps a line's start; the rest waits in the line's own file. A page says
// how long the whole line is so the client can offer to show all of it.
const wholeOf = line => (line.length === undefined ? undefined : { length: line.length })

function roomItem(rt, line) {
  const bot = line.botId === undefined ? undefined : rt.botOf(line.botId)
  const item = {
    // A line a member wrote is a Bot entry, one the user wrote is theirs; anything else
    // is the round's own event (a missed reply, a lookup, a stop).
    kind: line.botId !== undefined ? 'bot' : line.who === 'User' ? 'user' : 'event',
    id: String(line.seq),
    text: line.text ?? '',
    name: line.who,
    ...(bot?.color !== undefined ? { color: bot.color } : {}),
    ...(typeof line.time === 'number' ? { time: line.time } : {}),
    ...(line.botId !== undefined ? { botId: line.botId } : {}),
    // `kind: 'notice'` carries why it happened in `reason`; that is the event the client
    // draws. Other kinds name themselves.
    ...(line.kind === 'notice' ? (line.reason === undefined ? {} : { event: line.reason }) : line.kind === undefined ? {} : { event: line.kind }),
    ...(line.files === undefined ? {} : { images: line.files.length }),
    ...(wholeOf(line) === undefined ? {} : { whole: wholeOf(line) }),
  }
  return item
}

// A page of a group chat, newest page first, oldest first within it.
export function roomChatPage(rt, roomId, cursor) {
  const room = rt.roomOf(roomId)
  if (room === undefined) throw Object.assign(new Error('Unknown group chat'), { code: 'bot/not-found' })
  const log = room.log ?? []
  const before = Number.isInteger(cursor?.beforeSeq) ? cursor.beforeSeq : undefined
  const older = before === undefined ? log : log.filter(line => line.seq < before)
  const page = older.slice(-HISTORY_PAGE)
  const running = [...rt.roomProgress.values()].find(round => round.roomId === room.id)
  return {
    roomId: room.id,
    items: page.map(line => roomItem(rt, line)),
    cursor: older.length > page.length ? { beforeSeq: page[0].seq } : null,
    running: running !== undefined,
    ...(running?.speaking === undefined || running.speaking === null ? {} : { speaking: running.speaking }),
  }
}

const botOfSession = (rt, sessionId) => {
  const botId = rt.chatOwners.get(sessionId) ?? ''
  return { botId, name: rt.botOf(botId)?.name ?? '' }
}

function snapshot(rt, seq) {
  const { state } = rt
  const notices = []
  // A card waiting for the user is the one thing worth a notice with no event log: it
  // stays until answered, so a snapshot of the pending cards is exactly right.
  for (const [sessionId, pending] of Object.entries(state.questions ?? {})) {
    if (pending === null || typeof pending !== 'object') continue
    const text = [pending.question, pending.detail].filter(value => typeof value === 'string' && value !== '').join('\n')
    notices.push({ seq, kind: 'question', ...botOfSession(rt, sessionId), sessionId, text, time: pending.askedAt })
  }
  for (const [sessionId, pending] of Object.entries(state.views ?? {})) {
    if (pending === null || typeof pending !== 'object') continue
    notices.push({ seq, kind: 'view', ...botOfSession(rt, sessionId), sessionId, text: '', ...(pending.title === undefined ? {} : { title: pending.title }), time: pending.askedAt })
  }
  // The newest line of each group, so a client opening after a round sees where it stood.
  for (const room of Object.values(state.rooms ?? {})) {
    const line = (room.log ?? []).at(-1)
    if (line === undefined) continue
    notices.push({
      seq,
      kind: 'group',
      botId: line.botId ?? '',
      name: line.who ?? '',
      roomId: room.id,
      title: room.name,
      text: line.text ?? '',
      ...(typeof line.time === 'number' ? { time: line.time } : {}),
    })
  }
  return notices.slice(0, NOTICE_MAX)
}

// The notices a client that was away should hear about. `boot` names the host start it
// last read, `since` the revision it has already seen.
export function noticesView(rt, body) {
  const seq = rt.state.revision ?? 0
  const since = Number.isInteger(body?.since) ? body.since : undefined
  // A different host start, or a revision this host has not reached, means the client's
  // picture is from another run: nothing it holds can be trusted as up to date.
  const reset = (typeof body?.boot === 'string' && body.boot !== BOOT_ID) || (since !== undefined && since > seq)
  const fresh = reset || since === undefined || since < seq
  return { boot: BOOT_ID, seq, reset, notices: fresh ? snapshot(rt, seq) : [] }
}
