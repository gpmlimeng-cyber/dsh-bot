import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from './i18n.js'
import { CloseIcon, SearchIcon, PlusIcon, GearIcon, GlobeIcon, TerminalIcon, FolderIcon, MemoryIcon } from './icons.js'

// The market takes the main content area rather than a dialog: a rail of categories on the
// left, the installed list under it, and the catalogue or one entry's detail on the right.
// The pages that already own these settings stay where they are; every action here opens
// them, so nothing about connectors, capabilities or plugins changes underneath.

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

function Mark({ icon, state }) {
  return h('span', { className: 'bt-market-mark', 'data-state': state ?? 'off', 'aria-hidden': true }, icon ? h(icon) : h(PlusIcon))
}

function Card({ name, detail, mark, state, action, installed, onPick, onOpen }) {
  return h('div', { className: 'bt-market-card', 'data-installed': installed ? '' : undefined },
    h(Mark, { icon: mark, state }),
    h('button', { type: 'button', className: 'bt-market-copy', onClick: onOpen },
      h('span', { className: 'bt-market-name' }, name),
      detail ? h('span', { className: 'bt-market-detail' }, detail) : null),
    h('button', { type: 'button', className: 'bt-market-go', 'data-on': state === 'ready' || installed ? '' : undefined, onClick: onPick }, action))
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
  const plugins = roster.plugins ?? []
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
          className: 'bt-market-cat', onClick: () => setTab(category.id),
        }, category.name))),
      h('div', { className: 'bt-market-insthead' }, t('Installed')),
      h('div', { className: 'bt-market-installed' },
        installed.length
          ? installed.map((entry) => h('button', {
            key: entry.id ?? entry.name, type: 'button',
            className: 'bt-market-inst', 'aria-current': selected === (entry.id ?? entry.name) ? 'page' : undefined,
            onClick: () => setSelected(entry.id ?? entry.name),
          }, h(Mark, { icon: entry.icon, state: entry.state ?? 'ready' }), h('span', { className: 'bt-market-instname' }, entry.name)))
          : h('span', { className: 'bt-market-hint' }, t('Nothing installed yet')))),
    h('main', { className: 'bt-market-main' },
      h('header', { className: 'bt-market-head' },
        h('div', { className: 'bt-market-heading' },
          h('h2', { className: 'bt-market-h2' }, heading),
          h('p', { className: 'bt-market-sub' }, current ? current.detail : t('Connect an app or your own server once, then choose which Bots may use it'))),
        current
          ? h('button', { type: 'button', className: 'bt-market-back', onClick: () => setSelected(null) }, t('Back'))
          : h('label', { className: 'bt-market-search' },
            h(SearchIcon),
            h('input', {
              ref: search, type: 'search', value: query, placeholder: t('Search apps'),
              onChange: (event) => setQuery(event.target.value), 'aria-label': t('Search apps'),
            }))),
      h('div', { className: 'bt-market-body' },
        current
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
                key: entry.id ?? entry.name, name: entry.name, detail: entry.detail, mark: entry.icon, state: entry.state,
                installed: installed.some((item) => (item.id ?? item.name) === (entry.id ?? entry.name)),
                action: installed.some((item) => (item.id ?? item.name) === (entry.id ?? entry.name)) ? t('Manage') : t('Connect'),
                onOpen: () => setSelected(entry.id ?? entry.name),
                onPick: () => pick(entry),
              })))
              : h('div', { className: 'bt-market-empty', key: 'empty' },
                tab === 'plugins'
                  ? h('div', { className: 'bt-market-official' },
                    h('span', null, t('The plugin catalogue is the shell own page.')),
                    h('button', {
                      type: 'button', className: 'bt-market-go',
                      onClick: () => { onClose(); import('./sidebar.js').then((mod) => mod.openHarnessSettings()) },
                    }, t('Open it')))
                  : t('Nothing here yet')),
            h('button', { type: 'button', className: 'bt-market-more', key: 'more', onClick: () => { onClose(); actions.openConnectors() } },
              h(GearIcon), h('span', null, t('Open the full connector page'))),
          ])))), document.body)
}
