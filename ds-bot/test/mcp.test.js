import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { cutRow, install, rowText, schemaSummary } from '../src/host/mcp.js'
import { fakeContext } from './fake-ctx.js'

const CLIENT = '@deepseek-ai/dsh-mcp-client'

const stdio = { transport: 'stdio', serverName: 'files', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], env: { ROOT: '/tmp/a b' } }
const http = { transport: 'streamable-http', serverName: 'remote', url: 'https://mcp.test/sse', headers: { Authorization: 'Bearer x' } }

test('a stdio row is an insert verb in the profile patch shape, values quoted', () => {
  assert.equal(rowText('mcp-files', stdio), [
    '- insert:',
    '    - id: "mcp-files"',
    '      name: "@deepseek-ai/dsh-mcp-client"',
    '      config:',
    '        transport: "stdio"',
    '        serverName: "files"',
    '        command: "npx"',
    '        args:',
    '          - "-y"',
    '          - "@modelcontextprotocol/server-filesystem"',
    '        env:',
    '          "ROOT": "/tmp/a b"',
    '',
  ].join('\n'))
})

test('an http row carries url and headers only, and a bad shape is refused', () => {
  const text = rowText('mcp-remote', http)
  assert.match(text, /transport: "streamable-http"/)
  assert.match(text, /url: "https:\/\/mcp\.test\/sse"/)
  assert.match(text, /"Authorization": "Bearer x"/)
  assert.doesNotMatch(text, /command/)
  assert.throws(() => rowText('mcp-x', { ...stdio, serverName: 'has space' }), /server name/)
  assert.throws(() => rowText('mcp-x', { ...stdio, command: '  ' }), /needs a command/)
  assert.throws(() => rowText('mcp-x', { ...http, url: 'ftp://x' }), /http\(s\) URL/)
})

test('cutRow takes the whole insert verb and leaves nothing behind', () => {
  const text = `- id: "other"\n  name: "x"\n${rowText('mcp-files', stdio)}- id: "tail"\n  name: "y"\n`
  const cut = cutRow(text, 'mcp-files')
  assert.ok(cut !== null)
  assert.equal(cut.block[0], '- insert:')
  assert.equal(cut.block[1], '    - id: "mcp-files"')
  assert.equal(cut.block.at(-1), '          "ROOT": "/tmp/a b"')
  const left = [...cut.lines.slice(0, cut.start), ...cut.lines.slice(cut.end)].join('\n')
  assert.doesNotMatch(left, /mcp-files/)
  assert.match(left, /id: "other"/)
  assert.match(left, /id: "tail"/)
  // A block with our id but someone else's plugin is left alone.
  const foreign = '- insert:\n    - id: "mcp-files"\n      name: "another-plugin"\n'
  assert.equal(cutRow(foreign, 'mcp-files'), null)
  assert.equal(cutRow(text, 'mcp-missing'), null)
})

test('schemaSummary reads required names and field types', () => {
  const summary = schemaSummary(JSON.stringify({ type: 'object', required: ['path'], properties: { path: { type: 'string', description: 'File to read' }, depth: { type: ['number', 'null'] } } }))
  assert.deepEqual(summary.fields.map(field => [field.name, field.type, field.required]), [['path', 'string', true], ['depth', 'number | null', false]])
  assert.deepEqual(schemaSummary('not json').fields, [])
})

// The panel's endpoints, against the two DSH services and one profile file.
function setup({ entries = [], rows = [], edit, setEnabled } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsb-mcp-'))
  const file = join(dir, 'cordis.patch.yml')
  const state = { entries, rows, edits: [], toggles: [], tools: [] }
  const editor = {
    documentPath: file,
    // The real editor lists what the Loader runs, so a written row shows up after the
    // Loader reloads; here the fake reads the file it was written to.
    entries: () => (typeof state.entries === 'function' ? state.entries() : state.entries),
    edit: async (entry, change) => { state.edits.push({ id: entry.options.id, config: change(entry.options.config ?? {}, {}) }); return edit?.(entry, change) },
  }
  const manager = {
    listPlugins: async () => (typeof state.rows === 'function' ? state.rows() : state.rows),
    setPluginEnabled: async (id, enabled) => { state.toggles.push({ id, enabled }); return setEnabled?.(id, enabled) },
  }
  const ctx = fakeContext({ services: { configEditor: editor, pluginManager: manager } })
  ctx.tools.schemas = () => state.tools
  const rt = { ctx }
  install(rt)
  return { rt, state, file, dir, done: () => rmSync(dir, { recursive: true, force: true }) }
}

const row = (id, config, { enabled = true, readOnly, disabled = false } = {}) => ({ options: { id, name: CLIENT, config }, ...(disabled ? {} : { fiber: { state: 2 } }), ...(readOnly ? {} : {}) , enabled })

test('mcp-list reads the running rows and counts each server of its own namespace', async () => {
  const env = setup({
    entries: [row('mcp-files', { ...stdio }).options ? { options: { id: 'mcp-files', name: CLIENT, config: stdio }, fiber: { state: 2 } } : null],
    rows: [{ entryId: 'mcp-files', moduleName: CLIENT, enabled: true }],
  })
  try {
    env.state.tools = ['mcp__files__read_file', 'mcp__files__write_file', 'mcp__other__x', 'read_file'].map(name => ({ name }))
    const view = await env.rt.mcpView()
    assert.equal(view.available, true)
    assert.deepEqual(view.servers.map(server => [server.serverName, server.transport, server.enabled, server.toolCount]), [['files', 'stdio', true, 2]])
  } finally { env.done() }
})

test('mcp-tools lists one server and cuts a schema that is too long', async () => {
  const env = setup()
  try {
    env.state.tools = [
      { name: 'mcp__files__read_file', description: 'Read', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
      { name: 'mcp__files__huge', description: 'Huge', parameters: { type: 'object', properties: { blob: { type: 'string', description: 'x'.repeat(6000) } } } },
      { name: 'read_file', description: 'native', parameters: {} },
    ]
    const answer = await env.rt.mcpEndpoint('mcp-tools', { serverName: 'files' })
    assert.deepEqual(answer.tools.map(tool => tool.name), ['huge', 'read_file'])
    assert.equal(answer.tools[1].fullName, 'mcp__files__read_file')
    assert.equal(answer.tools[0].truncated, true)
    assert.ok(answer.tools[0].schema.endsWith('…'))
    await assert.rejects(env.rt.mcpEndpoint('mcp-tools', { serverName: 'no such' }), /Unknown server/)
  } finally { env.done() }
})

test('mcp-save refuses a disabled row before the editor sees it', async () => {
  const env = setup({ entries: [{ options: { id: 'mcp-files', name: CLIENT, config: stdio } }] })
  try {
    await assert.rejects(env.rt.mcpEndpoint('mcp-save', { entryId: 'mcp-files', config: stdio }), /Enable this server/)
    assert.equal(env.state.edits.length, 0)
  } finally { env.done() }
})

test('mcp-save writes the row and keeps the keys the form does not show', async () => {
  const env = setup({
    entries: [{ options: { id: 'mcp-files', name: CLIENT, config: { ...stdio, toolCallTimeoutMs: 60000 } }, fiber: { state: 2 } }],
    rows: [{ entryId: 'mcp-files', moduleName: CLIENT, enabled: true }],
  })
  try {
    await env.rt.mcpEndpoint('mcp-save', { entryId: 'mcp-files', config: { ...http, serverName: 'files' } })
    const [edit] = env.state.edits
    assert.equal(edit.config.transport, 'streamable-http')
    assert.equal(edit.config.url, 'https://mcp.test/sse')
    assert.equal(edit.config.toolCallTimeoutMs, 60000)
    assert.equal(edit.config.command, undefined)
    await assert.rejects(env.rt.mcpEndpoint('mcp-save', { entryId: 'gone', config: stdio }), /no longer in the profile/)
  } finally { env.done() }
})

test('mcp-toggle goes through the plugin manager and refuses an unaddressable row', async () => {
  const env = setup({ rows: [{ entryId: 'mcp-files', moduleName: CLIENT, enabled: true, patchId: 'mcp-files' }] })
  try {
    await env.rt.mcpEndpoint('mcp-toggle', { entryId: 'mcp-files', enabled: false })
    assert.deepEqual(env.state.toggles, [{ id: 'mcp-files', enabled: false }])
    env.state.rows = [{ entryId: 'mcp-files', moduleName: CLIENT, enabled: true, readOnlyReason: 'unaddressable' }]
    await assert.rejects(env.rt.mcpEndpoint('mcp-toggle', { entryId: 'mcp-files', enabled: false }), /not addressable/)
  } finally { env.done() }
})

test('mcp-add writes one block, and mcp-remove takes only that block away', async () => {
  const env = setup()
  try {
    // Nothing is running yet: the row appears once the file carries it, as the Loader
    // would after its reload.
    const text = () => { try { return readFileSync(env.file, 'utf8') } catch { return '' } }
    env.state.entries = () => (text().includes('- id: "mcp-files"')
      ? [{ options: { id: 'mcp-files', name: CLIENT, config: stdio }, fiber: { state: 2 } }]
      : [])
    const added = await env.rt.mcpEndpoint('mcp-add', { config: stdio })
    assert.deepEqual(added.servers.map(server => server.serverName), ['files'])
    const written = readFileSync(env.file, 'utf8')
    assert.match(written, /- id: "mcp-files"/)
    assert.match(written, /name: "@deepseek-ai\/dsh-mcp-client"/)
    await assert.rejects(env.rt.mcpEndpoint('mcp-add', { config: stdio }), /already in the profile/)

    await env.rt.mcpEndpoint('mcp-remove', { serverName: 'files' })
    assert.doesNotMatch(readFileSync(env.file, 'utf8'), /mcp-files/)
    await assert.rejects(env.rt.mcpEndpoint('mcp-remove', { serverName: 'files' }), /not in the profile/)
  } finally { env.done() }
})

test('mcp-add replaces an empty patch document instead of appending to it', async () => {
  const env = setup()
  try {
    writeFileSync(env.file, '[]\n', 'utf8')
    env.state.entries = () => (readFileSync(env.file, 'utf8').includes('- id: "mcp-files"')
      ? [{ options: { id: 'mcp-files', name: CLIENT, config: stdio }, fiber: { state: 2 } }]
      : [])
    await env.rt.mcpEndpoint('mcp-add', { config: stdio })
    const written = readFileSync(env.file, 'utf8')
    assert.doesNotMatch(written, /\[\]/, written)
    assert.match(written, /^- insert:\n    - id: "mcp-files"/)
  } finally { env.done() }
})

test('mcp-remove leaves a row this page did not write', async () => {
  const env = setup()
  try {
    writeFileSync(env.file, `- id: "mcp-files"\n  name: "another-plugin"\n`, 'utf8')
    await assert.rejects(env.rt.mcpEndpoint('mcp-remove', { serverName: 'files' }), /not in the profile/)
    assert.match(readFileSync(env.file, 'utf8'), /another-plugin/)
  } finally { env.done() }
})
