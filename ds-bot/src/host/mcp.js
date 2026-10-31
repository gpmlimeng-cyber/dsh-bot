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
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { replaceFile } from './files.js'

const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client'
const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/
// A row written here is ours only when its id carries this prefix; anything else in the
// file belongs to the user or another plugin and is never rewritten or removed.
const ID_PREFIX = 'mcp-'
const RECHECK_MS = 1200
const SCHEMA_TEXT_MAX = 4000
// The ModelScope plaza answers one page of twenty rows; the panel asks for a page at a time.
const MARKET_PAGE_SIZE = 20
const MARKET_README_MAX = 4000
const MARKET_TIMEOUT_MS = 15000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// YAML double-quoted scalars accept JSON string escapes as they are.
const quote = value => JSON.stringify(String(value))

// The eight config keys an MCP client row can carry, written in the schema's own order.
// Values come from the panel's form, so a mis-shaped one is refused here rather than
// written into the profile.
export function rowText(id, config) {
  const transport = config?.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  const serverName = String(config?.serverName ?? '')
  if (!SERVER_NAME.test(serverName)) throw new Error('A server name is 1–32 letters, digits, "_" or "-"')
  const lines = [`- id: ${quote(id)}`, `  name: ${quote(MCP_CLIENT)}`, '  config:', `    transport: ${quote(transport)}`, `    serverName: ${quote(serverName)}`]
  if (transport === 'stdio') {
    const command = String(config?.command ?? '').trim()
    if (command === '') throw new Error('A stdio server needs a command')
    lines.push(`    command: ${quote(command)}`)
    const args = Array.isArray(config?.args) ? config.args.filter(argument => typeof argument === 'string' && argument !== '') : []
    if (args.length === 0) lines.push('    args: []')
    else lines.push('    args:', ...args.map(argument => `      - ${quote(argument)}`))
    const env = pairs(config?.env)
    if (env.length === 0) lines.push('    env: {}')
    else lines.push('    env:', ...env.map(([key, value]) => `      ${quote(key)}: ${quote(value)}`))
  } else {
    const url = String(config?.url ?? '').trim()
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('An http server needs an http(s) URL')
    lines.push(`    url: ${quote(url)}`)
    const headers = pairs(config?.headers)
    if (headers.length === 0) lines.push('    headers: {}')
    else lines.push('    headers:', ...headers.map(([key, value]) => `      ${quote(key)}: ${quote(value)}`))
  }
  return `${lines.join('\n')}\n`
}

// `env`/`headers` arrive from a form as `{ key: value }`; blank keys are dropped.
function pairs(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .filter(([key, item]) => typeof key === 'string' && key.trim() !== '' && typeof item === 'string')
    .map(([key, item]) => [key.trim(), item])
}

// The block written by `rowText`: from its `- id:` line to the next row at column zero.
export function cutRow(text, id) {
  const lines = String(text ?? '').split('\n')
  const start = lines.findIndex(line => line.trimEnd() === `- id: ${quote(id)}`)
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length && !lines[end].startsWith('- ')) end += 1
  const block = lines.slice(start, end)
  if (!block.some(line => line.trimEnd() === `  name: ${quote(MCP_CLIENT)}`)) return null
  return { start, end, block, lines }
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
    list.sort((left, right) => left.serverName.localeCompare(right.serverName))
    return { servers: list, available: true }
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
    const temp = `${path}.ds-bot-${process.pid}.tmp`
    // The profile patch is the user's own file and holds provider keys and `!!js`
    // expressions; it stays readable by its owner only, so the replacement does too.
    await writeFile(temp, text, { encoding: 'utf8', mode: 0o600 })
    try {
      await replaceFile(temp, path)
    } catch (error) {
      await unlink(temp).catch(() => {})
      throw error
    }
    try {
      await sleep(RECHECK_MS)
      if (await check()) return
    } catch { /* checked below */ }
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
      if (editor()?.entries().some(entry => entry.options.id === id)) throw fail(`A row with the id ${id} is already there`)
      const block = rowText(id, body.config)
      // An empty patch document is `[]`; rows cannot follow that, so they replace it.
      const base = text.trimEnd()
      const next = base === '' || base === '[]' ? block : `${base}\n${block}`
      await writePatch(path, next, async () => (await servers()).servers.some(item => item.serverName === serverName))
      return servers()
    },
    async 'mcp-remove'(body) {
      const serverName = String(body.serverName ?? '')
      const id = `${ID_PREFIX}${serverName}`
      const { path, text } = await readPatch()
      const cut = cutRow(text, id)
      if (cut === null) {
        // A row the user wrote by hand has no `mcp-` id; removing it would mean editing
        // their own text, which this panel does not do.
        const ed = editor()
        if (ed?.entries().some(entry => entry.options.id === id)) throw fail('That row was not added from here, so it stays')
        throw fail('That server is not in the profile', 'bot/stale')
      }
      const lines = [...cut.lines.slice(0, cut.start), ...cut.lines.slice(cut.end)]
      await writePatch(path, lines.join('\n'), async () => !(await servers()).servers.some(item => item.serverName === serverName))
      return servers()
    },
    // The ModelScope MCP plaza, read through its own open API. Search lists the catalogue
    // (PUT on the collection, the only verb it answers), and one server's detail carries
    // what a client needs to connect: either a hosted endpoint under the user's account
    // or a stdio launch line to run locally.
    async 'mcp-market'(body) {
      const base = 'https://modelscope.cn/openapi/v1/mcp/servers'
      const timeout = AbortSignal.timeout(MARKET_TIMEOUT_MS)
      if (body.kind === 'detail') {
        const id = String(body.id ?? '')
        if (!/^@?[\w.-]+\/[\w.-]+$/.test(id)) throw fail('Unknown MCP server id')
        const answer = await fetch(`${base}/${id.split('/').map(encodeURIComponent).join('/')}`, { headers: { accept: 'application/json' }, signal: timeout })
        if (!answer.ok) throw fail(`ModelScope answered ${answer.status}`, 'bot/upstream')
        const data = (await answer.json())?.data ?? {}
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
      const page = Math.max(1, Math.min(10, Number(body.page ?? 1) || 1))
      const answer = await fetch(base, {
        method: 'PUT',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ page_number: page, page_size: MARKET_PAGE_SIZE, search: String(body.query ?? '') }),
        signal: timeout,
      })
      if (!answer.ok) throw fail(`ModelScope answered ${answer.status}`, 'bot/upstream')
      const data = (await answer.json())?.data ?? {}
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
