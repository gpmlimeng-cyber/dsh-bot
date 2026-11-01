// Settings → SuperAgent: the behaviour switches we added around the Bot team, on one
// page. Every switch is on unless someone wrote `false`, and the threshold is the only
// number here: it decides where a group line folds, never whether the reply is kept.
import { createElement as h, Fragment, useState } from 'react'
import { t } from './i18n.js'
import { Switch } from './bot-settings.js'
import { foldAtOf } from './themes.js'

const SWITCHES = [
  ['superagent', 'Hand-offs', 'Records a Bot handing work to another Bot, and asks before one is delivered.'],
  ['saFold', 'Group lines', 'Folds a long reply in a group chat under its first lines, so the chat reads as short messages.'],
  ['saConclude', 'Lead with the conclusion', 'Asks a Bot to open with a sentence under about 100 characters, then the detail.'],
  ['saLookup', 'Look it up', 'Asks a Bot to read an earlier message or a file again instead of answering from memory.'],
  ['saBackground', 'Long commands', 'Asks a Bot to run a slow command in the background and read its result when it settles.'],
  ['saPrepare', 'Prepare ahead', 'Lets a Bot read, list and look things up on its own guess, but not edit, message or start work before it is asked.'],
]

// The switches sit in the system prompt, so turning one changes the prompt's text: the
// next turn picks it up, and that Session's cached prefix misses once.
function Threshold({ Row, prefs, run, actions }) {
  const at = foldAtOf(prefs)
  const [chars, setChars] = useState(String(at.chars))
  const [lines, setLines] = useState(String(at.lines))
  const save = () => {
    const next = { chars: Number(chars), lines: Number(lines) }
    if (!Number.isInteger(next.chars) || !Number.isInteger(next.lines)) return
    run(actions.setPrefs({ saFoldAt: next }))
  }
  const field = (label, value, set, min, max) => h('input', {
    type: 'number', className: 'bt-input', style: { width: 88 }, min, max, step: 1, value,
    'aria-label': label,
    onChange: (event) => { set(event.target.value); }, onBlur: save,
  })
  return h(Row, {
    label: t('Fold threshold'),
    hint: t('Characters {chars}, lines {lines}: a longer or taller reply folds. Between 300 and 20000 characters, 8 and 500 lines.', { chars: at.chars, lines: at.lines }),
  },
    field(t('Characters'), chars, setChars, 300, 20_000),
    field(t('Lines'), lines, setLines, 8, 500))
}

export function SuperAgentPage({ roster, actions, run, Section, Row }) {
  const prefs = roster.prefs ?? {}
  return h(Fragment, null,
    h(Section, { title: t('How Bots work') },
      SWITCHES.map(([key, label, hint]) => h(Row, { key, label: t(label), hint: t(hint) },
        h(Switch, { label: t(label), on: prefs[key] !== false, onChange: on => run(actions.setPrefs({ [key]: on })) })))),
    h(Section, { title: t('Group chat') },
      h(Threshold, { Row, prefs, run, actions }),
      h('p', { className: 'bt-set-hint' }, t('A reply that marks where its detail starts folds there, keeping the whole point above it, and only when the detail is long enough. A reply over 20,000 characters goes as a file instead.'))))
}
