import { createElement as h, useMemo, useState } from 'react'
import { t } from './i18n.js'

// A message past FOLD_AT shows folded: its first lines, then "Show all". A Bot's reply in
// its own chat is what the user reads, so it folds only past FOLD_HUGE, where rendering
// all of it would slow the chat down.
export const FOLD_AT = { chars: 1500, lines: 25 }
export const FOLD_HUGE = { chars: 20_000, lines: Infinity }
const ALWAYS = { chars: -1, lines: 0 }
const PREVIEW_LINES = 10
const PREVIEW_CHARS = 600
const PREVIEW = { chars: PREVIEW_CHARS, lines: PREVIEW_LINES }
// Folding is only worth it when it hides something: a bubble that keeps a line and hides
// the one behind it reads as a no-op. Past the limit, this much has to be hidden.
const HIDDEN = { chars: 120, lines: 3 }
const FENCE = /^ {0,3}(`{3,}|~{3,})/

// Cuts `text` at `end` code units, backing up one when the last character is a
// high surrogate so an emoji is not split in half.
function cutAt(text, end) {
  const code = text.charCodeAt(end - 1)
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? end - 1 : end)
}

// A preview ends where a sentence does, so a fold does not stop mid-thought. A period
// counts only before a space or a line end, which leaves 3.14 and a.b alone.
const SENTENCE = new Set(['。', '！', '？', '!', '?'])
const endsSentence = (text, at) => SENTENCE.has(text[at]) || (text[at] === '.' && (at + 1 === text.length || /\s/.test(text[at + 1])))

// Where a sentence ends inside `text[from, to)`; a line break there ends the preview
// without it, a punctuation mark belongs to it. -1 when nothing ends one.
function endIn(text, from, to) {
  for (let at = Math.min(to, text.length) - 1; at >= from; at -= 1) {
    if (text[at] === '\n') return at
    if (endsSentence(text, at)) return at + 1
  }
  return -1
}

// A reply can mark where its point ends and its detail starts: an empty line, or a line
// that is only a rule. A fold there keeps the whole point, so the point is never cut.
// Returns the offset past the mark, or 0 when the reply has none.
const RULE = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
function coreEnd(text) {
  let from = 0
  for (const line of text.split('\n')) {
    const end = Math.min(from + line.length + 1, text.length)
    if (from > 0 && (line.trim() === '' || RULE.test(line))) return end
    from = end
  }
  return 0
}

// Where the last blank line before `to` ends, so a preview keeps the paragraph above it
// and the empty line that separates it: a reply that leads with its point folds to that
// point. -1 when the text has no paragraph break before the budget.
function paragraphIn(text, to) {
  const end = Math.min(to, text.length)
  for (let at = end - 2; at >= 0; at -= 1) {
    if (text[at] !== '\n') continue
    let next = at + 1
    while (next < end && (text[next] === ' ' || text[next] === '\t')) next += 1
    if (next < end - 1 && text[next] === '\n') return next + 1
  }
  return -1
}

// The first sentence end at or after `from`, before `to`; -1 when there is none.
function endAfter(text, from, to) {
  for (let at = from; at < Math.min(to, text.length); at += 1) {
    if (text[at] === '\n') return at
    if (endsSentence(text, at)) return at + 1
  }
  return -1
}

// More than `max` lines, counted only as far as needed.
function moreLines(text, max) {
  let lines = 1
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) {
    if (++lines > max) return true
  }
  return false
}

// The start of a long text, cut at a line end (or inside a very long first line). In
// Markdown a code fence left open is closed, so the preview does not run on as code.
// Null when `text` is within `limit`, or when folding it would hide less than HIDDEN:
// `preview` is what a folded bubble keeps, and `force` folds regardless (a message kept
// only in part must fold however short its start).
// A mark only says where the point ends; it does not decide that the reply is long enough
// to fold. Detail under this much reads whole, so a 500-character reply stays readable.
const DETAIL = 600

export function foldPreview(text, limit = FOLD_AT, markdown = true, preview = PREVIEW, force = false, mark = false) {
  // Blank lines first: the preview starts at the first visible character. An
  // all-blank message has nothing to preview, so it does not fold at all.
  const body = text.replace(/^(\s*\n)+/, '')
  if (body.trim() === '') return null
  // Only a group line folds at a mark it carries (the option says so): a chat with the user
  // shows the whole reply, and its own limit decides. A mark followed by one short line
  // does not fold at all.
  if (mark && !force) {
    const core = coreEnd(body)
    if (core > 0 && body.length - core >= DETAIL) return body.slice(0, core)
  }
  if (text.length <= limit.chars && !moreLines(text, limit.lines)) return null
  if (!force && text.length - preview.chars < HIDDEN.chars && !moreLines(text, preview.lines + HIDDEN.lines)) return null
  let head = body.split('\n', preview.lines).join('\n')
  if (head.length > preview.chars) {
    // A paragraph break wins: the reply leads with its point, and a fold shows that point.
    // Then a sentence: one that ends near the budget, else the first past it up to 130%.
    // Only a message with no break and no sentence at all is cut hard, at a word end.
    const budget = preview.chars
    const paragraph = paragraphIn(head, budget)
    const near = paragraph > 0 ? paragraph : endIn(head, Math.floor(budget * 0.6), budget)
    const wider = near > 0 ? near : endAfter(head, budget, Math.floor(budget * 1.3))
    if (wider > 0) head = cutAt(head, wider)
    else {
      const space = head.lastIndexOf(' ', budget)
      head = cutAt(head, space > 0 ? space : budget)
    }
  }
  if (head.trim() === '') head = cutAt(body, preview.chars)
  if (!markdown) return head
  let open = null
  let openLine = -1
  let lines = head.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const marker = FENCE.exec(lines[i])?.[1]
    if (marker === undefined) continue
    if (open === null) { open = marker; openLine = i }
    else if (marker[0] === open[0] && marker.length >= open.length) open = null
  }
  if (open !== null && lines.slice(openLine + 1).join('').trim() === '') {
    // The cut kept only the fence marker (a card opening like ```dsh-ui on
    // its own line): an empty fence renders nothing, so pull the start of
    // the fenced text in as the preview instead.
    head = cutAt(body, preview.chars)
    lines = head.split('\n')
    open = null
    openLine = -1
    for (let i = 0; i < lines.length; i += 1) {
      const marker = FENCE.exec(lines[i])?.[1]
      if (marker === undefined) continue
      if (open === null) { open = marker; openLine = i }
      else if (marker[0] === open[0] && marker.length >= open.length) open = null
    }
  }
  if (open === null) return head
  // A fence the preview cut open loses its language tag: a downstream
  // renderer (dsh-ui cards) would otherwise claim the half message and the
  // expansion remounts its subtree looking like a no-op.
  lines[openLine] = open
  return `${lines.join('\n')}\n${open}`
}

// The line a long message that went as a file starts with (the host's attachLong) is
// for the model; the chat shows "Show all" instead.
export const stripLongNote = text => text.replace(/^\[A long message: \d+ characters\.[^\]\n]*\]\n/, '')

// `shown`: the text to show now; `control`: what goes under it (null for a short text).
// `whole`, when `text` is only the start of the message: its `length`, and `load()`,
// which reads it whole ({ text, whole }). `live`: still streaming, never folded.
// `markdown`: false for plain text.
export function useFold(text, { limit = FOLD_AT, preview, mark = false, whole, live = false, markdown = true } = {}) {
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState()
  const cut = whole !== undefined && whole.length > text.length
  // A message kept only in part folds whatever the length of its start.
  const kept = useMemo(() => (live ? null : foldPreview(text, cut ? ALWAYS : limit, markdown, preview, cut, mark)), [text, live, limit, markdown, preview, cut, mark])
  if (kept === null) return { shown: text, control: null }
  // The count follows what made it fold: a message too long by lines says its lines.
  const rows = cut || !moreLines(text, limit.lines) ? undefined : text.split('\n').length
  const count = (cut ? whole.length : text.length).toLocaleString()
  if (!open) {
    const show = async () => {
      setOpen(true)
      if (!cut || read !== undefined || whole.load === undefined) return
      setRead('loading')
      setRead(await whole.load() ?? { whole: false })
    }
    // A message kept only as a file says so: its "Show all" reads the attachment, and
    // its count is the whole message, not the start the bubble holds.
    const label = cut
      ? t('Open the whole reply · {count} characters, from its file', { count })
      : rows === undefined ? t('Show all · {count} characters', { count }) : t('Show all · {count} lines', { count: rows.toLocaleString() })
    return { shown: kept, folded: true, control: h('span', { className: 'bt-fold' }, h('button', { type: 'button', className: 'bt-more', onClick: show }, label)) }
  }
  const loaded = typeof read?.text === 'string' ? read : undefined
  const note = !cut || read === undefined || read === 'loading' || loaded?.whole ? null
    : loaded !== undefined && loaded.text.length > text.length ? t('Showing the first {count} characters', { count: loaded.text.length.toLocaleString() })
      : t('Only the start of this message is kept here')
  return {
    shown: loaded?.text ?? text,
    control: h('span', { className: 'bt-fold' },
      note ? h('span', { className: 'bt-fold-note' }, note) : null,
      h('button', { type: 'button', className: 'bt-more', onClick: () => setOpen(false) }, t('Show less'))),
  }
}
