// Deliverable cards: a Bot's `present` files attached to a reply. The host carries each
// file's path, description and `{sessionId, seq, index}` coordinates from the
// `deliverables/presented` event. A card's tap reads the file through the host's
// `present-file` action, which answers only for the exact paths a Bot handed over --
// delivered files sit outside the team workspace, where the panel's own reader refuses
// them by design. The shape follows DSH's own PresentedFileCard
// (dsh-client-ui-deliverables lib/client.js): a 60px tile, a 40px type icon, the name
// over its metadata, and one hit target covering the whole card.
//
// Two ways out stay, because a phone and a desktop need different ones: the whole card
// opens the file here (a picture as itself, text and Markdown through the panel's own
// viewer), the Open button still asks the Host to open it in a desktop application, and
// when neither can, the card says so and offers the path to copy -- which is how a phone
// reaches its own copy of the file.
import { createElement as h, useState } from 'react'
import { FileTypeIcon, fileExtension } from '@deepseek-ai/dsh-client-ui-primitives'
import { CopyIcon, CheckIcon } from './icons.js'
import { FileView } from './file-preview.js'
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

// What the card shows under the name: DSH's own card shows the file's description when
// it has one, else the upper-case extension, else the word for a file. A trailing
// parenthetical is dropped first, since descriptions often end in one.
const metaText = (file, name) => {
  const trimmed = typeof file.description === 'string'
    ? file.description.replace(/\s*(?:\([^()]*\)|（[^（）]*）)\s*$/u, '').trim()
    : ''
  if (trimmed !== '') return trimmed
  const extension = fileExtension(name).toUpperCase()
  return extension === '' ? t('File') : extension
}

// Only these can be shown in the card: a picture, or text to read. Anything else (a
// binary, a file too big to read) is answered by the host as its kind with no content,
// and the card falls back to the path.
const readable = (answer) => answer?.ok === true && (answer.kind === 'image' || answer.kind === 'text' || answer.kind === 'markdown')

function DeliverableCard({ file, actions }) {
  const [state, setState] = useState('idle') // idle | reading | shown | opening | copied | failed
  const [read, setRead] = useState(null)
  const name = basename(file.path)
  // The whole card reads the file here and shows it. Tapping a card that is showing
  // puts it away, so the transcript stays the thing on screen.
  const preview = async () => {
    if (state === 'reading') return
    if (state === 'shown') {
      setRead(null)
      setState('idle')
      return
    }
    setState('reading')
    try {
      const answer = await actions?.presentFile?.(file.path)
      if (!readable(answer)) {
        setRead(null)
        setState('failed')
        return
      }
      setRead(answer)
      setState('shown')
    } catch {
      setState('failed')
    }
  }
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
  return h('div', { className: 'bt-dcard-wrap' },
    h('div', { className: 'bt-dcard', 'data-state': state === 'failed' ? 'fallback' : undefined },
      // One hit target over the whole card, as DSH's own card has: the name and icon
      // carry no pointer events of their own, so a tap anywhere but the two buttons
      // reads the file and shows it.
      h('button', {
        type: 'button',
        className: 'bt-dcard-hit',
        title: file.path,
        'aria-label': `${state === 'shown' ? t('Hide preview') : t('Preview')} ${name}`,
        onClick: preview,
      }),
      h('span', { className: 'bt-dcard-ico', 'aria-hidden': true }, h(FileTypeIcon, { path: file.path, size: 20 })),
      h('span', { className: 'bt-dcard-copy' },
        h('span', { className: 'bt-dcard-name' }, name),
        h('span', { className: 'bt-dcard-desc' }, state === 'reading' ? t('Opening…') : metaText(file, name)),
        h('span', { className: 'bt-dcard-peek', 'aria-hidden': true }, state === 'shown' ? t('Hide preview') : t('Preview'))),
      h('span', { className: 'bt-dcard-acts' },
        h('button', { type: 'button', className: 'bt-dcard-btn', disabled: state === 'opening', onClick: open },
          state === 'opening' ? t('Opening…') : t('Open')),
        h('button', { type: 'button', className: 'bt-dcard-btn', onClick: copy, 'aria-label': t('Copy path'), title: t('Copy path') },
          state === 'copied' ? h(CheckIcon) : h(CopyIcon), state === 'copied' ? t('Copied') : t('Path')))),
    state === 'shown' && read !== null
      ? h('div', { className: 'bt-dcard-view', 'data-kind': read.kind },
        // A picture is shown as itself; Markdown and text go through the panel's own
        // renderer, so a delivered README looks the way it does in the Files tab.
        read.kind === 'image'
          ? h('img', { src: `data:${read.mime ?? 'application/octet-stream'};base64,${read.base64 ?? ''}`, alt: name })
          : h(FileView, { file: read }))
      : null,
    state === 'failed'
      ? h('span', { className: 'bt-dcard-hint', role: 'status' }, t('Could not open it here. Copy the path and open the copy under {folder}', { folder: PHONE_COPY_HINT }))
      : null)
}

// One card per delivered file, under the group reply that carried them.
export function DeliverableCards({ deliverables, actions }) {
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
  return h('div', { className: 'bt-dcards' }, files.map(file => h(DeliverableCard, { key: `${file.sessionId}:${file.seq}:${file.index}`, file, actions })))
}
