import { createElement as h, useEffect } from 'react'
import { SkillMarketPanel, readySkillMarket } from './skill-market/panel.js'

// The shell's Plugins page takes extra tabs through its `plugins.tab` slot, and the entry
// draws the whole tab body. Skills live in the vendored market panel, so the tab is that
// panel in a frame that has a definite height: the panel sizes itself to its parent.
export function SkillsTab() {
  useEffect(() => { readySkillMarket() }, [])
  return h('div', { className: 'bt-market-skillhost', 'data-bt-skills': '' }, h(SkillMarketPanel))
}
