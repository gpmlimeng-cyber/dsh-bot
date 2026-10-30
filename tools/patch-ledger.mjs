/**
 * Generates design/ds-bot-patches.hunks.md from design/ds-bot-patches.patch.
 *
 * The ledger must be mechanical: hand-written line numbers were wrong three times.
 * Writes the table to stdout only; nothing else is touched.
 *
 *   node tools/patch-ledger.mjs > design/ds-bot-patches.hunks.md
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const patchPath = resolve(root, 'design/ds-bot-patches.patch')
const patch = readFileSync(patchPath, 'utf8')

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

const hunks = []
let file = null
for (const line of patch.split('\n')) {
  if (line.startsWith('+++ b/')) {
    file = line.slice(6)
    continue
  }
  if (line.startsWith('--- ') || line.startsWith('+++ ')) continue

  const head = HUNK.exec(line)
  if (head) {
    hunks.push({ file, start: Number(head[3]), end: Number(head[3]), count: 0, next: Number(head[3]) })
    continue
  }

  const hunk = hunks[hunks.length - 1]
  if (!hunk || file === null) continue
  if (line.startsWith('+')) {
    if (hunk.count === 0) hunk.start = hunk.next
    hunk.end = hunk.next
    hunk.count++
    hunk.next++
  } else if (line.startsWith(' ')) {
    hunk.next++
  }
}

hunks.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.start - b.start || a.end - b.end))

const rows = hunks.map((hunk, i) => {
  const range = hunk.start === hunk.end ? `${hunk.start}` : `${hunk.start}–${hunk.end}`
  return `| ${i + 1} | \`${hunk.file}\` | ${range} | ${hunk.count} |`
})

process.stdout.write('| # | 文件 | 新增行号 | 新增数 |\n|---|---|---|---|\n' + rows.join('\n') + '\n')
