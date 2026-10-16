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

test('the list keeps the message cards, and changes only their second line', () => {
  assert.ok(list.includes('export function DeliveredList({ actions, onClose })'), 'the panel is one component')
  assert.ok(list.includes('const answer = await ask.current?.listDelivered?.()'), 'it reads through the host action')
  // The very cards a message ends with, so a later edit cannot grow a second row design; the
  // exits are the card's own one "···" here as well, so there is no shape to ask for.
  assert.ok(list.includes('h(DeliverableCards, { deliverables: rows, actions, list: true, metaOf })'), 'the list is the shared card list')
  assert.ok(list.includes('const rows = [{ files: files.map(entry => ({ path: entry.path, at: entry.at })) }]'), 'fed the host’s rows')
  assert.ok(!list.includes('menu: list,') && !list.includes('menu ='), 'and asks for no shape of its own')
  assert.ok(!list.includes("className: 'bt-prod-row'"), 'and there is no row of its own')
  assert.ok(!preview.includes('.bt-prod-row'), 'nor a row style of its own')
  assert.ok(!list.includes('const open = (file) =>'), 'the panel no longer opens files itself')
  // The second line is the one thing the panel changes: a message says what the file is, the
  // list names its kind, how big it is and which workspace it came from, naming the workspace
  // rather than spelling its absolute path out.
  assert.ok(list.includes('const metaOf = (file) => {'), 'the list’s line is its own shape')
  assert.ok(list.includes("const parts = [wordFor(file.path)]"), 'it opens with the kind')
  assert.ok(list.includes('if (Number.isFinite(size)) parts.push(fileSizeText(size))'), 'the size joins it when the read answers')
  assert.ok(list.includes('parts.push(workspaceOf(file.path))'), 'and the workspace closes it')
  assert.ok(list.includes("return parts.join(' · ')"), 'joined the reference way')
  assert.ok(list.includes("const wordFor = (path) => t(TYPE_WORDS[fileExtension(basename(path))] ?? 'File')"), 'the kind is a translated word, not the extension')
  assert.ok(list.includes("import { fileExtension, fileSizeText, ImageLightbox, Menu }"), 'and the size is the platform’s own formatter')
  assert.ok(list.includes('meta: metaOf?.(file)'), 'and the card is handed it')
  // The size is the host's, and this client's only read of a delivered file is the one the
  // preview opens with -- so no new host action, and no restart to see the line.
  assert.ok(list.includes('answer = await ask.current?.presentFile?.(entry.path)'), 'one read per row, through the preview’s own read')
  assert.ok(list.includes('sizesOf.set(entry.path, Number.isFinite(answer?.size) ? answer.size : null)'), 'the answer is kept, a refusal included')
  assert.ok(list.includes('if (sizesOf.has(entry.path)) continue'), 'so a path is asked once')
  assert.ok(!list.includes('folderOf') && !list.includes('atText'), 'the time and the path left the line')
  // The workspace is named, never drawn as the path it came from: a reader cannot act on
  // /data/user/0/..., which is exactly what the user rejected in the second line.
  const line = list.slice(list.indexOf('const WORKSPACES = ['))
  assert.ok(!line.includes('/data/user/0') && !line.includes('/data/data'), 'and no absolute path is written anywhere in the line')
  assert.ok(preview.includes('.bt-products .bt-dcards{'), 'the panel gives the shared cards their width')
  // The rows of a stack sit closer than the rows of the message's two-column grid: the
  // reference list the user pointed at reads as a stack of tiles, not as a grid.
  assert.ok(preview.includes(".bt-products .bt-dcards{margin-left:0;grid-template-columns:minmax(0,1fr);gap:6px;padding:0 2px 6px}"), 'and a tighter row gap than the grid')
})

test('an empty list and a list that cannot be read each say so, in the reader’s language', () => {
  assert.ok(list.includes("t('No deliverables yet')"), 'the empty state is written')
  assert.ok(list.includes("t('This list could not be read')"), 'and so is a failed read')
  // The list is not backfilled, so a short one is the truth rather than a bug: it says so.
  // That it is not backfilled is a line under the page's own name (the user asked the separate row
  // above the list away): the head takes a `hint`, and the sheet's CSS stacks the two lines.
  assert.ok(list.includes("hint: t('Only files delivered since this run started are listed.')"), 'the head carries the line')
  assert.ok(list.includes("hint ? h('span', { className: 'bt-preview-hint' }, hint) : null"), 'drawn under the name')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-head{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;height:auto;min-height:56px;padding:0 12px}'), 'the sheet\'s title row stacks them, from the same left edge')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-head .bt-preview-hint{font-size:12px;line-height:16px;color:var(--bt-ink-3)}'), 'in the second level\'s own small type')
  assert.ok(!list.includes('bt-prod-note') && !preview.includes('.bt-prod-note{'), 'and the row of its own is gone, not kept in two places')
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
  assert.ok(list.includes("h(PreviewHead, { name: t('All deliverables'), onClose, close: mobile, hint: t('Only files delivered since this run started are listed.') })"), 'with the same title bar component as the preview page')
  assert.ok(list.includes('function PreviewHead({ name, onClose, children, close = false, hint })'), 'one title bar definition, shared by both pages')
  const previewUses = list.split('h(PreviewHead, ').length - 1
  assert.equal(previewUses, 2, 'and both pages use it')
})

test('on a phone the list slides up from the foot: full width, rounded top, a handle and a scrim', () => {
  // The sheet's own shape: the width of the screen, glued to the foot, as tall as its list asks
  // for up to 85% of the viewport -- and a sliding entrance rather than the column's fade.
  // The selector carries one attribute more than the phone width bands in styles.js
  // (html[data-bt-mobile][data-bt-size=medium] .bt-panel{…width:70vw!important}): a tie there goes to
  // whichever sheet is injected last, and that one is -- measured -- so the weight is load-bearing.
  const sheet = 'html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-panel[data-view=products]'
  assert.ok(pane.includes(`${sheet}{top:auto;bottom:0;left:0!important;right:0!important;width:100%!important;height:auto;max-height:85vh;`), 'full width, at the foot, 85% at most, beating the 70vw band by weight')
  assert.ok(pane.includes(`${sheet}[data-leaving]{`), 'and the exit reads from the same selector')
  assert.ok(!pane.includes('\nhtml[data-bt-mobile] .bt-panel[data-view=products]{'), 'never spelled without it')
  assert.ok(pane.includes('border-radius:18px 18px 0 0'), 'with the two top corners rounded')
  assert.ok(pane.includes('animation:bt-sheet-in .26s cubic-bezier(.2,0,0,1)'), 'sliding up from below')
  assert.ok(pane.includes('@keyframes bt-sheet-in{from{transform:translateY(100%)}to{transform:none}}'), 'the entrance')
  assert.ok(pane.includes('@keyframes bt-sheet-out{from{transform:none}to{transform:translateY(100%)}}'), 'and the exit, which a leaving sheet takes')
  assert.ok(pane.includes(`${sheet}[data-leaving]{animation:bt-sheet-out`), 'on the way out too')
  // A handle says where it came from; the scrim above it dismisses it, and only a phone draws one.
  assert.ok(pane.includes("view === 'products'\n      ? h('div', {"), 'the handle is drawn only for this view')
  assert.ok(pane.includes("view === 'products' ? h('div', { className: 'bt-scrim bt-panel-scrim', onClick: () => actions.closeProducts?.() }) : null"), 'the scrim closes it, and it is the skin\'s own scrim class')
  assert.ok(pane.includes('.bt-panel-scrim{display:none}'), 'a desktop column gets no backdrop')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-panel-scrim{display:block;position:fixed;inset:0;z-index:95}'), 'the phone places one under the sheet (96), and its colour is not declared twice')
  assert.ok(!pane.includes('.bt-panel-scrim{display:none}\nhtml[data-bt-mobile] .bt-panel-scrim{display:block;position:fixed;inset:0;z-index:95;background:'), 'which means no second copy of the scrim\'s colour')
  assert.ok(pane.includes('.bt-sheet-handle{width:36px;height:4px;border-radius:999px;background:var(--bt-line-2)}'), 'the handle is a small pill, centred in the band above it')
  // The head is the sheet's: name from the edge, close at the other end.
  assert.ok(list.includes('const mobile = useMobile()'), 'the list knows the band through the shared hook')
  assert.ok(list.includes("close ? 'bt-preview-head bt-sheet-head' : 'bt-preview-head'"), 'and asks the head for its sheet form')
  assert.ok(list.includes('close ? null : children'), 'where the name stands alone -- the way out is the corner button')
  // The corner button: 44px of finger at the sheet's top right, on the handle's own row, and it
  // never starts the drag it sits in.
  assert.ok(pane.includes("className: 'bt-sheet-close', 'aria-label': t('Close'), title: t('Close'),"), 'the close is a button of its own')
  assert.ok(pane.includes('onPointerDown: (event) => event.stopPropagation(),'), 'which does not begin a drag')
  assert.ok(pane.includes("onClick: () => actions.closeProducts?.(),") && pane.includes("}, h(CloseIcon)))"), 'and it closes the sheet')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-close{display:inline-flex;position:absolute;right:2px;top:50%;transform:translateY(-50%);'), 'pinned to the right corner of that row')
  assert.ok(pane.includes('.bt-sheet-close{display:none}'), 'while a desktop column keeps its back arrow')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-head .bt-preview-back{display:none}'), 'the sheet\'s title row draws the name alone')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-head .bt-preview-name{position:static;transform:none;flex:none;min-width:0;text-align:left;font-size:15px;line-height:21px}'), 'the name reads from the edge there')
  // The handle drags the sheet's height: 44px of band over a 4px pill, a floor and a ceiling, a
  // close when the drag goes well past the floor, and nothing remembered between openings.
  assert.ok(pane.includes("className: 'bt-sheet-grip', role: 'separator', 'aria-orientation': 'horizontal'"), 'the band is the separator a thumb grabs')
  assert.ok(pane.includes("h('span', { className: 'bt-sheet-handle', 'aria-hidden': true })"), 'with the thin pill inside it')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-grip{position:relative;flex:none;display:flex;align-items:center;justify-content:center;height:44px;touch-action:none;cursor:grab}'), '44 tall, positioned for the corner close, and the gesture is the handle\'s (touch-action)')
  assert.ok(pane.includes('html[data-bt-mobile] .bt-sheet-handle{width:36px;height:4px;'), 'the pill itself stays 36x4')
  assert.ok(pane.includes('onPointerDown: startSheetDrag'), 'the band starts the drag')
  assert.ok(pane.includes('const SHEET_MIN_VH = 30') && pane.includes('const SHEET_MAX_VH = 85'), 'between 30% and 85% of the window')
  assert.ok(pane.includes('panel.style.height = `${Math.min(Math.max(wanted, min), max)}px`'), 'and it lands clamped')
  assert.ok(pane.includes('if (wanted < min - SHEET_CLOSE_SLACK) { actions.closeProducts?.(); return }'), 'a drag well past the floor closes it, like the scrim')
  assert.ok(pane.includes("if (!moved) return"), 'a tap on the handle changes nothing at all')
  assert.ok(pane.includes("panel.dataset.draggingSheet = ''") && pane.includes('.bt-panel[data-dragging-sheet]{animation:none;transition:none}'), 'the sheet follows the finger with nothing easing behind it')
  assert.ok(!pane.slice(pane.indexOf('const startSheetDrag'), pane.indexOf('const startResize')).includes('localStorage'), 'and no height is remembered between openings')
  // The sheet must load on a phone that has no desktop browser shell: BROWSER_CSS is installed only
  // when a webview bridge exists (index.js), so the sheet lives in a block of its own, installed
  // beside the unconditional ones. Measured: with it inside BROWSER_CSS the panel stayed the centred
  // 70vw card on this device -- those rules were never injected at all.
  assert.ok(pane.includes('export const PANEL_SHEET_CSS = `'), 'the sheet is a block of its own')
  assert.ok(index.includes("import { BROWSER_CSS, PANEL_SHEET_CSS } from './browser-pane.js'"), 'the installer takes it')
  assert.ok(index.includes("installCompiledStyles(PANEL_SHEET_CSS, 'panel-sheet'),"), 'and installs it')
  const at = index.indexOf("installCompiledStyles(PANEL_SHEET_CSS")
  const conditional = index.indexOf('browsers ? installCompiledStyles(BROWSER_CSS')
  assert.ok(at > 0 && conditional > at, 'before the conditional browser block, in the same list')
  assert.ok(!pane.slice(pane.indexOf('export const BROWSER_CSS')).includes('data-view=products'), 'with no copy left inside the conditional one')
  // Two more panel-common pieces a phone uses went the same way (measured: they were swallowed too).
  const sheetBlock = pane.slice(pane.indexOf('export const PANEL_SHEET_CSS'), pane.indexOf('export const BROWSER_CSS'))
  const conditionalBlock = pane.slice(pane.indexOf('export const BROWSER_CSS'))
  for (const rule of ['.bt-panel-view{flex:1;min-height:0;display:flex;flex-direction:column;animation:bt-panel-view-in .22s cubic-bezier(.16,1,.3,1)}', '@keyframes bt-panel-view-in{from{opacity:0}}', '.bt-panel[data-settling]{overflow:hidden}']) {
    assert.ok(sheetBlock.includes(rule), `the sheet block carries ${rule.slice(0, 24)}`)
    assert.ok(!conditionalBlock.includes(rule), `and the conditional one no longer does`)
  }
  // The ghost column is the pc layout's, and stays with the browser.
  assert.ok(conditionalBlock.includes('.bt-panel-ghost{position:absolute;top:44px;'), 'the ghost column stays behind the bridge')
  // Nothing invented behind a batch-action bar: the reference has one, this skin has no such command.
  assert.ok(!list.includes('批量操作') && !list.includes('Batch actions'), 'no empty action bar')
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

test('the second line names the workspace the file came out of, not its path', () => {
  const table = list.slice(list.indexOf('const WORKSPACES = ['), list.indexOf('const workspaceOf'))
  assert.ok(table.includes("['.dsh/bot/workspace', 'DSH workspace']"), 'a Bot’s own working folder is named')
  assert.ok(table.includes("['repos/dsh-bot/ds-bot', 'DSBot']") && table.includes("['repos/dsh-bot', 'DSBot']"), 'the team’s repo is named, longest root first so it wins')
  assert.ok(table.indexOf("'repos/dsh-bot/ds-bot'") < table.indexOf("['repos/dsh-bot', 'DSBot']"), 'the more specific root is tried first')
  assert.ok(list.includes('if (path.includes(`${root}/`)) return t(name)'), 'a root is matched on its tail, so one machine’s two path spellings answer the same')
  assert.ok(list.includes("return folder === '' ? t('Workspace') : folder"), 'and a file from anywhere else falls back to the folder it sits in')
  assert.ok(list.includes("const at = path.lastIndexOf('/')") && list.includes('basename(path.slice(0, at))'), 'which is the folder above the file, not the whole path')
  // Every name the table can print has a translation, the fallback included.
  for (const name of ['DSH workspace', 'DSBot', 'Workspace']) {
    assert.ok(i18n.includes(`'${name}':`) || i18n.includes(`\n  ${name}:`), `${name} has a translation`)
  }
  assert.ok(i18n.includes("'DSH workspace': 'DSH 工作区'"), 'the default workspace reads in Chinese')
})

test('a leaving panel is inert, so a browser can both hide it and let its focus go', () => {
  // The tap that closes a preview leaves the focus on a button inside the panel. `aria-hidden`
  // is refused on a subtree that still holds the focus ("Blocked aria-hidden on an element
  // because its descendant retained focus"), which leaves the panel announced and the focus on
  // a control on its way out. `inert` is what the browser asks for instead: hidden, no focus.
  assert.ok(pane.includes("inert: leaving ? '' : undefined"), 'the panel goes inert while it leaves')
  assert.ok(!pane.includes("'aria-hidden': leaving"), 'and nothing hides it with aria-hidden while it holds the focus')
})
