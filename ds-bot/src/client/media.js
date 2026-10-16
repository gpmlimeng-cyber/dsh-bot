// A picture a Bot writes as a local path shows up as nothing on its own: the shell's MarkdownText
// renders an image when it is http(s), and for anything else it asks its owner through
// `pathImages.resolve` -- a synchronous resolver, the only hook it offers. The native chat answers it
// with the app's own `api/file` endpoint (dsh-client-ui-chat/lib/client.js:64,5307); our pictures are
// files the host delivered to this team, so the host's `present-file` is the reader that fits, and it
// answers only what it was asked to deliver (files.js:270, the `delivered` set is the whitelist).
//
// So: scan the messages on screen, ask the host for at most four local paths each, and let the resolver
// read the answers out of a map. Nothing waits on the network, and a path that is not an image we can
// read simply keeps its own alt text.
import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_PER_MESSAGE = 4
const MAX_BYTES = 2 * 1024 * 1024

/** The local image destinations in one message, in order. http(s), data: and fragment destinations are
 *  the shell's own to render, and are left alone. */
export function imageDestinations(text) {
  if (typeof text !== 'string' || !text.includes('![')) return []
  const found = []
  for (const match of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) {
    const value = match[1]
    if (/^(?:https?:|data:|#|\/\/)/i.test(value)) continue
    if (!found.includes(value)) found.push(value)
    if (found.length === MAX_PER_MESSAGE) break
  }
  return found
}

const pathsFor = (texts) => {
  const all = []
  for (const text of texts ?? []) for (const path of imageDestinations(text)) if (!all.includes(path)) all.push(path)
  return all
}

const isImage = (answer) => answer?.ok === true && (answer.kind === 'image' || String(answer.mime ?? '').startsWith('image/'))
const smallEnough = (answer) => {
  const bytes = answer.bytes ?? answer.size ?? (typeof answer.base64 === 'string' ? answer.base64.length * 0.75 : 0)
  return bytes > 0 && bytes <= MAX_BYTES
}

/**
 * The `pathImages` vocabulary for a list of messages: one prefetch for the whole list, one resolver
 * shared by every MarkdownText in it. The resolver's identity is fixed for the life of the component --
 * the shell discards its streaming render cache when that identity changes -- and it reads a map that
 * answers land in, so a picture appears one render after its bytes arrive. `actions` is read through a
 * ref because the panel rebuilds it on every render; an effect that depended on it would drop the
 * answers already on their way.
 */
export function usePathImages(texts, actions) {
  const answers = useRef(new Map())
  const latest = useRef(actions)
  latest.current = actions
  const [, bump] = useState(0)
  const wanted = useMemo(() => pathsFor(texts).join('\n'), [texts])
  useEffect(() => {
    if (!wanted) return undefined
    let live = true
    for (const path of wanted.split('\n')) {
      if (answers.current.has(path) || typeof latest.current?.presentFile !== 'function') continue
      answers.current.set(path, null) // asked once; a failure leaves the text alone
      Promise.resolve(latest.current.presentFile(path))
        .then(answer => {
          if (!live || !isImage(answer) || !smallEnough(answer)) return
          answers.current.set(path, `data:${answer.mime ?? 'image/png'};base64,${answer.base64 ?? ''}`)
          bump(count => count + 1)
        })
        .catch(() => {})
    }
    return () => { live = false }
  }, [wanted])
  return useMemo(() => ({ resolve: value => answers.current.get(value) ?? undefined }), [])
}
