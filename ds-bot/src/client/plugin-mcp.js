// The MCP tab of the shell's Plugins page: the ModelScope MCP plaza, one row per server,
// with the connection details behind a row and one press to add the server to this
// profile. It reads through our host (`mcp-market`), which owns the plaza's open API —
// the page itself never talks to modelscope.cn.
//
// What a row can promise: the plaza's own words about a server, and whether this profile
// already runs it. Nothing here claims a server works until it is added and DSH lists its
// tools on the MCP page.
import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { t } from './i18n.js'
import { CloseIcon, PlusIcon, SearchIcon, SwitchIcon, TrashIcon } from './icons.js'

// A server name has to fit the profile's own rule; the plaza's ids are `@owner/name`.
const nameOf = (id) => {
  const tail = String(id ?? '').split('/').pop() ?? ''
  const slug = tail.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug.slice(0, 32) || 'mcp-server'
}

const shortCount = (value) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

function Row({ server, added, onOpen }) {
  return h('button', { type: 'button', className: 'bt-mm-row', onClick: onOpen },
    server.logo
      ? h('img', { className: 'bt-mm-logo', src: server.logo, alt: '', loading: 'lazy' })
      : h('span', { className: 'bt-mm-logo bt-mm-logo-empty', 'aria-hidden': true }, server.name.slice(0, 1)),
    h('span', { className: 'bt-mm-main' },
      h('span', { className: 'bt-mm-title' },
        h('span', { className: 'bt-mm-name' }, server.name),
        server.hosted ? h('span', { className: 'bt-mm-tag' }, t('Hosted')) : null,
        added ? h('span', { className: 'bt-mm-tag bt-mm-tag-on' }, t('Added')) : null),
      h('span', { className: 'bt-mm-desc' }, server.description)),
    h('span', { className: 'bt-mm-end' },
      server.installs ? h('span', { className: 'bt-mm-count' }, shortCount(server.installs)) : null,
      h('span', { className: 'bt-mm-go', 'aria-hidden': true }, '›')))
}

// One server: what it is, and how this profile would connect to it — a hosted endpoint
// when the plaza has one, otherwise the stdio launch line the server ships.
function Detail({ actions, server, state, report, onClose, onAdded }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(nameOf(server.id))

  useEffect(() => {
    let live = true
    setName(nameOf(server.id))
    setError('')
    Promise.resolve(actions.mcpMarket?.({ kind: 'detail', id: server.id }))
      .then((next) => { if (live) setDetail(next) }, (failure) => { if (live) setError(String(failure?.message ?? failure)) })
    return () => { live = false }
  }, [actions, server.id])

  const url = detail?.urls?.[0]?.url ?? ''
  const stdio = detail?.stdio ?? null
  const config = url
    ? { transport: 'streamable-http', serverName: name, url }
    : stdio?.command
      ? { transport: 'stdio', serverName: name, command: stdio.command, args: stdio.args }
      : null

  const install = () => {
    if (config === null || busy) return
    setBusy(true)
    setError('')
    Promise.resolve(actions.mcpAdd?.({ config }))
      .then((next) => { setBusy(false); onAdded(next, name) }, (failure) => { setBusy(false); report(failure) })
  }

  return h('div', { className: 'bt-mm-detail' },
    h('div', { className: 'bt-mm-detail-head' },
      server.logo ? h('img', { className: 'bt-mm-logo bt-mm-logo-lg', src: server.logo, alt: '', loading: 'lazy' }) : null,
      h('div', { className: 'bt-mm-detail-title' },
        h('h3', null, server.name),
        h('p', null, server.publisher || server.id)),
      h('button', { type: 'button', className: 'bt-mm-close', 'aria-label': t('Close'), title: t('Close'), onClick: onClose }, h(CloseIcon))),
    h('p', { className: 'bt-mm-detail-desc' }, detail?.description || server.description),
    error ? h('p', { className: 'bt-mm-error' }, error) : null,
    detail === null && error === '' ? h('p', { className: 'bt-mm-note' }, t('Reading the server…')) : null,
    config !== null
      ? h('div', { className: 'bt-mm-card' },
        h('span', { className: 'bt-mm-card-label' }, url ? t('Hosted endpoint') : t('Launch line')),
        h('code', { className: 'bt-mm-code' }, url || `${stdio.command} ${stdio.args.join(' ')}`.trim()),
        stdio?.env?.length ? h('span', { className: 'bt-mm-note' }, t('Needs {names} set in the profile', { names: stdio.env.join(', ') })) : null,
        h('label', { className: 'bt-mm-field' },
          h('span', null, t('Server name')),
          h('input', { value: name, onChange: (event) => setName(event.target.value), spellCheck: false })))
      : detail === null ? null : h('p', { className: 'bt-mm-note' }, t('This server has no connection this profile can use on its own.')),
    detail?.readme ? h('pre', { className: 'bt-mm-readme' }, detail.readme) : null,
    h('div', { className: 'bt-mm-actions' },
      h('span', { className: 'bt-mm-note' }, state ? t('Added as {name}', { name: state }) : ''),
      h('button', {
        type: 'button',
        className: 'bt-mm-add',
        disabled: config === null || busy || name.trim() === '',
        onClick: install,
      }, busy ? t('Adding…') : h('span', null, h(PlusIcon), t('Add to DSH')))))
}

// The servers this profile already runs, above the plaza: the same rows the MCP settings
// page draws, so adding one from the plaza leaves it somewhere the person can switch off
// or take away without leaving the tab.
function Installed({ servers, busy, onToggle, onRemove }) {
  if (servers.length === 0) return h('p', { className: 'bt-mm-note' }, t('No MCP server is running in this profile yet.'))
  return h('div', { className: 'bt-mm-installed' }, servers.map(server => h('div', {
    key: server.entryId ?? server.serverName,
    className: 'bt-mm-inst-row',
    'data-off': server.enabled ? undefined : '',
  },
  h('span', { className: 'bt-mm-inst-main' },
    h('span', { className: 'bt-mm-name' }, server.serverName),
    h('span', { className: 'bt-mm-note' },
      server.transport === 'streamable-http' ? t('Hosted endpoint') : t('Local process'),
      server.enabled ? '' : ` · ${t('Off')}`,
      server.toolCount ? ` · ${t('{count} tools', { count: server.toolCount })}` : '')),
  h('span', { className: 'bt-mm-inst-end' },
    h('button', {
      type: 'button', className: 'bt-mm-switch', 'aria-pressed': server.enabled, 'data-on': server.enabled ? '' : undefined,
      'aria-label': server.enabled ? t('Turn off') : t('Turn on'), title: server.enabled ? t('Turn off') : t('Turn on'),
      disabled: busy !== '', onClick: () => onToggle(server),
    }, h(SwitchIcon)),
    h('button', {
      type: 'button', className: 'bt-mm-remove', 'aria-label': t('Remove'), title: t('Remove'),
      disabled: busy !== '', onClick: () => onRemove(server),
    }, h(TrashIcon))))))
}

export function McpMarketTab({ actions = {} }) {
  const [query, setQuery] = useState('')
  const [sent, setSent] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ total: 0, servers: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(null)
  const [added, setAdded] = useState({})
  const [installed, setInstalled] = useState([])
  const [rows, setRows] = useState([])
  const [busyRow, setBusyRow] = useState('')
  const [notice, setNotice] = useState('')
  const timer = useRef(null)

  const report = (failure) => setError(String(failure?.message ?? failure))

  useEffect(() => {
    let live = true
    Promise.resolve(actions.mcpList?.()).then((next) => {
      if (!live) return
      setRows(next?.servers ?? [])
      setInstalled((next?.servers ?? []).map(server => server.serverName))
    }, () => {})
    return () => { live = false }
  }, [actions])

  // Typing settles before the plaza is asked: one request per pause, not per key.
  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setSent(query.trim()); setPage(1) }, 320)
    return () => { if (timer.current !== null) clearTimeout(timer.current) }
  }, [query])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    Promise.resolve(actions.mcpMarket?.({ kind: 'search', query: sent, page }))
      .then((next) => {
        if (!live) return
        setLoading(false)
        setList((now) => page === 1
          ? { total: next?.total ?? 0, servers: next?.servers ?? [] }
          : { total: next?.total ?? now.total, servers: [...now.servers, ...(next?.servers ?? [])] })
      }, (failure) => { if (live) { setLoading(false); report(failure) } })
    return () => { live = false }
  }, [actions, sent, page])

  const applyRows = (next) => {
    setRows(next?.servers ?? [])
    setInstalled((next?.servers ?? []).map(server => server.serverName))
  }
  const toggle = (server) => {
    setBusyRow(server.entryId ?? server.serverName)
    Promise.resolve(actions.mcpToggle?.({ entryId: server.entryId, enabled: !server.enabled }))
      .then((next) => { setBusyRow(''); applyRows(next) }, (failure) => { setBusyRow(''); report(failure) })
  }
  const remove = (server) => {
    setBusyRow(server.entryId ?? server.serverName)
    Promise.resolve(actions.mcpRemove?.({ serverName: server.serverName }))
      .then((next) => { setBusyRow(''); applyRows(next) }, (failure) => { setBusyRow(''); report(failure) })
  }

  const names = useMemo(() => new Set(installed), [installed])
  const more = list.servers.length < list.total

  return h('div', { className: 'bt-mm' },
    notice ? h('p', { className: 'bt-mm-done' }, notice) : null,
    h('section', { className: 'bt-mm-section' },
      h('h4', { className: 'bt-mm-h' }, t('In this profile')),
      h(Installed, { servers: rows, busy: busyRow, onToggle: toggle, onRemove: remove })),
    h('div', { className: 'bt-mm-head' },
      h('label', { className: 'bt-mm-search' },
        h(SearchIcon),
        h('input', {
          value: query,
          placeholder: t('Search MCP servers'),
          'aria-label': t('Search MCP servers'),
          onChange: (event) => setQuery(event.target.value),
        })),
      h('span', { className: 'bt-mm-total' }, loading && list.servers.length === 0 ? t('Reading…') : t('{count} servers', { count: list.total.toLocaleString() }))),
    error ? h('p', { className: 'bt-mm-error' }, error) : null,
    open === null
      ? [
        h('div', { className: 'bt-mm-list', key: 'list' }, list.servers.map(server => h(Row, {
          key: server.id,
          server,
          added: names.has(nameOf(server.id)) || added[server.id] !== undefined,
          onOpen: () => setOpen(server),
        }))),
        more
          ? h('button', { type: 'button', className: 'bt-mm-more', key: 'more', disabled: loading, onClick: () => setPage(page + 1) },
            loading ? t('Reading…') : t('Show more'))
          : null,
        !loading && list.servers.length === 0 && error === '' ? h('p', { className: 'bt-mm-note', key: 'empty' }, t('No MCP server matches that search.')) : null,
      ]
      : h(Detail, {
        key: open.id,
        actions,
        server: open,
        state: added[open.id] ?? null,
        report,
        onClose: () => setOpen(null),
        onAdded: (next, serverName) => {
          setAdded((now) => ({ ...now, [open.id]: serverName }))
          setInstalled((next?.servers ?? []).map(server => server.serverName))
          setNotice(next?.pending ? t('Added {name}. Restart DSH to run it.', { name: serverName }) : '')
          setOpen(null)
        },
      }))
}
