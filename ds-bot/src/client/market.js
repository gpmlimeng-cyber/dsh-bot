import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dateLocale, t } from './i18n.js'
import { CloseIcon, SearchIcon, PlusIcon, PlugIcon, GearIcon, GlobeIcon, TerminalIcon, FolderIcon, MemoryIcon } from './icons.js'

// The market takes the main content area rather than a dialog: a rail of categories on the
// left, the installed list under it, and the catalogue or one entry's detail on the right.
// The pages that already own these settings stay where they are; every action here opens
// them, so nothing about connectors, capabilities or plugins changes underneath.
//
// The plugin catalogue is the shell's plugin-market index, drawn the way its own Discover
// tab draws it: its remotes hand us the index, the categories, labels and sort keys it
// declares and one page of entries, and installing goes through the shell's package
// manager, so a plugin lands exactly where its own page puts it.

const CATEGORIES = () => [
  { id: 'plugins', name: t('Plugins') },
  { id: 'connectors', name: t('Connectors') },
  { id: 'capabilities', name: t('Capabilities') },
  { id: 'skills', name: t('Skills') },
]

const CAPABILITIES = () => [
  { id: 'memory', name: t('Memory'), detail: t('What every Bot remembers about you'), icon: MemoryIcon },
  { id: 'terminal', name: t('Terminal'), detail: t('Run commands in the session workspace'), icon: TerminalIcon },
  { id: 'files', name: t('Workspace files'), detail: t('Read and edit the session workspace'), icon: FolderIcon },
  { id: 'browser', name: t('Browser'), detail: t('Open pages and work inside them'), icon: GlobeIcon },
]

// An index lists its categories in its own key order; the shell's page shows the same fixed
// sequence, so ids it does not know come after these instead of jumping to the front.
const CATEGORY_ORDER = ['tools', 'workflow', 'integrations', 'memory', 'skills', 'interface', 'development', 'providers', 'appearance', 'usage', 'knowledge']

// Label order is the shell's, not the index's: reach first, then freshness, activity, trust.
const LABEL_ORDER = ['downloads-100k', 'downloads-50k', 'downloads-10k', 'downloads-5k', 'downloads-1k', 'downloads-500', 'downloads-100', 'updated-recent', 'updated-week', 'updated-month', 'updated-quarter', 'active', 'trending', 'verified']
const byLabel = (list = []) => list.slice().sort((a, b) => {
  const left = LABEL_ORDER.indexOf(a.id)
  const right = LABEL_ORDER.indexOf(b.id)
  return (left < 0 ? LABEL_ORDER.length : left) - (right < 0 ? LABEL_ORDER.length : right)
})

const SORTS = () => [
  { id: 'index', name: t('Default order'), value: { kind: 'index' } },
  { id: 'recommended', name: t('Smart picks'), value: { kind: 'key', id: 'recommended', direction: 'desc' } },
  { id: 'github-stars', name: t('GitHub stars'), value: { kind: 'key', id: 'github-stars', direction: 'desc' } },
  { id: 'random-resources', name: t('Random'), value: { kind: 'key', id: 'random-resources', direction: 'desc' } },
  { id: 'published', name: t('Newest first'), value: { kind: 'published', direction: 'desc' } },
]

const PAGE = 24

const day = (ms) => (ms ? new Intl.DateTimeFormat(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ms)) : '')

function RefreshIcon() {
  return h('svg', { width: 15, height: 15, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M16 10a6 6 0 1 1-2.1-4.6' }), h('path', { d: 'M16 3.6V7h-3.4' }))
}

function TagIcon() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M9.6 3.5H4.8A1.3 1.3 0 0 0 3.5 4.8v4.8c0 .35.14.68.38.92l6.1 6.1a1.3 1.3 0 0 0 1.84 0l4.8-4.8a1.3 1.3 0 0 0 0-1.84l-6.1-6.1a1.3 1.3 0 0 0-.92-.38z' }),
    h('path', { d: 'M7.1 7.1h.01' }))
}

function Mark({ icon, state }) {
  return h('span', { className: 'bt-market-mark', 'data-state': state ?? 'off', 'aria-hidden': true }, icon ? h(icon) : h(PlusIcon))
}

function Card({ name, detail, mark, state, action, installed, quiet, onPick, onOpen }) {
  return h('div', { className: 'bt-market-card', 'data-installed': installed ? '' : undefined },
    h(Mark, { icon: mark, state }),
    h('button', { type: 'button', className: 'bt-market-copy', onClick: onOpen },
      h('span', { className: 'bt-market-name' }, name),
      detail ? h('span', { className: 'bt-market-detail' }, detail) : null),
    quiet
      ? h('span', { className: 'bt-market-state', 'data-on': state === 'ready' ? '' : undefined }, action)
      : h('button', { type: 'button', className: 'bt-market-go', 'data-on': state === 'ready' || installed ? '' : undefined, onClick: onPick }, action))
}

// One page of the shell's plugin market: its index picker, search box, label and sort menus
// and category pills above one card per entry. The entries, categories and labels all come
// from the index the shell fetched, so nothing here invents catalogue content.
function Discover({ actions }) {
  const [index, setIndex] = useState(null)
  const [text, setText] = useState('')
  const [settled, setSettled] = useState('')
  const [category, setCategory] = useState('')
  const [labels, setLabels] = useState([])
  const [sort, setSort] = useState('index')
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [page, setPage] = useState(null)
  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(true)
  const [more, setMore] = useState(false)
  const [reload, setReload] = useState(0)
  const [installing, setInstalling] = useState(null)
  // The pills sit on one line; the ones that do not fit fold into a More menu, so the row
  // never grows and never scrolls sideways.
  const cats = useRef(null)
  const mirror = useRef(null)
  const row = useRef(null)
  const [fits, setFits] = useState(null)
  const [moreCats, setMoreCats] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text.trim()), 300)
    return () => clearTimeout(timer)
  }, [text])

  const sortValue = useMemo(() => (SORTS().find((item) => item.id === sort) ?? SORTS()[0]).value, [sort])
  const sortName = useMemo(() => (SORTS().find((item) => item.id === sort) ?? SORTS()[0]).name, [sort])

  useEffect(() => {
    let live = true
    setBusy(true)
    Promise.resolve(actions.pluginsMarket?.({
      index: index ?? undefined,
      text: settled,
      category: category || undefined,
      labels,
      sort: sortValue,
      offset: 0,
      limit: PAGE,
      refresh: reload > 0,
    })).then((result) => {
      if (!live) return
      setPage(result ?? null)
      setEntries(result?.entries ?? [])
      setBusy(false)
    }, () => { if (live) { setPage(null); setEntries([]); setBusy(false) } })
    return () => { live = false }
  }, [actions, index, settled, category, labels, sortValue, reload])

  const loadMore = () => {
    if (more || !page?.nextOffset) return
    setMore(true)
    Promise.resolve(actions.pluginsMarket?.({
      index: index ?? undefined,
      text: settled,
      category: category || undefined,
      labels,
      sort: sortValue,
      offset: page.nextOffset,
      limit: PAGE,
    })).then((result) => {
      if (result?.entries?.length) {
        setEntries((current) => current.concat(result.entries.filter((entry) => !current.some((item) => item.id === entry.id))))
      }
      setPage((current) => (current && result ? { ...current, nextOffset: result.nextOffset } : current))
      setMore(false)
    }, () => setMore(false))
  }

  const install = (entry) => {
    if (installing) return
    setInstalling(entry.id)
    Promise.resolve(actions.installMarketPlugin?.(entry.spec, entry.registry)).then((okay) => {
      setInstalling(null)
      if (okay) setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, status: 'installed' } : item)))
    }, () => setInstalling(null))
  }

  const pills = useMemo(() => {
    const declared = page?.categories ?? []
    const ordered = CATEGORY_ORDER.map((id) => declared.find((item) => item.id === id)).filter(Boolean)
    const rest = declared.filter((item) => !ordered.includes(item))
    return [{ id: '', name: t('All') }, ...ordered, ...rest]
  }, [page])

  const toggleLabel = (id) => setLabels((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)))
  const indexes = page?.indexes ?? []

  // Measure a hidden copy of the row, so how many pills fit never depends on how many
  // are drawn: the next render takes the same answer and the row stays stable.
  useEffect(() => {
    const line = row.current
    const full = mirror.current
    if (!line || !full) return undefined
    const measure = () => {
      const widths = [...full.querySelectorAll('.bt-mk-pill')].map((node) => node.getBoundingClientRect().width)
      const room = line.clientWidth - 78
      let used = 0
      let count = widths.length
      for (let i = 0; i < widths.length; i += 1) {
        if (used + widths[i] + 6 > room) { count = i; break }
        used += widths[i] + 6
      }
      setFits(Math.max(1, count))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(line)
    return () => observer.disconnect()
  }, [pills])

  useEffect(() => {
    if (!moreCats) return undefined
    const close = () => setMoreCats(false)
    const onKey = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [moreCats])

  const cut = fits === null ? pills.length : Math.min(fits, pills.length)
  const head = pills.slice(0, cut)
  const tail = pills.slice(cut)
  // A category chosen from the More menu does not get one more pill: the menu's own
  // button takes that name, so the row keeps its width and stays one line.
  const chosenTail = tail.find((pill) => pill.id === category)
  const shown = head

  return h('div', { className: 'bt-mk' },
    h('div', { className: 'bt-mk-bar' },
      indexes.length > 1
        // The name sizes itself to the chosen index, as the shell's own picker does; the
        // select lies over it, invisible, so the native menu still opens.
        ? h('label', { className: 'bt-mk-menu bt-mk-pick bt-mk-switch' },
          h('span', { className: 'bt-mk-switchname' }, (indexes.find((item) => item.url === (index ?? indexes[0].url)) ?? indexes[0]).name),
          h('select', {
            value: index ?? indexes[0].url,
            onChange: (event) => { setIndex(event.target.value); setCategory(''); setLabels([]) },
            'aria-label': t('Plugin market'),
          }, ...indexes.map((item) => h('option', { key: item.url, value: item.url }, item.name))))
        : h('span', { className: 'bt-mk-name' }, page?.index?.name ?? t('Plugin market')),
      h('label', { className: 'bt-mk-search' },
        h(SearchIcon),
        h('input', {
          type: 'search', value: text, onChange: (event) => setText(event.target.value),
          placeholder: t('Search plugins'), 'aria-label': t('Search plugins'),
        })),
      h('button', {
        type: 'button', className: 'bt-mk-menu', 'data-on': labels.length ? '' : undefined,
        'aria-expanded': labelsOpen, onClick: () => setLabelsOpen((open) => !open),
      }, h(TagIcon), h('span', null, t('Labels'))),
      // Like the market picker: the visible name sizes itself and the select covers the
      // whole control, so a click anywhere on it opens the menu.
      h('label', { className: 'bt-mk-menu bt-mk-pick bt-mk-sort' },
        h('span', null, t('Sort:')),
        h('span', { className: 'bt-mk-sortname' }, sortName),
        h('select', { value: sort, onChange: (event) => setSort(event.target.value), 'aria-label': t('Sort') },
          ...SORTS().map((item) => h('option', { key: item.id, value: item.id }, item.name)))),
      h('button', { type: 'button', className: 'bt-mk-refresh', 'aria-label': t('Refresh'), title: t('Refresh'), onClick: () => setReload((count) => count + 1) }, h(RefreshIcon))),
    labelsOpen
      ? h('div', { className: 'bt-mk-labels' },
        ...byLabel(page?.labels).map((label) => h('button', {
          key: label.id, type: 'button', className: 'bt-mk-tag', 'data-on': labels.includes(label.id) ? '' : undefined,
          onClick: () => toggleLabel(label.id),
        }, label.name)))
      : null,
    h('div', { ref: row, className: 'bt-mk-catrow' },
      h('div', { ref: cats, className: 'bt-mk-cats', role: 'tablist' },
        ...shown.map((pill) => h('button', {
          key: pill.id || 'all', type: 'button', role: 'tab', 'aria-selected': category === pill.id,
          className: 'bt-mk-pill', 'data-on': category === pill.id ? '' : undefined,
          onClick: () => setCategory(pill.id),
        }, pill.name))),
      tail.length
        ? h('div', { className: 'bt-mk-catmore' },
          h('button', {
            type: 'button', className: 'bt-mk-pill bt-mk-morecat', 'aria-haspopup': 'menu',
            'aria-expanded': moreCats, 'data-on': chosenTail ? '' : undefined,
            onClick: (event) => { event.stopPropagation(); setMoreCats((open) => !open) },
          }, chosenTail ? chosenTail.name : t('More')),
          moreCats
            ? h('div', { className: 'bt-mk-catmenu', role: 'menu', onMouseDown: (event) => event.stopPropagation() },
              ...tail.map((pill) => h('button', {
                key: pill.id, type: 'button', role: 'menuitemradio', 'aria-checked': category === pill.id,
                className: 'bt-mk-catitem', 'data-on': category === pill.id ? '' : undefined,
                onClick: () => { setCategory(pill.id); setMoreCats(false) },
              }, pill.name)))
            : null)
        : null,
      h('div', { ref: mirror, className: 'bt-mk-catmirror', 'aria-hidden': true },
        ...pills.map((pill) => h('span', { key: pill.id || 'all', className: 'bt-mk-pill' }, pill.name)))),
    entries.length
      ? h('ul', { className: 'bt-mk-cards' }, ...entries.map((entry) => h('li', { key: entry.id, className: 'bt-mk-card' },
        h('span', { className: 'bt-mk-mark', 'aria-hidden': true },
          entry.icon ? h('img', { src: entry.icon, alt: '', loading: 'lazy' }) : h(PlugIcon)),
        h('div', { className: 'bt-mk-main' },
          h('div', { className: 'bt-mk-titlerow' },
            h('span', { className: 'bt-mk-name', title: entry.id }, entry.name),
            ...byLabel(entry.labels).map((label) => h('span', { key: label.id, className: 'bt-mk-tag' }, label.name))),
          entry.detail ? h('span', { className: 'bt-mk-desc' }, entry.detail) : null,
          h('span', { className: 'bt-mk-meta' }, [entry.version, entry.author, day(entry.published)].filter(Boolean).join(' · '))),
        h('div', { className: 'bt-mk-end' },
          entry.status === 'not-installed' || entry.status === 'failed'
            ? h('button', {
              type: 'button', className: 'bt-mk-install',
              disabled: installing === entry.id || !entry.spec,
              onClick: () => install(entry),
            }, installing === entry.id ? t('Installing…') : t('Install'))
            : h('span', { className: 'bt-mk-installed' }, t('Installed'))))))
      : busy ? null : h('div', { className: 'bt-mk-empty' }, t('No plugin matches this search')),
    h('div', { className: 'bt-mk-foot' },
      h('span', { className: 'bt-mk-count' },
        busy && !entries.length ? t('Reading the plugin index…') : t('{count} plugins', { count: page?.total ?? entries.length })),
      page?.nextOffset
        ? h('button', { type: 'button', className: 'bt-mk-more', disabled: more, onClick: loadMore }, more ? t('Loading…') : t('Show more'))
        : null))
}

export function MarketPanel({ open, onClose, roster = {}, actions = {} }) {
  const [tab, setTab] = useState('connectors')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const search = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { setSelected(null); setQuery('') }, [tab])

  const connectors = useMemo(() => (roster.connectors ?? []).map((connector) => ({
    id: connector.id,
    name: connector.title ?? connector.name ?? connector.id,
    detail: connector.state === 'ready'
      ? (connector.account ? t('Connected as {account}', { account: connector.account }) : t('Connected'))
      : connector.state === 'error' ? t('Could not connect') : (connector.about ?? t('Not connected')),
    state: connector.state,
  })), [roster.connectors])

  const capabilities = useMemo(CAPABILITIES, [t])
  // The shell owns the plugin pages; its remote hands us the installed list, we draw the rows.
  const [shellPlugins, setShellPlugins] = useState(null)
  useEffect(() => {
    if (!open || tab !== 'plugins' || shellPlugins !== null) return undefined
    let live = true
    Promise.resolve(actions.pluginsList?.()).then((list) => { if (live) setShellPlugins(Array.isArray(list) ? list : []) },
      () => { if (live) setShellPlugins([]) })
    return () => { live = false }
  }, [open, tab, shellPlugins, actions])
  const plugins = Array.isArray(shellPlugins) ? shellPlugins : (roster.plugins ?? [])
  const skills = roster.skills ?? []

  if (!open) return null

  const catalogue = (id) => (id === 'connectors' ? connectors : id === 'capabilities' ? capabilities : id === 'plugins' ? plugins : skills)
  const installedOf = (id) => {
    if (id === 'connectors') return connectors.filter((entry) => entry.state === 'ready')
    if (id === 'capabilities') return capabilities
    if (id === 'plugins') return plugins
    return skills
  }

  const q = query.trim().toLowerCase()
  const row = (entry) => !q || `${entry.name} ${entry.detail ?? ''}`.toLowerCase().includes(q)
  const list = catalogue(tab).filter(row)
  const installed = installedOf(tab)
  const current = selected ? catalogue(tab).find((entry) => (entry.id ?? entry.name) === selected) : null

  const pick = (entry) => {
    if (tab === 'connectors' || tab === 'capabilities') { onClose(); actions.openConnectors(); return }
    setSelected(entry.id ?? entry.name)
  }

  const heading = current ? current.name : t(tab === 'plugins' ? 'Plugins' : tab === 'connectors' ? 'Connectors' : tab === 'capabilities' ? 'Capabilities' : 'Skills')

  return createPortal(h('div', {
    className: 'bt-market-frame',
    onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() },
  },
  h('div', { className: 'bt-market-pane', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Market') },
    h('aside', { className: 'bt-market-nav' },
      h('div', { className: 'bt-market-navhead' },
        h('span', { className: 'bt-market-h2' }, t('Market')),
        h('button', { type: 'button', className: 'bt-market-close', 'aria-label': t('Close'), onClick: onClose }, h(CloseIcon))),
      h('div', { className: 'bt-market-cats', role: 'tablist' },
        ...CATEGORIES().map((category) => h('button', {
          key: category.id, type: 'button', role: 'tab', 'aria-selected': tab === category.id,
          className: 'bt-market-cat',
          onClick: () => setTab(category.id),
        }, category.name))),
      h('div', { className: 'bt-market-insthead' }, t('Installed')),
      h('div', { className: 'bt-market-installed' },
        installed.length
          ? installed.slice(0, 8).map((entry) => h('button', {
            key: entry.id ?? entry.name, type: 'button',
            className: 'bt-market-inst', 'aria-current': selected === (entry.id ?? entry.name) ? 'page' : undefined,
            onClick: () => setSelected(entry.id ?? entry.name),
          }, h(Mark, { icon: entry.icon, state: entry.state ?? 'ready' }), h('span', { className: 'bt-market-instname' }, entry.name)))
          : h('span', { className: 'bt-market-hint' }, t('Nothing installed yet')))),
    h('main', { className: 'bt-market-main' },
      h('header', { className: 'bt-market-head' },
        h('div', { className: 'bt-market-heading' },
          h('h2', { className: 'bt-market-h2' }, heading),
          h('p', { className: 'bt-market-sub' }, current
            ? current.detail
            : tab === 'plugins' ? t('Browse the plugin markets this Harness lists') : t('Connect an app or your own server once, then choose which Bots may use it'))),
        current
          ? h('button', { type: 'button', className: 'bt-market-back', onClick: () => setSelected(null) }, t('Back'))
          : tab === 'plugins'
            ? null
            : h('label', { className: 'bt-market-search' },
              h(SearchIcon),
              h('input', {
                ref: search, type: 'search', value: query, placeholder: t('Search apps'),
                onChange: (event) => setQuery(event.target.value), 'aria-label': t('Search apps'),
              }))),
      h('div', { className: 'bt-market-body' },
        tab === 'plugins' && !current
          ? [h(Discover, { key: 'discover', actions }),
            h('button', { type: 'button', className: 'bt-market-more', key: 'more', onClick: () => { onClose(); actions.openPluginsPanel?.() } },
              h(GearIcon), h('span', null, t('Open the page that manages plugins')))]
          : current
            ? h('div', { className: 'bt-market-detailpane' },
              h(Card, {
                name: current.name, detail: current.detail, mark: current.icon, state: current.state,
                installed: true, action: t('Manage'), onOpen: () => {}, onPick: () => { onClose(); actions.openConnectors() },
              }),
              h('div', { className: 'bt-market-note' }, t('The settings for this entry stay on the page that owns them.')),
              h('button', { type: 'button', className: 'bt-market-more', onClick: () => { onClose(); actions.openConnectors() } },
                h(GearIcon), h('span', null, t('Open the full connector page'))))
            : [
              list.length
                ? h('div', { className: 'bt-market-grid', key: 'grid' }, list.map((entry) => h(Card, {
                  key: entry.id ?? entry.name, name: entry.name, detail: entry.detail, mark: entry.icon,
                  state: entry.state,
                  installed: installed.some((item) => (item.id ?? item.name) === (entry.id ?? entry.name)),
                  action: installed.some((item) => (item.id ?? item.name) === (entry.id ?? entry.name)) ? t('Manage') : t('Connect'),
                  onOpen: () => setSelected(entry.id ?? entry.name),
                  onPick: () => pick(entry),
                })))
                : h('div', { className: 'bt-market-empty', key: 'empty' }, t('Nothing here yet')),
              h('button', { type: 'button', className: 'bt-market-more', key: 'more', onClick: () => { onClose(); actions.openConnectors() } },
                h(GearIcon), h('span', null, t('Open the full connector page'))),
            ])))), document.body)
}
