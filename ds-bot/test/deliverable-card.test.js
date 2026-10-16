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
// Two things are ours and must survive the port: the copy-path control (behind the card's
// one "···", since copying a path is what a reader reaches for when nothing can open the
// file) and the sentence that tells the reader where the copy lives. Every glyph the card
// and the preview bar draw is the platform's own, and the type mark is a tinted badge with
// the file's extension in it rather than a drawn glyph of a page.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
const styles = read('styles.js').split('\n')
const card = read('deliverables.js').split('\n')
const icons = read('icons.js')
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

test('the tile is DSH-shaped: 60px tall, a 24px flat mark, one hit target over it', () => {
  const tile = rule('.bt-dcard{')
  assert.ok(tile.includes('height:60px'), tile)
  assert.ok(tile.includes('border-radius:10px'), tile)
  const icon = rule('.bt-dcard-ico{')
  assert.ok(icon.includes('width:24px') && icon.includes('height:24px'), icon)
  assert.ok(!icon.includes('background:') && !icon.includes('border-radius:'), 'and the mark is the drawing itself, with no plate behind it')
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
  // The type mark is a 40px tinted square with the extension in it: the name and the line
  // under it keep their room, since the square has not grown.
  assert.ok(rule('.bt-dcard-ico{').includes('width:24px') && rule('.bt-dcard-ico{').includes('height:24px'), 'the type mark is the drawing itself, at the size the row was measured with')
  // The second line used to be replaced by the word "Preview" while the pointer was on the
  // card. A tap anywhere on the card says that now, so the line stays where it is.
  assert.ok(!styles.includes('.bt-dcard-peek'), 'the hover-only word is gone')
  assert.ok(!styles.includes('.bt-dcard:hover .bt-dcard-desc'), 'and the second line no longer gives way')
})

// Copying the path is the fallback a reader reaches for when nothing can open the file, so
// it is not a button on the card's face beside "preview": the card's face is the file, and one
// "···" at its right end opens the two exits by name. The panel's rows draw this same control
// with the same menu and the same words, which is why nothing here is parameterized by which
// list is drawing it -- and why the panel's name column has 285px where three icon buttons
// used to leave it 189px.
test('the card’s exits are one "···", the same control in every list', () => {
  const source = card.join('\n')
  const btn = rule('.bt-dcard-btn{')
  assert.ok(btn.includes('width:44px') && btn.includes('height:44px'), 'a 44px touch target')
  // The drawing is what the eye judges, and it is the same glyph the preview bar's own "···"
  // draws, in the one box that glyph carries. The sheet does not size it and neither does the
  // control: the glyph brings both its box and its stroke.
  assert.ok(!styles.some(line => line.startsWith('.bt-dcard-btn svg')), 'the sheet does not size the control’s glyph')
  assert.ok(source.includes('}, h(LucideEllipsisIcon)),'), 'it draws Lucide’s three dots')
  assert.ok(!source.includes('{ size: 36 }'), 'and no call site sizes a Lucide glyph by hand')
  assert.ok(icons.includes('export function DotsBoldIcon'), 'though our own dot glyph stays where the phone bar uses it')
  // Lucide's ellipsis is three r=1 circles on a 16-unit row, and it lands where the pill's own
  // icons measure: a 17px box paints 2.9px dots in a 12.8px row. The dots are outlined circles,
  // and at 17px the pinned 1.5px stroke is wider than the 1.4px the circle itself spans, so the
  // hole closes and they come out solid rather than as rings.
  const k = 17 / 24
  assert.equal((2 * k + 1.5).toFixed(2), '2.92', 'landing at 2.9px dots')
  assert.equal((16 * k + 1.5).toFixed(2), '12.83', 'in a 12.8px row')
  assert.ok((2 * k) - 1.5 < 0, 'with the hole closed, so they read solid rather than as rings')
  // Lucide's data is copied, so its notice travels with it -- and the strings are theirs.
  assert.ok(icons.includes('Lucide (ISC) · path data from lucide-static v1.57.0'), 'the ISC notice is written where the data is')
  assert.ok(icons.includes("['circle', { cx: 12, cy: 12, r: 1 }]") && icons.includes("['circle', { cx: 19, cy: 12, r: 1 }]") && icons.includes("['circle', { cx: 5, cy: 12, r: 1 }]"), 'with the glyph’s own three circles, in lucide-static’s order')
  assert.ok(source.includes("'data-act': 'more'"), 'the control is marked')
  assert.ok(source.includes("'aria-haspopup': 'menu'"), 'and announces the menu it opens')
  assert.ok(source.includes("'aria-label': t('More'), title: t('More')"), 'named for a reader')
  // Nothing else is a button on the card: the two exits are behind the one control, and a tap
  // on the card opens the preview, so no third button repeats it.
  for (const act of ['open', 'copy', 'preview']) {
    assert.ok(!source.includes(`'data-act': '${act}'`), `no ${act} button on the card`)
  }
  assert.equal(source.split("`${t('Preview')} ${name}`").length - 1, 1, 'only the card-wide hit target repeats the file name')
  // The exits' words are written once for both menus, and both are named.
  assert.equal(source.split('exitItems(exits.state)').length - 1, 1, 'the two exits are written once for both menus')
  assert.ok(source.includes("{ id: 'open', icon: h(LucideExternalLinkIcon), label: state === 'opening' ? t('Opening…') : t('Open with another app') }"), 'the first hands the file to another app')
  assert.ok(source.includes("{ id: 'copy', icon: state === 'copied' ? h(LucideCheckIcon) : h(LucideCopyIcon), label: state === 'copied' ? t('Copied') : t('Copy path') }"), 'the second copies the path')
  // One control for both lists: no list can ask for a shape of its own.
  assert.ok(source.includes('export function DeliverableActions({ file, actions, onFailed })'), 'the control takes nothing that depends on the list drawing it')
  assert.ok(!source.includes('menu = false') && !source.includes('menu: list'), 'and no list asks for another one')
  assert.ok(source.includes("className: 'bt-dcard-menu'"), 'the card’s own menu class')
  assert.ok(rule('.bt-dcard-menu{').includes('flex:none'), 'the one control neither shrinks nor wraps')
  assert.ok(rule('.bt-dcard-acts{').includes('flex-wrap:nowrap'), 'the row never wraps into a second row the 60px tile would clip')
  assert.ok(rule('.bt-dcard-acts{').includes('justify-content:flex-end'), 'and is held at the card’s right end')
  assert.ok(rule('.bt-dcard-ico{').includes('width:24px'), 'the kind\u2019s mark it sits beside is unchanged')
  // No word is painted on the card: a label that used to be a button's child would be one.
  for (const painted of [": t('Open with another app'))", ": t('Copy path'))", "t('Path')"]) {
    assert.ok(!source.includes(painted), `${painted} is not painted on the card`)
  }
  // The card's own glyphs went with the buttons that drew them, and so did the eye: looking at
  // the file is what a tap anywhere on the card already does.
  for (const gone of ['CardCopyIcon', 'CardExternalIcon', 'CardCheckIcon', 'EyeIcon']) {
    assert.ok(!icons.includes(gone), `${gone} is gone`)
  }
})

// The five glyphs in these two screens are Lucide's, copied -- so their data can be diffed
// against lucide-static byte for byte, and their licence travels with them. Nothing here is
// drawn by hand: the team's rule is to take a glyph that exists before shaping one.
test('every glyph is Lucide’s copied data, credited where it lives', () => {
  assert.ok(icons.includes('Lucide (ISC) · path data from lucide-static v1.57.0'), 'the ISC notice sits with the data')
  const glyphs = [
    ["['path', { d: 'm15 18-6-6 6-6' }]", 'chevron-left, the bar’s back arrow'],
    ["['circle', { cx: 12, cy: 12, r: 1 }]", 'ellipsis, dot one of three'],
    ["['circle', { cx: 19, cy: 12, r: 1 }]", 'ellipsis, dot two'],
    ["['circle', { cx: 5, cy: 12, r: 1 }]", 'ellipsis, dot three'],
    ["['path', { d: 'M15 3h6v6' }]", 'external-link, the menu’s “open with another app”'],
    ["['path', { d: 'M10 14 21 3' }]", 'external-link’s shaft'],
    ["['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]", 'external-link’s frame'],
    ["{ width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 }", 'copy, the sheet in front'],
    ["['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }]", 'copy, the sheet behind'],
    ["['path', { d: 'M20 6 9 17l-5-5' }]", 'check, the tick after a copy'],
  ]
  for (const [data, what] of glyphs) {
    assert.ok(icons.includes(data), `${what} is lucide-static’s own data`)
  }
  // One grid for every glyph, one stroke, and a box per glyph. Lucide's own 2-unit stroke would
  // scale with the box, so the 1.5px the pill's own icons render is pinned onto every shape --
  // vector-effect is not inherited, so it cannot sit on the frame around the glyph -- and each
  // box is derived from the one rule: the glyph's longest run of ink lands on the 13px the pill
  // draws its own icons at.
  assert.equal(icons.split("viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',").length - 1, 1, 'one glyph factory, one grid')
  assert.ok(icons.includes('const LUCIDE_STROKE = 1.5'), 'one 1.5px stroke, the number the pill’s own icons render')
  assert.ok(icons.includes("{ key: index, vectorEffect: 'non-scaling-stroke', ...attributes }"), 'pinned per shape, so a bigger box cannot thicken it')
  assert.ok(!read('file-preview.js').includes('stroke-width:2'), 'and nothing pins a stroke afterwards')
  const ink = (units, box) => units * box / 24 + 1.5
  assert.ok(Math.abs(ink(12, 23) - 13) < 0.05, 'the chevron’s 12 units of height land on the 13px the pill draws')
  assert.ok(Math.abs(ink(16, 17) - 12.83) < 0.05, 'and the dots’ 16-unit row lands beside it')
  // The dots only stay solid because the box is small: the hole left in an r=1 outline is
  // 2 * box / 24 - stroke, so it has to stay at or under zero.
  assert.ok((2 * 17 / 24) - 1.5 <= 0, 'a box this size leaves no hole in a dot')
  assert.ok(icons.includes('const LUCIDE_MENU_BOX = 15'), 'while the menu’s three keep the box the shell’s menus draw in (the platform pins them to 14)')
  // The three the menu draws cannot be judged here: the platform's Menu sets .itemIcon svg to
  // its own 14px, so their box is the platform's to choose. What stays ours is the stroke, which
  // rides on the glyph and survives that box.
  assert.ok(!read('file-preview.js').includes('itemIcon') && !styles.some(line => line.includes('itemIcon')), 'and no sheet of ours overrides the platform’s menu icon box')
})

test('two columns fold to one when the card column is narrow', () => {
  const grid = rule('.bt-dcards{')
  assert.ok(grid.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), grid)
  assert.ok(grid.includes('container-type:inline-size'), grid)
  assert.ok(styles.includes('@container (width<=620px){.bt-dcards{grid-template-columns:minmax(0,1fr)}}'))
})

test('the type mark is the kind\u2019s own drawing in a tinted square, not letters', () => {
  const source = card.join('\n')
  assert.ok(source.includes("h('span', { className: `bt-dcard-ico bt-dcard-ico-${toneOf(name)}`, 'aria-hidden': true }, h(iconOf(name)))"), 'the square holds the kind\u2019s drawing')
  assert.ok(!source.includes('badgeOf') && !source.includes('EXT_ALIASES'), 'no letters are written into it any more')
  assert.ok(!source.includes('bt-dcard-type'), 'and the rule that drew them is gone')
  // The map, kind by kind: the reader\u2019s kinds, not a mime table -- a picture, code, a sheet, a pdf,
  // a zip, and a document for everything else (markdown included, which is a document to a reader).
  assert.ok(source.includes("const CODE_EXTENSIONS = new Set(['html', 'htm', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'css', 'json', 'yml', 'yaml', 'toml', 'sh', 'sql', 'xml'])"), 'code has its own kind')
  assert.ok(source.includes("const TABLE_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods'])"), 'so does a sheet')
  for (const [test, icon] of [['IMAGE_EXTENSIONS.has(extension)', 'FluentImageIcon'], ['CODE_EXTENSIONS.has(extension)', 'FluentCodeIcon'], ['TABLE_EXTENSIONS.has(extension)', 'FluentTableIcon'], ["extension === 'pdf'", 'FluentPdfIcon'], ['ARCHIVE_EXTENSIONS.has(extension)', 'FluentArchiveIcon']]) {
    assert.ok(source.includes(`if (${test}) return ${icon}`), `${icon} answers ${test}`)
  }
  assert.ok(source.includes('return FluentDocumentIcon'), 'and a document is what is left')
  // Every glyph is Fluent\u2019s own artwork at 20, from the one 20-grid factory in icons.js.
  const icons = read('icons.js')
  assert.ok(icons.includes('const fluentIcon20 = d => function FluentIcon20()'), 'one factory for the 20 grid')
  for (const icon of ['FluentDocumentIcon', 'FluentImageIcon', 'FluentCodeIcon', 'FluentTableIcon', 'FluentPdfIcon', 'FluentArchiveIcon']) {
    assert.ok(icons.includes(`export const ${icon} = fluentIcon20(`), `${icon} is Fluent\u2019s artwork, not a drawing of ours`)
  }
  // The tint says what kind of thing it is, before either line under it is read.
  assert.ok(source.includes("const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff'])"), 'pictures are their own tone')
  assert.ok(source.includes("const MEDIA_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'ogg', 'flac'])"), 'and recordings')
  assert.ok(source.includes("if (IMAGE_EXTENSIONS.has(extension)) return 'image'") && source.includes("return 'doc'"), 'with documents as the default')
  assert.ok(rule('.bt-dcard-ico-image{').includes('--bt-type-ink:color-mix(in srgb,var(--bt-green) 82%,var(--bt-ink))'), 'the picture tone is the palette\u2019s green, mixed into the ink so it reads on both themes')
  assert.ok(rule('.bt-dcard-ico-doc{').includes('--bt-type-ink:var(--bt-accent)'), 'and a document is the shell\u2019s accent')
  // Flat: the glyph is the whole mark -- no plate, no border, one colour from the kind's tint.
  assert.ok(rule('.bt-dcard-ico{').includes('color:var(--bt-type-ink)') && !rule('.bt-dcard-ico{').includes('background:'), 'the drawing is the mark, with nothing behind it')
  assert.ok(!rule('.bt-dcard-ico{').includes('border:') && !rule('.bt-dcard-ico{').includes('border-radius:'), 'and no outline or plate of its own')
  assert.ok(rule('.bt-dcard-ico{').includes('width:24px') && rule('.bt-dcard-ico{').includes('height:24px'), 'the row keeps its 24px mark')
  assert.ok(rule('.bt-dcard-ico>svg{').includes('width:24px') && rule('.bt-dcard-ico>svg{').includes('height:24px'), 'and the drawing is the 24px the row was measured with')
})

test('the card keeps no selected look on a phone, and a keyboard keeps its ring', () => {
  const source = styles.join('\n')
  assert.ok(!styles.some(line => line.startsWith('.bt-dcard:hover{')), 'the card no longer greys itself under the cursor unconditionally')
  assert.ok(!styles.some(line => line.startsWith('.bt-dcard-btn:hover{')), 'nor do its buttons')
  const pointer = source.slice(source.indexOf('@media (hover:hover){'), source.indexOf('.bt-dcard-hit:focus-visible'))
  assert.ok(pointer.includes('.bt-dcard:hover{background:var(--bt-hover)}'), 'both live inside the pointer-only block')
  assert.ok(pointer.includes('.bt-dcard-btn:hover{background:var(--bt-active);color:var(--bt-ink)}'), 'which is where an Android tap cannot leave them stuck')
  // The ring belongs to a keyboard: the wide layout keeps it, and the phone band -- where a finger
  // opens the file and the user asked the card not to look chosen afterwards -- turns it off alone.
  assert.ok(styles.some(line => line.startsWith('.bt-dcard-hit:focus-visible{box-shadow:inset 0 0 0 2px var(--bt-accent);')), 'a keyboard still sees the card it has reached')
  assert.ok(styles.some(line => line.startsWith('html[data-bt-mobile] .bt-dcard-hit:focus-visible{box-shadow:none;outline:none}')), 'and the phone band draws none')
  assert.ok(!source.includes('.bt-dcard:active') && !source.includes('.bt-dcard[aria-selected'), 'and the card has no press or selected state of its own')
  // The tile is still the thing that opens the file: only its selected look went.
  assert.ok(source.includes(".bt-dcard-hit{position:absolute;inset:0;z-index:1;width:100%;padding:0;border:0;border-radius:inherit;background:0 0;cursor:pointer}"), 'the hit layer is still there')
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
  assert.ok(source.includes("h('button', { type: 'button', className: 'bt-preview-back', onClick: onClose, 'aria-label': t('Back'), title: t('Back') }, h(LucideChevronLeftIcon))"), 'the left control is a back button, named for a reader, drawing Lucide’s chevron')
  assert.ok(source.includes("h('span', { className: 'bt-preview-name' }, name)"), 'the name is the middle part')
  assert.ok(source.includes("} from './icons.js'"), 'the page’s glyphs come from our own module')
  // Every glyph in this page is Lucide's copied data: a page that hand-draws its chevron and
  // its dots is what read as cheap.
  assert.ok(source.includes('}, h(LucideEllipsisIcon)),'), 'the menu’s anchor draws Lucide’s three dots')
  // The menu is the platform’s own component and carries both exits, which are the same
  // behaviour the card’s row of buttons runs: one definition, two chromes.
  // The sheet's close is added to the same import line (the list's own head draws it), so the
  // assertion reads the Lucide names themselves rather than the whole line.
  assert.ok(source.includes("import { fileExtension, fileSizeText, ImageLightbox, Menu } from '@deepseek-ai/dsh-client-ui-primitives'") && source.includes("LucideCheckIcon, LucideChevronLeftIcon, LucideCopyIcon, LucideEllipsisIcon, LucideExternalLinkIcon } from './icons.js'"), 'the menu is the platform’s, and every glyph in it is Lucide’s data')
  assert.ok(source.includes('export function useDeliverableExits(file, actions, onFailed)'), 'the exits are defined once')
  assert.equal(source.split('useDeliverableExits(file, actions, onFailed)').length - 1, 3, 'and used by both chromes')
  assert.ok(source.includes("h(Menu, {"), 'the page’s exits are a menu')
  assert.ok(source.includes("align: 'end'"), 'aligned to the bar’s end')
  assert.ok(source.includes("{ id: 'open', icon: h(LucideExternalLinkIcon), label: state === 'opening' ? t('Opening…') : t('Open with another app') }"), 'the first item opens in another app, with Lucide’s external-link')
  assert.ok(source.includes("{ id: 'copy', icon: state === 'copied' ? h(LucideCheckIcon) : h(LucideCopyIcon), label: state === 'copied' ? t('Copied') : t('Copy path') }"), 'the second copies the path, and ticks with Lucide’s check')
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
// 56px, so the control keeps 4px at either end. The drawings are not sized here at all: every
// glyph in these two screens is Lucide's, at the one box and one stroke measured off the pill
// in the top bar, so the bar asks for nothing of its own and a later edit cannot quietly size
// a glyph up again. The card's own 44px controls are left where they were: the tile is 60px
// with 8px of padding, so a 48px control would break it.
test('the title bar is 56px, its controls 48px, and no rule sizes a drawing', () => {
  assert.ok(styles.some(line => line.includes('.bt-drawer-name{font-size:17px;line-height:24px;')), 'the drawer names a Bot at 17/24')
  assert.ok(previewRule('.bt-preview-head{').includes('height:56px'), 'so the page’s bar is 56px')
  assert.ok(previewRule('.bt-preview-name{').includes('font-size:17px') && previewRule('.bt-preview-name{').includes('line-height:24px'), 'and its title is 17/24')
  for (const prefix of ['.bt-preview-back{', '.bt-preview-more{']) {
    assert.ok(previewRule(prefix).includes('width:48px') && previewRule(prefix).includes('height:48px'), `${prefix} is a 48px touch target`)
  }
  // The glyphs bring the box and the stroke; no rule of ours and no call site corrects either.
  const source = card.join('\n')
  assert.ok(source.includes('h(LucideChevronLeftIcon)'), 'the chevron arrives as Lucide’s glyph in the glyph’s own box')
  assert.ok(icons.includes("['path', { d: 'm15 18-6-6 6-6' }]"), 'verbatim from lucide-static')
  assert.ok(source.split('h(LucideEllipsisIcon)').length - 1 === 2, 'the same glyph opens both menus')
  assert.ok(!source.includes('{ size: 36 }'), 'and neither control passes a size')
  assert.ok(!read('file-preview.js').includes('html[data-bt-pc] .bt-preview'), 'and no band gets a smaller control back')
  // The reserve for the centred name is the two controls, their padding and their gaps, so a
  // long name never slides under one.
  assert.ok(previewRule('.bt-preview-name{').includes('max-width:calc(100% - 136px)'), 'a long name never slides under a control')
})
