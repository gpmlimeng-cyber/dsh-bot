// The PC band (841-1023 landscape, pc-layout.js) gets its sidebar column from the shell
// rather than from a rule of our own, which means this plugin depends on three names that
// live in packages we do not own. This file is that dependency, written down: if upstream
// renames one of them, a red test says so instead of a folded screen that quietly stops
// opening its column.
//
//   * `data-sidebar-collapsed` on the frame -- `shellCollapsed` reads it to learn whether
//     the column this band is about to open is in fact folded;
//   * `expandSidebar` on the `sidebar.workspaces` slot -- the one-directional open. It is
//     the shell's own `if (collapsed) toggleSidebar()`, so it cannot fold an open column;
//   * `toggleSidebar` on the layout service -- the only handle on the closing direction.
//
// What is deliberately NOT asserted is the shell's column geometry: the 264-420 clamp, the
// grid template, the 56px rail. That is upstream's own layout, not a contract this plugin
// can hold it to, and a copy of it here would be a guess that rots the first time the shell
// widens its sidebar. The budget this plugin actually spends (280 column, 280 panel, 299
// conversation) is arithmetic on the device, not a promise about the shell's CSS.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

// The shell is present when the tests run inside a DSH install or a harness checkout, and
// absent in a bare clone: read what is there, skip what is not.
const shell = (name, file) => {
  try {
    const pkg = createRequire(import.meta.url).resolve(`@deepseek-ai/${name}/package.json`)
    return readFileSync(join(dirname(pkg), file), 'utf8')
  } catch { return null }
}

const layout = shell('dsh-client-ui-layout', 'lib/client.js')
const sidebar = shell('dsh-client-ui-sidebar', 'lib/client.js')
const absent = 'no @deepseek-ai shell package to read in this checkout'

test('the shell still marks its frame with the collapsed sidebar', { skip: layout ? false : absent }, () => {
  assert.match(layout, /data-sidebar-collapsed/)
})

test('the layout service still closes the sidebar through toggleSidebar', { skip: layout ? false : absent }, () => {
  assert.match(layout, /toggleSidebar/)
})

test('the workspaces slot still hands over expandSidebar', { skip: sidebar ? false : absent }, () => {
  // Matched with its guard: the call must stay a no-op on an open column, or the band's
  // entry would fold a sidebar the user already had up.
  assert.match(sidebar, /expandSidebar\s*:\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*collapsed\s*\)\s*toggleSidebar\(\)/)
})
