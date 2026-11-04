// The phone shows a line's words, not the note that lets a text-only model read a
// picture. A line written since this field exists names its notes exactly; an older
// line falls back to the shape the generators produce. Only a note that was actually
// cut is tidied away — and only with the one newline it sat on — so the words around
// it keep their own blank lines and nothing is trimmed.
const READING_BLOCK = /\[Image [^\]]*?[.,][\s\S]*?\[End of image [^\]]*?\]/g
const READING_LINE = /\[Image [^\]]*?\]/g

// Cuts [note] out of [text] and, at most, the one newline it sat on.
function cutImageNote(text, note) {
  const at = text.indexOf(note)
  if (at < 0) return text
  let start = at
  let end = at + note.length
  if (text[end] === '\n') end += 1
  else if (start > 0 && text[start - 1] === '\n') start -= 1
  return text.slice(0, start) + text.slice(end)
}

export function stripImageReadings(text, readings) {
  if (typeof text !== 'string' || text === '') return text
  const known = Array.isArray(readings) ? readings.filter(reading => typeof reading === 'string' && reading !== '') : []
  let out = text
  if (known.length > 0) {
    for (const reading of known) out = cutImageNote(out, reading)
  } else {
    for (const note of [...out.matchAll(READING_BLOCK)].map(match => match[0])) out = cutImageNote(out, note)
    for (const note of [...out.matchAll(READING_LINE)].map(match => match[0])) out = cutImageNote(out, note)
  }
  return out
}

