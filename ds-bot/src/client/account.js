// The account's two surfaces: 我的's own top card and the page behind it. There is no account system
// behind the skin yet, so nothing here signs anything in -- and the two controls that would need one
// (signing out, deleting an account) are drawn and left out of reach. What the user types is saved on
// this device (account-store.js), so it survives a reload, and it is theirs: nothing is sent anywhere.
import { createElement as h, Fragment } from 'react'
import { Card, InlineText, Row } from './bot-settings.js'
import { ChevronRightIcon, FluentPersonIcon } from './icons.js'
import { t } from './i18n.js'
import { EMPTY_ACCOUNT, loadAccount, saveAccount } from './account-store.js'

// The record and its storage live in account-store.js (the rule, no DOM); this module is the two
// surfaces that show and edit it.
export { EMPTY_ACCOUNT, loadAccount, saveAccount }

// The face both surfaces wear: the first letter of the name, or the skin's person when there is no
// name yet. It is the same circle the account has worn all along (styles.js, .bt-you).
function AccountFace({ account, size }) {
  const name = (account.name ?? '').trim()
  return h('span', {
    className: 'bt-you', 'aria-hidden': true,
    style: { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.42)) },
  }, name === '' ? h(FluentPersonIcon) : name.slice(0, 1))
}

// One value, or the dash that says there is none.
const orDash = (value) => (value ?? '').trim() === '' ? '—' : value

// 我的's own top card: who the user is on this device, and the way to the page that edits it.
export function AccountCard({ account, onOpen }) {
  const detail = [orDash(account.phone), orDash(account.email)].join(' · ')
  return h('button', {
    type: 'button', className: 'bt-account-card',
    'aria-label': t('Account settings'), title: t('Account settings'),
    onClick: onOpen,
  },
  h(AccountFace, { account, size: 44 }),
  h('span', { className: 'bt-account-body' },
    h('span', { className: 'bt-account-name' }, (account.name ?? '').trim() === '' ? t('Not signed in') : account.name),
    h('span', { className: 'bt-account-detail' }, detail)),
  h('span', { className: 'bt-account-go', 'aria-hidden': true }, h(ChevronRightIcon)))
}

// The page behind that card: the three values, each editable where it is read, and the two controls
// that need an account -- which is what keeps them out of reach rather than out of the drawing.
export function AccountPage({ account, onChange }) {
  return h(Fragment, null,
    h('div', { className: 'bt-account-head' }, h(AccountFace, { account, size: 64 })),
    h(Card, null,
      h(Row, { label: t('Nickname') }, h(InlineText, {
        label: t('Nickname'), value: account.name, placeholder: t('Your name'), maxLength: 40,
        onSave: name => onChange({ name }),
      })),
      h(Row, { label: t('Phone'), hint: t('Kept on this device.') }, h(InlineText, {
        label: t('Phone'), value: account.phone, placeholder: '+86 158…', maxLength: 32,
        onSave: phone => onChange({ phone }),
      })),
      h(Row, { label: t('Email') }, h(InlineText, {
        label: t('Email'), value: account.email, placeholder: 'you@example.com', maxLength: 80,
        onSave: email => onChange({ email }),
      }))),
    h('div', { className: 'bt-account-acts' },
      h('button', {
        type: 'button', className: 'bt-soft', disabled: true, title: t('Signing in is not available yet'),
      }, t('Sign out')),
      h('button', {
        type: 'button', className: 'bt-set-row bt-bs-row bt-bs-danger', disabled: true,
        title: t('Signing in is not available yet'),
      }, h('span', { className: 'bt-bs-label' }, t('Delete account')))))
}

// The card's own look. The rows on the page are 我的 -> Bot settings' own (bot-settings.js), so only
// the card and the face above the fields are declared here.
export const ACCOUNT_CSS = `
html[data-bt-mobile] .bt-account-card{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;margin:0 0 14px;padding:10px 12px;border:1px solid var(--bt-line);border-radius:16px;background:var(--bt-card);color:var(--bt-ink);font:inherit;text-align:left;cursor:pointer;box-sizing:border-box}

@media (hover:hover){
html[data-bt-mobile] .bt-account-card:hover{background:var(--bt-hover)}
}
html[data-bt-mobile] .bt-account-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
html[data-bt-mobile] .bt-account-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;line-height:21px}
html[data-bt-mobile] .bt-account-detail{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;color:var(--bt-ink-3)}
html[data-bt-mobile] .bt-account-go{flex:none;margin-left:auto;display:inline-flex;align-items:center;color:var(--bt-ink-3)}
.bt-account-head{display:flex;justify-content:center;padding:4px 0 18px}
.bt-account-acts{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.bt-account-acts>.bt-soft{align-self:center;min-width:180px;text-align:center}
.bt-account-acts>.bt-soft:disabled{opacity:.4;cursor:default}
.bt-account-acts>.bt-bs-danger{justify-content:center}
.bt-account-acts>.bt-bs-danger:disabled{opacity:.4;cursor:default}
`
