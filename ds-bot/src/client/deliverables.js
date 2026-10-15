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
import { FileTypeIcon, fileExtension, fileSizeText, ImageLightbox, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { BackChevronIcon, CheckIcon, CopyIcon, DotsBoldIcon, SwitchIcon } from './icons.js'
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

// The word for a kind of file, in the reader's language. The list's second line leads with
// it, so it is a word rather than the extension a message's card shows.
const TYPE_WORDS = {
  md: 'Markdown file', markdown: 'Markdown file', mdx: 'Markdown file',
  png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', webp: 'Image', avif: 'Image', bmp: 'Image', ico: 'Image', svg: 'Image',
  html: 'HTML file', htm: 'HTML file',
  pdf: 'PDF file',
  doc: 'Word document', docx: 'Word document', rtf: 'Word document',
  xls: 'Spreadsheet', xlsx: 'Spreadsheet', csv: 'Spreadsheet', ods: 'Spreadsheet',
  ppt: 'Slides', pptx: 'Slides', odp: 'Slides',
  mp4: 'Video', mov: 'Video', webm: 'Video', mkv: 'Video', avi: 'Video',
  mp3: 'Audio', wav: 'Audio', m4a: 'Audio', ogg: 'Audio', flac: 'Audio',
  zip: 'Archive file', tar: 'Archive file', gz: 'Archive file', tgz: 'Archive file', '7z': 'Archive file', rar: 'Archive file',
  js: 'Code file', mjs: 'Code file', cjs: 'Code file', ts: 'Code file', tsx: 'Code file', jsx: 'Code file',
  py: 'Code file', go: 'Code file', rs: 'Code file', java: 'Code file', c: 'Code file', h: 'Code file',
  cpp: 'Code file', css: 'Code file', json: 'Code file', yml: 'Code file', yaml: 'Code file',
  toml: 'Code file', sh: 'Code file', sql: 'Code file', xml: 'Code file',
}
const wordFor = (path) => t(TYPE_WORDS[fileExtension(basename(path))] ?? 'File')

// The workspace a delivered file came out of, named the way a reader asks about it rather
// than spelled out as an absolute path -- the path is what a reader cannot act on. A root is
// matched on its tail, so both the /data/user/0/... and the /data/data/... spelling of one
// machine answer the same, and the longest row wins. A file from anywhere else falls back to
// the folder it sits in, which is short and at least says which pile it belongs to.
const WORKSPACES = [
  ['.dsh/bot/workspace', 'DSH workspace'],
  ['repos/dsh-bot/ds-bot', 'DSBot'],
  ['repos/dsh-bot', 'DSBot'],
  ['repos/DeepSeek-Bot', 'DSBot'],
]
const workspaceOf = (path) => {
  for (const [root, name] of WORKSPACES) {
    if (path.includes(`${root}/`)) return t(name)
  }
  const at = path.lastIndexOf('/')
  const folder = at === -1 ? '' : basename(path.slice(0, at))
  return folder === '' ? t('Workspace') : folder
}

// Sizes the list has learned, by path: a delivered file's size is the host's to know, and
// the only read path this client already has is the one a preview opens a file with. No
// new host action, so nothing here waits on a restart. A path that comes back unreadable
// is remembered as such, so it is asked once and not once per redraw.
const sizesOf = new Map()

// What the panel's list says under the name where a message's card says what the file is:
// what kind of file it is, how big it is, and which workspace it came out of -- the second
// line the user asked for. The kind and the workspace are in the path and show at once; the
// size joins them when the host answers, so the line is never blank and never a bare path.
const metaOf = (file) => {
  const parts = [wordFor(file.path)]
  const size = sizesOf.get(file.path)
  if (Number.isFinite(size)) parts.push(fileSizeText(size))
  parts.push(workspaceOf(file.path))
  return parts.join(' · ')
}

/**
 * The sentence that explains a refusal. Both places that can refuse (the card and the
 * preview page) write it through here, so the wording cannot drift between them.
 */
export const exitsSentence = (shared) => (shared !== null && shared !== undefined
  ? t('Could not open it here. The copy is at {path}', { path: shared })
  : t('Could not open it here. Copy the path and open the copy under {folder}', { folder: PHONE_COPY_HINT }))

/**
 * The two ways a phone reaches a delivered file it cannot show in place, as behaviour
 * only -- the card and the preview page each open their own "···" onto them, and both go
 * through this one definition so they cannot drift apart.
 *
 * The first asks the shell's own chooser (window.__dshOpenPath, a system chooser that
 * hands an absolute device path to an app that can read it). A delivered file sits in
 * the app's own storage, which no other app can read, so a copy goes to shared storage
 * first. A host without the chooser -- a desktop -- keeps the engine's opener.
 *
 * A refusal is reported to the caller through `onFailed({ shared })` rather than written
 * here: the card clips at 60px, so its sentence has to live outside the tile.
 */
export function useDeliverableExits(file, actions, onFailed) {
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
      // A file opened from the list of everything delivered carries no message
      // coordinates, so the engine's own opener has nothing to point at: the sentence
      // sends the reader to the path instead.
      if (file.sessionId === undefined) { failed(null); return }
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
  return { state, open, copy }
}

/**
 * The card's exits: one "···" in the card's own 44px control, opening the file's two exits
 * by name -- hand it to another app, copy its path. Not a row of icon buttons, and not the
 * copy path beside "preview" as if the two were equals: copying the path is what a reader
 * reaches for when nothing else can open the file, so it belongs behind a menu, and the
 * card's own face is for the file. A tap anywhere on the card opens the preview -- the whole
 * card is the hit target and announces itself with "Preview <name>".
 *
 * The panel's rows draw this same control: one file to a row, and the name takes every pixel
 * the exits do not. Same exits, same words, same control in both -- which is why nothing here
 * is parameterized by which list is drawing it.
 */
export function DeliverableActions({ file, actions, onFailed }) {
  const exits = useDeliverableExits(file, actions, onFailed)
  const [shown, setShown] = useState(false)
  return h(ExitsMenu, {
    exits, shown, setShown, className: 'bt-dcard-menu',
    anchor: h('button', {
      type: 'button', className: 'bt-dcard-btn', 'data-act': 'more',
      'aria-haspopup': 'menu', 'aria-expanded': shown,
      'aria-label': t('More'), title: t('More'), onClick: () => setShown(value => !value),
      // The filled dots, not the hairline ones: DotsIcon paints 1.5-unit dots that land at
      // 2.6px here, which is why a control this size looked empty. 34px is the box the
      // preview bar's own "···" draws, so the two pages' menus read as one.
    }, h(DotsBoldIcon, { size: 34 })),
  })
}

/** What this file's exits can do, as menu items. Written here once: both menus show them. */
const exitItems = (state) => [
  { id: 'open', icon: h(SwitchIcon), label: state === 'opening' ? t('Opening…') : t('Open with another app') },
  { id: 'copy', icon: state === 'copied' ? h(CheckIcon) : h(CopyIcon), label: state === 'copied' ? t('Copied') : t('Copy path') },
]

/**
 * Those exits as the platform's own Menu, which behaves like every other one in the shell
 * (focus, Escape, a portal, aligning itself to the edge). The preview page's "···" and the
 * panel row's single control are this one menu around two anchors, so the two cannot come
 * to say different things; a page adds its source toggle here rather than crowding its bar.
 */
function ExitsMenu({ exits, shown, setShown, className, anchor, extra = null, onExtra }) {
  return h(Menu, {
    className, open: shown, autoFocus: true, portal: true, align: 'end',
    onClose: () => setShown(false),
    anchor,
    items: [...(extra === null ? [] : [extra]), ...exitItems(exits.state)],
    onSelect: (id) => {
      setShown(false)
      if (id === 'copy') void exits.copy()
      else if (id === 'open') void exits.open()
      else if (extra !== null && extra.id === id) onExtra?.()
    },
  })
}

/** The preview page's own "···": the same menu, opened from the bar's own control. */
function PreviewMenu({ file, actions, onFailed, extra = null, onExtra }) {
  const exits = useDeliverableExits(file, actions, onFailed)
  const [shown, setShown] = useState(false)
  return h(ExitsMenu, {
    exits, shown, setShown, className: 'bt-preview-menu', extra, onExtra,
    anchor: h('button', {
      type: 'button', className: 'bt-preview-more', 'aria-haspopup': 'menu', 'aria-expanded': shown,
      'aria-label': t('More'), title: t('More'), onClick: () => setShown(value => !value),
      // The filled dots, not the hairline ones: DotsIcon paints 1.5-unit dots that land at
      // 2.6px in this control, which is why a 48px button still looks empty. 34px is the box
      // the bar's rule sizes it to as well, so the two agree.
    }, h(DotsBoldIcon, { size: 34 })),
  })
}

/**
 * One delivered file, as the card DSH's own PresentedFileCard is shaped like. Both lists
 * of deliverables draw through this one component -- the ones a message ends with, and the
 * panel's list of everything -- so the two cannot drift apart; only what the second line
 * says and where the coordinates come from differ.
 */
function DeliverableCard({ file, actions, meta, role }) {
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
  return h('div', { className: 'bt-dcard-wrap', role },
    h('div', { className: 'bt-dcard' },
      h('button', {
        type: 'button',
        className: 'bt-dcard-hit',
        'aria-label': `${t('Preview')} ${name}`,
        onClick: preview,
      }),
      h('span', { className: 'bt-dcard-ico', 'aria-hidden': true }, h(FileTypeIcon, { path: file.path, size: 24 })),
      h('span', { className: 'bt-dcard-copy' },
        h('span', { className: 'bt-dcard-name' }, name),
        h('span', { className: 'bt-dcard-desc' }, meta ?? metaText(file, name))),
      h('span', { className: 'bt-dcard-acts' }, h(DeliverableActions, { file, actions, onFailed: setFailure }))),
    failure ? h('span', { className: 'bt-dcard-hint', role: 'status' }, exitsSentence(failure.shared)) : null)
}

/**
 * The cards for a set of deliverances: what a message ends with, and (with `metaOf` and
 * `list`) the panel's list of everything the team handed over. `deliverables` is the same
 * shape the host sends for a group reply -- `[{ sessionId, seq, files }]` -- and a file
 * carries its own `index` when the source already knows it.
 */
export function DeliverableCards({ deliverables, actions, metaOf = null, list = false }) {
  const files = (deliverables ?? [])
    .flatMap(entry => (entry?.files ?? []).map((file, position) => ({
      path: file?.path,
      description: typeof file?.description === 'string' ? file.description : undefined,
      // A file's own coordinates when the source has them (DSH's turn record does), the
      // position among its neighbours otherwise (the host's group replies do not).
      at: file?.at,
      sessionId: entry.sessionId,
      seq: entry.seq,
      index: Number.isInteger(file?.index) ? file.index : position,
    })))
    .filter(file => typeof file.path === 'string' && file.path !== '')
  if (files.length === 0) return null
  return h('div', { className: 'bt-dcards', role: list ? 'list' : undefined },
    files.map(file => h(DeliverableCard, {
      // The same file can be handed over twice; a row without coordinates is keyed by its
      // path, which is what makes it one row.
      key: file.sessionId === undefined ? file.path : `${file.sessionId}:${file.seq}:${file.index}`,
      file,
      actions,
      meta: metaOf?.(file),
      role: list ? 'listitem' : undefined,
    })))
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
  // A page keeps its source one item away in the same menu, so the bar stays three parts:
  // back on the left, the name centred, the menu on the right.
  const toggle = state === 'shown' && read.kind === 'html' ? { id: 'source', label: source ? t('Preview') : t('Source') } : null
  return h(Fragment, null,
    h(PreviewHead, { name, onClose },
      h(PreviewMenu, { file, actions, onFailed: setFailure, extra: toggle, onExtra: () => setSource(current => !current) })),
    body,
    // A refusal is the one thing that still needs a line of its own under the file.
    failure ? h('div', { className: 'bt-preview-acts' },
      h('span', { className: 'bt-dcard-hint', role: 'status' }, exitsSentence(failure.shared))) : null)
}

/**
 * The title bar both panel pages open with: the way back, what is being shown, and
 * whatever that page puts beside the two (a page's source toggle, and nothing else).
 */
function PreviewHead({ name, onClose, children }) {
  return h('div', { className: 'bt-preview-head' },
    h('button', { type: 'button', className: 'bt-preview-back', onClick: onClose, 'aria-label': t('Back'), title: t('Back') }, h(BackChevronIcon)),
    h('span', { className: 'bt-preview-name' }, name),
    children)
}

/**
 * Everything the team's Bots have handed over, newest first, in the panel a preview opens
 * in -- full screen on a phone, the right column on a desktop. It is a view of the same
 * host record the cards were registered from, so it lists what was really delivered, and
 * it is drawn with the very cards the messages end with: same tile, same type icon, the same
 * one "···" for the exits, one tap to the preview -- there is no panel shape of the card at
 * all. Only the second line differs: a message's card says what the file is, this one names
 * its kind and how big it is. Read-only: it lists and opens.
 */
export function DeliveredList({ actions, onClose }) {
  const [state, setState] = useState('reading') // reading | shown | failed
  const [files, setFiles] = useState([])
  const [, bumpSizes] = useState(0)
  const ask = useRef(actions)
  ask.current = actions
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const answer = await ask.current?.listDelivered?.()
        if (!live) return
        if (!Array.isArray(answer?.files)) { setState('failed'); return }
        setFiles(answer.files.filter(entry => typeof entry?.path === 'string' && entry.path !== ''))
        setState('shown')
      } catch {
        if (live) setState('failed')
      }
    })()
    return () => { live = false }
  }, [])
  // The second line carries a size, and a size is the host's to know: one read per row,
  // through the very read a preview opens a file with, one row at a time so a long list
  // does not fire every read at once. A row shows its kind until its size lands, and each
  // path is asked once -- `sizesOf` keeps the answer, a refusal included.
  useEffect(() => {
    let live = true
    void (async () => {
      for (const entry of files) {
        if (sizesOf.has(entry.path)) continue
        let answer = null
        try {
          answer = await ask.current?.presentFile?.(entry.path)
        } catch {
          answer = null
        }
        if (!live) return
        sizesOf.set(entry.path, Number.isFinite(answer?.size) ? answer.size : null)
        bumpSizes(count => count + 1)
      }
    })()
    return () => { live = false }
  }, [files])
  // A row from this list carries no message coordinates -- nothing here knows which
  // reply a file came from -- so the card's own exits do what they can: the phone's
  // chooser gets a copy, and the path is one tap away either way.
  const rows = [{ files: files.map(entry => ({ path: entry.path, at: entry.at })) }]
  const body = state === 'reading'
    ? h('div', { className: 'bt-products' }, h('div', { className: 'bt-fp-empty' }, h('div', { className: 'bt-fp-empty-title' }, t('Loading…'))))
    : state === 'failed'
      ? h('div', { className: 'bt-products' }, h('div', { className: 'bt-fp-empty' }, h('div', { className: 'bt-fp-empty-title', role: 'status' }, t('This list could not be read'))))
      : h('div', { className: 'bt-products' },
          // The list is what this host saw delivered, and it is not backfilled: a short
          // list is the truth rather than a bug, so it says so above itself.
          h('div', { className: 'bt-prod-note' }, t('Only files delivered since this run started are listed.')),
          files.length === 0
            ? h('div', { className: 'bt-fp-empty' },
                h('div', { className: 'bt-fp-empty-title' }, t('No deliverables yet')),
                h('div', { className: 'bt-fp-empty-text' }, t('Files a Bot hands over are listed here.')))
            : h(DeliverableCards, { deliverables: rows, actions, list: true, metaOf }))
  return h(Fragment, null,
    h(PreviewHead, { name: t('All deliverables'), onClose }),
    body)
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
  // The platform's own preview puts focus back on whatever opened it, and it already
  // skips a node that has left the document (ModalLayer checks isConnected). A card can
  // still be re-rendered away while the picture is up, and then there is nothing left to
  // return to: the same card is looked up again -- the list redrew it, so it is there --
  // and takes the focus instead of leaving it nowhere. Only a focus that was lost is
  // taken back; one the platform restored is left exactly where it put it.
  useEffect(() => () => {
    const active = document.activeElement
    if (active !== null && active !== document.body) return
    const again = [...document.querySelectorAll('.bt-dcard-hit')]
      .find(node => (node.getAttribute('aria-label') ?? '').endsWith(` ${name}`))
    if (again instanceof HTMLElement) again.focus()
  }, [name])
  if (src === null || typeof ImageLightbox !== 'function') return null
  return h(ImageLightbox, {
    src,
    alt: name,
    labels: { dialog: t('Image preview'), close: t('Close preview') },
    onClose,
  })
}
