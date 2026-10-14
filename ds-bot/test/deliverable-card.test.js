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
  assert.ok(card.some(line => line.includes("import { FileTypeIcon, fileExtension } from '@deepseek-ai/dsh-client-ui-primitives'")), 'the card imports the host icon')
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
  assert.ok(source.includes("h('span', { className: 'bt-dcard-hint', role: 'status' }"), 'the fallback is announced')
  assert.ok(source.includes('PHONE_COPY_HINT'), 'the fallback names the folder the phone can reach')
  assert.ok(rule('.bt-dcard-hint{').includes('word-break:break-all'), 'the sentence wraps instead of scrolling sideways')
})

// A tap on the card reads the file through the host, which answers for the paths a Bot
// actually delivered. Only a picture or text can be shown; everything else keeps the
// path to copy.
test('a tap shows the delivered file here, and only what can be shown', () => {
  const source = card.join('\n')
  assert.ok(source.includes('const answer = await actions?.presentFile?.(file.path)'), 'the card reads through the host action')
  assert.ok(source.includes("answer?.ok === true && (answer.kind === 'image' || answer.kind === 'text' || answer.kind === 'markdown')"), 'a binary or an unreadable file is not shown')
  assert.ok(source.includes("h('img', { src: `data:"), 'an image is shown as itself')
  // Text and Markdown go through the panel's own viewer rather than a second one drawn
  // here: one renderer means a delivered README looks the same in the card and in the
  // Files tab, and a fence or a heading is rendered instead of shown as its marks.
  assert.ok(source.includes('h(FileView, { file: read })'), 'text and Markdown are shown by the panel’s viewer')
  const panel = read('file-preview.js')
  assert.ok(panel.includes('export function FileView({ file })'), 'the viewer is the panel’s own')
  assert.ok(panel.includes('file ? h(FileView, { file }) : null'), 'the panel renders it with the same call')
  assert.ok(panel.includes("h(MarkdownText, { text: file.text ?? '', labels: mdLabels() })"), 'Markdown goes through DSH’s renderer')
  // A second tap puts the file away, and the label says which tap it is.
  assert.ok(source.includes("if (state === 'shown') {") && source.includes('setRead(null)'), 'a second tap puts it away')
  assert.ok(source.includes("`${state === 'shown' ? t('Hide preview') : t('Preview')} ${name}`"), 'the hit target names its tap')
  assert.ok(source.includes("state === 'reading' ? t('Opening…') : metaText(file, name)"), 'a read in flight says so, since a phone shows no hover')
  assert.ok(i18n.includes("Preview: '预览'") && i18n.includes("'Hide preview': '收起预览'"), 'both labels are translated')
  // Bounded height: one delivered file cannot push the conversation off the screen.
  assert.ok(rule('.bt-dcard-view img{').includes('max-height:260px'), 'a picture is capped')
  assert.ok(rule('.bt-dcard-view .bt-fp-body{').includes('overflow:auto') && rule('.bt-dcard-view .bt-fp-body{').includes('max-height:260px'), 'so does the viewer’s own box')
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
  assert.ok(source.includes("chooser(copy.path, 'view') === true"), 'the copy is what opens')
  assert.ok(source.includes("fetch(openUrl(file), { method: 'POST', credentials: 'same-origin' })"), 'a desktop keeps the engine’s opener')
  assert.ok(read('index.js').includes("shareFile: path => call('present-share', { path })"), 'the client exposes the copy-out action')
  assert.ok(i18n.includes("'Open with another app': '用其它应用打开'"), 'the button says what it does')
  assert.ok(source.includes("? t('Could not open it here. The copy is at {path}', { path: shared })")
    && i18n.includes("'Could not open it here. The copy is at {path}'"), 'when no app takes the copy, the card names it')
  // The shell intercepts a click whose target’s title looks like a path and sends that
  // path to its own chooser. The hit target must therefore carry no title: with one, a tap
  // meant for the preview would leave the app for a chooser that cannot read the file.
  const start = card.findIndex(line => line.includes("className: 'bt-dcard-hit'"))
  const end = card.findIndex(line => line.includes('onClick: preview'))
  assert.ok(start !== -1 && end > start, 'the hit target is still one button')
  assert.ok(!card.slice(start, end + 1).join('\n').includes('title:'), 'the hit target carries no title for the shell to read')
})
