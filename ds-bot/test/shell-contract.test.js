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
// Two more things the PC band's stylesheet reads off the shell, added when the band's three
// top rows were put on one line: the sidebar column's class suffix (the band pins the
// hamburger to that column, one address that neither the column's width nor the shell's
// padding can move) and the top padding the shell's own sidebar root carries in each of the
// column's two widths. The band cannot read that padding from CSS -- the class is hashed and
// the amount is upstream's -- so it mirrors it into `--bt-shell-pad-top` and the open row
// takes the last 4px from the difference. A mirror rots, so this is what tells us it did.
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

// Our band's rule is `[class*="_sidebarCol"]`; CSS modules hash the prefix, so the suffix is
// the part the shell can be held to. Losing it would not break the line (the frame itself is
// positioned, and it starts at y=0 too) but the button would be clipped by the sidebar column
// again in the folded width, so a red test here is the early warning, not a crash.
test('the layout still names the sidebar column that the band hangs the button off', { skip: layout ? false : absent }, () => {
  assert.match(layout, /_sidebarCol\s*\{/)
})

// Both numbers the band mirrors, read from the shell rather than restated: the shell's sidebar
// root with the column open, and the same root once the column is the rail. If upstream pads
// either one differently, the band's own arithmetic (4px onto the line, 44px onto the rail's
// first control) is wrong from that build on -- and it would be wrong silently, as a 2 or 4px
// seam between three rows that are supposed to share one line.
test('the shell still pads its sidebar root by what the band mirrors', { skip: sidebar ? false : absent }, () => {
  const rules = [...sidebar.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([, sel, body]) => [sel, body])
  const root = rules.filter(([sel]) => /_root(\.|$)/.test(sel.trim().replace(/^[^\w.#\-[]+/, '')))
  const padTop = ([, body]) => {
    const found = /(?:^|;)padding:([^;]+)/.exec(body)
    return found ? Number(found[1].trim().split(/\s+/)[0].replace('px', '')) : null
  }
  const open = root.filter(([sel]) => !/collapsed/.test(sel)).map(padTop).find(value => value !== null)
  const folded = root.filter(([sel]) => /collapsed/.test(sel)).map(padTop).find(value => value !== null)
  const own = readFileSync(new URL('../src/client/styles.js', import.meta.url), 'utf8')
  const band = /html\[data-bt-pc\]\{--bt-shell-pad-top:(\d+)px\}/.exec(own)
  const rail = /\.bt-side\.bt-rail\{--bt-shell-pad-top:(\d+)px/.exec(own)
  assert.ok(open !== null && folded !== null && band && rail, 'every side of the mirror is readable')
  assert.equal(Number(band[1]), open)
  assert.equal(Number(rail[1]), folded)
})
