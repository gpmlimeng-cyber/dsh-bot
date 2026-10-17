#!/usr/bin/env node
// Does the installed DeepSeek Harness still have the names this skin leans on?
//
// The skin reshapes the shell's chrome: it writes CSS against the shell's hashed
// CSS-module class names (_centerCol, _footArea, _header, ...), against a handful of
// its data attributes (data-composer-card, data-step-process, ...), and it reads three
// CSS variables. None of that is a public contract. When a DSH update renames one, the
// rule simply stops matching: no error, no log, no failing test -- just a screen that
// looks wrong, discovered weeks later on a device. This script turns that silent break
// into a loud one: it reads the installed client bundles and names every symbol the
// skin depends on that is no longer there.
//
// Read-only. It never writes, builds, imports a bundle, or touches the running app.
//
//   node scripts/check-shell-contract.mjs          table, exit 1 when anything is missing
//   node scripts/check-shell-contract.mjs --json   same result as JSON
//
// The shell root is found from $DSH_SHELL_ROOT, else from this Node's prefix, else from
// the known in-shell install path. The Android adaptation packages live in the profile
// and are searched for the symbols that layer provides (data-dsh-frame,
// --dsh-mobile-top-inset).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { homedir } from 'node:os'

const CANDIDATES = [
  process.env.DSH_SHELL_ROOT,
  join(dirname(process.execPath), '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
  '/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh',
  join(homedir(), '..', 'usr', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
].filter(Boolean)

const shellRoot = CANDIDATES.find(candidate => existsSync(join(candidate, 'node_modules', '@deepseek-ai')))
if (shellRoot === undefined) {
  console.error('check-shell-contract: no installed @deepseek-ai/dsh found; set DSH_SHELL_ROOT to its directory')
  process.exit(2)
}
const officialRoot = join(shellRoot, 'node_modules', '@deepseek-ai')
const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const androidRoot = join(dshHome, 'profiles', 'web', 'node_modules', '@dsh-android')

// A hashed CSS-module class: a module prefix, an underscore, and the exported name. The
// prefix is what the build renames; matching the whole word keeps a bare `_brand` in prose
// from counting as a hit. Trailing letters allowed because the skin matches `[class*="…"]`.
const cssClass = name => new RegExp(`\\.[A-Za-z0-9_-]{3,14}${name}[A-Za-z]*`)

// Each row says where the skin uses the symbol and what a user loses when it is gone.
const CONTRACT = [
  { id: '_centerCol', kind: 'class', match: cssClass('_centerCol'), used: 'styles.js:68,609,1297,1310,1318,1322,1343,1785,1839; browser-pane.js:86; composer.js:69', effect: 'the phone bottom bar covers the transcript; the right panel no longer makes room' },
  { id: '_footArea', kind: 'class', match: cssClass('_footArea'), used: 'styles.js:12,856-869; sidebar.js:839-843; overlay-hooks.js:39', effect: 'the account and connector seats fall out of the sidebar footer' },
  { id: '_header', kind: 'class', match: cssClass('_header'), used: 'styles.js:1266-1275,1864,1889', effect: 'the conversation header stops floating over the transcript' },
  { id: '_toBottomSlot', kind: 'class', match: cssClass('_toBottomSlot'), used: 'styles.js:2111-2122; header.js:237,299', effect: 'the jump-to-bottom key loses its look; the unread jump no longer finds it' },
  { id: '_composerHero', kind: 'class', match: cssClass('_composerHero'), used: 'styles.js:1918-1920', effect: 'the empty-conversation first screen breaks its layout' },
  { id: '_standardControls', kind: 'class', match: cssClass('_standardControls'), used: 'styles.js:2046', effect: 'the composer controls line up wrong' },
  { id: '_trailing', kind: 'class', match: cssClass('_trailing'), used: 'styles.js:1990,2044', effect: 'the send key and its neighbours move out of place' },
  { id: '_primary', kind: 'class', match: cssClass('_primary'), used: 'styles.js:2047-2055,2078-2080', effect: 'the send key loses its size and colour; the voice/mic switch misfires' },
  { id: '_flowItem', kind: 'class', match: cssClass('_flowItem'), used: 'styles.js:1262,1900', effect: 'empty slot rows come back and the separators sit in the wrong gap' },
  { id: '_userRow', kind: 'class', match: cssClass('_userRow'), used: 'index.js:303', effect: 'an "@Name" chip in a message the shell still draws loses the Bot mark' },
  { id: '_bubble', kind: 'class', match: cssClass('_bubble'), used: 'styles.js:2088,2147', effect: 'the command-input bubble and the group reply bubble lose their surface' },
  { id: '_markdown', kind: 'class', match: cssClass('_markdown'), used: 'styles.js:336-337,2147; file-preview.js:159', effect: 'text inside a bubble stops inheriting its size and colour' },
  { id: '_newSession', kind: 'class', match: cssClass('_newSession'), used: 'styles.js:840', effect: 'the sidebar shows two new-chat buttons' },
  { id: '_logoRow', kind: 'class', match: cssClass('_logoRow'), used: 'styles.js:840-845', effect: 'the sidebar shows the shell brand row next to ours' },
  { id: '_brand', kind: 'class', match: cssClass('_brand'), used: 'styles.js:840', effect: 'the sidebar shows two brand names' },

  { id: 'data-chat-flow', kind: 'attribute', match: /data-chat-flow\b/, used: 'activity-row.js:30,58,65,148; styles.js:1900', effect: 'the activity row loses its anchor and the scroll shift stops following' },
  { id: 'data-chat-flow-kind', kind: 'attribute', match: /data-chat-flow-kind/, used: 'styles.js:1900,2106-2107', effect: 'row-kind styling stops (separator gaps, question card spacing)' },
  { id: 'data-composer-card', kind: 'attribute', match: /data-composer-card/, used: 'styles.js:1971-2080', effect: 'the whole composer reshape stops: input, plus, voice and send keys' },
  { id: 'data-step-process', kind: 'attribute', match: /data-step-process/, used: 'styles.js:1259-1261; secret-card.js:290-291', effect: 'tool steps stay folded and the secret card is clipped' },
  { id: 'data-dsh-frame', kind: 'attribute', match: /data-dsh-frame/, used: 'styles.js:67-68,1297,1318,1322,1343,1402', effect: 'the phone top inset and the collapsed column widths stop applying', external: '@dsh-android' },
  { id: 'data-slot', kind: 'attribute', match: /data-slot=/, used: 'styles.js:1262,1900,1972,1991,2009-2013,2021', effect: 'empty-slot rows are no longer dropped and composer attachments stack wrong' },

  { id: '--dsh-mobile-top-inset', kind: 'variable', match: /--dsh-mobile-top-inset/, used: 'mobile.js:139; styles.js:1297-1343; nav-bar.js:156', effect: 'the status-bar inset reads 0 and content climbs under the status bar', external: '@dsh-android' },
  { id: '--dsh-frame-chrome-top', kind: 'variable', match: /--dsh-frame-chrome-top/, used: 'styles.js:1333', effect: 'the shell chrome height cannot be read' },
  { id: '--dsh-chat-content-width', kind: 'variable', match: /--dsh-chat-content-width/, used: 'styles.js:1864,1868,1879,1890,1976', effect: 'the wide transcript and bubble cap lose their width source' },
]

const filesIn = (root, predicate) => {
  const found = []
  if (!existsSync(root)) return found
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'types' || entry.name === 'src') continue
        walk(path)
      } else if (predicate(entry.name)) found.push(path)
    }
  }
  walk(root)
  return found
}

// Official client bundles first (the contract we actually care about), then the web
// shell's own assets, then the Android adaptation layer for the two symbols it owns.
const official = filesIn(officialRoot, name => /\.js$/.test(name))
const frontend = filesIn(join(officialRoot, 'dsh-web-frontend', 'dist', 'assets'), name => /\.js$/.test(name))
const android = filesIn(androidRoot, name => /\.js$/.test(name))

const pending = new Map(CONTRACT.map(entry => [entry.id, entry]))
const hits = new Map()
for (const file of [...official, ...frontend, ...android]) {
  if (pending.size === 0) break
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  for (const [id, entry] of pending) {
    if (!entry.match.test(text)) continue
    const token = (text.match(entry.match) ?? [])[0]
    hits.set(id, { file, token })
    pending.delete(id)
  }
}

const displayPath = file => (file.startsWith(shellRoot) ? relative(shellRoot, file) : file.replace(homedir(), '~'))
const results = CONTRACT.map(entry => {
  const hit = hits.get(entry.id)
  return {
    id: entry.id,
    kind: entry.kind,
    used: entry.used,
    effect: entry.effect,
    ...(entry.external === undefined ? {} : { external: entry.external }),
    status: hit === undefined ? 'MISSING' : 'ok',
    ...(hit === undefined ? {} : { file: displayPath(hit.file), token: hit.token }),
  }
})
const missing = results.filter(result => result.status === 'MISSING')

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ok: missing.length === 0, shellRoot, checked: results.length, missing: missing.length, results }, null, 2))
} else {
  const width = Math.max(...results.map(result => result.id.length))
  console.log(`shell: ${shellRoot}`)
  console.log('')
  for (const result of results) {
    const where = result.status === 'ok' ? result.file : '—'
    console.log(`${result.status === 'ok' ? ' ok ' : 'MISS'}= ${result.id.padEnd(width)}  ${where}`)
    if (result.status === 'MISSING') console.log(`${' '.repeat(8)}the skin uses it at ${result.used}; without it ${result.effect}`)
  }
  console.log('')
  console.log(`${results.length - missing.length}/${results.length} contract symbols found${missing.length === 0 ? '' : `; ${missing.length} missing`}`)
  if (missing.length > 0) console.log('a DSH update renamed something the skin still writes against: fix the skin before shipping')
}

process.exit(missing.length === 0 ? 0 : 1)
