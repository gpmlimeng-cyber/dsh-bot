// The live feed: a Server-Sent Events stream of what changes, for a window that draws
// the team itself (the desktop app) instead of polling.
//   revision  the team was saved: ask for `state` again
//   live      work changed without a new revision: ask for `state` again
//   message   a new entry of a Bot's own chat, as the `chat` endpoint returns it
//   stream    the reply a Bot is writing: a start, its text as it comes, an end
import { ROUTE, API_MAX } from './constants.js'
import { BOOT_ID, nextSeq, publishedSeq } from './boot.js'

export const FEED_ROUTE = `${ROUTE}/feed`
// A comment line now and then keeps an idle connection open.
const KEEPALIVE_MS = 20_000
// Status changes come in bursts (a turn starts several Sessions); one notice covers them.
const LIVE_DELAY_MS = 150
// A window that stops reading is dropped once this many events wait for it; it
// reconnects and catches up from `hello`.
const MAX_QUEUED = 512

// A group writes a round's lines in a burst; one event per room per burst is enough.
const ROUND_EVENT_LAG = 150

export function install(rt) {
  const { ctx, state } = rt
  const encoder = new TextEncoder()
  /** @type {Set<ReadableStreamDefaultController<Uint8Array>>} */
  const clients = new Set()
  const send = (controller, chunk) => {
    if ((controller.desiredSize ?? 0) < -MAX_QUEUED) {
      leave(controller)
      return
    }
    try { controller.enqueue(chunk) } catch { clients.delete(controller) }
  }
  // Remote readers (remote.js) take the same events as objects, in the same order as
  // the SSE windows; a window and a Remote reader can be connected at once.
  const feedListeners = new Set()
  const readers = () => clients.size > 0 || feedListeners.size > 0
  const publish = (event, data) => {
    nextSeq()
    for (const listener of feedListeners) {
      try { listener(event, data) } catch { /* the reader's own side drops it */ }
    }
    const chunk = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const controller of clients) send(controller, chunk)
  }

  // The feed as a subscription for the `dsBot/feed` Remote stream; returns the unsubscribe.
  rt.subscribeFeed = (listener) => {
    feedListeners.add(listener)
    try {
      listener('hello', { revision: state.revision, api: API_MAX, boot: BOOT_ID, seq: publishedSeq() })
    } catch { /* the reader is already gone */ }
    return () => feedListeners.delete(listener)
  }

  // A room's log or round changed. One `room` event per room per ROUND_EVENT_LAG, so a
  // round that writes several lines wakes the phone once, not once per line.
  const roomTimers = new Map()
  rt.roomChanged = (roomId) => {
    if (!readers() || roomTimers.has(roomId)) return
    const timer = setTimeout(() => {
      roomTimers.delete(roomId)
      publish('room', { roomId })
    }, ROUND_EVENT_LAG)
    timer.unref?.()
    roomTimers.set(roomId, timer)
  }

  rt.stateSaved = () => {
    if (readers()) publish('revision', { revision: state.revision })
  }

  let liveTimer
  const live = () => {
    if (!readers() || liveTimer !== undefined) return
    liveTimer = setTimeout(() => {
      liveTimer = undefined
      publish('live', {})
    }, LIVE_DELAY_MS)
  }
  ctx.on('agent/status', ({ agent }) => {
    if (rt.selfOf(agent.id) !== undefined) live()
  })

  ctx.on('session/event', (session, event) => {
    if (!readers()) return
    const botId = rt.chatOwners.get(session.id)
    if (botId === undefined) return
    for (const item of rt.displayItems(session.id, [event])) publish('message', { botId, sessionId: session.id, item })
    if (event.type === 'tool/call') live()
  })

  // Attempts being streamed, by id. A turn that answers another Bot is hidden from the
  // chat (turns.js marks it before the model is called), so its text is not streamed.
  const writing = new Map()
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (frame.type === 'start') {
      const botId = rt.chatOwners.get(agent.id)
      if (!readers() || botId === undefined || (state.exchangeTurns[agent.id] ?? []).includes(frame.turn)) return
      writing.set(frame.attemptId, { botId, sessionId: agent.id })
      publish('stream', { botId, sessionId: agent.id, attemptId: frame.attemptId, phase: 'start' })
      return
    }
    const target = writing.get(frame.attemptId)
    if (target === undefined) return
    if (frame.type === 'chunk' && frame.chunk?.type === 'text-delta') publish('stream', { ...target, attemptId: frame.attemptId, text: frame.chunk.text })
    else if (frame.type === 'end') {
      writing.delete(frame.attemptId)
      publish('stream', { ...target, attemptId: frame.attemptId, phase: 'end' })
    }
  })

  const leave = (controller) => {
    clients.delete(controller)
    if (!readers()) writing.clear()
    try { controller.close() } catch { /* already closed or errored */ }
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: FEED_ROUTE,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let controller
      const body = new ReadableStream({
        start(own) {
          controller = own
          clients.add(own)
          // A window that reconnects reads the same `hello` again: `boot` and `seq` tell it
          // whether this is the host it knew and where the stream had got to.
          send(own, encoder.encode(`event: hello\ndata: ${JSON.stringify({ revision: state.revision, api: API_MAX, boot: BOOT_ID, seq: publishedSeq() })}\n\n`))
        },
        cancel() { leave(controller) },
      })
      request.signal.addEventListener('abort', () => leave(controller), { once: true })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } })
    },
  }), 'ds-bot: live feed route')

  ctx.effect(() => {
    const keepalive = setInterval(() => {
      if (clients.size > 0) for (const controller of clients) send(controller, encoder.encode(': keepalive\n\n'))
    }, KEEPALIVE_MS)
    keepalive.unref?.()
    return () => {
      clearInterval(keepalive)
      clearTimeout(liveTimer)
      for (const timer of roomTimers.values()) clearTimeout(timer)
      roomTimers.clear()
      for (const controller of clients) leave(controller)
    }
  }, 'ds-bot: live feed')
}
