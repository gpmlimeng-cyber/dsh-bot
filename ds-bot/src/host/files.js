// Read-only file previews for the Bot panel's Files tab. The panel names a path in
// the team workspace and gets its text back, or its base64 for an image. The read
// is the whole risk: a path that escapes the workspace (an absolute path, a `..`
// walk, a link out of it) must never reach the disk, so every path is resolved
// against the root and checked twice — once as written, once as it really is.
import { mkdir, open, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve, sep } from 'node:path'

// What is read at most. A text or Markdown file gives back its first TEXT_MAX bytes
// and says it was cut off; an image is read whole up to IMAGE_MAX and is a binary
// past that, so one picture cannot flood the channel; nothing else is read at all.
export const TEXT_MAX = 120_000
export const IMAGE_MAX = 2_000_000
// How many bytes the signature check looks at, and so how much a small file reads.
const HEAD_MAX = 512
// How many delivered paths stay readable. A phone opens what was just handed to it, so
// the window only has to outlast the conversation it belongs to.
const DELIVERED_MAX = 500
// Suffixes shown as text. Everything else that is not an image is a binary.
const TEXT_SUFFIX = new Set([
  'bash', 'bibtex', 'c', 'cfg', 'clj', 'cljs', 'conf', 'cpp', 'cs', 'css', 'csv', 'dart', 'diff',
  'env', 'erl', 'ex', 'exs', 'fs', 'go', 'graphql', 'groovy', 'h', 'hpp', 'htm', 'html', 'ini',
  'java', 'js', 'json', 'json5', 'jsonc', 'jsonl', 'jsx', 'kt', 'kts', 'less', 'lisp', 'lock', 'log',
  'lua', 'm', 'make', 'md', 'mdx', 'mjs', 'mts', 'nim', 'patch', 'php', 'pl', 'pm', 'properties',
  'ps1', 'py', 'r', 'rb', 'rs', 'rst', 'sass', 'scala', 'scss', 'sh', 'sql', 'svg', 'swift', 'tex',
  'toml', 'ts', 'tsx', 'txt', 'vim', 'vue', 'xml', 'yaml', 'yml', 'zig', 'zsh',
])
const IMAGE_SUFFIX = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico'])
const MARKDOWN_SUFFIX = new Set(['md', 'mdx', 'markdown'])
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon' }

const suffixOf = name => {
  const at = basename(name).lastIndexOf('.')
  return at <= 0 ? '' : name.slice(at + 1).toLowerCase()
}

// The panel's renderer for one file. The name says what it claims to be; `head`, the
// file's first bytes, is what it really is: a suffix can lie in either direction, and
// a `.png` that holds text would otherwise be read whole as an image (up to IMAGE_MAX,
// many times TEXT_MAX), while a `.txt` holding binary would push raw bytes into text.
// So an image suffix is only believed when the bytes carry that image's signature,
// and a text suffix is only believed when the bytes hold no NUL — the cheapest
// reliable signal that a file is binary. `binary` is what the panel shows as a file
// card with no content.
export function fileKind(name, size, head) {
  const suffix = suffixOf(name)
  const bytes = Buffer.isBuffer(head) ? head : Buffer.alloc(0)
  if (MARKDOWN_SUFFIX.has(suffix)) return binaryBytes(bytes) ? 'binary' : 'markdown'
  if (IMAGE_SUFFIX.has(suffix)) return size > IMAGE_MAX || !imageBytes(bytes) ? 'binary' : 'image'
  if (TEXT_SUFFIX.has(suffix)) return binaryBytes(bytes) ? 'binary' : 'text'
  return 'binary'
}

// Signatures, each matched at the start of the file. WEBP is a RIFF box whose bytes
// 8..12 name the format; the rest are fixed at their own offsets.
const IMAGE_HEAD = [
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
  [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  [0x42, 0x4d], // BMP
  [0x00, 0x00, 0x01, 0x00], // ICO
]
const imageBytes = (bytes) => {
  for (const signature of IMAGE_HEAD) {
    if (bytes.length >= signature.length && signature.every((byte, at) => bytes[at] === byte)) return true
  }
  if (avifBytes(bytes)) return true
  // WEBP: "RIFF", four size bytes, then "WEBP".
  return bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP'
}

// AVIF and HEIC are ISO-BMFF boxes: a four-byte size, then "ftyp", then a brand.
const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'heic', 'heix', 'mif1'])
const avifBytes = (bytes) => bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp' && AVIF_BRANDS.has(bytes.toString('latin1', 8, 12))

// A NUL byte never appears in a text file that is worth showing, and always appears
// early in a binary one.
const binaryBytes = (bytes) => bytes.includes(0)

/** The absolute path a preview asks for, or null when it may not be read. */
export function safePath(root, input) {
  const text = String(input ?? '')
  // A NUL truncates the path for the syscall but not for these checks.
  if (text === '' || text.includes('\0')) return null
  // An absolute path, a Windows drive path, or a home-relative or `..` path.
  if (isAbsolute(text) || /^[a-zA-Z]:[\\/]/.test(text) || /^[~.]/.test(text.split(/[/\\]/)[0])) return null
  return inside(root, resolve(root, text))
}

// Whether an already absolute path is the root or something under it. Used on a
// path that was just resolved, and on the real path a link resolves to.
function inside(root, target) {
  if (target === root) return target
  return target.startsWith(`${root}${sep}`) ? target : null
}

const readSome = async (file, size) => {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.allocUnsafe(Math.min(size, TEXT_MAX, IMAGE_MAX))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

// The first bytes of a file, for the signature check. A small file gives back all of
// itself, so the content read later needs no second open.
const readHead = async (file, size) => readSome(file, Math.min(size, HEAD_MAX))

export function install(rt) {
  const { ctx, config, home, warn } = rt

  // The team's workspace root: the one its Sessions run in, else the configured
  // one. Without it there is nothing a path could be relative to.
  const workspacePath = () => {
    const id = rt.state.workspaceId
    const path = (id !== undefined ? ctx.workspaceRegistry?.get?.(id)?.path : undefined) ?? config.workspace
    return typeof path === 'string' && path !== '' ? path : null
  }

  // The root as it really is, so a link out of it is refused: a workspace under a
  // symlinked folder (macOS /var, Linux /tmp) has a real path elsewhere, and a file
  // inside it is inside the real one too.
  const realRoot = async (root) => {
    try { return await realpath(root) } catch { return root }
  }

  // Stat and resolve one regular file: a folder, a special file and a path that is not
  // there are all refused. The real path comes back so the caller can apply its own
  // policy before a single byte is read.
  const regularFile = async (target) => {
    let info
    try {
      info = await stat(target)
      if (info.isDirectory()) return { error: 'That is a folder.' }
      if (!info.isFile()) return { error: 'That is not a regular file.' }
    } catch {
      return { error: 'That file does not exist.' }
    }
    try {
      return { info, real: await realpath(target) }
    } catch {
      return { error: 'That file could not be read.' }
    }
  }

  // The bytes of a regular file whose path policy has already passed. Read once: the
  // head decides the kind, and a small file is already all of itself, so the content
  // needs no second open.
  const readRegular = async (real, name, info) => {
    const base = { ok: true, name, size: info.size, mtime: Math.round(info.mtimeMs) }
    const unreadable = { ok: false, error: 'That file could not be read.' }
    let head
    try {
      head = await readHead(real, info.size)
    } catch {
      return unreadable
    }
    const kind = fileKind(name, info.size, head)
    if (kind === 'binary') return { ...base, kind }
    try {
      if (kind === 'image') {
        const buffer = info.size <= head.length ? head : await readSome(real, info.size)
        return { ...base, kind, base64: buffer.toString('base64'), mime: MIME[suffixOf(name)] ?? 'application/octet-stream' }
      }
      const buffer = info.size <= head.length ? head : await readSome(real, info.size)
      const text = buffer.toString('utf8')
      // A cut-off text file says so, and the panel shows where it stopped.
      return info.size > TEXT_MAX ? { ...base, kind, text, truncated: true } : { ...base, kind, text }
    } catch {
      return unreadable
    }
  }

  /**
   * One file for the panel: `path` is relative to the workspace root.
   * @returns {Promise<{ok:true, kind:string, name:string, size:number, mtime:number, text?:string, base64?:string, mime?:string, truncated?:boolean} | {ok:false, error:string}>}
   */
  const panelFile = async (input) => {
    const root = await realRoot(workspacePath() ?? '')
    if (root === '') return { ok: false, error: 'This Bot team has no workspace.' }
    const target = safePath(root, input)
    if (target === null) return { ok: false, error: 'That path is outside the workspace.' }
    const found = await regularFile(target)
    if (found.error !== undefined) return { ok: false, error: found.error }
    // The real path, not the written one: a link inside the workspace that points out
    // of it is refused here, so the check cannot be walked around.
    if (inside(root, found.real) === null) return { ok: false, error: 'That path leaves the workspace.' }
    return readRegular(found.real, basename(target), found.info)
  }

  // A delivered file sits wherever the Bot put it, almost always outside the team
  // workspace, so the workspace rule cannot answer for it. What can: DSH's own `present`
  // tool named this exact path in a deliverables/presented event and the host kept it.
  // Only those paths are readable, so no directory is opened up and the read surface is
  // exactly "a file a Bot handed over". Anything the host never saw is refused before it
  // is even stat'ed.
  //
  // The list is kept across restarts, because the cards already in the chat are the
  // reason it exists: a restart must not turn every one of them into "not delivered".
  // It holds paths and times only -- never a byte of any file -- and every read still
  // goes through regularFile, so a path that has since gone falls back rather than
  // answering. It is capped: this is a window on recent work, not a record.
  const deliveredPath = join(home, 'delivered.json')
  const delivered = new Map()
  let saving = Promise.resolve()
  const keep = (path, at = Date.now()) => {
    delivered.delete(path)
    delivered.set(path, at)
    while (delivered.size > DELIVERED_MAX) delivered.delete(delivered.keys().next().value)
  }
  const saveDelivered = () => {
    saving = saving.then(async () => {
      const body = JSON.stringify({ version: 1, files: [...delivered].map(([path, at]) => ({ path, at })) })
      // Written beside the real file and renamed over it, so a reader never sees half a
      // JSON document, and created 0600: the paths a team delivered are its own business.
      const temporary = `${deliveredPath}.tmp`
      try {
        await mkdir(home, { recursive: true })
        await writeFile(temporary, body, { mode: 0o600 })
        await rename(temporary, deliveredPath)
      } catch (error) {
        warn('ds-bot: could not save the delivered-file list: %s', error)
      }
    }).catch(() => {})
    return saving
  }
  const rememberDelivered = (paths) => {
    if (!Array.isArray(paths)) return undefined
    let remembered = false
    for (const path of paths) {
      if (typeof path !== 'string' || path === '') continue
      keep(path)
      remembered = true
    }
    return remembered ? saveDelivered() : undefined
  }
  const loadDelivered = async () => {
    try {
      const parsed = JSON.parse(await readFile(deliveredPath, 'utf8'))
      if (!Array.isArray(parsed?.files)) return
      for (const entry of parsed.files) {
        if (typeof entry?.path !== 'string' || entry.path === '') continue
        // The saved time is kept when it is there: it is what a later expiry would use.
        keep(entry.path, Number.isFinite(entry.at) ? entry.at : Date.now())
      }
    } catch {
      // No list yet, or one this host cannot read: the window simply starts empty.
    }
  }
  const deliveredFile = async (input) => {
    const target = String(input ?? '')
    if (target.includes('\0') || !delivered.has(target)) return { ok: false, error: 'That file was not delivered to this team.' }
    const found = await regularFile(target)
    if (found.error !== undefined) return { ok: false, error: found.error }
    // What is read is what sits at the delivered path now -- through a link if one was
    // put there since. That path was writable by this same user and device all along, so
    // following it grants nothing the delivered path did not already allow.
    return readRegular(found.real, basename(target), found.info)
  }

  void loadDelivered()

  ctx.effect(() => () => {}, 'ds-bot: file previews')
  Object.assign(rt, { panelFile, rememberDelivered, deliveredFile, deliveredCount: () => delivered.size })
}
