// The phone's "all deliverables" panel: one entry in the more menu, one list the host
// answers, and -- since the list is drawn with the message cards themselves -- nothing of
// its own but a width and a second line. The panel is the one a preview opens in, so a
// phone gets it full screen with a title bar, and nothing about it is a second container.
// These are the parts a later edit could quietly drop.
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

test('the list keeps the message cards, and only gives them the panel’s shape', () => {
  assert.ok(list.includes('export function DeliveredList({ actions, onClose })'), 'the panel is one component')
  assert.ok(list.includes('const answer = await ask.current?.listDelivered?.()'), 'it reads through the host action')
  // The very cards a message ends with, so a later edit cannot grow a second row design.
  assert.ok(list.includes('h(DeliverableCards, { deliverables: rows, actions, list: true, metaOf })'), 'the list is the shared card list')
  assert.ok(list.includes('const rows = [{ files: files.map(entry => ({ path: entry.path, at: entry.at })) }]'), 'fed the host’s rows')
  // The shared card, in the shape a row of a stack wants: one control at its right end
  // rather than the message grid's two icons, which cost the name 92px of the row.
  assert.ok(list.includes('menu: list,'), 'the panel asks the card for its one-control shape')
  assert.ok(!list.includes("className: 'bt-prod-row'"), 'and there is no row of its own')
  assert.ok(!preview.includes('.bt-prod-row'), 'nor a row style of its own')
  assert.ok(!list.includes('const open = (file) =>'), 'the panel no longer opens files itself')
  // The second line is the one thing the panel changes: a message says what the file is,
  // the list names its kind and how big it is, the way the reference list does.
  assert.ok(list.includes('const metaOf = (file) => {'), 'the list’s line is its own shape')
  assert.ok(list.includes('return Number.isFinite(size) ? `${word} · ${fileSizeText(size)}` : word'), 'kind and size, joined the reference way')
  assert.ok(list.includes("const wordFor = (path) => t(TYPE_WORDS[fileExtension(basename(path))] ?? 'File')"), 'the kind is a translated word, not the extension')
  assert.ok(list.includes("import { FileTypeIcon, fileExtension, fileSizeText, ImageLightbox, Menu }"), 'and the size is the platform’s own formatter')
  assert.ok(list.includes('meta: metaOf?.(file)'), 'and the card is handed it')
  // The size is the host's, and this client's only read of a delivered file is the one the
  // preview opens with -- so no new host action, and no restart to see the line.
  assert.ok(list.includes('answer = await ask.current?.presentFile?.(entry.path)'), 'one read per row, through the preview’s own read')
  assert.ok(list.includes('sizesOf.set(entry.path, Number.isFinite(answer?.size) ? answer.size : null)'), 'the answer is kept, a refusal included')
  assert.ok(list.includes('if (sizesOf.has(entry.path)) continue'), 'so a path is asked once')
  assert.ok(!list.includes('folderOf') && !list.includes('atText'), 'the time and the path left the line')
  assert.ok(preview.includes('.bt-products .bt-dcards{'), 'the panel gives the shared cards their width')
  // The rows of a stack sit closer than the rows of the message's two-column grid: the
  // reference list the user pointed at reads as a stack of tiles, not as a grid.
  assert.ok(preview.includes(".bt-products .bt-dcards{margin-left:0;grid-template-columns:minmax(0,1fr);gap:6px;padding:0 2px 6px}"), 'and a tighter row gap than the grid')
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

test('every kind of file the list can name is translated', () => {
  const block = list.slice(list.indexOf('const TYPE_WORDS = {'), list.indexOf('const wordFor'))
  const words = [...new Set([...block.matchAll(/: '([^']+)'/g)].map(match => match[1]))]
  assert.ok(words.length >= 8, `the kinds are a real table (${words.length})`)
  for (const word of words) {
    assert.ok(i18n.includes(`'${word}':`) || i18n.includes(`\n  ${word}:`), `${word} has a translation`)
  }
  assert.ok(i18n.includes("'Markdown file': 'Markdown 文件'") && i18n.includes("Image: '图片'"), 'and the two the reference shows read the reference’s way')
})

test('a leaving panel is inert, so a browser can both hide it and let its focus go', () => {
  // The tap that closes a preview leaves the focus on a button inside the panel. `aria-hidden`
  // is refused on a subtree that still holds the focus ("Blocked aria-hidden on an element
  // because its descendant retained focus"), which leaves the panel announced and the focus on
  // a control on its way out. `inert` is what the browser asks for instead: hidden, no focus.
  assert.ok(pane.includes("inert: leaving ? '' : undefined"), 'the panel goes inert while it leaves')
  assert.ok(!pane.includes("'aria-hidden': leaving"), 'and nothing hides it with aria-hidden while it holds the focus')
})
