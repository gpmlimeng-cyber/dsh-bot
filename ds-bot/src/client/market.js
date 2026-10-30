import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from './i18n.js'
import { CloseIcon, SearchIcon, PlusIcon, GearIcon, GlobeIcon, TerminalIcon, FolderIcon, MemoryIcon } from './icons.js'

// The market: one panel over the conversation that shows what DS Bot can reach — the
// connectors it is wired to, the capabilities it runs on, and the DSH plugins installed
// beside it. The pages themselves are untouched; every card opens the page that owns it.
//
// The shape follows the reference app's Apps panel: a centred card, 780 wide and never
// taller than the window, a title row with the connected count, a search field, category
// tabs, then two columns of cards with a mark, a name, one line and a button.

// What DS Bot brings itself. Each entry names what owns the setting today.
const CAPABILITIES = () => [
  { id: 'memory', name: t('Memory'), detail: t('What every Bot remembers about you'), icon: MemoryIcon },
  { id: 'terminal', name: t('Terminal'), detail: t('Run commands in the session workspace'), icon: TerminalIcon },
  { id: 'files', name: t('Workspace files'), detail: t('Read and edit the session workspace'), icon: FolderIcon },
  { id: 'browser', name: t('Browser'), detail: t('Open pages and work inside them'), icon: GlobeIcon },
]

function Mark({ icon, state }) {
  return h('span', { className: 'bt-market-mark', 'data-state': state ?? 'off', 'aria-hidden': true }, icon ? h(icon) : h(PlusIcon))
}

function Card({ name, detail, mark, state, action, onPick }) {
  return h('div', { className: 'bt-market-card' },
    h(Mark, { icon: mark, state }),
    h('span', { className: 'bt-market-copy' },
      h('span', { className: 'bt-market-name' }, name),
      detail ? h('span', { className: 'bt-market-detail' }, detail) : null),
    h('button', { type: 'button', className: 'bt-market-go', 'data-on': state === 'ready' ? '' : undefined, onClick: onPick }, action))
}

export function MarketPanel({ open, onClose, roster, actions }) {
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const search = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const timer = setTimeout(() => search.current?.focus(), 40)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(timer) }
  }, [open, onClose])

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
  const connected = connectors.filter((entry) => entry.state === 'ready').length

  if (!open) return null

  const q = query.trim().toLowerCase()
  const match = (entry) => !q || `${entry.name} ${entry.detail ?? ''}`.toLowerCase().includes(q)

  const section = (title, entries, kind, render) => {
    if (tab !== 'all' && tab !== kind) return null
    const shown = entries.filter(match)
    if (!shown.length) return null
    return h('section', { className: 'bt-market-section', key: kind },
      h('h3', { className: 'bt-market-title' }, title),
      h('div', { className: 'bt-market-grid' }, shown.map(render)))
  }

  return createPortal(h('div', {
    className: 'bt-market-frame', role: 'presentation',
    onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() },
  },
  h('div', { className: 'bt-market', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Apps') },
    h('header', { className: 'bt-market-head' },
      h('div', { className: 'bt-market-heading' },
        h('h2', { className: 'bt-market-h2' }, t('Apps')),
        h('button', { type: 'button', className: 'bt-market-connected', onClick: () => setTab('connectors') },
          t('Connected {n}', { n: connected }), h('span', { 'aria-hidden': true }, '›'))),
      h('button', { type: 'button', className: 'bt-market-close', 'aria-label': t('Close'), onClick: onClose }, h(CloseIcon))),
    h('p', { className: 'bt-market-sub' }, t('Connect an app or your own server once, then choose which Bots may use it')),
    h('div', { className: 'bt-market-tools' },
      h('label', { className: 'bt-market-search' },
        h(SearchIcon),
        h('input', {
          ref: search, type: 'search', value: query, placeholder: t('Search apps'),
          onChange: (event) => setQuery(event.target.value), 'aria-label': t('Search apps'),
        })),
      h('div', { className: 'bt-market-tabs', role: 'tablist' },
        ...[['all', t('All')], ['connectors', t('Connectors')], ['capabilities', t('Capabilities')], ['plugins', t('Plugins')]]
          .map(([id, label]) => h('button', {
            key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, className: 'bt-market-tab',
            onClick: () => setTab(id),
          }, label)))),
    h('div', { className: 'bt-market-body' },
      section(t('Connectors'), connectors, 'connectors', (entry) => h(Card, {
        key: entry.id, name: entry.name, detail: entry.detail, state: entry.state,
        action: entry.state === 'ready' ? t('Manage') : t('Connect'),
        onPick: () => { onClose(); actions.openConnectors() },
      })),
      section(t('Capabilities'), capabilities, 'capabilities', (entry) => h(Card, {
        key: entry.id, name: entry.name, detail: entry.detail, mark: entry.icon,
        action: t('Open'),
        onPick: () => { onClose(); actions.openConnectors() },
      })),
      section(t('Plugins'), plugins, 'plugins', (entry) => h(Card, {
        key: entry.id ?? entry.name, name: entry.name ?? entry.id,
        detail: entry.detail ?? t('Installed in DeepSeek Harness'),
        action: t('Open'),
        onPick: () => { onClose(); actions.openSettings?.() },
      })),
      !connectors.length && !plugins.length
        ? h('div', { className: 'bt-market-empty' }, t('Nothing here yet'))
        : null,
      h('button', { type: 'button', className: 'bt-market-more', onClick: () => { onClose(); actions.openConnectors() } },
        h(GearIcon), h('span', null, t('Open the full connector page')))))), document.body)
}
