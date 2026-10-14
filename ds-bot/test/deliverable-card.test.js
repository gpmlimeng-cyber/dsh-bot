// A delivered file shows as DSH's own card shape, not as a row of our own invention. DSH's
// PresentedFileCard (dsh-client-ui-deliverables lib/client.js) is a local function inside a
// plugin bundle, so it cannot be imported: the shape is copied instead, and these are the
// parts of it a later edit could quietly drop or retune --
//
//   a 60px tile in a two-column grid that folds to one column when the card column is
//   narrow, a 40px tile for the type icon, the name over its metadata (13/20 name,
//   10/16 metadata), one hit target covering the whole card, and the metadata line giving
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

test('the name and its metadata keep the two sizes, and the metadata gives way on hover', () => {
  assert.ok(rule('.bt-dcard-name{').includes('font-size:13px') && rule('.bt-dcard-name{').includes('line-height:20px'))
  assert.ok(rule('.bt-dcard-desc{').includes('font-size:10px') && rule('.bt-dcard-desc{').includes('line-height:16px'))
  assert.ok(styles.includes('.bt-dcard:hover .bt-dcard-desc,.bt-dcard:focus-within .bt-dcard-desc{display:none}'))
  assert.ok(styles.includes('.bt-dcard:hover .bt-dcard-peek,.bt-dcard:focus-within .bt-dcard-peek{display:inline}'))
})

test('two columns fold to one when the card column is narrow', () => {
  const grid = rule('.bt-dcards{')
  assert.ok(grid.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), grid)
  assert.ok(grid.includes('container-type:inline-size'), grid)
  assert.ok(styles.includes('@container (width<=620px){.bt-dcards{grid-template-columns:minmax(0,1fr)}}'))
})

test('the icon is DSH’s FileTypeIcon, sized as DSH sizes it', () => {
  assert.ok(card.some(line => line.includes("import { FileTypeIcon, fileExtension, ImageLightbox } from '@deepseek-ai/dsh-client-ui-primitives'")), 'the card imports the host icon and the host image preview')
  assert.ok(card.some(line => line.includes('h(FileTypeIcon, { path: file.path, size: 20 })')), 'the icon follows the file path')
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
  assert.ok(source.includes("h('div', { className: 'bt-dcard-wrap' },"), 'the tile sits in a wrapper that can hold a line under it')
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
  const end = card.findIndex(line => line.includes('onClick: preview'))
  assert.ok(start !== -1 && end > start, 'the hit target is still one button')
  assert.ok(!card.slice(start, end + 1).join('\n').includes('title:'), 'the hit target carries no title for the shell to read')
})
