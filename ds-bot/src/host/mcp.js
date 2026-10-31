// MCP servers: the DSH MCP client instances this profile runs, read and changed through
// the profile's own two services — `configEditor` for an entry's config and
// `pluginManager` for its switch. Both are shipped with DSH (`dsh-base` mounts them), so
// nothing here depends on internal modules.
//
// Adding and removing a row has no service: `configEditor.edit` only touches a running
// entry, and `pluginManager` installs bundles, not single rows. So this module writes its
// own rows into the profile's `cordis.patch.yml` — the file `configEditor` edits too —
// with one textual block per server, `id: mcp-<serverName>`, values JSON-quoted (JSON
// string escaping is a subset of YAML double-quoted scalars). Every write keeps the
// previous text and puts it back when the row does not show up a moment later.
//
// ponytail: our write is not under the profile's file lock (that is an internal), so a
// bundle install running at the same instant can win; the reload self-check notices and
// puts the file back. Serialising with the editor's lock would need its internals.
import { readFile, writeFile, rename } from 'node:fs/promises'
import { request as httpsRequest } from 'node:https'

const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client'
const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/
// A row written here is ours only when its id carries this prefix; anything else in the
// file belongs to the user or another plugin and is never rewritten or removed.
const ID_PREFIX = 'mcp-'
// A written row shows up once the loader has reloaded the profile. A large profile takes
// longer than a small one, so the row is given a few seconds before the write is undone.
const RECHECK_MS = 1500
const RECHECK_TRIES = 6
const SCHEMA_TEXT_MAX = 4000
// The ModelScope plaza answers one page of twenty rows; the panel asks for a page at a time.
const MARKET_PAGE_SIZE = 20
const MARKET_README_MAX = 4000
// The plaza has no categories endpoint, so the chips come from one scan of its first pages,
// kept for a while: the set changes slowly and the page should not re-scan on every open.
const MARKET_SCAN_PAGES = 2
const MARKET_CATEGORIES_TTL_MS = 10 * 60 * 1000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))


// YAML double-quoted scalars accept JSON string escapes as they are.
const quote = value => JSON.stringify(String(value))

// The profile patch is a list of verbs; a new row goes in through an `insert` list, the
// only verb that adds an entry. Values are JSON-quoted: a JSON string is a valid YAML
// double-quoted scalar. The row keeps the shape the loader shows in its patch docs.
const MCP_NAME_LINE = `      name: ${quote(MCP_CLIENT)}`

export function rowText(id, config) {
  const transport = config?.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  const serverName = String(config?.serverName ?? '')
  if (!SERVER_NAME.test(serverName)) throw new Error('A server name is 1–32 letters, digits, "_" or "-"')
  const lines = ['- insert:', `    - id: ${quote(id)}`, `      name: ${quote(MCP_CLIENT)}`, '      config:', `        transport: ${quote(transport)}`, `        serverName: ${quote(serverName)}`]
  if (transport === 'stdio') {
    const command = String(config?.command ?? '').trim()
    if (command === '') throw new Error('A stdio server needs a command')
    lines.push(`        command: ${quote(command)}`)
    const args = Array.isArray(config?.args) ? config.args.filter(argument => typeof argument === 'string' && argument !== '') : []
    if (args.length === 0) lines.push('        args: []')
    else lines.push('        args:', ...args.map(argument => `          - ${quote(argument)}`))
    const env = pairs(config?.env)
    if (env.length === 0) lines.push('        env: {}')
    else lines.push('        env:', ...env.map(([key, value]) => `          ${quote(key)}: ${quote(value)}`))
  } else {
    const url = String(config?.url ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('An http server needs an http(s) URL')
    lines.push(`        url: ${quote(url)}`)
    const headers = pairs(config?.headers)
    if (headers.length === 0) lines.push('        headers: {}')
    else lines.push('        headers:', ...headers.map(([key, value]) => `          ${quote(key)}: ${quote(value)}`))
  }
  return `${lines.join('\n')}\n`
}

// The block written by `rowText` for this id: the whole `- insert:` block that carries it,
// so taking a row away leaves no empty verb behind.
export function cutRow(text, id) {
  const lines = String(text ?? '').split('\n')
  const row = lines.findIndex(line => line.trimEnd() === `    - id: ${quote(id)}`)
  if (row < 0) return null
  if (!lines.slice(row + 1, row + 3).includes(MCP_NAME_LINE)) return null
  let start = row
  while (start > 0 && !lines[start].startsWith('- ')) start -= 1
  if (!lines[start].startsWith('- ')) return null
  let end = row + 1
  while (end < lines.length && !lines[end].startsWith('- ')) end += 1
  const block = lines.slice(start, end).filter(line => line !== '')
  return { lines, start, end, block }
}

// `env`/`headers` arrive from a form as `{ key: value }`; blank keys are dropped.
function pairs(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .filter(([key, item]) => typeof key === 'string' && key.trim() !== '' && typeof item === 'string')
    .map(([key, item]) => [key.trim(), item])
}

// Rows this page wrote into the patch document that the running profile has not loaded
// yet: a row is only started when DSH next starts, and the panel shows it as waiting.
export function pendingRows(text) {
  const lines = String(text ?? '').split('\n')
  const rows = []
  for (let index = 0; index < lines.length; index += 1) {
    const head = /^    - id: "([^"]+)"$/.exec(lines[index])
    if (head === null || !head[1].startsWith(ID_PREFIX)) continue
    const block = []
    let cursor = index + 1
    while (cursor < lines.length && !lines[cursor].startsWith('- ') && !/^    - /.test(lines[cursor])) {
      block.push(lines[cursor])
      cursor += 1
    }
    if (!block.includes(`      name: ${quote(MCP_CLIENT)}`)) continue
    const read = (key) => {
      const line = block.find(item => item.trimStart().startsWith(`${key}: `))
      if (line === undefined) return undefined
      const raw = line.trimStart().slice(key.length + 2)
      try { return JSON.parse(raw) } catch { return undefined }
    }
    const serverName = read('serverName')
    if (typeof serverName !== 'string' || serverName === '') continue
    rows.push({
      serverName,
      transport: read('transport') === 'streamable-http' ? 'streamable-http' : 'stdio',
      entryId: '',
      enabled: false,
      pending: true,
      readOnly: null,
      toolCount: 0,
      command: read('command') ?? null,
      args: [],
      env: [],
      url: read('url') ?? null,
      headers: [],
    })
  }
  return rows
}

// The plaza answers JSON over https. `fetch` is not used here: inside the running app it
// left the request hanging past any reasonable timeout, while a plain https request from
// the same runtime answers in a few hundred milliseconds.
const MARKET_TIMEOUT_MS = 12000
const categoryCache = { at: 0, value: [] }
function httpsJson(url, { method = 'GET', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const payload = body === null ? null : Buffer.from(JSON.stringify(body), 'utf8')
    const headers = { accept: 'application/json', 'user-agent': 'ds-bot' }
    if (payload !== null) {
      headers['content-type'] = 'application/json'
      headers['content-length'] = String(payload.length)
    }
    const request = httpsRequest({ method, hostname: target.hostname, path: `${target.pathname}${target.search}`, headers, timeout: MARKET_TIMEOUT_MS }, (response) => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (response.statusCode !== undefined && response.statusCode >= 400) {
          reject(Object.assign(new Error(`ModelScope answered ${response.statusCode}`), { code: 'bot/upstream' }))
          return
        }
        try {
          resolve(JSON.parse(text))
        } catch {
          reject(Object.assign(new Error('ModelScope answered with something other than JSON'), { code: 'bot/upstream' }))
        }
      })
    })
    request.on('timeout', () => request.destroy(Object.assign(new Error('ModelScope did not answer in time'), { code: 'bot/upstream' })))
    request.on('error', (error) => reject(Object.assign(error, { code: error.code === 'ENOTFOUND' ? 'bot/upstream' : error.code ?? 'bot/upstream' })))
    if (payload !== null) request.write(payload)
    request.end()
  })
}

export function install(rt) {
  const { ctx } = rt
  const editor = () => ctx.get?.('configEditor')
  const manager = () => ctx.get?.('pluginManager')

  const fail = (message, code = 'bot/invalid') => Object.assign(new Error(message), { code })

  // Tool names carry the server's namespace, `mcp__<server>__<tool>`, so a count is a
  // prefix match. A name that had to be rewritten keeps the same prefix (only the tail
  // gets a hash), so nothing is lost there either.
  const toolNames = () => {
    try {
      return ctx.tools.schemas().map(schema => String(schema.name ?? '')).filter(name => name.startsWith('mcp__'))
    } catch {
      return []
    }
  }

  const countOf = (names, serverName) => (serverName === '' ? 0 : names.filter(name => name.startsWith(`mcp__${serverName}__`)).length)

  // One row per MCP client entry. A disabled entry is still a loader entry, so its config
  // is readable; only `edit` needs it running.
  async function servers() {
    const ed = editor()
    const mgr = manager()
    if (ed === undefined || mgr === undefined) return { servers: [], available: false }
    let rows = []
    try { rows = await mgr.listPlugins() } catch { rows = [] }
    const byEntry = new Map(rows.filter(row => row?.moduleName === MCP_CLIENT).map(row => [row.entryId, row]))
    const names = toolNames()
    const list = []
    for (const entry of ed.entries()) {
      if (entry.options.name !== MCP_CLIENT) continue
      const config = entry.options.config ?? {}
      const row = byEntry.get(entry.options.id)
      const serverName = String(config.serverName ?? '')
      const transport = config.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
      list.push({
        serverName,
        transport,
        entryId: entry.options.id,
        enabled: row?.enabled !== false && entry.disabled !== true,
        readOnly: row?.readOnlyReason ?? null,
        toolCount: countOf(names, serverName),
        command: transport === 'stdio' ? String(config.command ?? '') : null,
        args: transport === 'stdio' && Array.isArray(config.args) ? config.args.filter(item => typeof item === 'string') : [],
        env: transport === 'stdio' ? pairs(config.env) : [],
        url: transport === 'streamable-http' ? String(config.url ?? '') : null,
        headers: transport === 'streamable-http' ? pairs(config.headers) : [],
      })
    }
    // A row written but not loaded yet is still in the document: the page lists it so a
    // fresh install shows up at once, marked as waiting for the next start.
    const text = await readFile(patchPathSafe(), 'utf8').catch(() => '')
    const known = new Set(list.map(server => server.serverName))
    for (const row of pendingRows(text)) if (!known.has(row.serverName)) list.push(row)
    list.sort((left, right) => left.serverName.localeCompare(right.serverName))
    return { servers: list, available: true }
  }

  const patchPathSafe = () => {
    try { return patchPath() } catch { return '' }
  }
  const patchPath = () => {
    const path = editor()?.documentPath
    if (typeof path !== 'string' || path === '') throw fail('This DSH does not expose its profile configuration')
    return path
  }

  async function readPatch() {
    const path = patchPath()
    try {
      return { path, text: await readFile(path, 'utf8') }
    } catch (error) {
      if (error?.code === 'ENOENT') return { path, text: '[]\n' }
      throw error
    }
  }

  // Write, then look again after the Loader had its moment; put the old text back when
  // the change did not land.
  async function writePatch(path, text, check) {
    const before = await readFile(path, 'utf8').catch(() => '[]\n')
    // The file is written in place, not swapped in: the profile's loader watches the
    // document it opened, and an atomic rename replaces that file, so the loaded profile
    // never sees the new row. The previous text is kept in memory for the restore below.
    // The patch holds provider keys and `!!js` expressions, so it stays owner-readable.
    await writeFile(path, text, { encoding: 'utf8', mode: 0o600 })
    for (let attempt = 0; attempt < RECHECK_TRIES; attempt += 1) {
      try {
        await sleep(RECHECK_MS)
        if (await check()) return
      } catch { /* checked below */ }
    }
    const back = `${path}.ds-bot-restore-${process.pid}.tmp`
    await writeFile(back, before, { encoding: 'utf8', mode: 0o600 })
    await rename(back, path).catch(() => {})
    throw fail('The profile did not pick the change up, so it was put back')
  }

  const endpoint = {
    // A running entry's config goes through the editor: it validates, writes and reloads,
    // and it refuses a disabled entry, so the panel enables one first.
    async 'mcp-save'(body) {
      const ed = editor()
      if (ed === undefined) throw fail('This DSH has no configuration editor')
      const id = String(body.entryId ?? '')
      const entry = ed.entries().find(item => item.options.id === id)
      if (entry === undefined) throw fail('That server is no longer in the profile', 'bot/stale')
      if (entry.fiber === undefined) throw fail('Enable this server before changing it')
      const serverName = String(body.config?.serverName ?? '')
      if (!SERVER_NAME.test(serverName)) throw fail('A server name is 1–32 letters, digits, "_" or "-"')
      const taken = ed.entries().some(item => item.options.id !== id && String(item.options.config?.serverName ?? '') === serverName)
      if (taken) throw fail(`Another server is already called ${serverName}`)
      // Keys the form does not show (timeouts, reconnect) stay as they were; the other
      // transport's keys go, because the schema refuses both at once.
      const kept = { ...entry.options.config, transport: undefined, serverName: undefined }
      const next = body.config?.transport === 'streamable-http'
        ? { ...kept, transport: 'streamable-http', serverName, url: String(body.config?.url ?? '').trim(), headers: Object.fromEntries(pairs(body.config?.headers)), command: undefined, args: undefined, env: undefined }
        : { ...kept, transport: 'stdio', serverName, command: String(body.config?.command ?? '').trim(), args: (body.config?.args ?? []).filter(item => typeof item === 'string' && item !== ''), env: Object.fromEntries(pairs(body.config?.env)), url: undefined, headers: undefined }
      for (const key of ['transport', 'serverName', 'url', 'headers', 'command', 'args', 'env']) if (next[key] === undefined) delete next[key]
      if (next.transport === 'stdio' && next.command === '') throw fail('A stdio server needs a command')
      if (next.transport === 'streamable-http' && !/^https?:\/\/\S+$/i.test(next.url)) throw fail('An http server needs an http(s) URL')
      await ed.edit(entry, () => next)
      return servers()
    },
    async 'mcp-toggle'(body) {
      const mgr = manager()
      if (mgr === undefined) throw fail('This DSH has no plugin manager')
      const id = String(body.entryId ?? '')
      const row = (await mgr.listPlugins()).find(item => item.entryId === id)
      if (row === undefined) throw fail('That server is no longer in the profile', 'bot/stale')
      if (row.readOnlyReason !== undefined) throw fail('This row is not addressable from here')
      await mgr.setPluginEnabled(id, body.enabled !== false)
      return servers()
    },
    async 'mcp-add'(body) {
      const serverName = String(body.config?.serverName ?? '')
      const id = `${ID_PREFIX}${serverName}`
      if (!SERVER_NAME.test(serverName)) throw fail('A server name is 1–32 letters, digits, "_" or "-"')
      const { path, text } = await readPatch()
      if (cutRow(text, id) !== null) throw fail(`A server called ${serverName} is already in the profile`)
      const row = rowText(id, body.config)
      // An empty patch document is `[]`; rows cannot follow that, so they replace it.
      const base = text.trimEnd()
      const next = base === '' || base === '[]' ? row : `${base}\n${row}`
      // A row added here is read when DSH next starts, so the write is checked against the
      // document itself; `pending` tells the page the server is not running yet.
      // Known gap, not a race this write closes: `next` was read before it, so an entry
      // that lands in this window is put back over and silently dropped — the self-check
      // passes because our own row does appear. Two adds at once can lose one.
      await writePatch(path, next, async () => (await readFile(path, 'utf8')).includes(`- id: ${quote(id)}`))
      return { ...(await servers()), pending: serverName }
    },
    async 'mcp-remove'(body) {
      const serverName = String(body.serverName ?? '')
      if (!SERVER_NAME.test(serverName)) throw fail('Unknown server')
      const id = `${ID_PREFIX}${serverName}`
      const { path, text } = await readPatch()
      const cut = cutRow(text, id)
      if (cut === null) {
        // A row the user wrote by hand has no `mcp-` id; removing it would mean editing
        // their own text, which this page does not do.
        throw fail('That server is not in the profile', 'bot/stale')
      }
      const lines = [...cut.lines.slice(0, cut.start), ...cut.lines.slice(cut.end)]
      await writePatch(path, lines.join('\n'), async () => !(await readFile(path, 'utf8')).includes(`- id: ${quote(id)}`))
      return servers()
    },
    async 'mcp-market'(body) {
      const base = 'https://modelscope.cn/openapi/v1/mcp/servers'
      if (body.kind === 'detail') {
        const id = String(body.id ?? '')
        if (!/^@?[\w.-]+\/[\w.-]+$/.test(id)) throw fail('Unknown MCP server id')
        const data = (await httpsJson(`${base}/${id.split('/').map(encodeURIComponent).join('/')}`))?.data ?? {}
        const readme = String(data.readme ?? '')
        const hosted = (Array.isArray(data.operational_urls) ? data.operational_urls : [])
          .map(entry => ({ type: String(entry?.url ?? '').split('/').pop() ?? '', url: String(entry?.url ?? '') }))
          .filter(entry => /^https?:\/\//.test(entry.url))
        const groups = data.server_config?.[0]?.mcpServers
        const first = groups !== null && typeof groups === 'object' ? Object.entries(groups)[0] : null
        const stdio = first === null || first === undefined ? null : {
          name: String(first[0]),
          command: String(first[1]?.command ?? ''),
          args: Array.isArray(first[1]?.args) ? first[1].args.map(String) : [],
          env: Object.keys(first[1]?.env ?? {}).map(String),
        }
        return {
          id: String(data.id ?? id),
          name: String(data.name || data.chinese_name || id),
          description: String(data.description ?? ''),
          readme: readme.length > MARKET_README_MAX ? `${readme.slice(0, MARKET_README_MAX)}\n…` : readme,
          urls: hosted,
          stdio,
        }
      }
      if (body.kind === 'categories') {
        const now = Date.now()
        if (categoryCache.at !== 0 && now - categoryCache.at < MARKET_CATEGORIES_TTL_MS) return categoryCache.value
        const counts = new Map()
        for (let scan = 1; scan <= MARKET_SCAN_PAGES; scan += 1) {
          const page = (await httpsJson(base, { method: 'PUT', body: { page_number: scan, page_size: 100, search: '' } }))?.data ?? {}
          for (const row of Array.isArray(page.mcp_server_list) ? page.mcp_server_list : []) {
            for (const raw of Array.isArray(row.categories) ? row.categories : []) {
              const id = String(raw).toLowerCase()
              counts.set(id, (counts.get(id) ?? 0) + 1)
            }
          }
        }
        const value = [...counts.entries()].map(([id, count]) => ({ id, count })).sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
        // An empty scan is an upstream hiccup, not a market with no categories: caching it
        // would hide the labels for ten minutes, so only a real set is kept.
        if (value.length > 0) {
          categoryCache.at = now
          categoryCache.value = value
        }
        return value
      }
      const page = Math.max(1, Math.min(10, Number(body.page ?? 1) || 1))
      // The chip the person picked narrows the search on the plaza's own side, so the list
      // it pages through holds only that category and the count above it agrees.
      const category = /^[\w-]{1,64}$/.test(String(body.category ?? '')) ? String(body.category).toLowerCase() : ''
      const data = (await httpsJson(base, {
        method: 'PUT',
        body: {
          page_number: page,
          page_size: MARKET_PAGE_SIZE,
          search: String(body.query ?? ''),
          ...(category === '' ? {} : { filter: { category } }),
        },
      }))?.data ?? {}
      const rows = Array.isArray(data.mcp_server_list) ? data.mcp_server_list : []
      return {
        total: Number(data.total_count ?? rows.length),
        servers: rows.map(row => ({
          id: String(row.id ?? ''),
          name: String(row.name || row.chinese_name || row.id || ''),
          publisher: String(row.publisher ?? ''),
          description: String(row.description ?? ''),
          logo: String(row.logo_url ?? ''),
          hosted: row.is_hosted === true,
          installs: Number(row.view_count ?? 0),
          categories: (Array.isArray(row.categories) ? row.categories : []).map(item => String(item).toLowerCase()),
        })).filter(row => row.id !== ''),
      }
    },
    // A schema has no size limit, a chat message does; the panel shows a summary, so the
    // text is cut here rather than shipped whole.
    async 'mcp-tools'(body) {
      const serverName = String(body.serverName ?? '')
      if (!SERVER_NAME.test(serverName)) throw fail('Unknown server')
      const prefix = `mcp__${serverName}__`
      let schemas = []
      try { schemas = ctx.tools.schemas() } catch { schemas = [] }
      const tools = schemas
        .filter(schema => String(schema.name ?? '').startsWith(prefix))
        .map((schema) => {
          const text = JSON.stringify(schema.parameters ?? {}, null, 2) ?? ''
          return {
            name: String(schema.name).slice(prefix.length),
            fullName: String(schema.name),
            description: String(schema.description ?? '').slice(0, 400),
            schema: text.length > SCHEMA_TEXT_MAX ? `${text.slice(0, SCHEMA_TEXT_MAX)}\n…` : text,
            truncated: text.length > SCHEMA_TEXT_MAX,
          }
        })
        .sort((left, right) => left.name.localeCompare(right.name))
      return { serverName, tools }
    },
  }

  Object.assign(rt, { mcpView: servers, mcpEndpoint: (name, body) => endpoint[name](body ?? {}) })
}

// The tool schema a summary needs: required names and each property's type.
export function schemaSummary(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { return { required: [], fields: [] } }
  const required = Array.isArray(parsed?.required) ? parsed.required.map(String) : []
  const properties = parsed?.properties !== null && typeof parsed?.properties === 'object' ? parsed.properties : {}
  const fields = Object.entries(properties).map(([key, value]) => ({
    name: key,
    type: typeof value?.type === 'string' ? value.type : Array.isArray(value?.type) ? value.type.join(' | ') : 'any',
    required: required.includes(key),
    description: typeof value?.description === 'string' ? value.description.slice(0, 200) : '',
  }))
  return { required, fields }
}
