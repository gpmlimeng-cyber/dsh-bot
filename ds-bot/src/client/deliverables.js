// Deliverable cards: a Bot's `present` files attached to a group reply. The host carries
// each file's `{sessionId, seq, index}` coordinates from the `deliverables/presented`
// event; DSH's own /api/present.open route resolves them back to the real file. Opening
// needs the Host desktop (409 otherwise), so the card falls back to copying the path —
// which is what a phone needs to reach a copy under its own DSH/deliverables folder.
import { createElement as h, useState } from 'react'
import { PaperclipIcon, CopyIcon, CheckIcon } from './icons.js'
import { t } from './i18n.js'

const basename = (path) => {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

// The mobile fallback folder the user's own file manager can reach. Its exact path is
// a product convention, not something DSH tells us, so it is only offered as a hint.
const PHONE_COPY_HINT = '/storage/emulated/0/DSH/deliverables/'

const openUrl = (file) => {
  const query = new URLSearchParams({ sessionId: file.sessionId, seq: String(file.seq), index: String(file.index ?? 0) })
  return `api/present.open?${query}`
}

function DeliverableCard({ file }) {
  const [state, setState] = useState('idle') // idle | opening | copied | failed
  const name = basename(file.path)
  const open = async () => {
    if (state === 'opening') return
    setState('opening')
    try {
      // POST is what DSH's own card does; it authenticates with the session cookie.
      const response = await fetch(openUrl(file), { method: 'POST', credentials: 'same-origin' })
      // 409 = no Host desktop (a phone); 422 = path no longer maps. Both fall back to
      // copying the path so the file stays reachable through the phone's file manager.
      if (response.ok || response.status === 409 || response.status === 422) setState(response.ok ? 'idle' : 'failed')
      else setState('failed')
    } catch {
      setState('failed')
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(file.path)
      setState('copied')
      setTimeout(() => setState(current => (current === 'copied' ? 'idle' : current)), 1600)
    } catch {
      setState('failed')
    }
  }
  return h('div', { className: 'bt-dcard', 'data-state': state === 'failed' ? 'fallback' : undefined },
    h('span', { className: 'bt-dcard-ico', 'aria-hidden': true }, h(PaperclipIcon)),
    h('span', { className: 'bt-dcard-copy' },
      h('span', { className: 'bt-dcard-name' }, name),
      file.description ? h('span', { className: 'bt-dcard-desc' }, file.description) : null),
    state === 'failed'
      ? h('span', { className: 'bt-dcard-hint', role: 'status' }, t('Could not open it here. Copy the path and open the copy under {folder}', { folder: PHONE_COPY_HINT }))
      : null,
    h('span', { className: 'bt-dcard-acts' },
      h('button', { type: 'button', className: 'bt-dcard-btn', disabled: state === 'opening', onClick: open },
        state === 'opening' ? t('Opening…') : t('Open')),
      h('button', { type: 'button', className: 'bt-dcard-btn', onClick: copy, 'aria-label': t('Copy path'), title: t('Copy path') },
        state === 'copied' ? h(CheckIcon) : h(CopyIcon), state === 'copied' ? t('Copied') : t('Path'))))
}

// One card per delivered file, under the group reply that carried them.
export function DeliverableCards({ deliverables }) {
  const files = (deliverables ?? [])
    .flatMap(entry => (entry?.files ?? []).map((file, index) => ({
      path: file?.path,
      description: typeof file?.description === 'string' ? file.description : undefined,
      sessionId: entry.sessionId,
      seq: entry.seq,
      index,
    })))
    .filter(file => typeof file.path === 'string' && file.path !== '')
  if (files.length === 0) return null
  return h('div', { className: 'bt-dcards' }, files.map(file => h(DeliverableCard, { key: `${file.sessionId}:${file.seq}:${file.index}`, file })))
}
