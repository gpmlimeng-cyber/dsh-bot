import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { IMAGE_MAX, TEXT_MAX, fileKind } from '../src/host/files.js'
import { createRuntime } from '../index.js'
import { fakeContext } from './fake-ctx.js'

function start({ config = {}, home = mkdtempSync(join(tmpdir(), 'ds-bot-files-')) } = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'ds-bot-files-ws-'))
  const ctx = fakeContext()
  Object.assign(ctx, {
    workspaceRegistry: { get: () => ({ path: workspace }), archiveSession: async () => {} },
    sessionController: { create: async () => ({ sessionId: 's1' }) },
    sessionTitle: { rename: async () => {} },
    sessions: { flush: async () => {} },
  })
  let route
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = (options) => { route = options; return register(options) }
  const rt = createRuntime(ctx, { home, workspace, ...config })
  const call = async (endpoint, payload) => {
    const response = await route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))
    return response.json()
  }
  const stop = () => {
    ctx.dispose()
    rmSync(home, { recursive: true, force: true, maxRetries: 5 })
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5 })
  }
  return { home, workspace, call, rt, stop }
}

// A home with a delivered-file list already on disk, as a restart would find it.
function withList(t, body) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-files-'))
  writeFileSync(join(home, 'delivered.json'), body)
  t.after(() => rmSync(home, { recursive: true, force: true, maxRetries: 5 }))
  return home
}

test('a workspace file comes back with its kind and its text', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  writeFileSync(join(workspace, 'notes.md'), '# Title\n\nSome text.')
  writeFileSync(join(workspace, 'app.js'), 'const a = 1\nconst b = 2')
  writeFileSync(join(workspace, 'data.bin'), Buffer.from([0, 1, 2, 3, 255]))
  const md = (await call('panel-file', { path: 'notes.md' })).value
  assert.equal(md.ok, true)
  assert.equal(md.kind, 'markdown')
  assert.equal(md.name, 'notes.md')
  assert.equal(md.text.length, md.size)
  assert.equal(md.text, '# Title\n\nSome text.')
  assert.equal(typeof md.mtime, 'number')
  assert.ok(md.mtime > 0)
  const js = (await call('panel-file', { path: 'app.js' })).value
  assert.equal(js.kind, 'text')
  assert.equal(js.text, 'const a = 1\nconst b = 2')
  // A binary answers with its kind and size but no content.
  const bin = (await call('panel-file', { path: 'data.bin' })).value
  assert.deepEqual([bin.kind, bin.size, bin.text, bin.base64], ['binary', 5, undefined, undefined])
})

test('an image comes back as base64 with its mime type', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  writeFileSync(join(workspace, 'pixel.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  const file = (await call('panel-file', { path: 'pixel.png' })).value
  assert.equal(file.kind, 'image')
  assert.equal(file.mime, 'image/png')
  assert.equal(file.base64, Buffer.from('89504e470d0a1a0a', 'hex').toString('base64'))
})

test('a nested path and an empty file are read', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  writeFileSync(join(workspace, 'empty.txt'), '')
  const empty = (await call('panel-file', { path: 'empty.txt' })).value
  assert.deepEqual([empty.kind, empty.text, empty.truncated], ['text', '', undefined])
  // A path inside a folder of the workspace is still inside the workspace.
  const missing = (await call('panel-file', { path: 'nope/deep/file.txt' })).value
  assert.equal(missing.ok, false)
})

test('a text file past the limit is cut off and says so', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  writeFileSync(join(workspace, 'big.txt'), 'a'.repeat(TEXT_MAX + 500))
  const file = (await call('panel-file', { path: 'big.txt' })).value
  assert.equal(file.truncated, true)
  assert.equal(file.size, TEXT_MAX + 500)
  // Only the first TEXT_MAX bytes are sent back.
  assert.equal(file.text.length, TEXT_MAX)
})

test('a path that leaves the workspace is refused', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-files-out-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  writeFileSync(join(outside, 'secret.txt'), 'secret')
  writeFileSync(join(workspace, 'here.txt'), 'here')
  const outsideFile = (await call('panel-file', { path: join(outside, 'secret.txt') })).value
  assert.equal(outsideFile.ok, false)
  assert.match(outsideFile.error, /outside the workspace/)
  for (const path of ['../secret.txt', '..', '~/secret.txt', '/etc/hosts', 'C:\\Windows\\win.ini', '']) {
    const answer = (await call('panel-file', { path })).value
    assert.equal(answer.ok, false, `${path} must be refused`)
  }
  // A link inside the workspace pointing out of it is refused by the real path.
  symlinkSync(join(outside, 'secret.txt'), join(workspace, 'link.txt'))
  const linked = (await call('panel-file', { path: 'link.txt' })).value
  assert.equal(linked.ok, false)
  assert.match(linked.error, /leaves the workspace/)
})

test('a missing file, a folder, and a path with no workspace answer with a reason', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  mkdirSync(join(workspace, 'sub'))
  const missing = (await call('panel-file', { path: 'nope.txt' })).value
  assert.deepEqual([missing.ok, missing.error], [false, 'That file does not exist.'])
  const folder = (await call('panel-file', { path: 'sub' })).value
  assert.deepEqual([folder.ok, folder.error], [false, 'That is a folder.'])
  assert.equal((await call('panel-file', { path: 'a\u0000b' })).value.ok, false)
})

test('a suffix that lies about the bytes is a binary, with no content', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  // A `.png` holding text would otherwise be read whole as an image: the image path
  // allows many times what the text path does.
  writeFileSync(join(workspace, 'liar.png'), 'just text, no signature here at all')
  // A `.txt` holding binary would push raw bytes into the text answer.
  writeFileSync(join(workspace, 'liar.txt'), Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]))
  const png = (await call('panel-file', { path: 'liar.png' })).value
  assert.deepEqual([png.ok, png.kind, png.text, png.base64, png.mime], [true, 'binary', undefined, undefined, undefined])
  const txt = (await call('panel-file', { path: 'liar.txt' })).value
  assert.deepEqual([txt.ok, txt.kind, txt.text, txt.base64, txt.mime], [true, 'binary', undefined, undefined, undefined])
  // A text suffix holding bytes with a NUL in them is a binary too, and the answer
  // carries no text field at all — not even an empty one.
  writeFileSync(join(workspace, 'nulls.txt'), Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]))
  const nulls = (await call('panel-file', { path: 'nulls.txt' })).value
  assert.deepEqual([nulls.ok, nulls.kind, nulls.text, nulls.base64, nulls.mime], [true, 'binary', undefined, undefined, undefined])
  assert.ok(!('text' in nulls) && !('base64' in nulls))
})

test('fileKind trusts the bytes over the suffix', () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex')
  const jpeg = Buffer.from('ffd8ff0001', 'hex')
  const gif = Buffer.from('GIF89a0102', 'latin1')
  const webp = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP', 'latin1'), Buffer.from([0, 0])])
  const avif = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftyp', 'latin1'), Buffer.from('avif', 'latin1'), Buffer.from([0, 0, 0, 0])])
  const bmp = Buffer.from('BM', 'latin1')
  const text = Buffer.from('hello, this is plain text\n')
  const binary = Buffer.from([0x00, 0x01, 0x02, 0x03])
  // An image suffix is believed only with that image's signature.
  for (const head of [png, jpeg, gif, webp, avif, bmp]) assert.equal(fileKind('a.png', 10, head), 'image')
  assert.equal(fileKind('a.png', 10, text), 'binary')
  assert.equal(fileKind('a.jpg', 10, text), 'binary')
  assert.equal(fileKind('a.gif', 10, text), 'binary')
  assert.equal(fileKind('a.webp', 10, text), 'binary')
  // Past IMAGE_MAX an image is not read whole, whatever the bytes say.
  assert.equal(fileKind('a.png', IMAGE_MAX + 1, png), 'binary')
  // A text or Markdown suffix is believed only without a NUL.
  assert.equal(fileKind('a.txt', 10, text), 'text')
  assert.equal(fileKind('a.md', 10, text), 'markdown')
  assert.equal(fileKind('a.js', 10, text), 'text')
  // A real signature under a text suffix is a binary too: only NUL decides text, and
  // a PNG header has none.
  assert.equal(fileKind('a.txt', 10, png), 'text')
  assert.equal(fileKind('a.md', 10, png), 'markdown')
  assert.equal(fileKind('a.md', 10, binary), 'binary')
  // No bytes at all (an empty file) is text: nothing in it says otherwise.
  assert.equal(fileKind('a.txt', 0, Buffer.alloc(0)), 'text')
  assert.equal(fileKind('a.md', 0, Buffer.alloc(0)), 'markdown')
  assert.equal(fileKind('a.png', 0, Buffer.alloc(0)), 'binary')
  // An unknown suffix is a binary even with text inside.
  assert.equal(fileKind('a.zip', 10, text), 'binary')
})

// A picture written as text, and a page meant to be looked at: SVG is drawn by the
// platform as an image (an <img> never runs its scripts), HTML is rendered in a frame
// the client sandboxes, and a NUL byte under either suffix is still a binary.
test('svg is a picture and html is a page, decided by the bytes as ever', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
  const page = Buffer.from('<!doctype html><title>hi</title>')
  const binary = Buffer.from([0x00, 0x01, 0x02, 0x03])
  assert.equal(fileKind('logo.svg', svg.length, svg), 'image')
  assert.equal(fileKind('logo.svg', 500, binary), 'binary')
  assert.equal(fileKind('page.html', page.length, page), 'html')
  assert.equal(fileKind('page.htm', page.length, page), 'html')
  assert.equal(fileKind('page.html', 500, binary), 'binary')
  // Everything else keeps the rule it had: a code file is text, not a page.
  assert.equal(fileKind('page.js', page.length, page), 'text')
  assert.equal(fileKind('page.xml', page.length, page), 'text')
})

test('an image over 120 KB is read whole, up to the image limit', async (t) => {
  const { workspace, call, stop } = start()
  t.after(stop)
  // A PNG header, then filler: the bytes need only carry the signature, and the read
  // used to stop at the text limit, which cut every picture past 120 KB in half.
  const big = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(200_000, 7)])
  writeFileSync(join(workspace, 'big.png'), big)
  const answer = (await call('panel-file', { path: 'big.png' })).value
  assert.equal(answer.kind, 'image')
  assert.equal(Buffer.from(answer.base64, 'base64').length, big.length, 'the whole picture comes back')
  // An SVG comes back as a picture too, with the mime that draws it.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>'
  writeFileSync(join(workspace, 'logo.svg'), svg)
  const vector = (await call('panel-file', { path: 'logo.svg' })).value
  assert.deepEqual([vector.kind, vector.mime], ['image', 'image/svg+xml'])
  assert.equal(Buffer.from(vector.base64, 'base64').toString('utf8'), svg)
  // A page arrives as a page: its text, with the kind that says how to show it.
  writeFileSync(join(workspace, 'page.html'), '<h1>Hello</h1>')
  const page = (await call('panel-file', { path: 'page.html' })).value
  assert.deepEqual([page.kind, page.text], ['html', '<h1>Hello</h1>'])
})

test('a delivered file is readable wherever it was put, and only it is', async (t) => {
  const { workspace, rt, call, stop } = start()
  t.after(stop)
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const report = join(outside, 'report.md')
  const shot = join(outside, 'pixel.png')
  writeFileSync(report, '# Delivered\n\nBody.')
  writeFileSync(shot, Buffer.from('89504e470d0a1a0a', 'hex'))
  writeFileSync(join(workspace, 'secret.md'), 'not delivered')
  // Nothing outside the workspace is readable until a Bot has handed it over.
  const before = (await call('present-file', { path: report })).value
  assert.equal(before.ok, false)
  assert.match(before.error, /was not delivered/)
  rt.rememberDelivered([report, shot])
  const read = (await call('present-file', { path: report })).value
  assert.deepEqual([read.ok, read.kind, read.name, read.text], [true, 'markdown', 'report.md', '# Delivered\n\nBody.'])
  const image = (await call('present-file', { path: shot })).value
  assert.deepEqual([image.ok, image.kind, image.mime], [true, 'image', 'image/png'])
  assert.equal(image.base64, Buffer.from('89504e470d0a1a0a', 'hex').toString('base64'))
  // Remembering one path must not open the door for another — not even one inside the
  // workspace, and not a path that was never delivered.
  for (const path of [join(workspace, 'secret.md'), join(outside, 'other.md'), '', '/etc/hosts']) {
    assert.equal((await call('present-file', { path })).value.ok, false, `${path} must be refused`)
  }
  // The panel's own rule is untouched: it still refuses absolute paths.
  assert.equal((await call('panel-file', { path: report })).value.ok, false)
})

test('a delivered path that is gone, or is now a folder, answers with a reason', async (t) => {
  const { rt, call, stop } = start()
  t.after(stop)
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-gone-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const gone = join(outside, 'gone.md')
  const folder = join(outside, 'folder')
  mkdirSync(folder)
  rt.rememberDelivered([gone, folder])
  assert.match((await call('present-file', { path: gone })).value.error, /does not exist/)
  assert.match((await call('present-file', { path: folder })).value.error, /is a folder/)
})

// The cards already in a chat are the reason the list exists, so a restart must not turn
// them all into "not delivered". What is saved is the paths and the times, nothing else,
// and a saved path still has to be a regular file that is there when it is read.
test('the delivered list is saved as paths and times, and survives a restart', async (t) => {
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-saved-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const report = join(outside, 'kept.md')
  writeFileSync(report, '# Kept\n\nBody.')
  const first = start()
  await first.rt.rememberDelivered([report])
  const saved = join(first.home, 'delivered.json')
  // The list is its own file: paths and times, no content of any file.
  assert.equal(statSync(saved).mode & 0o777, 0o600, 'the list is readable by its owner only')
  const body = readFileSync(saved, 'utf8')
  const parsed = JSON.parse(body)
  assert.deepEqual(parsed.files.map(entry => entry.path), [report])
  assert.deepEqual(Object.keys(parsed.files[0]).sort(), ['at', 'path'])
  assert.ok(Number.isFinite(parsed.files[0].at))
  assert.ok(!body.includes('Kept'), 'no byte of the file itself is saved')
  first.stop()
  // A host that starts with that list on disk has it again, without a new delivery.
  const restarted = start({ home: withList(t, body) })
  t.after(() => restarted.stop())
  const until = Date.now() + 2000
  while (restarted.rt.deliveredCount() === 0 && Date.now() < until) await new Promise(resolve => setImmediate(resolve))
  assert.equal(restarted.rt.deliveredCount(), 1)
  const read = (await restarted.call('present-file', { path: report })).value
  assert.deepEqual([read.ok, read.kind, read.text], [true, 'markdown', '# Kept\n\nBody.'])
  // A path in the list that is gone now still falls back rather than answering.
  const gone = withList(t, JSON.stringify({ version: 1, files: [{ path: join(outside, 'gone.md'), at: 1 }] }))
  const later = start({ home: gone })
  t.after(() => later.stop())
  const until2 = Date.now() + 2000
  while (later.rt.deliveredCount() === 0 && Date.now() < until2) await new Promise(resolve => setImmediate(resolve))
  assert.equal(later.rt.deliveredCount(), 1)
  assert.match((await later.call('present-file', { path: join(outside, 'gone.md') })).value.error, /does not exist/)
})

test('a saved list longer than the cap is trimmed to the cap', async (t) => {
  const many = JSON.stringify({ version: 1, files: Array.from({ length: 501 }, (_, index) => ({ path: `/tmp/none/${index}.md`, at: index })) })
  const host = start({ home: withList(t, many) })
  t.after(() => host.stop())
  const until = Date.now() + 2000
  while (host.rt.deliveredCount() === 0 && Date.now() < until) await new Promise(resolve => setImmediate(resolve))
  assert.equal(host.rt.deliveredCount(), 500)
})

// The phone's list of everything delivered reads the same record the cards were registered
// from: newest first, paths and times only, through one read-only call.
test('the delivered list answers newest first, and carries no file content', async (t) => {
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-list-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const older = join(outside, 'older.md')
  const newer = join(outside, 'newer.md')
  writeFileSync(older, '# older')
  writeFileSync(newer, '# newer')
  const { rt, call, stop } = start()
  t.after(stop)
  await rt.rememberDelivered([older])
  await rt.rememberDelivered([newer])
  const answer = (await call('list-delivered')).value
  assert.deepEqual(answer.files.map(entry => entry.path), [newer, older], 'the newest delivery comes first')
  assert.deepEqual(Object.keys(answer.files[0]).sort(), ['at', 'path'], 'a path and its time, nothing else')
  assert.ok(Number.isFinite(answer.files[0].at))
  assert.ok(!JSON.stringify(answer).includes('# newer'), 'no byte of any delivered file is in the list')
  // The same list the cards are answered from, so the two cannot disagree.
  assert.equal(answer.files.length, rt.deliveredCount())
})

// Handing a file to another app means putting a copy where that app can read it: the
// shell's chooser opens shared storage, and a delivered file sits in the app's own. The
// gate is the same read gate, and a name already there is numbered rather than replaced,
// so a copy a reader may have open in another app is never written over.
test('a delivered file is copied out for another app, and never over a file already there', async (t) => {
  const shared = mkdtempSync(join(tmpdir(), 'ds-bot-shared-'))
  t.after(() => rmSync(shared, { recursive: true, force: true, maxRetries: 5 }))
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-share-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const { rt, call, stop } = start({ config: { sharedDir: shared } })
  t.after(stop)
  const report = join(outside, 'report.md')
  writeFileSync(report, 'first')
  // Nothing is copied out for a path a Bot never delivered, whatever it points at.
  const before = (await call('present-share', { path: report })).value
  assert.equal(before.ok, false)
  assert.match(before.error, /was not delivered/)
  rt.rememberDelivered([report])
  const first = (await call('present-share', { path: report })).value
  assert.deepEqual([first.ok, first.path, first.name], [true, join(shared, 'report.md'), 'report.md'])
  assert.equal(readFileSync(first.path, 'utf8'), 'first')
  // The same name again: a numbered copy, and the first one is left as it was.
  writeFileSync(report, 'second')
  const again = (await call('present-share', { path: report })).value
  assert.equal(again.path, join(shared, 'report (2).md'))
  assert.equal(readFileSync(first.path, 'utf8'), 'first')
  assert.equal(readFileSync(again.path, 'utf8'), 'second')
  // A folder, a path that is gone, and a path that was never delivered answer with a
  // reason instead of a copy.
  for (const path of [join(outside, 'gone.md'), '/etc/hosts', '']) {
    assert.equal((await call('present-share', { path })).value.ok, false, `${path} must be refused`)
  }
  // A name with no suffix is numbered too, without losing the whole name.
  const notes = join(outside, 'NOTES')
  writeFileSync(notes, 'one')
  rt.rememberDelivered([notes])
  assert.equal((await call('present-share', { path: notes })).value.path, join(shared, 'NOTES'))
  assert.equal((await call('present-share', { path: notes })).value.path, join(shared, 'NOTES (2)'))
})


// The panel is a team-wide record, so a row has to be able to say whose file it is: the name of the
// Bot that handed it over is kept with the path, and survives a restart the same way the path does.
test('a delivered file remembers which Bot handed it over', async (t) => {
  const outside = mkdtempSync(join(tmpdir(), 'ds-bot-delivered-by-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 5 }))
  const report = join(outside, 'by.md')
  writeFileSync(report, '# By\n\nBody.')
  const first = start()
  await first.rt.rememberDelivered([report], '研究分析')
  const list = (await first.call('list-delivered')).value
  assert.equal(list.files[0].by, '研究分析', 'the list says who handed it over')
  const body = readFileSync(join(first.home, 'delivered.json'), 'utf8')
  assert.equal(JSON.parse(body).files[0].by, '研究分析', 'and the saved list keeps it')
  first.stop()
  const restarted = start({ home: withList(t, body) })
  t.after(() => restarted.stop())
  const until = Date.now() + 2000
  while (restarted.rt.deliveredCount() === 0 && Date.now() < until) await new Promise(resolve => setImmediate(resolve))
  assert.equal((await restarted.call('list-delivered')).value.files[0].by, '研究分析', 'still there after a restart')
  // A delivery with no Bot behind it (a caller that does not know) keeps the old shape.
  await restarted.rt.rememberDelivered([report])
  assert.deepEqual(Object.keys((await restarted.call('list-delivered')).value.files[0]).sort(), ['at', 'path'])
})
