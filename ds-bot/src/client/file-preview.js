// The Files tab of the Bot panel: a path into the team workspace, read on the host
// (src/host/files.js) and rendered here. One view per kind — Markdown, code or text,
// image — and a card with no content for everything else. The styles live in this
// module, since styles.js belongs to the conversation surface.
import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { t } from './i18n.js'

const sizeText = bytes => {
  if (!Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${unit === 0 ? Math.round(value) : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
const whenText = ms => new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const icon = paths => function FileIcon() {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    paths.map((d, index) => h('path', { key: index, d })))
}
const FileGlyph = icon(['M11.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 6 16.5h8a1.5 1.5 0 0 0 1.5-1.5V7.5z', 'M11.5 3.5v4h4'])
const OpenIcon = icon(['M10 3.5v9', 'M6.5 9.5L10 13l3.5-3.5'])
// The same labels the chat's Markdown uses, so a fence copies the same way.
const mdLabels = () => ({ code: { copyLabel: t('Copy'), copiedLabel: t('Copied') }, footnotes: t('Footnotes') })

// A code line with its number, so a long file keeps its bearings.
function CodeLine({ number, text }) {
  return h('span', { className: 'bt-fp-line' },
    h('span', { className: 'bt-fp-num', 'aria-hidden': true }, number),
    h('span', { className: 'bt-fp-code' }, text === '' ? '\u200b' : text))
}

function CutNote({ file }) {
  return h('div', { className: 'bt-fp-cut' }, t('Only the first {size} are shown.', { size: sizeText(file.size) }))
}

function TextView({ file }) {
  return h('div', { className: 'bt-fp-body bt-fp-text', 'aria-label': file.name },
    (file.text ?? '').split('\n').map((line, index) => h(CodeLine, { key: index, number: index + 1, text: line })),
    file.truncated ? h(CutNote, { file }) : null)
}

function MarkdownView({ file }) {
  return h('div', { className: 'bt-fp-body bt-fp-markdown', 'aria-label': file.name },
    h(MarkdownText, { text: file.text ?? '', labels: mdLabels() }),
    file.truncated ? h(CutNote, { file }) : null)
}

function ImageView({ file }) {
  const [failed, setFailed] = useState(false)
  if (failed) return h('div', { className: 'bt-fp-body bt-fp-empty' }, h('div', { className: 'bt-fp-empty-title' }, t('This file has no preview')))
  return h('div', { className: 'bt-fp-body bt-fp-image' }, h('img', { src: `data:${file.mime ?? 'application/octet-stream'};base64,${file.base64 ?? ''}`, alt: file.name, onError: () => setFailed(true) }))
}

/**
 * What the panel shows for one file, once the host answered. A delivered file shown in
 * the conversation is a file too, so the card re-uses this rather than drawing a second
 * viewer: Markdown goes through DSH's own renderer, text keeps its line numbers.
 */
export function FileView({ file }) {
  if (file.kind === 'markdown') return h(MarkdownView, { file })
  if (file.kind === 'image') return h(ImageView, { file })
  if (file.kind === 'text') return h(TextView, { file })
  return h('div', { className: 'bt-fp-body bt-fp-empty' },
    h(FileGlyph),
    h('div', { className: 'bt-fp-empty-title' }, t('This file has no preview')),
    h('div', { className: 'bt-fp-empty-text' }, t('Text and Markdown files, and images, are previewed here. Everything else shows its details only.')),
    h('div', { className: 'bt-fp-meta' },
      h('span', null, file.name),
      h('span', null, sizeText(file.size)),
      h('span', null, t('Changed {when}', { when: whenText(file.mtime) }))))
}

/**
 * The Files tab. `actions.panelFile` posts one path to the host (channel.js,
 * `panel-file`) and answers with the file or its reason.
 */
export function FilePreview({ actions }) {
  const [draft, setDraft] = useState('')
  const [path, setPath] = useState(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Only the newest read is shown: a slow one for an abandoned path must not land.
  const ask = useRef(0)

  const open = useCallback(async (next) => {
    const at = ++ask.current
    setLoading(true)
    setError('')
    try {
      const answer = await actions.panelFile(next)
      if (ask.current !== at) return
      if (!answer.ok) { setFile(null); setError(answer.error); return }
      setFile(answer)
      setPath(next)
    } catch (failure) {
      if (ask.current !== at) return
      setFile(null)
      setError(failure?.message ?? String(failure))
    } finally {
      if (ask.current === at) setLoading(false)
    }
  }, [actions])

  // A cleared form clears the view with it, so a stale preview never stays up.
  useEffect(() => {
    if (draft.trim() !== '') return
    setPath(null); setFile(null); setError('')
  }, [draft])

  const submit = (event) => {
    event.preventDefault()
    const next = draft.trim()
    if (next === '') { setError(t('A file path is required')); return }
    void open(next)
  }

  const empty = !loading && !file && !error
  return h('div', { className: 'bt-panel-view bt-fp', 'aria-label': t('Files') },
    h('form', { className: 'bt-fp-bar', onSubmit: submit },
      h('input', {
        type: 'text', value: draft, spellCheck: false, autoComplete: 'off', 'aria-label': t('File path'),
        placeholder: t('Open a file in the workspace'),
        onChange: event => setDraft(event.target.value),
      }),
      h('button', { type: 'submit', className: 'bt-fp-open', disabled: loading, title: t('Open a file in the workspace') }, h(OpenIcon))),
    error ? h('div', { className: 'bt-fp-error', role: 'alert' }, error) : null,
    loading && !file ? h('div', { className: 'bt-fp-body bt-fp-empty' }, h('div', { className: 'bt-fp-empty-title' }, t('Loading…'))) : null,
    file ? h(FileView, { file }) : null,
    empty ? h('div', { className: 'bt-fp-body bt-fp-empty' },
      h(FileGlyph),
      h('div', { className: 'bt-fp-empty-title' }, t('No preview')),
      h('div', { className: 'bt-fp-empty-text' }, t('Text and Markdown files, and images, are previewed here. Everything else shows its details only.'))) : null,
    path && !loading && !error && file ? h('div', { className: 'bt-fp-foot' }, t('Preview {name}', { name: path })) : null)
}

export const FILE_PREVIEW_CSS = `
.bt-fp{--bt-fp-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.bt-fp-bar{display:flex;align-items:center;gap:6px;height:44px;flex:none;padding:0 10px 0 12px;border-bottom:.5px solid var(--bt-line)}
.bt-fp-bar input{flex:1;min-width:0;height:30px;margin:0;padding:0 10px;border:0;border-radius:8px;outline:none;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:12.5px;font-family:var(--bt-fp-mono)}
.bt-fp-bar input::placeholder{color:var(--bt-ink-3)}
.bt-fp-bar input:focus{background:var(--bt-main);box-shadow:0 0 0 1px var(--bt-line-2)}
.bt-fp-open{flex:none;width:30px;height:30px;border:0;border-radius:8px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.bt-fp-open:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-fp-open:disabled{opacity:.4;cursor:default;background:none}
.bt-fp-open svg{width:15px;height:15px}
.bt-fp-body{flex:1;min-height:0;overflow:auto;padding:10px 12px 14px}
.bt-fp-error{padding:8px 12px;color:#e02135;font-size:12px;line-height:16px;flex:none}
.bt-fp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--bt-ink-3);text-align:center;padding:24px}
.bt-fp-empty svg{width:22px;height:22px}
.bt-fp-empty-title{font-size:13px;line-height:18px;font-weight:500;color:var(--bt-ink-2)}
.bt-fp-empty-text{max-width:260px;font-size:12px;line-height:17px;overflow-wrap:anywhere}
.bt-fp-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 10px;margin-top:4px;font-size:11.5px;line-height:15px;color:var(--bt-ink-3)}
.bt-fp-markdown [class*="_markdown"]{color:inherit}
.bt-fp-text{font-family:var(--bt-fp-mono);font-size:12.5px;line-height:19px;color:var(--bt-ink)}
.bt-fp-line{display:flex;gap:8px}
.bt-fp-num{flex:none;width:26px;text-align:right;color:var(--bt-ink-3);font-variant-numeric:tabular-nums;user-select:none;-webkit-user-select:none}
.bt-fp-code{white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
.bt-fp-cut{margin-top:10px;padding:6px 8px;border-radius:8px;background:var(--bt-hover);color:var(--bt-ink-3);font-size:11.5px;line-height:15px}
.bt-fp-image{display:flex;align-items:flex-start;justify-content:center;padding:14px}
.bt-fp-image img{max-width:100%;max-height:100%;border-radius:8px;object-fit:contain}
.bt-fp-foot{flex:none;padding:6px 12px 8px;border-top:.5px solid var(--bt-line);font-size:11.5px;line-height:15px;color:var(--bt-ink-3);font-family:var(--bt-fp-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* A delivered file's own page in the panel (deliverables.js): a title bar -- back on the
   left, the name centred, the "···" menu on the right -- the file, and the exits. The
   panel carries the shape: full screen on a phone, the right column on a desktop, so
   nothing here is sized per band.

   The bar takes the drawer's title -- the 17/24 name (.bt-drawer-name in styles.js) -- and
   grows from there: the controls are a 48px touch target, the size a finger is owed on the
   page the user actually taps, and the bar is 56px, which leaves that control 4px at either
   end rather than touching the edges.

   The drawing inside a control is what the eye judges, so neither is a shape we drew: both
   are Lucide (ISC) glyph data, copied from lucide-static and carrying its notice in icons.js.
   One grid, one stroke, and a box derived per glyph so that the longest run of ink lands on
   the 18px these controls were measured to. Nothing here sizes an icon or pins a width. */
.bt-preview-head{position:relative;display:flex;align-items:center;gap:8px;height:56px;flex:none;padding:0 10px;border-bottom:.5px solid var(--bt-line)}
.bt-preview-back{flex:none;width:48px;height:48px;border:0;border-radius:10px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.bt-preview-back:hover{background:var(--bt-hover);color:var(--bt-ink)}
/* The bar's back arrow is Lucide's chevron-left: 6x12 units of a 24-unit grid, so the 33px
   box it brings paints 9.8x18.0 of ink. The box and the stroke are the glyph's. */
/* Centred over the bar itself, so the name is in the middle whatever the two ends hold.
   The reserve is the two controls, their padding and their gaps, so a long name never
   slides under one: 48 + 48 + 20 of padding + 20 of slack. */
.bt-preview-name{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:calc(100% - 136px);font-size:17px;line-height:24px;font-weight:500;color:var(--bt-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-preview-menu{margin-left:auto}
.bt-preview-more{flex:none;width:48px;height:48px;border:0;border-radius:10px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.bt-preview-more:hover{background:var(--bt-hover);color:var(--bt-ink)}
/* The dots are Lucide's ellipsis: three r=1 circles, the one glyph here that keeps Lucide's own
   stroke -- pinned at 1.5px its 5.5px dots would each carry a 2.5px hole. Its 33px box lands
   5.5px dots in a 24.8px row. A row of dots has no height to grow -- its ink is the dot diameter
   -- so the glyph's own box carries the size. */
.bt-preview-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
.bt-preview-body>.bt-fp-body{flex:1}
.bt-preview-frame{flex:1;min-height:0;width:100%;border:0;background:#fff}
.bt-preview-acts{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;justify-content:flex-end;padding:8px 10px;border-top:.5px solid var(--bt-line)}
.bt-preview-acts .bt-dcard-hint{flex:1 1 100%;text-align:left}
/* Everything the team delivered, in the same panel a preview opens in. The list is drawn
   with the message cards themselves (deliverables.js), so there is no row style of its
   own here: only the panel's own shape -- the cards take the full width instead of the
   message's avatar indent, one to a row, under the line that says what the list is. */
.bt-products{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;padding:6px}
.bt-products>.bt-fp-empty{flex:1}
/* The list's rows sit closer than the message's two-column grid: the reference list is a
   stack of tiles, not a grid, so 10px of gap read as a gap rather than as rhythm. */
.bt-products .bt-dcards{margin-left:0;grid-template-columns:minmax(0,1fr);gap:6px;padding:0 2px 6px}
`
