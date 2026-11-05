// 队列（agent inbox）到 App 的映射。契约里的 inbox payload 和 send 的 itemId/slot 都从这里来。
//
// 真相在 agent-loop 注册的 `inbox` 投影：next-turn / next-step / inFlight。
// inFlight 不列给 App：那不是队列，是已经进回合的。
import { textOf } from './text.js'

export const QUEUE_SLOTS = ['next-turn', 'next-step']

function queueMessage(message) {
  return {
    itemId: typeof message?.id === 'string' ? message.id : String(message?.id ?? ''),
    rpcId: typeof message?.source?.rpcId === 'string' && message.source.rpcId !== '' ? message.source.rpcId : null,
    text: textOf(Array.isArray(message?.content) ? message.content : []),
    time: Number.isFinite(message?.time) ? message.time : null,
  }
}

// canSteer 由 Host 算：条目在 next-turn 且回合正在跑，才允许「改为插话」。
export function queueView(sessionId, projection, running) {
  const inbox = projection?.inbox ?? {}
  const list = (slot) => (Array.isArray(inbox[slot]) ? inbox[slot] : []).map((message) => ({
    ...queueMessage(message),
    canSteer: slot === 'next-turn' && running === true,
  }))
  return {
    sessionId,
    nextTurn: list('next-turn'),
    nextStep: list('next-step'),
  }
}

// send 之后用客户端给的 requestId 在队列里精确找回该条，拿到 itemId 和 slot。
export function findQueueItem(projection, requestId) {
  if (typeof requestId !== 'string' || requestId === '') return null
  const inbox = projection?.inbox ?? {}
  for (const slot of QUEUE_SLOTS) {
    const found = (Array.isArray(inbox[slot]) ? inbox[slot] : []).find((message) => message?.source?.rpcId === requestId)
    if (found !== undefined) return { itemId: String(found.id), slot }
  }
  return null
}
