// The phone's "all deliverables" panel: one entry in the more menu, one list, and a row
// that opens a file the way its card does. The list is the host's own record of what the
// team delivered, read through one action, and the panel is the one a preview opens in --
// so a phone gets it full screen with a title bar, and nothing about it is a second
// container. These are the parts a later edit could quietly drop.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const host = (name) => readFileSync(new URL(`../src/host/${name}`, import.meta.url), 'utf8')
const menu = read('context-menu.js')
const index = read('index.js')
const pane = read('browser-pane.js')
const overlays = read('overlays.js')
const list = read('deliverables.js')
const preview = read('file-preview.js')
const i18n = read('i18n.js')

test('the more menu offers the team’s deliverables, and the entry is translated', () => {
  assert.ok(menu.includes("[t('All deliverables'), FolderIcon, () => actions.openProducts()]"), 'the menu has the entry')
  assert.ok(menu.includes("import { GearIcon, PinIcon"), 'and it draws an icon like its neighbours')
  assert.ok(menu.includes('FolderIcon }'), 'the folder icon is the one it draws')
  assert.ok(i18n.includes("'All deliverables': '全部产物'"), 'the entry is translated')
  assert.ok(index.includes('actions.openProducts = '), 'the action behind it exists')
})

test('the list is read from the host, read-only, and the client has that one call', () => {
  assert.ok(index.includes("listDelivered: () => call('list-delivered')"), 'the client asks the host once')
  assert.ok(host('channel.js').includes("case 'list-delivered':"), 'the host answers that call')
  assert.ok(host('channel.js').includes('return ok({ files: rt.deliveredList() })'), 'with the delivered list')
  // The list is the same record the cards are answered from, newest first.
  assert.ok(host('files.js').includes('const deliveredList = () => [...delivered]'), 'the host builds it from the delivered map')
  assert.ok(host('files.js').includes('.sort((one, two) => two.at - one.at)'), 'newest first')
  assert.ok(host('files.js').includes('deliveredFile, deliveredList, shareDelivered'), 'and hands it to the channel')
})

test('a row opens its file the way its card does, and shows what it is', () => {
  assert.ok(list.includes('export function DeliveredList({ actions, onClose })'), 'the panel is one component')
  assert.ok(list.includes('const answer = await ask.current?.listDelivered?.()'), 'it reads through the host action')
  assert.ok(list.includes('if (isPicture(basename(file.path))) actions?.previewImage?.(file)'), 'a picture opens the image preview')
  assert.ok(list.includes('else actions?.previewFile?.(file)'), 'everything else opens the preview page')
  // Type icon, name, and when it arrived where it sits -- the row says what it is.
  assert.ok(list.includes('h(FileTypeIcon, { path: file.path, size: 18 })'), 'the row carries the file type icon')
  assert.ok(list.includes("h('span', { className: 'bt-prod-name' }, name)"), 'and the name')
  assert.ok(list.includes('const meta = [atText(file.at), folderOf(file.path)]'), 'and the time with the folder it sits in')
  assert.ok(list.includes('const folderOf = (path) => {') && list.includes('const atText = (at) => (Number.isFinite(at)'), 'both are defined once')
  assert.ok(preview.includes('.bt-prod-name{') && preview.includes('.bt-prod-meta{'), 'and styled where the panel’s other styles live')
})

test('an empty list and a list that cannot be read each say so, in the reader’s language', () => {
  assert.ok(list.includes("t('No deliverables yet')"), 'the empty state is written')
  assert.ok(list.includes("t('This list could not be read')"), 'and so is a failed read')
  // The list is not backfilled, so a short one is the truth rather than a bug: it says so.
  assert.ok(list.includes("h('div', { className: 'bt-prod-note' }, t('Only files delivered since this run started are listed.'))"), 'the list says it is not backfilled')
  assert.ok(preview.includes('.bt-prod-note{'), 'and that line is styled with the panel’s own rules')
  assert.ok(list.includes("if (!Array.isArray(answer?.files)) { setState('failed'); return }"), 'a shape the host did not send is not listed')
  assert.ok(i18n.includes("'No deliverables yet': '还没有产物'"), 'the empty state is translated')
  assert.ok(i18n.includes("'This list could not be read': '这份列表读不出来'"), 'and the failure')
  assert.ok(i18n.includes("'Only files delivered since this run started are listed.': '只显示本次启动以来交付过的文件。'"), 'and the note explains a short list in Chinese')
})

test('the panel is the one a preview opens in, title bar and all', () => {
  // No conversation behind it: the panel opens for the list the way it does for a preview.
  assert.ok(overlays.includes(": ui.products && ui.view === 'products' ? { id: '', view: 'products', renaming: false, tab: null } : null"),
    'the panel opens with no conversation selected')
  assert.ok(overlays.includes('[ui.details, ui.view, ui.renaming, ui.tab, ui.preview, ui.products]'), 'and follows the products flag')
  assert.ok(index.includes('products: false'), 'the flag starts off')
  assert.ok(index.includes("actions.openProducts = () => ui.set(state => ({ ...state, products: true, preview: null, lightbox: null, view: 'products', menu: null }))"), 'opening it sets the view and closes the menu')
  assert.ok(index.includes('actions.closeProducts = ()'), 'and it can be closed')
  // The panel draws the list as its own view, with the same title bar a preview has, and
  // without the tab strip that belongs to a conversation.
  assert.ok(pane.includes(": pane.view === 'products' ? 'products'"), 'the panel has the view')
  assert.ok(pane.includes("view !== 'preview' && view !== 'products'"), 'the strip is skipped for it')
  assert.ok(pane.includes("h(DeliveredList, { actions: panelActions, onClose: () => actions.closeProducts?.() })"), 'the list is what the panel renders')
  assert.ok(pane.includes('view === \'products\' ? t(\'All deliverables\')'), 'and it is labelled')
  assert.ok(list.includes('h(PreviewHead, { name: t(\'All deliverables\'), onClose })'), 'with the same title bar component as the preview page')
  assert.ok(list.includes('function PreviewHead({ name, onClose, children })'), 'one title bar definition, shared by both pages')
  const previewUses = list.split('h(PreviewHead, ').length - 1
  assert.equal(previewUses, 2, 'and both pages use it')
})
