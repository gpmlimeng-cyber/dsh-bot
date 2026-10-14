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
  assert.ok(source.includes(": h('pre', { className: 'bt-dcard-text' }, read.text ?? '')"), 'text is shown as text')
  // A second tap puts the file away, and the label says which tap it is.
  assert.ok(source.includes("if (state === 'shown') {") && source.includes('setRead(null)'), 'a second tap puts it away')
  assert.ok(source.includes("`${state === 'shown' ? t('Hide preview') : t('Preview')} ${name}`"), 'the hit target names its tap')
  assert.ok(source.includes("state === 'reading' ? t('Opening…') : metaText(file, name)"), 'a read in flight says so, since a phone shows no hover')
  assert.ok(i18n.includes("Preview: '预览'") && i18n.includes("'Hide preview': '收起预览'"), 'both labels are translated')
  // Bounded height: one delivered file cannot push the conversation off the screen.
  assert.ok(rule('.bt-dcard-view img{').includes('max-height:260px'), 'a picture is capped')
  assert.ok(rule('.bt-dcard-text{').includes('overflow:auto') && rule('.bt-dcard-text{').includes('max-height:260px'), 'text scrolls inside its own box')
})

test('the card is wired to the host action that answers for delivered files', () => {
  assert.ok(read('index.js').includes("presentFile: path => call('present-file', { path })"), 'the client exposes the action')
  assert.ok(read('cells.js').includes('h(DeliverableCards, { deliverables, actions })'), 'the group reply hands the card its actions')
})
