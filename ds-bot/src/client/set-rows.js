// The small rows and controls the Settings pages are built from: the section and row shells, the
// switch, and the one animation control. They live in a leaf of their own because more than one page
// draws them -- the Bot form, the settings pages, and the 伙伴 list -- and a page that only wants the
// control must not carry the form's own dependencies with it.
import { createElement as h } from 'react'
import { Segmented } from './motion.js'
import { t } from './i18n.js'

export function SetSection({ title, children }) {
  return h('section', { className: 'bt-set-section' }, h('h3', null, title), h('div', { className: 'bt-set-card' }, children))
}

export function SetRow({ label, hint, children }) {
  return h('div', { className: 'bt-set-row' },
    h('div', { className: 'bt-set-copy' }, h('span', null, label), hint ? h('span', { className: 'bt-set-hint' }, hint) : null),
    children ? h('div', { className: 'bt-set-control' }, children) : null)
}

export function Switch({ on, label, disabled, onChange }) {
  return h('button', { type: 'button', role: 'switch', className: 'bt-switch', 'aria-checked': on, 'aria-label': label, disabled, onClick: () => onChange(!on) },
    h('span', { className: 'bt-switch-knob', 'aria-hidden': true }))
}

// One skin-wide animation level, drawn once and read everywhere: every Bot mark animates at it
// (index.js publishes it as body[data-bt-motion]). The three levels are read the way that file
// publishes them: one of the three, and anything else (including nothing at all) is the middle one.
export const MOTIONS = [['quiet', 'Quiet'], ['normal', 'Normal'], ['lively', 'Lively']]

export function motionOf(roster) {
  const value = roster.prefs?.motion
  return value === 'quiet' || value === 'lively' ? value : 'normal'
}

// The same three levels as the control alone -- same ids, same words, same action -- for a page that
// offers them where they are read rather than in a row of their own (伙伴, beside that list's
// heading). Two places drawing this control must not be two values.
export function MotionControl({ roster, actions, run, className }) {
  const motion = motionOf(roster)
  return h(Segmented, { label: t('Bot animation'), value: motion, className: className ?? 'bt-motion-seg' },
    MOTIONS.map(([id, label]) => h('button', {
      key: id, type: 'button', 'aria-pressed': motion === id,
      onClick: () => { if (motion !== id) run(actions.setPrefs({ motion: id })) },
    }, t(label))))
}

export function MotionSection({ roster, actions, run }) {
  return h(SetSection, { title: t('Animation') },
    h(SetRow, { label: t('Bot animation') },
      h(MotionControl, { roster, actions, run })))
}
