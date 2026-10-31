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

// A catalogue card, drawn the way the shell's own plugin market draws one: the logo, then
// the name with its badges, what it does, and the facts beside an install control.
// The plaza's categories are slugs; these are the reading names of the ones it uses most.
// Anything else falls back to the slug with its hyphens opened up.
const CATEGORY_NAMES = {
  'developer-tools': 'Developer tools',
  'search': 'Search',
  'browser-automation': 'Browser automation',
  'knowledge-and-memory': 'Knowledge and memory',
  'file-systems': 'File systems',
  'other': 'Other',
  'finance': 'Finance',
  'entertainment-and-media': 'Entertainment and media',
  'research-and-data': 'Research and data',
  'location-services': 'Location services',
  'art-and-culture': 'Art and culture',
  'databases': 'Databases',
  'communication': 'Communication',
  'calendar-management': 'Calendar',
  'version-control': 'Version control',
  'aigc': 'Generative AI',
  'image-and-video-processing': 'Image and video',
  'note-taking': 'Note taking',
  'travel-and-transportation': 'Travel and transport',
  'os-automation': 'OS automation',
  'cloud-platforms': 'Cloud platforms',
  'monitoring': 'Monitoring',
  'social-media': 'Social media',
}

const categoryName = id => t(CATEGORY_NAMES[id] ?? id.replace(/[-_]+/g, ' '))

function Row({ server, added, onOpen }) {
  return h('div', { className: 'bt-mm-plug' + (added ? ' is-added' : '') },
    h('button', { type: 'button', className: 'bt-mm-plugopen', 'aria-label': server.name, onClick: onOpen }),
    server.logo
      ? h('img', { className: 'bt-mm-logo', src: server.logo, alt: '', loading: 'lazy' })
      : h('span', { className: 'bt-mm-logo bt-mm-logo-empty', 'aria-hidden': true }, server.name.slice(0, 1)),
    h('div', { className: 'bt-mm-main' },
      h('div', { className: 'bt-mm-title' },
        h('span', { className: 'bt-mm-name' }, server.name),
        server.hosted ? h('span', { className: 'bt-mm-tag' }, t('Hosted')) : null,
        added ? h('span', { className: 'bt-mm-tag bt-mm-tag-on' }, t('Added')) : null),
      h('div', { className: 'bt-mm-meta' },
        server.installs ? h('span', { className: 'bt-mm-count' }, `↓ ${shortCount(server.installs)}`) : null,
        server.publisher ? h('span', { className: 'bt-mm-pub' }, server.publisher) : null),
      h('p', { className: 'bt-mm-desc' }, server.description)),
    h('div', { className: 'bt-mm-end' },
      h('button', {
        type: 'button',
        className: 'bt-mm-install',
        'data-added': added ? '' : undefined,
        onClick: onOpen,
      }, added ? t('Installed') : t('Install'))))
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
      server.pending ? ` · ${t('Starts with the next DSH')}` : server.enabled ? '' : ` · ${t('Off')}`,
      server.toolCount ? ` · ${t('{count} tools', { count: server.toolCount })}` : '')),
  h('span', { className: 'bt-mm-inst-end' },
    h('button', {
      type: 'button', className: 'bt-mm-switch', 'aria-pressed': server.enabled, 'data-on': server.enabled ? '' : undefined,
      'aria-label': server.enabled ? t('Turn off') : t('Turn on'), title: server.enabled ? t('Turn off') : t('Turn on'),
      disabled: busy !== '' || server.pending === true, onClick: () => onToggle(server),
    }, h(SwitchIcon)),
    h('button', {
      type: 'button', className: 'bt-mm-remove', 'aria-label': t('Remove'), title: t('Remove'),
      disabled: busy !== '', onClick: () => onRemove(server),
    }, h(TrashIcon))))))
}

// The custom view: a server the person names and configures themselves. It is the same
// two shapes DSH runs — a local process, or a hosted endpoint.
function Custom({ actions, report, onAdded }) {
  const [form, setForm] = useState({ serverName: '', transport: 'stdio', command: '', args: '', env: '', url: '', headers: '' })
  const [busy, setBusy] = useState(false)
  const set = (key, value) => setForm((now) => ({ ...now, [key]: value }))
  const http = form.transport === 'streamable-http'
  const lines = text => String(text).split('\n').map(line => line.trim()).filter(line => line !== '')
  const pairs = text => Object.fromEntries(lines(text).map((line) => {
    const at = line.indexOf('=')
    return at < 0 ? [line, ''] : [line.slice(0, at).trim(), line.slice(at + 1).trim()]
  }))
  const canSave = form.serverName.trim() !== '' && (http ? /^https?:\/\//i.test(form.url.trim()) : form.command.trim() !== '')

  const add = () => {
    if (!canSave || busy) return
    setBusy(true)
    const config = http
      ? { transport: 'streamable-http', serverName: form.serverName.trim(), url: form.url.trim(), headers: pairs(form.headers) }
      : { transport: 'stdio', serverName: form.serverName.trim(), command: form.command.trim(), args: lines(form.args), env: pairs(form.env) }
    Promise.resolve(actions.mcpAdd?.({ config }))
      .then((next) => { setBusy(false); onAdded(next, config.serverName) },
        (failure) => { setBusy(false); report(failure) })
  }

  return h('div', { className: 'bt-mm-custom' },
    h('p', { className: 'bt-mm-note' }, t('DSH starts each server as its own plugin; its tools become mcp__name__tool.')),
    h('label', { className: 'bt-mm-field' },
      h('span', null, t('Name')),
      h('input', { value: form.serverName, placeholder: 'my-server', spellCheck: false, onChange: (event) => set('serverName', event.target.value) })),
    h('div', { className: 'bt-mm-switchbar' },
      h('button', { type: 'button', 'aria-pressed': !http, 'data-on': !http ? '' : undefined, onClick: () => set('transport', 'stdio') }, t('stdio')),
      h('button', { type: 'button', 'aria-pressed': http, 'data-on': http ? '' : undefined, onClick: () => set('transport', 'streamable-http') }, t('streamable-http'))),
    http
      ? [
        h('label', { className: 'bt-mm-field', key: 'url' }, h('span', null, t('URL')), h('input', { value: form.url, placeholder: 'https://host/mcp', spellCheck: false, onChange: (event) => set('url', event.target.value) })),
        h('label', { className: 'bt-mm-field', key: 'headers' }, h('span', null, t('Headers')), h('textarea', { rows: 3, value: form.headers, placeholder: 'Authorization=Bearer …', onChange: (event) => set('headers', event.target.value) })),
      ]
      : [
        h('label', { className: 'bt-mm-field', key: 'command' }, h('span', null, t('Command')), h('input', { value: form.command, placeholder: 'npx', spellCheck: false, onChange: (event) => set('command', event.target.value) })),
        h('label', { className: 'bt-mm-field', key: 'args' }, h('span', null, t('Arguments')), h('textarea', { rows: 3, value: form.args, placeholder: '-y\n@modelcontextprotocol/server-filesystem\n/tmp', onChange: (event) => set('args', event.target.value) })),
        h('label', { className: 'bt-mm-field', key: 'env' }, h('span', null, t('Environment')), h('textarea', { rows: 3, value: form.env, placeholder: 'KEY=value', onChange: (event) => set('env', event.target.value) })),
      ],
    h('div', { className: 'bt-mm-actions' },
      h('button', { type: 'button', className: 'bt-mm-add', disabled: !canSave || busy, onClick: add }, busy ? t('Adding…') : t('Add server'))))
}

const VIEWS = () => [
  { id: 'discover', name: t('Discover') },
  { id: 'installed', name: t('Installed') },
  { id: 'custom', name: t('Custom') },
]

export function McpMarketTab({ actions = {} }) {
  const [view, setView] = useState('discover')
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
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('default')
  const timer = useRef(null)

  const report = (failure) => setError(String(failure?.message ?? failure))

  const applyRows = (next) => {
    setRows(next?.servers ?? [])
    setInstalled((next?.servers ?? []).map(server => server.serverName))
  }

  const loadRows = () => Promise.resolve(actions.mcpList?.()).then(applyRows, () => {})

  useEffect(() => {
    let live = true
    Promise.resolve(actions.mcpList?.()).then((next) => { if (live) applyRows(next) }, () => {})
    return () => { live = false }
  }, [actions])

  // Typing settles before the plaza is asked: one request per pause, not per key.
  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setSent(query.trim()); setPage(1) }, 320)
    return () => { if (timer.current !== null) clearTimeout(timer.current) }
  }, [query])

  useEffect(() => {
    if (view !== 'discover') return undefined
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
  }, [actions, sent, page, view])

  useEffect(() => {
    if (view !== 'discover' || categories.length > 0) return undefined
    let live = true
    Promise.resolve(actions.mcpMarket?.({ kind: 'categories' }))
      .then((next) => { if (live && Array.isArray(next)) setCategories(next) }, () => {})
    return () => { live = false }
  }, [actions, view, categories.length])

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
  const shown = useMemo(() => {
    const rows = category === '' ? list.servers : list.servers.filter(server => (server.categories ?? []).includes(category))
    return sort === 'installs' ? rows.slice().sort((left, right) => (right.installs ?? 0) - (left.installs ?? 0)) : rows
  }, [list.servers, category, sort])
  const more = list.servers.length < list.total

  const body = view === 'installed'
    ? h(Installed, { key: 'installed', servers: rows, busy: busyRow, onToggle: toggle, onRemove: remove })
    : view === 'custom'
      ? h(Custom, {
        key: 'custom',
        actions,
        report,
        onAdded: (next, serverName) => {
          applyRows(next)
          setNotice(t('Added {name}. Restart DSH to run it.', { name: serverName }))
          setView('installed')
          loadRows()
        },
      })
      : open === null
        ? [
          h('div', { className: 'bt-mm-list', key: 'list' }, shown.map(server => h(Row, {
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
            applyRows(next)
            setNotice(next?.pending ? t('Added {name}. Restart DSH to run it.', { name: serverName }) : '')
            setOpen(null)
          },
        })

  return h('div', { className: 'bt-mm' },
    h('div', { className: 'bt-mm-tabs', role: 'tablist', 'aria-label': t('MCP') }, VIEWS().map(item => h('button', {
      key: item.id,
      type: 'button',
      role: 'tab',
      'aria-selected': view === item.id,
      className: 'bt-mm-tab' + (view === item.id ? ' is-on' : ''),
      onClick: () => { setView(item.id); setOpen(null); setError('') },
    }, item.name, item.id === 'installed' && rows.length > 0 ? h('span', { className: 'bt-mm-tabcount' }, String(rows.length)) : null))),
    notice ? h('p', { className: 'bt-mm-done' }, notice) : null,
    view === 'discover'
      ? [
        h('div', { className: 'bt-mm-head', key: 'head' },
          h('label', { className: 'bt-mm-search' },
            h(SearchIcon),
            h('input', {
              value: query,
              placeholder: t('Search MCP servers'),
              'aria-label': t('Search MCP servers'),
              onChange: (event) => setQuery(event.target.value),
            })),
          h('label', { className: 'bt-mm-sort' },
            h('span', null, t('Sort')),
            h('select', { value: sort, 'aria-label': t('Sort'), onChange: (event) => setSort(event.target.value) },
              h('option', { value: 'default' }, t('Default order')),
              h('option', { value: 'installs' }, t('Downloads')))),
          h('span', { className: 'bt-mm-total' }, loading && list.servers.length === 0 ? t('Reading…') : t('{count} servers', { count: list.total.toLocaleString() }))),
        h('div', { className: 'bt-mm-filters', key: 'filters' },
          h('span', { className: 'bt-mm-filter-label' }, t('Labels')),
          h('div', { className: 'bt-mm-chips' },
            h('button', { type: 'button', className: 'bt-mm-chip' + (category === '' ? ' is-on' : ''), onClick: () => setCategory('') }, t('All')),
            categories.map(item => h('button', {
              key: item.id,
              type: 'button',
              className: 'bt-mm-chip' + (category === item.id ? ' is-on' : ''),
              onClick: () => setCategory(item.id),
            }, categoryName(item.id))))),
      ]
      : null,
    error ? h('p', { className: 'bt-mm-error' }, error) : null,
    body)
}
