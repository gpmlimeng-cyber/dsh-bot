// The MCP page: the MCP servers this profile runs, one row each, and one server's tools.
// It follows the Skills page's shape — a title row with the page's own action, then
// plain rows on a light surface — instead of the catalogue's cards, because these are
// settings, not things to browse.
//
// What a row can honestly say: the tools a server registered right now. A server with no
// tools may be down or may simply offer none, and DSH keeps no last-seen time, so the
// page never claims a connection is healthy.
import { createElement as h, useEffect, useRef, useState } from 'react'
import { t } from './i18n.js'
import { CloseIcon, PlugIcon, PlusIcon, SearchIcon, SwitchIcon, TrashIcon } from './icons.js'

const BLANK = { transport: 'stdio', serverName: '', command: '', args: '', env: '', url: '', headers: '' }

// The form keeps args and env as text: one argument per line, one `KEY=value` per line.
// That is what people paste, and it needs no sub-form.
const linesOf = text => String(text ?? '').split('\n').map(line => line.trim()).filter(line => line !== '')
const pairsOf = text => Object.fromEntries(linesOf(text).map((line) => {
  const at = line.indexOf('=')
  return at < 0 ? [line, ''] : [line.slice(0, at).trim(), line.slice(at + 1).trim()]
}))
const textOfPairs = pairs => Object.entries(pairs ?? {}).map(([key, value]) => `${key}=${value}`).join('\n')

const formOf = (server) => {
  if (server === null || server === undefined) return { ...BLANK }
  const http = server.transport === 'streamable-http'
  return {
    transport: http ? 'streamable-http' : 'stdio',
    serverName: server.serverName ?? '',
    command: server.command ?? '',
    args: (server.args ?? []).join('\n'),
    env: textOfPairs(server.env),
    url: server.url ?? '',
    headers: textOfPairs(server.headers),
  }
}

const configOf = form => form.transport === 'streamable-http'
  ? { transport: 'streamable-http', serverName: form.serverName.trim(), url: form.url.trim(), headers: pairsOf(form.headers) }
  : { transport: 'stdio', serverName: form.serverName.trim(), command: form.command.trim(), args: linesOf(form.args), env: pairsOf(form.env) }

function Field({ label, hint, children }) {
  return h('label', { className: 'bt-mcp-field' },
    h('span', { className: 'bt-mcp-label' }, label),
    children,
    hint ? h('span', { className: 'bt-mcp-hint' }, hint) : null)
}

function Switch({ on, label, busy, onToggle }) {
  return h('button', {
    type: 'button', className: 'bt-mcp-switch', 'aria-pressed': on, 'aria-label': label, title: label,
    'data-on': on ? '' : undefined, 'data-busy': busy ? '' : undefined, onClick: onToggle,
  }, h('span', { className: 'bt-mcp-knob', 'aria-hidden': true }))
}

// One server's tools, found by name or description; a tool opens its schema summary.
function Tools({ actions, serverName, report }) {
  const [tools, setTools] = useState(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState('')
  useEffect(() => {
    let live = true
    actions.mcpTools(serverName).then((answer) => { if (live) setTools(answer?.tools ?? []) }, (error) => { if (live) { setTools([]); report(error) } })
    return () => { live = false }
  }, [actions, serverName])
  if (tools === null) return h('div', { className: 'bt-mcp-empty' }, t('Reading tools…'))
  const q = text.trim().toLowerCase()
  const list = tools.filter(tool => !q || `${tool.name} ${tool.description}`.toLowerCase().includes(q))
  return h('div', { className: 'bt-mcp-tools' },
    tools.length === 0
      ? h('div', { className: 'bt-mcp-empty' }, t('This server has registered no tools. It may be unreachable, or it may offer none.'))
      : h('label', { className: 'bt-mcp-search' },
        h(SearchIcon),
        h('input', {
          type: 'search', value: text, onChange: (event) => setText(event.target.value),
          placeholder: t('Search tools'), 'aria-label': t('Search tools'),
        })),
    list.map((tool) => {
      const key = tool.fullName
      return h('div', { className: 'bt-mcp-tool', key, 'data-open': open === key ? '' : undefined },
        h('button', {
          type: 'button', className: 'bt-mcp-toolrow',
          'aria-expanded': open === key,
          onClick: () => setOpen(open === key ? '' : key),
        },
        h('span', { className: 'bt-mcp-toolname' }, tool.name),
        tool.description ? h('span', { className: 'bt-mcp-tooltext' }, tool.description) : null),
        open === key
          ? h('pre', { className: 'bt-mcp-schema' }, tool.schema)
          : null)
    }))
}

export function McpPanel({ actions }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [text, setText] = useState('')
  const [openName, setOpenName] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState('')
  const first = useRef(null)

  const report = (problem) => setError(problem?.message ?? String(problem))
  const load = () => Promise.resolve(actions.mcpList()).then((next) => { setState(next); setError('') }, report)

  useEffect(() => { void load() }, [])
  useEffect(() => { if (form !== null) first.current?.focus() }, [form])

  // A mutating call answers with the fresh list, so nothing re-reads twice.
  const apply = (name, call) => {
    setBusy(name)
    setError('')
    return Promise.resolve(call()).then((next) => {
      if (next?.servers !== undefined) setState(next)
      return next
    }, report).finally(() => setBusy(''))
  }

  if (state === null) return h('div', { className: 'bt-mcp' }, h('div', { className: 'bt-mcp-empty' }, t('Reading MCP servers…')))

  const servers = state.servers ?? []
  const current = openName === '' ? null : servers.find(server => server.serverName === openName) ?? null

  // ── the editor ────────────────────────────────────────────────────────────────
  if (form !== null) {
    const http = form.transport === 'streamable-http'
    const set = (key, value) => setForm({ ...form, [key]: value })
    const save = () => {
      const config = configOf(form)
      const name = editing === null ? `add:${config.serverName}` : `save:${editing}`
      apply(name, () => (editing === null ? actions.mcpAdd({ config }) : actions.mcpSave({ entryId: editing, config })))
        .then((next) => { if (next?.servers !== undefined) { setForm(null); setEditing(null) } })
    }
    return h('div', { className: 'bt-mcp' },
      h('header', { className: 'bt-mcp-head' },
        h('div', { className: 'bt-mcp-heading' },
          h('h2', { className: 'bt-mcp-h2' }, editing === null ? t('New MCP server') : t('Edit MCP server')),
          h('p', { className: 'bt-mcp-sub' }, t('DSH starts each server as its own plugin; its tools become mcp__name__tool.'))),
        h('button', { type: 'button', className: 'bt-mcp-ghost', onClick: () => { setForm(null); setEditing(null); setError('') } }, h(CloseIcon), t('Cancel'))),
      h('div', { className: 'bt-mcp-body' },
        h('div', { className: 'bt-mcp-form' },
          h('div', { className: 'bt-mcp-seg' },
            h('button', { type: 'button', 'aria-pressed': !http, 'data-on': !http ? '' : undefined, onClick: () => set('transport', 'stdio') }, t('stdio')),
            h('button', { type: 'button', 'aria-pressed': http, 'data-on': http ? '' : undefined, onClick: () => set('transport', 'streamable-http') }, t('streamable-http'))),
          h(Field, { label: t('Name'), hint: t('1–32 letters, digits, “_” or “-”; it names every tool this server adds.') },
            h('input', {
              ref: first, className: 'bt-mcp-input', value: form.serverName, placeholder: 'files',
              onChange: (event) => set('serverName', event.target.value), readOnly: editing !== null,
            })),
          http
            ? h(Field, { label: t('URL'), hint: 'https://host/mcp' },
              h('input', { className: 'bt-mcp-input', value: form.url, placeholder: 'https://', onChange: (event) => set('url', event.target.value) }))
            : h('div', null,
              h(Field, { label: t('Command'), hint: 'npx -y @modelcontextprotocol/server-filesystem' },
                h('input', { className: 'bt-mcp-input', value: form.command, placeholder: 'npx', onChange: (event) => set('command', event.target.value) })),
              h(Field, { label: t('Arguments'), hint: t('One per line.') },
                h('textarea', { className: 'bt-mcp-input bt-mcp-area', rows: 3, value: form.args, onChange: (event) => set('args', event.target.value) })),
              h(Field, { label: t('Environment'), hint: t('One KEY=value per line.') },
                h('textarea', { className: 'bt-mcp-input bt-mcp-area', rows: 3, value: form.env, onChange: (event) => set('env', event.target.value) }))),
          http
            ? h(Field, { label: t('Headers'), hint: t('One Name=value per line.') },
              h('textarea', { className: 'bt-mcp-input bt-mcp-area', rows: 3, value: form.headers, onChange: (event) => set('headers', event.target.value) }))
            : null,
          error ? h('p', { className: 'bt-mcp-error', role: 'alert' }, error) : null,
          h('div', { className: 'bt-mcp-formfoot' },
            h('button', {
              type: 'button', className: 'bt-mcp-primary', disabled: busy !== '',
              onClick: save,
            }, busy.startsWith('save:') || busy.startsWith('add:') ? t('Saving…') : t('Save'))))))
  }

  // ── one server ────────────────────────────────────────────────────────────────
  if (current !== null) {
    const readOnly = current.readOnly !== null && current.readOnly !== undefined
    return h('div', { className: 'bt-mcp' },
      h('header', { className: 'bt-mcp-head' },
        h('div', { className: 'bt-mcp-heading' },
          h('button', { type: 'button', className: 'bt-mcp-back', onClick: () => { setOpenName(''); setConfirming('') } }, t('Back')),
          h('h2', { className: 'bt-mcp-h2' }, current.serverName),
          h('p', { className: 'bt-mcp-sub' },
            `${current.transport} · ${t('{count} tools registered', { count: current.toolCount })}`)),
        h('div', { className: 'bt-mcp-actions' },
          h('button', {
            type: 'button', className: 'bt-mcp-ghost', disabled: readOnly || busy !== '',
            onClick: () => { setEditing(current.entryId); setForm(formOf(current)); setError('') },
          }, h(SwitchIcon), t('Edit')),
          h('button', {
            type: 'button', className: 'bt-mcp-ghost bt-danger', disabled: readOnly || busy !== '',
            onClick: () => setConfirming(confirming === current.serverName ? '' : current.serverName),
          }, h(TrashIcon), t('Delete')),
          h(Switch, {
            on: current.enabled, busy: busy === `toggle:${current.entryId}`,
            label: current.enabled ? t('Disable') : t('Enable'),
            onToggle: () => apply(`toggle:${current.entryId}`, () => actions.mcpToggle({ entryId: current.entryId, enabled: !current.enabled })).then((next) => {
              if (next?.servers !== undefined) setState(next)
            }, () => {}),
          }))),
      confirming === current.serverName
        ? h('div', { className: 'bt-mcp-confirm', role: 'alertdialog', 'aria-label': t('Delete this server?') },
          h('span', { className: 'bt-mcp-confirmtext' }, t('Delete {name} and the row that starts it? Its tools go with it.', { name: current.serverName })),
          h('div', { className: 'bt-mcp-confirmrow' },
            h('button', { type: 'button', className: 'bt-mcp-ghost', onClick: () => setConfirming('') }, t('Cancel')),
            h('button', {
              type: 'button', className: 'bt-mcp-primary bt-danger', disabled: busy !== '',
              onClick: () => apply(`remove:${current.serverName}`, () => actions.mcpRemove({ serverName: current.serverName })).then((next) => {
                if (next?.servers !== undefined) { setState(next); setOpenName(''); setConfirming('') }
              }),
            }, t('Delete'))))
        : null,
      readOnly
        ? h('div', { className: 'bt-mcp-note' }, t('This server was added outside this page, so it is read-only here.'))
        : null,
      h('div', { className: 'bt-mcp-body' },
        current.enabled
          ? h(Tools, { actions, serverName: current.serverName, report })
          : h('div', { className: 'bt-mcp-empty' }, t('This server is off, so it registers no tools.')),
        error ? h('p', { className: 'bt-mcp-error', role: 'alert' }, error) : null))
  }

  // ── the list ──────────────────────────────────────────────────────────────────
  const q = text.trim().toLowerCase()
  const list = servers.filter(server => !q || `${server.serverName} ${server.transport}`.toLowerCase().includes(q))
  return h('div', { className: 'bt-mcp' },
    h('header', { className: 'bt-mcp-head' },
      h('div', { className: 'bt-mcp-heading' },
        h('h2', { className: 'bt-mcp-h2' }, t('MCP')),
        h('p', { className: 'bt-mcp-sub' }, t('Servers every Bot and Session can use. Their tools appear as mcp__name__tool.'))),
      h('div', { className: 'bt-mcp-actions' },
        servers.length > 0
          ? h('label', { className: 'bt-mcp-search' },
            h(SearchIcon),
            h('input', {
              type: 'search', value: text, onChange: (event) => setText(event.target.value),
              placeholder: t('Search servers'), 'aria-label': t('Search servers'),
            }))
          : null,
        h('button', { type: 'button', className: 'bt-mcp-primary', onClick: () => { setEditing(null); setForm({ ...BLANK }); setError('') } },
          h(PlusIcon), t('Add server')))),
    h('div', { className: 'bt-mcp-body' },
      state.available === false
        ? h('div', { className: 'bt-mcp-empty' }, t('This DSH does not offer its profile configuration, so MCP servers cannot be listed here.'))
        : servers.length === 0
          ? h('div', { className: 'bt-mcp-empty' }, t('No MCP server yet. Add one and its tools appear to every Bot.'))
          : h('div', { className: 'bt-mcp-list' }, list.map((server) => {
            const readOnly = server.readOnly !== null && server.readOnly !== undefined
            return h('div', { className: 'bt-mcp-row', key: server.entryId, 'data-off': server.enabled ? undefined : '' },
              h('button', { type: 'button', className: 'bt-mcp-main', onClick: () => { setOpenName(server.serverName); setError('') } },
                h('span', { className: 'bt-mcp-mark', 'aria-hidden': true }, h(PlugIcon)),
                h('span', { className: 'bt-mcp-copy' },
                  h('span', { className: 'bt-mcp-name' }, server.serverName),
                  h('span', { className: 'bt-mcp-detail' },
                    `${server.transport} · ${t('{count} tools', { count: server.toolCount })}${readOnly ? ` · ${t('read-only')}` : ''}`))),
              h(Switch, {
                on: server.enabled, busy: busy === `toggle:${server.entryId}`,
                label: server.enabled ? t('Disable') : t('Enable'),
                onToggle: () => apply(`toggle:${server.entryId}`, () => actions.mcpToggle({ entryId: server.entryId, enabled: !server.enabled })).then((next) => {
                  if (next?.servers !== undefined) setState(next)
                }, () => {}),
              }))
          })),
      error ? h('p', { className: 'bt-mcp-error', role: 'alert' }, error) : null))
}
