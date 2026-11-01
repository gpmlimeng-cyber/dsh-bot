// How a finished turn's tool calls read as one line: a class and a count, and files counted
// once by path, so reading the same file three times is "3 calls, 1 file".
const CLASSES = [
  ['read', ['read', 'read_own_chat', 'read_group_chat', 'list_files', 'glob', 'grep', 'search', 'list_bots', 'list_bot_models', 'list_capabilities', 'list_secrets', 'recall']],
  ['write', ['write', 'edit', 'str_replace', 'apply_patch', 'remember', 'forget']],
  ['run', ['bash', 'pwsh', 'run_code', 'browser']],
  ['show', ['show_view', 'ask_user', 'request_secret', 'present']],
]

export function classOf(name) {
  for (const [kind, names] of CLASSES) if (names.includes(name)) return kind
  return 'other'
}

// The file a call names, by path only: a read already done is not a second file.
export function fileOf(args) {
  if (args === null || typeof args !== 'object') return undefined
  const path = args.path ?? args.file ?? args.file_path
  return typeof path === 'string' && path !== '' ? path : undefined
}

// `calls` are the turn's calls in order; returns counts per class and the unique paths.
export function summarizeCalls(calls) {
  const counts = { read: 0, write: 0, run: 0, show: 0, other: 0 }
  const files = new Set()
  for (const call of calls ?? []) {
    const name = String(call?.name ?? '')
    if (name === '') continue
    counts[classOf(name)] += 1
    const file = fileOf(call.arguments ?? call.args)
    if (file !== undefined) files.add(file)
  }
  return { counts, files: [...files] }
}

// The one-line label, in the order the reader cares about: what was read or changed, then
// what was run or shown. Empty when nothing happened.
export function summaryLine({ counts, files }, t = (text, params) => text.replace(/\{(\w+)\}/g, (_, key) => String(params?.[key] ?? ''))) {
  const parts = []
  if (counts.read > 0) parts.push(t('{count} read', { count: counts.read }))
  if (counts.write > 0) parts.push(t('{count} changed', { count: counts.write }))
  if (counts.run > 0) parts.push(t('{count} run', { count: counts.run }))
  if (counts.show > 0) parts.push(t('{count} shown', { count: counts.show }))
  if (counts.other > 0) parts.push(t('{count} other', { count: counts.other }))
  if (files.length > 0) parts.push(t('{count} files', { count: files.length }))
  return parts.join(' · ')
}
