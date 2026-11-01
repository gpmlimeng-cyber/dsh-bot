// The patch is the replayable record of every local change. These tests keep it replayable
// without restating any of its numbers by hand: the statistics below are recounted from the
// patch, and the ledger's own table is only allowed to be the generator's output.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = dirname(PLUGIN)
const PATCH = join(ROOT, 'design/ds-bot-patches.patch')
const HUNKS = join(ROOT, 'design/ds-bot-patches.hunks.md')
// The ledger's baseline: the upstream release the local commits sit on top of.
const BASE = 'v0.2.4'
// client.js is generated from src/client, and gaze.js carries generated images, so neither
// is part of the hand-maintained patch.
const PATCHED = ['ds-bot', ':!ds-bot/client.js', ':!ds-bot/src/client/gaze.js']

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' })

test('the patch still reverses cleanly on HEAD', () => {
  // HEAD already contains every hunk, so the forward direction cannot apply here; the
  // direction that proves the patch still describes HEAD is the reverse one.
  const result = git(['apply', '--reverse', '--check', PATCH], ROOT)
  assert.equal(result.status, 0, result.stderr)
})

test('the patch still replays on the baseline, and is exactly the baseline diff', () => {
  const base = git(['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`], ROOT)
  assert.equal(base.status, 0, `the ledger baseline ${BASE} is not a ref here: ${base.stderr}`)

  // A work tree of the baseline is the only place the forward direction can run.
  const dir = mkdtempSync(join(tmpdir(), 'ds-bot-baseline-'))
  try {
    const added = git(['worktree', 'add', '--detach', '--quiet', dir, BASE], ROOT)
    assert.equal(added.status, 0, added.stderr)
    const applied = git(['apply', '--check', PATCH], dir)
    assert.equal(applied.status, 0, applied.stderr)
  } finally {
    git(['worktree', 'remove', '--force', dir], ROOT)
    rmSync(dir, { recursive: true, force: true })
  }

  const diff = execFileSync('git', ['diff', BASE, 'HEAD', '--', ...PATCHED], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  assert.equal(readFileSync(PATCH, 'utf8'), diff, `regenerate it: git diff ${BASE} HEAD -- ${PATCHED.join(' ')} > design/ds-bot-patches.patch`)
})

test('the ledger table is the generator output', () => {
  const generated = spawnSync(process.execPath, [join(ROOT, 'tools/patch-ledger.mjs')], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  assert.equal(generated.status, 0, generated.stderr)
  assert.equal(readFileSync(HUNKS, 'utf8'), generated.stdout, 'regenerate it: node tools/patch-ledger.mjs > design/ds-bot-patches.hunks.md')
})

test('the statistics in the ledger table are counted from the patch', () => {
  let files = 0, hunks = 0, added = 0, removed = 0
  for (const line of readFileSync(PATCH, 'utf8').split('\n')) {
    if (line.startsWith('+++ b/')) files++
    else if (line.startsWith('--- ')) continue
    else if (line.startsWith('@@')) hunks++
    else if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
  }

  const stats = readFileSync(HUNKS, 'utf8')
  const count = label => {
    const found = new RegExp(`^\\| ${label} \\| (\\d+) \\|$`, 'm').exec(stats)
    assert.notEqual(found, null, `the generated statistics have no ${label} row`)
    return Number(found[1])
  }
  assert.deepEqual({ files: count('文件'), hunks: count('hunks'), added: count('新增行'), removed: count('删除行') },
    { files, hunks, added, removed })
})
