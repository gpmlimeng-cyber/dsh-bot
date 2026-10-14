// A delivered file shows as DSH's own card shape, not as a row of our own invention. DSH's
// PresentedFileCard (dsh-client-ui-deliverables lib/client.js) is a local function inside a
// plugin bundle, so it cannot be imported: the shape is copied instead, and these are the
// parts of it a later edit could quietly drop or retune --
//
//   a 60px tile in a two-column grid that folds to one column when the card column is
//   narrow, a 40px tile for the type icon, the name over its metadata (15/21 name,
//   12/17 metadata), one hit target covering the whole card, and the metadata line giving
//   way to the hint while the card is hovered or focused.
//
// Two things are ours and must survive the port: the copy-path button (the only thing a
// phone can actually do with a delivered file) and the sentence that tells the reader
// where the copy lives. The icon is DSH's own FileTypeIcon, so its glyph follows the file.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const styles = read('styles.js').split('\n')
const card = read('deliverables.js').split('\n')
const i18n = read('i18n.js')

const rule = (prefix) => {
  const found = styles.filter(line => line.startsWith(prefix))
  assert.equal(found.length, 1, `${prefix} is declared once, found ${found.length}`)
  return found[0]
}
// The preview page's own chrome is styled next to it in file-preview.js, not in styles.js.
const previewRule = (prefix) => {
  const found = read('file-preview.js').split('\n').filter(line => line.startsWith(prefix))
  assert.equal(found.length, 1, `${prefix} is declared once, found ${found.length}`)
  return found[0]
}

test('the tile is DSH-shaped: 60px tall, a 40px type tile, one hit target over it', () => {
  const tile = rule('.bt-dcard{')
  assert.ok(tile.includes('height:60px'), tile)
  assert.ok(tile.includes('border-radius:10px'), tile)
  const icon = rule('.bt-dcard-ico{')
  assert.ok(icon.includes('width:40px') && icon.includes('height:40px'), icon)
  const hit = rule('.bt-dcard-hit{')
  assert.ok(hit.includes('position:absolute') && hit.includes('inset:0'), hit)
  // The hit target is the only thing in the card that takes a pointer, so a tap on the
  // name or the icon lands on it.
  for (const prefix of ['.bt-dcard-ico{', '.bt-dcard-copy{']) assert.ok(rule(prefix).includes('pointer-events:none'), prefix)
  assert.ok(rule('.bt-dcard-acts{').includes('pointer-events:auto'))
})

test('the name and its metadata keep their two sizes, and nothing swaps places on hover', () => {
  // The sizes come from the delivery list the user pointed at: a step larger and heavier for
  // the name, a step down in the quiet grey under it, and the two lines tight together.
  assert.ok(rule('.bt-dcard-name{').includes('font-size:15px') && rule('.bt-dcard-name{').includes('line-height:21px'))
  assert.ok(rule('.bt-dcard-name{').includes('font-weight:600'), 'the name carries medium weight, not the plain 500')
  assert.ok(rule('.bt-dcard-desc{').includes('font-size:12px') && rule('.bt-dcard-desc{').includes('line-height:17px'))
  assert.ok(rule('.bt-dcard-copy{').includes('gap:1px'), 'and the second line sits tight under the first')
  // 21 + 1 + 17 = 39 of the tile's 44px of content room, so the tile is still 60px.
  assert.ok(rule('.bt-dcard{').includes('height:60px'), 'the tile does not grow with the type')
  // The type mark is sized against the exit icons rather than left at the platform's own
  // 28px default or the 20px it had: the platform's document glyph fills 24.8x28 of its own
  // 28-unit box, so 24px paints 21.2x24px of ink beside 23-31px of exit ink.
  assert.ok(card.join('\n').includes('h(FileTypeIcon, { path: file.path, size: 24 })'), 'the type mark is 24px')
  // The second line used to be replaced by the word "Preview" while the pointer was on the
  // card. The eye in the acts row says that now, so the line stays where it is.
  assert.ok(!styles.includes('.bt-dcard-peek'), 'the hover-only word is gone')
  assert.ok(!styles.includes('.bt-dcard:hover .bt-dcard-desc'), 'and the second line no longer gives way')
})

// The card's three exits are icons, not words: three word pills take more width than the
// card has to spare. The words stay in aria-label (a reader still hears them) and in the
// preview page's menu, and the target is the 44px the preview page's own controls take.
test('the card’s exits are three named icons, each a 44px target', () => {
  const source = card.join('\n')
  const btn = rule('.bt-dcard-btn{')
  assert.ok(btn.includes('width:44px') && btn.includes('height:44px'), 'a 44px touch target')
  // The drawing is what the eye judges -- a 44px target around a small glyph still reads as
  // a small button -- so the box is sized for the ink these glyphs paint out of their 20x20
  // box at the 2-unit stroke set here: at 36px the eye lands at 30.6x23.4, the arrow at
  // 27x27.9, the sheets at 25.2x25.2 and the tick at 23.4x18, which clears the 22px the
  // preview bar's own controls paint. The 44px control does not grow with it: the card is a
  // 60px tile with 8px of padding, so a 48px control would break the tile the user approved.
  const glyph = rule('.bt-dcard-btn svg{')
  assert.ok(glyph.includes('width:36px') && glyph.includes('height:36px'), 'and the glyph box is 36px')
  assert.ok(glyph.includes('stroke-width:2'), 'drawn at the 2-unit stroke the preview bar uses')
  assert.ok(rule('.bt-dcard-ico{').includes('width:40px'), 'the tile it matches stays 40px')
  assert.ok(rule('.bt-dcard-acts{').includes('flex-wrap:nowrap'), 'the three never wrap into a second row the 60px tile would clip')
  // The row is held at the card's right end, with the 4px gap it has always had: the gap is
  // not what makes the row read tight -- a 44px control around 23-31px of ink leaves the
  // glyphs 19-22px apart, and 2px of box space moves them by 4px across the whole row, which
  // the eye does not see. The ink is the lever, and it is pinned separately below.
  assert.ok(rule('.bt-dcard-acts{').includes('gap:4px'), 'the three keep their 4px gap')
  assert.ok(rule('.bt-dcard-acts{').includes('justify-content:flex-end'), 'and the row stays at the card’s right end')
  for (const [act, shape] of [['preview', '}, h(EyeIcon))'], ['open', '}, h(ExternalIcon))'], ['copy', "}, state === 'copied' ? h(CheckIcon) : h(CopyIcon)))"]]) {
    assert.ok(source.includes(`'data-act': '${act}'`), `the ${act} exit is marked`)
    assert.ok(source.includes(shape), `and draws its own icon (${act})`)
  }
  // Each button carries its own name -- the word pill used to be that name -- and none of
  // them repeats the file name, which the card itself already writes.
  assert.ok(source.includes("'aria-label': t('Preview'), title: t('Preview')"), 'the eye is named for what it does')
  assert.ok(source.includes("'aria-label': state === 'opening' ? t('Opening…') : t('Open with another app')"), 'the arrow is named for the other app')
  assert.ok(source.includes("'aria-label': state === 'copied' ? t('Copied') : t('Copy path')"), 'the copy icon is named for the path')
  assert.equal(source.split("`${t('Preview')} ${name}`").length - 1, 1, 'only the card-wide hit target repeats the file name')
  // No word is left painted on a button: the label that used to be its child would be one.
  for (const painted of [": t('Open with another app'))", ": t('Copy path'))", "t('Path')"]) {
    assert.ok(!source.includes(painted), `${painted} is no longer painted on a card button`)
  }
})

test('two columns fold to one when the card column is narrow', () => {
  const grid = rule('.bt-dcards{')
  assert.ok(grid.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), grid)
  assert.ok(grid.includes('container-type:inline-size'), grid)
  assert.ok(styles.includes('@container (width<=620px){.bt-dcards{grid-template-columns:minmax(0,1fr)}}'))
})

test('the icon is DSH’s FileTypeIcon, sized against the row it sits in', () => {
  assert.ok(card.some(line => line.includes("import { FileTypeIcon, fileExtension, fileSizeText, ImageLightbox, Menu } from '@deepseek-ai/dsh-client-ui-primitives'")), 'the card imports the host icon, the host image preview, the host size format and the host menu')
  // 24px, not the platform's 28px default and not the 20px it had: the document glyph fills
  // 24.8x28 of its own box, so 24px paints 21.2x24px beside the 23-31px the exits paint.
  assert.ok(card.some(line => line.includes('h(FileTypeIcon, { path: file.path, size: 24 })')), 'the icon follows the file path, at the row’s size')
  assert.ok(!card.some(line => line.includes('PaperclipIcon')), 'the placeholder paperclip is gone')
})

test('the metadata reads description, then the extension, then the word for a file', () => {
  const source = card.join('\n')
  assert.ok(source.includes("replace(/\\s*(?:\\([^()]*\\)|（[^（）]*）)\\s*$/u, '')"), 'a trailing parenthetical is dropped')
  assert.ok(source.includes('fileExtension(name).toUpperCase()'), 'the extension is the second answer')
  assert.ok(source.includes("return extension === '' ? t('File') : extension"), 'the third answer is the word for a file')
  assert.ok(i18n.includes("File: '文件'"), 'the word for a file is translated')
})

test('a phone keeps its way out: the copy-path button and the sentence about the copy', () => {
  const source = card.join('\n')
  assert.ok(source.includes("t('Copy path')"), 'the copy-path button survives')
  assert.ok(source.includes('writeText(file.path)'), 'it copies the real path')
  // One sentence, written once: the exits row only reports a refusal, and the two hosts
  // that show it (the card, the preview page) write it through the same function.
  assert.ok(source.includes('export const exitsSentence = (shared) =>'), 'the sentence has one definition')
  assert.equal(source.split("exitsSentence(failure.shared)").length - 1, 2, 'both hosts write it through that definition')
  assert.ok(source.includes("h('span', { className: 'bt-dcard-hint', role: 'status' }, exitsSentence(failure.shared))"), 'the fallback is announced')
  assert.ok(!/state === 'failed'[\s\S]{0,40}h\('span'/.test(source), 'the exits row reports instead of writing the sentence itself')
  assert.ok(source.includes("failed(shared)") && source.includes('onFailed?.({ shared: next })'), 'a refusal carries the copy that was made, when one was')
  assert.ok(source.includes('PHONE_COPY_HINT'), 'the fallback names the folder the phone can reach')
  assert.ok(rule('.bt-dcard-hint{').includes('word-break:break-all'), 'the sentence wraps instead of scrolling sideways')
  // The tile is a fixed 60px and clips, so its sentence is written under it, by the
  // wrapper -- not inside the tile, where it would be cut off.
  assert.ok(source.includes("h('div', { className: 'bt-dcard-wrap', role },"), 'the tile sits in a wrapper that can hold a line under it')
  const actsAt = source.indexOf("h('span', { className: 'bt-dcard-acts' }")
  const hintAt = source.indexOf('exitsSentence(failure.shared)')
  assert.ok(actsAt !== -1 && hintAt > actsAt, 'and the sentence is written after the tile’s own row')
  assert.ok(rule('.bt-dcard{').includes('overflow:hidden'), 'the tile still clips')
  assert.ok(rule('.bt-dcard-wrap{').includes('flex-direction:column'), 'so the wrapper stacks the sentence under it')
})

// A delivered file opens where a file belongs, never inside the message it arrived in:
// a picture in the platform's own image preview, anything readable in the panel's preview
// page. The page reads through the host action, which answers only for the paths a Bot
// handed over, and everything it cannot show keeps the two exits.
test('a tap opens the file where it belongs, and only what can be shown', () => {
  const source = card.join('\n')
  // A picture goes to the platform's own preview; anything else to the preview page.
  assert.ok(source.includes('if (isPicture(name)) actions?.previewImage?.(file)'), 'a picture takes the image preview')
  assert.ok(source.includes('else actions?.previewFile?.(file)'), 'everything else takes the preview page')
  assert.ok(source.includes('const PICTURE_NAME = /\\.(?:png|jpe?g|gif|webp|avif|bmp|ico|svg)$/iu'), 'the picture names cover the formats a phone shows, svg included')
  // One read, through the host, for both pages.
  assert.ok(source.includes('const answer = await ask.current?.presentFile?.(file.path)'), 'the preview page reads through the host action')
  assert.ok(source.includes("answer?.ok === true && (answer.kind === 'html' || answer.kind === 'image' || answer.kind === 'text' || answer.kind === 'markdown')"), 'a binary or an unreadable file is not shown')
  // The standard image preview is DSH's own component, opened with the same labels DSH
  // uses; it is not a second image viewer of ours.
  assert.ok(source.includes('h(ImageLightbox, {'), 'the picture opens the platform’s lightbox')
  assert.ok(source.includes("labels: { dialog: t('Image preview'), close: t('Close preview') }"), 'its dialog and close control are named')
  assert.ok(i18n.includes("'Image preview': '图片预览'") && i18n.includes("'Close preview': '关闭预览'"), 'both are translated')
  // Text and Markdown go through the panel's own viewer rather than a second one drawn
  // here: one renderer means a delivered README looks the same in the preview page and in
  // the Files tab, and a fence or a heading is rendered instead of shown as its marks.
  assert.ok(source.includes('h(FileView, { file: source ? { ...read, kind: \'text\' } : read })'), 'text and Markdown are shown by the panel’s viewer')
  const panel = read('file-preview.js')
  assert.ok(panel.includes('export function FileView({ file })'), 'the viewer is the panel’s own')
  assert.ok(panel.includes('file ? h(FileView, { file }) : null'), 'the panel renders it with the same call')
  assert.ok(panel.includes("h(MarkdownText, { text: file.text ?? '', labels: mdLabels() })"), 'Markdown goes through DSH’s renderer')
  // Nothing is drawn inside the message any more: the old inline box is gone from both
  // the code and the stylesheet, so a long file can no longer push the chat around.
  assert.ok(!source.includes('bt-dcard-view'), 'the inline preview box is gone')
  assert.ok(!styles.some(line => line.startsWith('.bt-dcard-view')), 'and so is its style')
  assert.ok(!source.includes('Hide preview'), 'the card no longer toggles a preview in place')
  assert.ok(i18n.includes("Preview: '预览'"), 'the card’s own invitation is translated')
})

// A page and a file are two different things, and the page is the one that can do harm:
// it renders in a frame that may run no script and reach no network. Both the sandbox
// attribute and the policy are written out in full, since loosening either is a security
// change rather than a preference.
test('a delivered page renders sandboxed, with its policy spelled out', () => {
  const source = card.join('\n')
  assert.ok(source.includes("const FRAME_POLICY = \"default-src 'none'; style-src 'unsafe-inline'; img-src data:\""), 'the policy is the fixed one')
  assert.ok(source.includes('h(\'iframe\', { className: \'bt-preview-frame\', sandbox: \'\', srcDoc: frameDocument(read.text ?? \'\'), title: name })'), 'the frame is empty-sandboxed and fed the document')
  assert.ok(source.includes('frameDocument = (text) => `<!doctype html><meta http-equiv="Content-Security-Policy"'), 'the policy travels inside the document')
  // The toggle between the rendered page and its source is in the title bar, and only a
  // page has it.
  assert.ok(source.includes("read.kind === 'html' && !source"), 'only a page renders as a page')
  assert.ok(source.includes("state === 'shown' && read.kind === 'html'"), 'only a page offers the toggle')
  assert.ok(source.includes("source ? t('Preview') : t('Source')") && i18n.includes("Source: '源码'"), 'the toggle is labelled both ways')
  // The bytes still come from the host: the frame is fed text, no file:// and no blob.
  assert.ok(!source.includes('file://') && !source.includes('URL.createObjectURL'), 'nothing is loaded from the disk by the page itself')
})

// The preview lives in the plugin's own `ui` source, on the panel, and not in the state of
// the message cell that drew the card: a new message arriving in the conversation
// re-renders that reply, and a preview held there used to close itself.
test('a preview is held outside the message, so a new message cannot close it', () => {
  const index = read('index.js')
  assert.ok(index.includes('preview: null, lightbox: null, products: false'), 'the panel state carries the preview')
  assert.ok(index.includes("actions.previewFile = (file) => ui.set(state => ({ ...state, preview: file, lightbox: null, products: false, view: 'preview' }))"), 'opening the page sets it on the panel state')
  assert.ok(index.includes("actions.previewImage = (file) => ui.set(state => ({ ...state, lightbox: file, preview: null, products: false }))"), 'so does the image preview')
  assert.ok(index.includes('actions.closePreview = () =>'), 'and only an explicit close takes it away')
  assert.ok(read('overlays.js').includes('h(DeliveredLightbox, {'), 'the image preview is mounted by the overlay host, not by the card')
  assert.ok(read('browser-pane.js').includes("pane.view === 'preview' && pane.preview"), 'the panel draws the preview page')
  assert.ok(read('browser-pane.js').includes('h(DeliveredPreview, { file: pane.preview'), 'the page is handed the file the card opened')
  assert.ok(read('overlays.js').includes('preview: ui.preview'), 'the open panel carries it through a re-render')
})

test('the card is wired to the host action that answers for delivered files', () => {
  assert.ok(read('index.js').includes("presentFile: path => call('present-file', { path })"), 'the client exposes the action')
  assert.ok(read('cells.js').includes('h(DeliverableCards, { deliverables, actions })'), 'the group reply hands the card its actions')
})

// The third way out, for a phone: hand the file to another app. The shell exposes its own
// chooser (window.__dshOpenPath), which opens a shared-storage path with whichever app can
// read it -- and a delivered file is in the app's own storage, which other apps cannot
// read, so a copy goes out first. A desktop has no chooser and keeps the engine's opener.
test('the card hands a file to another app, and keeps the shell from taking the tap', () => {
  const source = card.join('\n')
  assert.ok(source.includes('const chooser = globalThis.__dshOpenPath'), 'the shell’s chooser is used when it is there')
  assert.ok(source.includes('await actions?.shareFile?.(file.path)'), 'a copy goes out for it first')
  assert.ok(source.includes("chooser(shared, 'view') === true"), 'the copy is what opens')
  assert.ok(source.includes("fetch(openUrl(file), { method: 'POST', credentials: 'same-origin' })"), 'a desktop keeps the engine’s opener')
  assert.ok(read('index.js').includes("shareFile: path => call('present-share', { path })"), 'the client exposes the copy-out action')
  assert.ok(i18n.includes("'Open with another app': '用其它应用打开'"), 'the button says what it does')
  assert.ok(source.includes("t('Could not open it here. The copy is at {path}', { path: shared })")
    && i18n.includes("'Could not open it here. The copy is at {path}'"), 'when no app takes the copy, the sentence names it')
  // The shell intercepts a click whose target’s title looks like a path and sends that
  // path to its own chooser. The hit target must therefore carry no title: with one, a tap
  // meant for the preview would leave the app for a chooser that cannot read the file.
  const start = card.findIndex(line => line.includes("className: 'bt-dcard-hit'"))
  const end = card.findIndex((line, index) => index > start && line.includes('onClick: preview'))
  assert.ok(start !== -1 && end > start, 'the hit target is still one button')
  assert.ok(!card.slice(start, end + 1).join('\n').includes('title:'), 'the hit target carries no title for the shell to read')
})

// The preview page's title bar is three parts: back on the left, the name centred over
// the bar, and one "···" menu on the right -- the two exits live in that menu, so the
// bar stays three parts and a page's source toggle joins them instead of crowding it.
test('the preview page’s title bar is back, the name, and one more menu', () => {
  const source = card.join('\n')
  assert.ok(source.includes("h('button', { type: 'button', className: 'bt-preview-back', onClick: onClose, 'aria-label': t('Back'), title: t('Back') }, h(ChevronLeftIcon))"), 'the left control is a back button, named for a reader')
  assert.ok(source.includes("h('span', { className: 'bt-preview-name' }, name)"), 'the name is the middle part')
  assert.ok(source.includes('import { CheckIcon, ChevronLeftIcon, CopyIcon, DotsBoldIcon, ExternalIcon, EyeIcon, SwitchIcon }'), 'a back arrow, the menu’s own icons and the card’s three are imported')
  // The "···" draws the filled dots: the hairline ones paint 1.5-unit dots that land at
  // 2.6px in the 48px control, which is why it looked empty. The 34px box matches the rule
  // in file-preview.js that sizes it, so the two never drift apart.
  assert.ok(source.includes('}, h(DotsBoldIcon, { size: 34 })),'), 'the menu’s anchor draws the filled dots')
  // The menu is the platform’s own component and carries both exits, which are the same
  // behaviour the card’s row of buttons runs: one definition, two chromes.
  assert.ok(source.includes("import { FileTypeIcon, fileExtension, fileSizeText, ImageLightbox, Menu }"), 'the menu is the platform’s, not one of ours')
  assert.ok(source.includes('export function useDeliverableExits(file, actions, onFailed)'), 'the exits are defined once')
  assert.equal(source.split('useDeliverableExits(file, actions, onFailed)').length - 1, 3, 'and used by both chromes')
  assert.ok(source.includes("h(Menu, {"), 'the page’s exits are a menu')
  assert.ok(source.includes("align: 'end'"), 'aligned to the bar’s end')
  assert.ok(source.includes("{ id: 'open', icon: h(SwitchIcon), label: state === 'opening' ? t('Opening…') : t('Open with another app') }"), 'the first item opens in another app')
  assert.ok(source.includes("{ id: 'copy', icon: state === 'copied' ? h(CheckIcon) : h(CopyIcon), label: state === 'copied' ? t('Copied') : t('Copy path') }"), 'the second copies the path')
  assert.ok(source.includes("'aria-label': t('More'), title: t('More')"), 'the menu button is named')
  assert.ok(i18n.includes("Back: '后退'") && i18n.includes("More: '更多'"), 'both names are translated')
  // A page’s source toggle rides in the same menu rather than in the bar.
  assert.ok(source.includes("const toggle = state === 'shown' && read.kind === 'html' ? { id: 'source', label: source ? t('Preview') : t('Source') } : null"), 'a page offers its source in the menu')
  assert.ok(!source.includes('bt-preview-toggle'), 'the old bar toggle is gone')
  assert.ok(!read('file-preview.js').includes('.bt-preview-toggle'), 'and so is its style')
  // The bar itself: the name centred over the bar, the menu pushed to its end.
  assert.ok(previewRule('.bt-preview-name{').includes('position:absolute'), 'the name is centred over the bar')
  assert.ok(previewRule('.bt-preview-name{').includes('text-overflow:ellipsis'), 'and gives way with an ellipsis')
  assert.ok(previewRule('.bt-preview-menu{').includes('margin-left:auto'), 'the menu sits at the end')
})

// The platform’s own preview returns focus to what opened it and already skips a node
// that left the document. A card can still be redrawn while the picture is up, so the
// page takes the focus back to the same card when it is there, and never steals a focus
// the platform did restore.
test('a lost focus goes back to the same card, and a restored one is left alone', () => {
  const source = card.join('\n')
  assert.ok(source.includes('if (active !== null && active !== document.body) return'), 'only a focus that was lost is taken back')
  assert.ok(source.includes("const again = [...document.querySelectorAll('.bt-dcard-hit')]"), 'the same card is looked up again')
  assert.ok(source.includes("(node.getAttribute('aria-label') ?? '').endsWith(` ${name}`)"), 'by the name it announces')
  assert.ok(source.includes('if (again instanceof HTMLElement) again.focus()'), 'and takes the focus when it is really there')
})

// A turn that handed files over ends with the cards of that turn, in every conversation.
// A group reply draws its own under the reply that carried them, so the turn tail covers
// the rest. The per-turn record read here is the same one DSH's own delivery card reads,
// which is what keeps the list to this turn's files instead of every file ever delivered.
test('a turn that delivered files ends with the cards, in every conversation', () => {
  const cells = read('cells.js')
  assert.ok(cells.includes('export function TurnTailCell({ turn: location, sessionId, useTurnClock, useUi, actions })'), 'the turn tail is where they hang')
  assert.ok(cells.includes("const presented = location?.data?.get?.('deliverables')?.presented"), 'the per-turn record is read off the turn itself')
  assert.ok(cells.includes('h(DeliverableCards, { deliverables: delivered, actions })'), 'and drawn with the one card list, actions and all')
  assert.ok(cells.includes('if (!label && !fresh && delivered.length === 0) return null'), 'a turn with neither a gap nor a delivery draws nothing')
  assert.ok(cells.includes('bySequence.get(seq).push({ path: file.path, description: file.description, index: file.index })'), 'each file keeps the index the engine opens it by')
  // Two surfaces drawing from the same record would show two sets of cards, so the
  // platform's own block stands down -- its "files changed" card is another module.
  assert.ok(styles.some(line => line.includes('[class*="_root"]:has(>[data-presented-files-row])')), 'the platform’s delivery cards stand down')
  assert.ok(!styles.some(line => line.includes('P4kPIW') && line.includes('display:none')), 'and the files-changed card is left alone')
  // The tail is not a message cell: the cards take the full width, not the avatar indent.
  assert.ok(styles.some(line => line.includes('[data-turn-tail] .bt-dcards{margin-left:0;')), 'the turn tail’s cards are not indented')
})

// The panel's list and a message's list are the same card, so a later edit cannot give
// the panel a row of its own again.
test('the message cards and the panel’s list are one component', () => {
  const source = card.join('\n')
  assert.ok(source.includes('export function DeliverableCards({ deliverables, actions, metaOf = null, list = false })'), 'one card list, two callers')
  assert.ok(source.includes("h('div', { className: 'bt-dcards', role: list ? 'list' : undefined },"), 'and the panel’s list still announces itself')
  assert.ok(source.includes('meta: metaOf?.(file)'), 'the second line is the caller’s')
  assert.ok(source.includes('index: Number.isInteger(file?.index) ? file.index : position'), 'a file that carries coordinates keeps them')
  assert.ok(!source.includes('bt-prod-row'), 'no second row shape survives')
})

// The preview page's title bar takes the drawer's own title size, and grows from there: the
// controls are a 48px touch target -- a finger's, not the drawer's 36px one -- and the bar is
// 56px, so the control keeps 4px at either end. What the eye judges is the drawing, and the
// icons paint only part of their own 20x20 box (the chevron 11 units, the filled dots 15), so
// the boxes are sized for the ink and the stroke is thickened to 2 -- a bigger hairline reads
// as small as the small one did: 36px paints a 23.4px chevron, 34px paints a 25.5px row of
// 6.8px dots. Each keeps a little over the 22px asked for, since a drawing sitting on the line
// rounds whichever way a device measures it. That 22px is the same ink the card's exits paint
// and the card's own 44px controls are left where they were: the tile is 60px with 8px of
// padding, so a 48px control would break it. Pinned here so a later edit cannot quietly shrink
// them back.
test('the title bar is 56px, its controls 48px, and their drawings 22px of ink', () => {
  assert.ok(styles.some(line => line.includes('.bt-drawer-name{font-size:17px;line-height:24px;')), 'the drawer names a Bot at 17/24')
  assert.ok(previewRule('.bt-preview-head{').includes('height:56px'), 'so the page’s bar is 56px')
  assert.ok(previewRule('.bt-preview-name{').includes('font-size:17px') && previewRule('.bt-preview-name{').includes('line-height:24px'), 'and its title is 17/24')
  for (const prefix of ['.bt-preview-back{', '.bt-preview-more{']) {
    assert.ok(previewRule(prefix).includes('width:48px') && previewRule(prefix).includes('height:48px'), `${prefix} is a 48px touch target`)
  }
  const back = previewRule('.bt-preview-back svg{')
  assert.ok(back.includes('width:36px') && back.includes('height:36px'), 'the chevron’s box is 36px, which paints its 13/20 as 23.4px')
  assert.ok(back.includes('stroke-width:2'), 'and it is stroked at 2, not the 1.6 the shared chevron keeps elsewhere')
  const dots = previewRule('.bt-preview-more svg{')
  assert.ok(dots.includes('width:34px') && dots.includes('height:34px'), 'the dots’ box is 34px, which paints their 15/20 as a 25.5px row')
  // The dots are judged as a diameter as well as a row: three marks of a hairline's weight are
  // what made this control look empty, so the arithmetic is tied to the glyph itself -- the
  // filled dots are 4 units across, and 4 units of a 34px box is 6.8px.
  assert.ok(read('icons.js').includes('cy: 10, r: 2 }'), 'the filled dots are 4 units across')
  assert.ok(4 * 34 / 20 >= 6, 'which lands over the 6px the bar asks for')
  assert.ok(!read('file-preview.js').includes('html[data-bt-pc] .bt-preview'), 'and no band gets a smaller control back')
  // The reserve for the centred name is the two controls, their padding and their gaps, so a
  // long name never slides under one.
  assert.ok(previewRule('.bt-preview-name{').includes('max-width:calc(100% - 136px)'), 'a long name never slides under a control')
})
