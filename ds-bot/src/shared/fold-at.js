// Where a group line folds, and what the settings page may set it to. Host and client both
// read this file, so a value the host refuses and a value the client falls back on can never
// drift apart.
export const SA_FOLD_AT = { chars: 1000, lines: 20 }
export const FOLD_AT_BOUNDS = { chars: [300, 20_000], lines: [8, 500] }

export function isFoldAt(at) {
  const [minChars, maxChars] = FOLD_AT_BOUNDS.chars
  const [minLines, maxLines] = FOLD_AT_BOUNDS.lines
  return Number.isInteger(at?.chars) && at.chars >= minChars && at.chars <= maxChars
    && Number.isInteger(at?.lines) && at.lines >= minLines && at.lines <= maxLines
}
