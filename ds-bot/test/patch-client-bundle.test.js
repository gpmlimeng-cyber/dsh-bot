// client.js and office.js are committed builds. The unit tests elsewhere check client.js
// in-process; this runs the exact CI command, which also covers office.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)))

test('the committed builds match src', () => {
  const result = spawnSync(process.execPath, [join(PLUGIN, 'scripts/build-client.mjs'), '--check'], { cwd: PLUGIN, encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`)
})
