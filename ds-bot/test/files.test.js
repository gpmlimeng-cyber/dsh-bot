import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { IMAGE_MAX, TEXT_MAX, fileKind } from '../src/host/files.js'
import { createRuntime } from '../index.js'
import { fakeContext } from './fake-ctx.js'

function start({ config = {} } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'ds-bot-files-'))
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
  return { workspace, call, rt, stop }
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

