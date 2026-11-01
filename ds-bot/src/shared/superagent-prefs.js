// The SuperAgent page's preferences, applied the same way wherever they come from. A switch
// is on unless it was written `false`, so deleting a key turns it back on; the one threshold
// is refused outside its bounds rather than clamped, and `null` resets either to its default.
import { FOLD_AT_BOUNDS, isFoldAt } from './fold-at.js'

export const SWITCH_KEYS = ['saFold', 'saConclude', 'saLookup', 'saBackground', 'saPrepare']

export function applySuperAgentPrefs(prefs, body) {
  for (const key of SWITCH_KEYS) {
    if (body[key] === true) prefs[key] = true
    else if (body[key] === false) prefs[key] = false
    else if (body[key] === null) delete prefs[key]
  }
  if (body.saFoldAt === undefined) return prefs
  const at = body.saFoldAt
  if (at === null) delete prefs.saFoldAt
  else if (isFoldAt(at)) prefs.saFoldAt = { chars: at.chars, lines: at.lines }
  else {
    const message = `Fold threshold must be ${FOLD_AT_BOUNDS.chars.join('–')} characters and ${FOLD_AT_BOUNDS.lines.join('–')} lines`
    throw Object.assign(new Error(message), { code: 'bot/invalid' })
  }
  return prefs
}
