// Deliverable cards: a Bot's `present` files attached to a reply. The host carries each
// file's path, description and `{sessionId, seq, index}` coordinates from the
// `deliverables/presented` event, and the card's shape follows DSH's own
// PresentedFileCard (dsh-client-ui-deliverables lib/client.js): a 60px tile, a 40px type
// icon, the name over its metadata, and one hit target covering the whole card.
//
// A tap opens the file where a file belongs, never inside the message it arrived in:
// a picture opens the platform's own image preview (the same ImageLightbox DSH uses),
// anything readable opens the panel's preview page -- full screen on a phone, the right
// column on a desktop. Both read through the host's `present-file`, which answers only
// for the paths a Bot actually handed over.
//
// Whatever cannot be shown keeps the two exits a phone always has, and both the card and
// the preview page use the one definition of them: hand the file to another app (a copy
// goes to shared storage first, since no other app can read the app's own), or copy the
// path for the phone's file manager.
import { createElement as h, Fragment, useEffect, useRef, useState } from 'react'
import { FileTypeIcon, fileExtension, ImageLightbox } from '@deepseek-ai/dsh-client-ui-primitives'
import { CheckIcon, CloseIcon, CopyIcon } from './icons.js'
import { FileView } from './file-preview.js'
import { t } from './i18n.js'

const basename = (path) => {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

// The mobile fallback folder the user's own file manager can reach. Its exact path is
// a product convention, not something DSH tells us, so it is only offered as a hint.
const PHONE_COPY_HINT = '/storage/emulated/0/DSH/deliverables/'

// What the card's own tap can open in the platform's image preview. The host decides the
// kind from the bytes; this only picks which door to knock on, and a picture whose bytes
// say otherwise falls through to the preview page, which keeps both exits.
const PICTURE_NAME = /\.(?:png|jpe?g|gif|webp|avif|bmp|ico|svg)$/iu
const isPicture = (name) => PICTURE_NAME.test(name)

// What the preview page can show. Everything else (a binary, a file too big to read)
// arrives as its kind with no content and falls back to the two exits.
const readable = (answer) => answer?.ok === true && (answer.kind === 'html' || answer.kind === 'image' || answer.kind === 'text' || answer.kind === 'markdown')

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

/**
 * The sentence that explains a refusal. Both places that can refuse (the card and the
 * preview page) write it through here, so the wording cannot drift between them.
 */
export const exitsSentence = (shared) => (shared !== null && shared !== undefined
  ? t('Could not open it here. The copy is at {path}', { path: shared })
  : t('Could not open it here. Copy the path and open the copy under {folder}', { folder: PHONE_COPY_HINT }))

/**
 * The two ways a phone reaches a delivered file it cannot show in place. Shared by the
 * card and the preview page on purpose: one definition, so the two cannot drift apart.
 *
 * The second one asks the shell's own chooser (window.__dshOpenPath, a system chooser
 * that hands an absolute device path to an app that can read it). A delivered file sits
 * in the app's own storage, which no other app can read, so a copy goes to shared
 * storage first. A host without the chooser -- a desktop -- keeps the engine's opener.
 *
 * A refusal is reported to the host through `onFailed({ shared })` rather than written
 * here: the card clips at 60px, so its sentence has to live outside the tile.
 */
export function DeliverableActions({ file, actions, onFailed }) {
  const [state, setState] = useState('idle') // idle | opening | copied | failed
  const failed = (next) => {
    setState('failed')
    onFailed?.({ shared: next })
  }
  const open = async () => {
    if (state === 'opening') return
    setState('opening')
    onFailed?.(null)
    try {
      const chooser = globalThis.__dshOpenPath
      if (typeof chooser === 'function') {
        const copy = await actions?.shareFile?.(file.path)
        // Where the copy landed, when one was made: the fallback then names it, so the
        // reader can still open the copy itself rather than only a folder.
        const shared = copy?.ok === true ? copy.path : null
        if (shared !== null && chooser(shared, 'view') === true) {
          setState('idle')
          return
        }
        failed(shared)
        return
      }
      // POST is what DSH's own card does; it authenticates with the session cookie.
      const response = await fetch(openUrl(file), { method: 'POST', credentials: 'same-origin' })
      // 409 = no Host desktop (a phone); 422 = path no longer maps. Both fall back to
      // copying the path so the file stays reachable through the phone's file manager.
      if (response.ok) setState('idle')
      else failed(null)
    } catch {
      failed(null)
    }
  }
  const copy = async () => {
    onFailed?.(null)
    try {
      await navigator.clipboard?.writeText(file.path)
      setState('copied')
      setTimeout(() => setState(current => (current === 'copied' ? 'idle' : current)), 1600)
    } catch {
      failed(null)
    }
  }
  return h(Fragment, null,
    h('button', { type: 'button', className: 'bt-dcard-btn', disabled: state === 'opening', onClick: open },
      state === 'opening' ? t('Opening…') : t('Open with another app')),
    h('button', { type: 'button', className: 'bt-dcard-btn', onClick: copy, 'aria-label': t('Copy path'), title: t('Copy path') },
      state === 'copied' ? h(CheckIcon) : h(CopyIcon), state === 'copied' ? t('Copied') : t('Path')))
}

function DeliverableCard({ file, actions }) {
  const name = basename(file.path)
  // A refusal writes its sentence under the tile, not in it: the tile is 60px and clips.
  const [failure, setFailure] = useState(null)
  // The card is one button, as DSH's own is: a picture goes to the platform's image
  // preview, everything else to the preview page. It carries no `title` on purpose --
  // the shell intercepts a click whose target's title looks like a path and sends that
  // path to its own chooser, which would take this tap away from the preview.
  const preview = () => {
    if (isPicture(name)) actions?.previewImage?.(file)
    else actions?.previewFile?.(file)
  }
  return h('div', { className: 'bt-dcard-wrap' },
    h('div', { className: 'bt-dcard' },
      h('button', {
        type: 'button',
        className: 'bt-dcard-hit',
        'aria-label': `${t('Preview')} ${name}`,
        onClick: preview,
      }),
      h('span', { className: 'bt-dcard-ico', 'aria-hidden': true }, h(FileTypeIcon, { path: file.path, size: 20 })),
      h('span', { className: 'bt-dcard-copy' },
        h('span', { className: 'bt-dcard-name' }, name),
        h('span', { className: 'bt-dcard-desc' }, metaText(file, name)),
        h('span', { className: 'bt-dcard-peek', 'aria-hidden': true }, t('Preview'))),
      h('span', { className: 'bt-dcard-acts' }, h(DeliverableActions, { file, actions, onFailed: setFailure }))),
    failure ? h('span', { className: 'bt-dcard-hint', role: 'status' }, exitsSentence(failure.shared)) : null)
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

// A page is rendered in a frame that cannot do anything: `sandbox=""` refuses scripts,
// forms, same-origin access and top navigation, and the policy inside the document
// allows nothing but its own inline styling and data: images -- so an <img src="http…">
// or a <script> in a delivered page reaches nothing. Written out in full, not
// configurable, because a weakening here is a security change, not a preference.
const FRAME_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
const frameDocument = (text) => `<!doctype html><meta http-equiv="Content-Security-Policy" content="${FRAME_POLICY}">${text}`

/**
 * A delivered file, opened in the panel: full screen on a phone, the right column on a
 * desktop. The panel itself is the container (its own rules already carry both shapes),
 * so this is only the title bar, the file, and the two exits.
 */
export function DeliveredPreview({ file, actions, onClose }) {
  const [read, setRead] = useState(null)
  const [state, setState] = useState('reading') // reading | shown | failed
  // A page shows as a page until the reader asks for the text it is written in.
  const [source, setSource] = useState(false)
  // A refusal from the exits row writes its sentence at the foot, beside the buttons.
  const [failure, setFailure] = useState(null)
  const name = basename(file.path)
  // The actions object is rebuilt by the panel on every render, so it is read through a
  // ref: an effect that depended on it would read the file again and again.
  const ask = useRef(actions)
  ask.current = actions
  useEffect(() => {
    let live = true
    setRead(null)
    setState('reading')
    setSource(false)
    void (async () => {
      try {
        const answer = await ask.current?.presentFile?.(file.path)
        if (!live) return
        if (!readable(answer)) { setState('failed'); return }
        setRead(answer)
        setState('shown')
      } catch {
        if (live) setState('failed')
      }
    })()
    return () => { live = false }
  }, [file.path])
  const body = state === 'reading'
    ? h('div', { className: 'bt-preview-body bt-fp-empty' }, h('div', { className: 'bt-fp-empty-title' }, t('Loading…')))
    : state === 'failed'
      ? h('div', { className: 'bt-preview-body bt-fp-empty' },
          h('div', { className: 'bt-fp-empty-title' }, t('This file has no preview')),
          h('div', { className: 'bt-fp-empty-text', role: 'status' }, t('Could not open it here. Copy the path and open the copy under {folder}', { folder: PHONE_COPY_HINT })))
      : read.kind === 'html' && !source
        ? h('iframe', { className: 'bt-preview-frame', sandbox: '', srcDoc: frameDocument(read.text ?? ''), title: name })
        : read.kind === 'image'
          // Images take the platform's own preview; this only catches one whose name
          // looked like a picture and whose bytes say otherwise.
          ? h('div', { className: 'bt-preview-body bt-fp-image' }, h('img', { src: `data:${read.mime ?? 'application/octet-stream'};base64,${read.base64 ?? ''}`, alt: name }))
          : h('div', { className: 'bt-preview-body' }, h(FileView, { file: source ? { ...read, kind: 'text' } : read }))
  return h(Fragment, null,
    h('div', { className: 'bt-preview-head' },
      h('button', { type: 'button', className: 'bt-preview-close', onClick: onClose, 'aria-label': t('Close preview'), title: t('Close preview') }, h(CloseIcon)),
      h('span', { className: 'bt-preview-name' }, name),
      state === 'shown' && read.kind === 'html'
        ? h('button', { type: 'button', className: 'bt-preview-toggle', onClick: () => setSource(current => !current) }, source ? t('Preview') : t('Source'))
        : null),
    body,
    h('div', { className: 'bt-preview-acts' },
      h(DeliverableActions, { file, actions, onFailed: setFailure }),
      failure ? h('span', { className: 'bt-dcard-hint', role: 'status' }, exitsSentence(failure.shared)) : null))
}

/**
 * A delivered picture, opened in the platform's own image preview: the lightbox DSH
 * itself opens, with Escape, a backdrop press and a close control, and focus back on
 * what opened it. The bytes still come from the host, one read, no copy on disk.
 */
export function DeliveredLightbox({ file, actions, onClose, onUnreadable }) {
  const [src, setSrc] = useState(null)
  const name = basename(file.path)
  const ask = useRef(actions)
  ask.current = actions
  const fallback = useRef(onUnreadable)
  fallback.current = onUnreadable
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const answer = await ask.current?.presentFile?.(file.path)
        if (!live) return
        if (answer?.ok === true && answer.kind === 'image') {
          setSrc(`data:${answer.mime ?? 'application/octet-stream'};base64,${answer.base64 ?? ''}`)
          return
        }
        // Not something the image preview can show: the preview page keeps both exits.
        fallback.current?.()
      } catch {
        if (live) fallback.current?.()
      }
    })()
    return () => { live = false }
  }, [file.path])
  if (src === null || typeof ImageLightbox !== 'function') return null
  return h(ImageLightbox, {
    src,
    alt: name,
    labels: { dialog: t('Image preview'), close: t('Close preview') },
    onClose,
  })
}
