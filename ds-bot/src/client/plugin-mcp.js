// The MCP tab of the shell's Plugins page: the ModelScope MCP plaza, one row per server,
// with the connection details behind a row and one press to add the server to this
// profile. It reads through our host (`mcp-market`), which owns the plaza's open API —
// the page itself never talks to modelscope.cn.
//
// What a row can promise: the plaza's own words about a server, and whether this profile
// already runs it. Nothing here claims a server works until it is added and DSH lists its
// tools on the MCP page.
import { createElement as h, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { t } from './i18n.js'
import { CloseIcon, PlusIcon, SearchIcon, TrashIcon } from './icons.js'

// A server name has to fit the profile's own rule; the plaza's ids are `@owner/name`.
const nameOf = (id) => {
  const tail = String(id ?? '').split('/').pop() ?? ''
  const slug = tail.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug.slice(0, 32) || 'mcp-server'
}

// Custom sources live on this device, like the sidebar's grouping: they are how this
// person reads the catalogue, not part of the team.
const SOURCES_KEY = 'ds-bot.mcp-sources'

const readSources = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SOURCES_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(item => item && typeof item.id === 'string' && typeof item.url === 'string') : []
  } catch { return [] }
}

const writeSources = (next) => {
  try { localStorage.setItem(SOURCES_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
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

// The shell's own switch: a 36x20 track with a 16px knob. A card and an installed row both
// use it, so switching a server on or off looks the same wherever it happens.
function Toggle({ on, busy, label, onClick }) {
  return h('button', {
    type: 'button',
    className: 'bt-mm-toggle',
    role: 'switch',
    'aria-checked': on ? 'true' : 'false',
    'aria-label': label,
    title: label,
    disabled: busy,
    onClick,
  }, h('span', { className: 'bt-mm-toggle-thumb', 'aria-hidden': true }))
}

function Row({ server, added, enabled, busy, onInstall, onOpen, onHome, onMenu }) {
  return h('li', { className: 'bt-mm-card', 'data-mcp-entry': server.id },
    h('span', { className: 'bt-mm-icon', 'aria-hidden': true },
      server.logo
        ? h('img', { className: 'bt-mm-image', src: server.logo, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' })
        : h('span', null, server.name.slice(0, 1))),
    h('div', { className: 'bt-mm-main' },
      h('div', { className: 'bt-mm-titleRow' },
        h('button', { type: 'button', className: 'bt-mm-cardOpen', 'aria-label': server.name, onClick: onOpen }, server.name),
        server.installs ? h('span', { className: 'bt-mm-tag' }, `↓ ${shortCount(server.installs)}`) : null,
        server.hosted ? h('span', { className: 'bt-mm-tag' }, t('Hosted')) : null,
        added ? h('span', { className: 'bt-mm-tag bt-mm-tag-on' }, t('Added')) : null),
      server.description ? h('span', { className: 'bt-mm-description' }, server.description) : null),
    h('div', { className: 'bt-mm-cardEnd' },
      // An added server has nothing left to install, so its control is the menu that
      // switches it off or takes it away; a card that cannot install only opens.
      added
        ? h(Toggle, {
          on: enabled !== false,
          busy,
          label: enabled === false ? t('Turn on') : t('Turn off'),
          onClick: onMenu,
        })
        : server.installable === false
          ? (server.homepage
            ? h('button', { type: 'button', className: 'bt-mm-btn bt-mm-btn-ghost', onClick: onHome }, t('Open page'))
            : null)
          : h('button', {
            type: 'button',
            className: 'bt-mm-btn',
            disabled: busy,
            onClick: onInstall,
          }, busy ? t('Adding…') : t('Install'))))
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

  return h('div', { className: 'bt-mm-drawer' },
    h('div', { className: 'bt-mm-detail-head' },
      server.logo ? h('img', { className: 'bt-mm-icon bt-mm-image', src: server.logo, width: 48, height: 48, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : null,
      h('div', { className: 'bt-mm-detail-title' },
        h('h3', null, server.name),
        h('p', null, server.publisher || server.id)),
      h('button', { type: 'button', className: 'bt-mm-close', 'aria-label': t('Close'), title: t('Close'), onClick: onClose }, h(CloseIcon))),
    h('p', { className: 'bt-mm-detail-desc' }, detail?.description || server.description),
    error ? h('p', { className: 'bt-mm-error' }, error) : null,
    detail === null && error === '' ? h('p', { className: 'bt-mm-note' }, t('Reading the server…')) : null,
    config !== null
      ? h('div', { className: 'bt-mm-config' },
        h('span', { className: 'bt-mm-config-label' }, url ? t('Hosted endpoint') : t('Launch line')),
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
    h(Toggle, {
      on: server.enabled !== false,
      busy: busy !== '' || server.pending === true,
      label: server.enabled ? t('Turn off') : t('Turn on'),
      onClick: () => onToggle(server),
    }),
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
  const [installing, setInstalling] = useState('')
  const [notice, setNotice] = useState('')
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('default')
  const [source, setSource] = useState('modelscope')
  const [sources, setSources] = useState(() => readSources())
  const [sourceMenu, setSourceMenu] = useState(false)
  const [moreLabels, setMoreLabels] = useState(false)
  // How many label pills the row has room for, the trailing menu included. 0 means the
  // whole catalogue fits and no menu is drawn.
  const [labelFit, setLabelFit] = useState(0)
  const labelRow = useRef(null)
  const labelBox = useRef(null)
  const sourceWrap = useRef(null)
  const [reload, setReload] = useState(0)
  const [adding, setAdding] = useState(null)
  const timer = useRef(null)

  // A menu hangs off its own trigger, so a press anywhere else — or Escape — closes it.
  useEffect(() => {
    if (!sourceMenu) return undefined
    const close = (event) => {
      if (sourceWrap.current !== null && sourceWrap.current.contains(event.target)) return
      setSourceMenu(false)
    }
    const escape = (event) => { if (event.key === 'Escape') setSourceMenu(false) }
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('keydown', escape)
    }
  }, [sourceMenu])

  useEffect(() => {
    if (!moreLabels) return undefined
    const close = (event) => {
      if (labelRow.current !== null && labelRow.current.contains(event.target)) return
      setMoreLabels(false)
    }
    const escape = (event) => { if (event.key === 'Escape') setMoreLabels(false) }
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('keydown', escape)
    }
  }, [moreLabels])

  const report = (failure) => setError(String(failure?.message ?? failure))

  const sourceName = () => ({
    modelscope: t('ModelScope MCP'),
    reference: t('MCP reference servers'),
    awesome: t('awesome-mcp-servers'),
  }[source] ?? (sources.find(item => item.id === source)?.name ?? source))

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

  // The category goes to the plaza with the search: the list is that category's own page
  // from the first one, not twenty rows cut down after they arrive.
  useEffect(() => {
    if (view !== 'discover') return undefined
    let live = true
    setLoading(true)
    setError('')
    const custom = sources.find(item => item.id === source) ?? null
    const ask = (at) => Promise.resolve(actions.mcpMarket?.({ kind: 'search', query: sent, page: at, category, source, custom }))
    // Every section shows six cards, and one plaza page of twenty cannot fill them: a
    // grouped browse reads a few pages before it draws. A hundred rows is the plaza's own
    // ceiling for one search, so five pages of twenty is as far as this goes.
    // A grouped browse reads each label for itself, so the mixed page stays one page.
    const fill = page === 1 && category === '' && sent === '' && custom === null && source !== 'modelscope'
    const run = async () => {
      const first = await ask(page)
      if (!live) return
      const rows = []
      const seen = new Set()
      const collect = (next) => {
        for (const server of next?.servers ?? []) {
          if (seen.has(server.id)) continue
          seen.add(server.id)
          rows.push(server)
        }
      }
      collect(first)
      let total = first?.total ?? 0
      let at = page
      while (fill && at < 5 && rows.length < 60 && (total === 0 || rows.length < total)) {
        at += 1
        const more = await ask(at).catch(() => null)
        if (!live) return
        if (more === null || (more.servers ?? []).length === 0) break
        total = more.total ?? total
        collect(more)
      }
      if (!live) return
      setLoading(false)
      setList((now) => page === 1
        ? { total, servers: rows }
        : { total: total === 0 ? now.total : total, servers: [...now.servers, ...rows] })
    }
    run().catch((failure) => { if (live) { setLoading(false); report(failure) } })
    return () => { live = false }
  }, [actions, sent, page, category, view, source, sources, reload])

  useEffect(() => {
    if (view !== 'discover' || categories.length > 0 || source !== 'modelscope') return undefined
    let live = true
    Promise.resolve(actions.mcpMarket?.({ kind: 'categories' }))
      .then((next) => { if (live && Array.isArray(next)) setCategories(next) }, () => {})
    return () => { live = false }
  }, [actions, view, categories.length, source])

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

  // The chip is part of the search, so a new one starts the list again from the plaza's
  // first page of that category instead of cutting down what is already on screen.
  const pick = (value) => {
    setCategory(value)
    setPage(1)
    // Picking the label that is already on has to bring the list back too, so the read is
    // asked for again even though the category did not change.
    setReload(count => count + 1)
  }

  // The label row is one line: the pills that fit, then a trailing menu for the rest. The
  // widths come from an off-screen copy of the pills, because a row that is merely clipped
  // would also cut off the menu hanging from its last pill.
  const fitLabels = () => {
    const row = labelRow.current
    const box = labelBox.current
    if (row === null || box === null) return
    const width = row.clientWidth
    if (width === 0) return
    const pills = box.querySelectorAll('[data-mm-measure]')
    if (pills.length === 0) return
    const more = box.querySelector('[data-mm-measure-more]')
    const room = width - (more === null ? 0 : more.offsetWidth + 6)
    let used = 0
    let fit = 0
    for (const pill of pills) {
      const next = fit === 0 ? pill.offsetWidth : used + 6 + pill.offsetWidth
      if (next > room) break
      used = next
      fit += 1
    }
    setLabelFit(fit >= pills.length ? 0 : Math.max(1, fit))
  }

  useLayoutEffect(fitLabels, [categories, category, source])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const row = labelRow.current
    if (row === null) return undefined
    const observer = new ResizeObserver(fitLabels)
    observer.observe(row)
    return () => observer.disconnect()
  }, [categories, category, source])

  // The card installs the way the shell's own market installs: read the server, then add
  // it. Anything that cannot be added from that much — no hosted endpoint and no launch
  // line, or a write that fails — opens the detail page with the reason.
  const install = (server) => {
    if (installing !== '') return
    setInstalling(server.id)
    const giveUp = (reason) => {
      setInstalling('')
      setOpen(server)
      setNotice(String(reason?.message ?? reason ?? ''))
    }
    const carried = server.install !== null && server.install !== undefined ? server.install : null
    const readDetail = carried === null
      ? Promise.resolve(actions.mcpMarket?.({ kind: 'detail', id: server.id }))
      : Promise.resolve(null)
    readDetail
      .then((detail) => {
        const name = nameOf(server.id)
        const url = detail?.urls?.[0]?.url ?? ''
        const stdio = detail?.stdio ?? null
        const config = carried !== null
          ? { ...carried, serverName: name }
          : url
            ? { transport: 'streamable-http', serverName: name, url }
            : stdio?.command
              ? { transport: 'stdio', serverName: name, command: stdio.command, args: stdio.args }
              : null
        if (config === null) {
          giveUp(t('This server has no connection this profile can use on its own.'))
          return undefined
        }
        return Promise.resolve(actions.mcpAdd?.({ config })).then((next) => {
          setInstalling('')
          setAdded((now) => ({ ...now, [server.id]: name }))
          applyRows(next)
          setNotice(next?.pending ? t('Added {name}. Restart DSH to run it.', { name }) : '')
        })
      })
      .catch(giveUp)
  }

  // A label's own page answers how many servers it holds, which no page of the whole plaza
  // can say. Four labels at a time, so a dozen of them do not all hit the plaza at once.
  const [sections, setSections] = useState([])
  const sectionCache = useRef(new Map())
  useEffect(() => {
    if (view !== 'discover' || category !== '' || sent !== '' || source !== 'modelscope' || categories.length === 0) return undefined
    let live = true
    const key = `${source}|${categories.map(item => item.id).join('|')}`
    const kept = sectionCache.current.get(key)
    if (kept !== undefined) {
      setSections(kept)
      return undefined
    }
    const read = (id) => Promise.resolve(actions.mcpMarket?.({ kind: 'search', query: '', page: 1, category: id, source, custom: null }))
      .then(next => ({ id, total: next?.total ?? 0, servers: next?.servers ?? [] }), () => ({ id, total: 0, servers: [] }))
    const run = async () => {
      const out = []
      for (let at = 0; at < categories.length && at < 24; at += 4) {
        out.push(...await Promise.all(categories.slice(at, at + 4).map(item => read(item.id))))
        if (!live) return
      }
      sectionCache.current.set(key, out)
      setSections(out)
    }
    run()
    return () => { live = false }
  }, [actions, view, category, sent, source, categories])

  const names = useMemo(() => new Set(installed), [installed])
  const shown = useMemo(
    () => (sort === 'installs'
      ? list.servers.slice().sort((left, right) => (right.installs ?? 0) - (left.installs ?? 0))
      : list.servers),
    [list.servers, sort],
  )
  // Cards are grouped the way the shell's own Discover list groups them: one section per
  // category, six cards in each, and the section's own control narrows the list to it. A
  // page of the whole plaza cannot say how many a label holds, so every label is asked for
  // its own first page; that answer carries the count the section reports.
  const groups = useMemo(() => {
    const rank = (id) => { const at = categories.findIndex(item => item.id === id); return at < 0 ? categories.length : at }
    const order = (servers) => (sort === 'installs' ? servers.slice().sort((left, right) => (right.installs ?? 0) - (left.installs ?? 0)) : servers)
    if (category === '' && sections.length > 0) {
      return sections
        .filter(entry => entry.servers.length > 0)
        .map(entry => ({ id: entry.id, name: categoryName(entry.id), total: entry.total, servers: order(entry.servers) }))
        .sort((left, right) => rank(left.id) - rank(right.id) || right.total - left.total)
    }
    const buckets = new Map()
    for (const server of shown) {
      const key = category !== '' ? '' : (server.categories?.[0] ?? server.publisher ?? '')
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(server)
    }
    return [...buckets.entries()]
      // A filtered list keeps the name of the category it was filtered to, so opening a
      // section does not rename it to "all".
      .map(([id, servers]) => ({ id, name: category !== '' ? categoryName(category) : (id === '' ? t('All') : categoryName(id)), total: servers.length, servers }))
      .sort((left, right) => rank(left.id) - rank(right.id) || right.servers.length - left.servers.length)
  }, [shown, sections, sort, category, categories, t])
  // A section shows six cards, and names what it leaves out the way the shell's own skill
  // list does: the first missing names, then how many more there are.
  const sectionMore = (group) => {
    const rest = group.servers.slice(6)
    const left = Math.max(0, (group.total ?? group.servers.length) - 6)
    if (left === 0) return null
    const names = rest.slice(0, 2).map(server => server.name).join(', ')
    return names === '' || left <= 2
      ? t('View {count} more', { count: left })
      : t('View {names}, and {count} more', { names, count: left - 2 })
  }
  // A section already says how much it holds, so the footer pages only inside one label.
  const more = category !== '' && list.servers.length < list.total

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
          loading && list.servers.length === 0
            ? h('ul', { className: 'bt-mm-cards', key: 'skeleton', 'aria-busy': true }, [0, 1, 2].map(index => h('li', { key: index, className: 'bt-mm-card' },
              h('span', { className: 'bt-mm-icon bt-mm-skeletonFill', 'aria-hidden': true }),
              h('div', { className: 'bt-mm-main' },
                h('span', { className: 'bt-mm-skeletonBar bt-mm-skeletonTitle' }),
                h('span', { className: 'bt-mm-skeletonBar bt-mm-skeletonDescription' })))))
            : groups.map((group) => {
              const more = category === '' && group.id !== '' ? sectionMore(group) : null
              return h('section', { className: 'bt-mm-group', key: group.id || 'all' },
              h('div', { className: 'bt-mm-grouphead' },
                h('h3', { className: 'bt-mm-grouptitle' }, group.name),
                more === null
                  ? null
                  : h('button', {
                    type: 'button',
                    className: 'bt-mm-groupmore',
                    title: group.name,
                    onClick: () => { pick(group.id); setPage(1) },
                  }, more)),
              h('ul', { className: 'bt-mm-cards' }, group.servers.slice(0, category === '' ? 6 : group.servers.length).map(server => h(Row, {
                key: server.id,
                server,
                added: names.has(nameOf(server.id)) || added[server.id] !== undefined,
                busy: installing === server.id,
                enabled: (rows.find(item => item.serverName === (added[server.id] ?? nameOf(server.id))) ?? {}).enabled !== false,
                onMenu: () => {
                  const name = added[server.id] ?? nameOf(server.id)
                  const entry = rows.find(item => item.serverName === name)
                  if (entry !== undefined) toggle(entry)
                },
                onInstall: () => install(server),
                onOpen: () => setOpen(server),
                onHome: () => { try { window.open(server.homepage, '_blank', 'noopener') } catch { /* no window */ } },
              }))))}
            ),
          more
            ? h('button', { type: 'button', className: 'bt-mm-btn bt-mm-more', key: 'more', disabled: loading, onClick: () => setPage(page + 1) },
              loading ? t('Reading…') : t('Show more'))
            : null,
          !loading && shown.length === 0 && error === '' ? h('p', { className: 'bt-mm-muted', key: 'empty' }, t('No MCP server matches that search.')) : null,
          adding === null
            ? null
            : h('div', { className: 'bt-mm-addsource', key: 'addsource' },
              h('div', { className: 'bt-mm-addsource-head' },
                h('span', null, t('Add a custom source')),
                h('button', { type: 'button', className: 'bt-mm-close', 'aria-label': t('Close'), title: t('Close'), onClick: () => setAdding(null) }, h(CloseIcon))),
              h('label', { className: 'bt-mm-field' }, h('span', null, t('Name')),
                h('input', { value: adding.name, placeholder: 'My MCP list', spellCheck: false, onChange: (event) => setAdding({ ...adding, name: event.target.value }) })),
              h('label', { className: 'bt-mm-field' }, h('span', null, 'URL'),
                h('input', { value: adding.url, placeholder: 'https://raw.githubusercontent.com/…/README.md', spellCheck: false, onChange: (event) => setAdding({ ...adding, url: event.target.value }) })),
              h('div', { className: 'bt-mm-switchbar' },
                h('button', { type: 'button', 'data-on': adding.kind === 'readme' ? '' : undefined, onClick: () => setAdding({ ...adding, kind: 'readme' }) }, t('README')),
                h('button', { type: 'button', 'data-on': adding.kind === 'json' ? '' : undefined, onClick: () => setAdding({ ...adding, kind: 'json' }) }, 'JSON')),
              h('div', { className: 'bt-mm-actions' },
                h('button', {
                  type: 'button',
                  className: 'bt-mm-btn',
                  disabled: adding.name.trim() === '' || !/^https?:\/\//i.test(adding.url.trim()),
                  onClick: () => {
                    const entry = { id: `custom:${Date.now()}`, name: adding.name.trim(), url: adding.url.trim(), kind: adding.kind }
                    const next = [...sources, entry]
                    setSources(next)
                    writeSources(next)
                    setAdding(null)
                    setSource(entry.id)
                    setPage(1)
                    setList({ total: 0, servers: [] })
                  },
                }, t('Add source')))),
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

  const shownLabels = labelFit > 0 ? Math.max(0, labelFit - 1) : categories.length
  const hiddenLabels = categories.slice(shownLabels)
  const moreLabel = hiddenLabels.some(item => item.id === category) ? categoryName(category) : t('More labels')

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
      ? h('div', { className: 'bt-mm-discover', key: 'discover' },
        h('div', { className: 'bt-mm-toolbar' },
          h('div', { className: 'bt-mm-sourcewrap', ref: sourceWrap },
            h('button', {
              type: 'button',
              className: 'bt-mm-source',
              'aria-haspopup': 'menu',
              'aria-expanded': sourceMenu ? 'true' : 'false',
              onClick: () => setSourceMenu(!sourceMenu),
            },
            h('span', { className: 'bt-mm-source-name' }, sourceName()),
            h('span', { 'aria-hidden': true }, '▾')),
            sourceMenu
              ? h('div', { className: 'bt-mm-menu', role: 'menu' },
                [
                  { id: 'modelscope', name: t('ModelScope MCP') },
                  { id: 'reference', name: t('MCP reference servers') },
                  { id: 'awesome', name: t('awesome-mcp-servers') },
                  ...sources.map(item => ({ id: item.id, name: item.name, custom: true })),
                ].map(item => h('button', {
                  key: item.id,
                  type: 'button',
                  role: 'menuitem',
                  className: 'bt-mm-menuitem' + (item.id === source ? ' is-on' : ''),
                  onClick: () => { setSource(item.id); setSourceMenu(false); setPage(1); setList({ total: 0, servers: [] }); setCategories([]); setCategory('') },
                }, item.name, item.custom ? h('span', { className: 'bt-mm-menuitem-x', role: 'button', 'aria-label': t('Remove'), title: t('Remove'), onClick: (event) => { event.stopPropagation(); const next = sources.filter(one => one.id !== item.id); setSources(next); writeSources(next); if (source === item.id) setSource('modelscope') } }, '×') : null, h('span', { className: 'bt-mm-menuitem-check', 'aria-hidden': true }, '✓'))),
                // The shell hangs its footer items off a hairline inside the list.
                h('div', { className: 'bt-mm-menu-footer' },
                  h('button', { type: 'button', role: 'menuitem', className: 'bt-mm-menuitem', onClick: () => { setSourceMenu(false); setAdding({ name: '', url: '', kind: 'readme' }) } }, t('Manage sources…'), h('span', { className: 'bt-mm-menuitem-gear', 'aria-hidden': true }, '⚙'))))
              : null),
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
              h('option', { value: 'installs' }, t('Downloads'))))),
        categories.length === 0 ? null : h('div', { className: 'bt-mm-tagrow' },
          h('div', { className: 'bt-mm-categories', role: 'group', 'aria-label': t('Labels'), ref: labelRow },
            h('button', {
              type: 'button',
              className: 'bt-mm-pill' + (category === '' ? ' is-on' : ''),
              'aria-pressed': category === '',
              onClick: () => pick(''),
            }, t('All')),
            categories.slice(0, shownLabels).map(item => h('button', {
              key: item.id,
              type: 'button',
              className: 'bt-mm-pill' + (category === item.id ? ' is-on' : ''),
              'aria-pressed': category === item.id,
              onClick: () => pick(item.id),
            }, categoryName(item.id))),
            hiddenLabels.length === 0
              ? null
              : h('div', { className: 'bt-mm-morewrap' },
                h('button', {
                  type: 'button',
                  className: 'bt-mm-pill bt-mm-morepill' + (hiddenLabels.some(item => item.id === category) ? ' is-on' : ''),
                  'aria-haspopup': 'menu',
                  'aria-expanded': moreLabels ? 'true' : 'false',
                  onClick: () => setMoreLabels(!moreLabels),
                }, moreLabel, h('span', { 'aria-hidden': true }, '▾')),
                moreLabels
                  ? h('div', { className: 'bt-mm-menu bt-mm-labelmenu', role: 'menu' },
                    hiddenLabels.map(item => h('button', {
                      key: item.id,
                      type: 'button',
                      role: 'menuitem',
                      className: 'bt-mm-menuitem' + (category === item.id ? ' is-on' : ''),
                      onClick: () => { setMoreLabels(false); pick(item.id) },
                    }, categoryName(item.id), h('span', { className: 'bt-mm-menuitem-check', 'aria-hidden': true }, '✓'))))
                  : null)),
          // Off-screen copy of the row, only ever measured.
          h('div', { className: 'bt-mm-tagmeasure', ref: labelBox, 'aria-hidden': 'true' },
            h('span', { className: 'bt-mm-pill', 'data-mm-measure': '' }, t('All')),
            categories.map(item => h('span', { key: item.id, className: 'bt-mm-pill', 'data-mm-measure': '' }, categoryName(item.id))),
            h('span', { className: 'bt-mm-pill bt-mm-morepill', 'data-mm-measure-more': '' }, moreLabel, h('span', { 'aria-hidden': true }, '▾')))),
        error ? h('p', { className: 'bt-mm-error' }, error) : null,
        body)
      : h('div', { className: 'bt-mm-other' },
        error ? h('p', { className: 'bt-mm-error' }, error) : null,
        body),
    adding === null
      ? null
      : h('div', { className: 'bt-mm-addsource' },
        h('div', { className: 'bt-mm-addsource-head' },
          h('span', null, t('Add a custom source')),
          h('button', { type: 'button', className: 'bt-mm-close', 'aria-label': t('Close'), title: t('Close'), onClick: () => setAdding(null) }, h(CloseIcon))),
        h('label', { className: 'bt-mm-field' }, h('span', null, t('Name')),
          h('input', { value: adding.name, placeholder: t('My MCP list'), spellCheck: false, onChange: (event) => setAdding({ ...adding, name: event.target.value }) })),
        h('label', { className: 'bt-mm-field' }, h('span', null, 'URL'),
          h('input', { value: adding.url, placeholder: 'https://raw.githubusercontent.com/…/README.md', spellCheck: false, onChange: (event) => setAdding({ ...adding, url: event.target.value }) })),
        h('div', { className: 'bt-mm-switchbar' },
          h('button', { type: 'button', 'data-on': adding.kind === 'readme' ? '' : undefined, onClick: () => setAdding({ ...adding, kind: 'readme' }) }, t('README')),
          h('button', { type: 'button', 'data-on': adding.kind === 'json' ? '' : undefined, onClick: () => setAdding({ ...adding, kind: 'json' }) }, 'JSON')),
        h('div', { className: 'bt-mm-actions' },
          h('button', {
            type: 'button',
            className: 'bt-mm-btn',
            disabled: adding.name.trim() === '' || !/^https?:\/\//i.test(adding.url.trim()),
            onClick: () => {
              const entry = { id: `custom:${Date.now()}`, name: adding.name.trim(), url: adding.url.trim(), kind: adding.kind }
              const next = [...sources, entry]
              setSources(next)
              writeSources(next)
              setAdding(null)
              setSource(entry.id)
              setPage(1)
              setList({ total: 0, servers: [] })
            },
          }, t('Add source')))))
}
