// The account this skin keeps for the user, and where it lives: a name, a phone number and an email,
// held on this device. There is no account system behind the skin yet, so nothing here signs anything
// in; this module is only the record and the storage key, free of the page that shows it (account.js)
// so the rule can be read, and checked, without a DOM.
import { STORAGE } from './storage.js'

// What the card and the page show before anything is typed.
export const EMPTY_ACCOUNT = { name: '', phone: '', email: '' }

// A stored profile, or nothing at all. A value that cannot be read is not a reason to fail the page
// that shows it, so every failure answers the empty one.
export function loadAccount(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE.account)
    if (!raw) return EMPTY_ACCOUNT
    const saved = JSON.parse(raw)
    if (saved === null || typeof saved !== 'object') return EMPTY_ACCOUNT
    return { name: String(saved.name ?? ''), phone: String(saved.phone ?? ''), email: String(saved.email ?? '') }
  } catch { return EMPTY_ACCOUNT }
}

export function saveAccount(account, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE.account, JSON.stringify({
      name: account?.name ?? '', phone: account?.phone ?? '', email: account?.email ?? '',
    }))
  } catch { /* storage unavailable: the page still shows what was typed this session */ }
}
