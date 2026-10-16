// The account the user keeps for themselves (account-store.js, account.js): a name, a phone number
// and an email held on this device, with no account system behind them. The record and its storage
// are checked by running them against a fake storage; the two surfaces are checked as source, the way
// the other client sheets are -- there is no DOM here.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DICTIONARY } from '../src/client/i18n.js'
import { EMPTY_ACCOUNT, loadAccount, saveAccount } from '../src/client/account-store.js'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const code = (name) => read(name).split('\n').filter(line => !line.trim().startsWith('//')).join('\n')

const fakeStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('a profile survives a save and a read, under this skin\'s own key', () => {
  const storage = fakeStorage()
  saveAccount({ name: '李猛', phone: '+86 15800007644', email: 'li@example.com' }, storage)
  const saved = storage.values.get('ds-bot:account')
  assert.ok(saved, 'stored under the key the rest of the skin uses')
  assert.deepEqual(loadAccount(storage), { name: '李猛', phone: '+86 15800007644', email: 'li@example.com' }, 'and read back whole')
})

test('what cannot be read answers the empty profile, never a throw', () => {
  assert.deepEqual(loadAccount(fakeStorage()), EMPTY_ACCOUNT, 'nothing stored yet')
  assert.deepEqual(loadAccount(undefined), EMPTY_ACCOUNT, 'no storage at all')
  assert.deepEqual(loadAccount(fakeStorage({ 'ds-bot:account': '{not json' })), EMPTY_ACCOUNT, 'a damaged value')
  assert.deepEqual(loadAccount(fakeStorage({ 'ds-bot:account': '"a string"' })), EMPTY_ACCOUNT, 'a value of the wrong shape')
  assert.deepEqual(loadAccount(fakeStorage({ 'ds-bot:account': 'null' })), EMPTY_ACCOUNT, 'and an empty one')
  assert.deepEqual(loadAccount(fakeStorage({ 'ds-bot:account': '{"name":"李"}' })), { name: '李', phone: '', email: '' }, 'a field that was never set reads as empty, not undefined')
  // A storage that refuses to answer is the same story.
  const broken = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
  assert.deepEqual(loadAccount(broken), EMPTY_ACCOUNT, 'a storage that throws on read')
  assert.doesNotThrow(() => saveAccount({ name: 'x' }, broken), 'and one that throws on write')
})

test('我的 carries the card, and the page behind it edits and keeps the values', () => {
  const page = code('settings.js')
  const card = code('account.js')
  // The card sits at the top of the phone's own list -- which is what 我的 is there -- and opens the
  // account page: a page of Settings, opened the way any other is, so the back arrow lands on the
  // list it came from.
  assert.ok(page.includes("mobile ? h(AccountCard, { account, onOpen: () => actions.openSettings('account') }) : null"), 'the card is the phone list\'s first child')
  assert.ok(page.includes("['account', 'Account settings']"), 'and the page it opens is a page the dialog knows')
  assert.ok(!page.includes("['Team', ['bots', 'groups', 'account']]"), 'with no row of its own in the list')
  assert.ok(page.includes("shown === 'account' ? h(AccountPage, { account, onChange: updateAccount }) : null"), 'the page itself is drawn among the others')
  // Reading and keeping: one state, saved on every change, under this skin's key (account-store.js).
  assert.ok(page.includes('const [account, setAccount] = useState(() => loadAccount())'), 'read once, when the layer opens')
  assert.ok(page.includes('saveAccount(next)'), 'and written on every change')
  assert.ok(code('account-store.js').includes('STORAGE.account'), 'through the store\'s own key')
  assert.ok(code('storage.js').includes("account: 'ds-bot:account'"), 'which carries this skin\'s prefix')
  // The three values are editable fields, not text: the same inline editor the Bot and group forms use.
  for (const field of ['name', 'phone', 'email']) {
    assert.ok(card.includes(`onSave: ${field} => onChange({ ${field} })`), `${field} is saved through the page's own handler`)
  }
  assert.equal([...card.matchAll(/h\(InlineText, \{/g)].length, 3, 'one field per value')
  // And the two controls that need an account: drawn, disabled, and saying why.
  assert.ok(card.includes("disabled: true, title: t('Signing in is not available yet')"), 'signing out waits for an account system')
  assert.ok(card.includes("type: 'button', className: 'bt-set-row bt-bs-row bt-bs-danger', disabled: true,"), 'and so does deleting one')
  assert.ok(!card.includes('fetch(') && !code('account-store.js').includes('fetch('), 'nothing is sent anywhere')
})

test('every word the account shows is in the dictionary', () => {
  for (const key of ['Account settings', 'Not signed in', 'Nickname', 'Phone', 'Email', 'Your name', 'Kept on this device.', 'Sign out', 'Delete account', 'Signing in is not available yet']) {
    assert.ok(Object.hasOwn(DICTIONARY.zh, key), `${key} has a Chinese string`)
  }
})
