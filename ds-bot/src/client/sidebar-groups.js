import { STORAGE } from './storage.js'

// Groups of sidebar rows, as the reference product lets a user keep them: a named list of
// sections and which entry sits in which one. It is layout, not team data, so it lives on
// this device; the roster stays the source of what exists.

const EMPTY = { groups: [], assign: {} }

export function readArrangement() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.groups) ?? 'null')
    if (!raw || !Array.isArray(raw.groups)) return { groups: [], assign: {} }
    return {
      groups: raw.groups
        .filter(group => group && typeof group.id === 'string' && typeof group.name === 'string')
        .map(group => ({ id: group.id, name: group.name.slice(0, 24), collapsed: group.collapsed === true })),
      assign: raw.assign && typeof raw.assign === 'object' ? { ...raw.assign } : {},
    }
  } catch { return { groups: [], assign: {} } }
}

export function writeArrangement(next) {
  try { localStorage.setItem(STORAGE.groups, JSON.stringify(next)) } catch { /* storage unavailable */ }
  // Context menus live in another component; one event keeps both views on the same list.
  window.dispatchEvent(new Event('ds-bot:groups'))
}

export const emptyArrangement = () => ({ ...EMPTY })
