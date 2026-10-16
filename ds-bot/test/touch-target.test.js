// A finger is not a cursor: the phone's floor for anything a thumb is meant to hit is 44 CSS px,
// and the bars this skin draws use one shape for their keys -- 48px of finger, no fill, a 12px
// press shape, a 22px glyph. This is the lint that keeps both true. It is a lint, not a style
// preference: a control that declares a box under the floor is reported with its file and line,
// and the only way past it is a written reason in EXEMPT below.
//
// Two things it can see. First, the named keys: every title-bar icon key this skin draws is read
// out of its module and held to the one shape, so a key cannot quietly go back to 40px, back to a
// fill, or back to a hit that only a ::after could reach. Second, a sweep: every rule the phone
// band declares that sets both a width and a height in px must clear the floor, unless its subject
// is a glyph (an <svg>, which is a drawing inside a target rather than one) or it is exempted with
// a reason.
//
// What it cannot see is honest to write down: a box that comes from padding, a min-height, a
// selector that is not written against the phone band (the wide layouts are the shell's and the
// desktop's), and a box the band inherits from an unbounded rule. Those are the places where a
// small target could still hide, so this is a floor on the rules, not a proof about the screen.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const DIR = new URL('../src/client/', import.meta.url)
/** The floor for a thumb: what a press target must measure at least. */
const FLOOR = 44
/** The one shape the phone's title-bar keys wear. */
const KEY = 48
const KEY_GLYPH = 22
const KEY_RADIUS = 12

const read = (name) => readFileSync(new URL(name, DIR), 'utf8')

/** Blanks out block and line comments, keeping every newline so line numbers survive. A `//` inside a
 *  value (a data: URL's own http://) is not a comment, so a colon in front of it keeps the text. */
const uncommented = (text) => {
  const out = text.split('')
  let i = 0
  while (i < text.length) {
    const block = text.startsWith('/*', i)
    const line = text.startsWith('//', i) && text[i - 1] !== ':'
    if (!block && !line) { i += 1; continue }
    const close = block ? text.indexOf('*/', i + 2) : text.indexOf('\n', i)
    const end = close === -1 ? text.length : close + (block ? 2 : 0)
    for (let j = i; j < end; j += 1) if (out[j] !== '\n') out[j] = ' '
    i = end
  }
  return out.join('')
}

/** Every leaf rule of every CSS-bearing client module: { file, line, selector, body }. */
const rules = () => {
  const found = []
  for (const file of readdirSync(DIR).filter(name => name.endsWith('.js'))) {
    const text = uncommented(read(file))
    const pattern = /([^{}]*)\{([^{}]*)\}/g
    let match
    while ((match = pattern.exec(text))) {
      const selector = match[1].trim()
      if (selector) found.push({ file, line: text.slice(0, match.index + match[1].length).split('\n').length, selector, body: match[2] })
    }
  }
  return found
}

/** The box a rule declares, when it declares both sides in px (a padding-sized box is not one). */
const box = (body) => {
  const width = body.match(/(?:^|;)\s*width:(\d+(?:\.\d+)?)px/)
  const height = body.match(/(?:^|;)\s*height:(\d+(?:\.\d+)?)px/)
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : null
}

const ruleFor = (all, file, selector) => all.find(rule => rule.file === file && rule.selector === selector)

// The title-bar icon keys, in the three bars the phone draws. Each carries the same shape; only the
// ink differs, because a back key is navigation and the bar's primary action is the one full-ink key.
// The rule and the button that wears it are not always declared by the same module (the settings row
// marks the button up in settings.js and the bar's own shape lives with the skin), so each key names
// both.
const KEYS = [
  { file: 'peers-page.js', selector: 'html[data-bt-mobile] .bt-peers-new', button: "type: 'button', className: 'bt-peers-new'", buttonFile: 'peers-page.js', note: 'the 伙伴 page\u2019s New, the bar\u2019s primary action, in full ink' },
  { file: 'styles.js', selector: 'html[data-bt-mobile] .bt-settings-top>.bt-icon-btn', button: "type: 'button', className: 'bt-icon-btn', 'aria-label': backLabel", buttonFile: 'settings.js', note: 'the settings bar\u2019s back / page key, in the quiet ink' },
  { file: 'browser-pane.js', selector: 'html[data-bt-mobile] .bt-sheet-close', button: "className: 'bt-sheet-close'", buttonFile: 'browser-pane.js', note: 'the 全部产物 sheet\u2019s close, in the quiet ink' },
  { file: 'discover-page.js', selector: 'html[data-bt-mobile] .bt-subback-btn', glyph: 'html[data-bt-mobile] .bt-subback-btn>svg', button: "type: 'button', className: 'bt-subback-btn'", buttonFile: 'discover-page.js', note: 'the strip over a shell panel\u2019s second level, in the page\u2019s ink' },
]

// Rules the sweep lets through, each with the reason it is not a target of its own. An entry that
// stops naming an offender is reported too: a stale reason rots exactly like a missing one.
const EXEMPT = new Map([
  ['html[data-bt-mobile] .bt-sheet-handle', 'not a target: the 4px pill the eye sees; the 44px band around it (.bt-sheet-grip) is what a thumb grabs'],
])

/** Shapes that are never a target of their own, whatever they measure: a dot, a rule, a glyph, a
 *  decoration, a spinner, or a picture inside a row that is itself the thing you press. Widening the
 *  sweep to every rule the phone ends up with (below) is what makes this list necessary -- and the
 *  shapes are what keeps it short enough to read. */
const NOT_A_TARGET = [
  /::(before|after)$/,                    // a decoration: it paints, it is not in the accessibility tree
  /\s(svg|i|b|em|span)$/,                 // a mark drawn inside a target
  /svg\./,                                // a drawn mark with its own class
  /-dot$|-spin$|-badge$|-star$|-warn$|-sep$|-slash$|-ico$|-icon$|-glyph$|-ava$|-you$|-tick$|-lock$|-sr$/,
  /\.bt-badge-working$|\.bt-admin-star$|\.bt-unread$|\.bt-connector-mark$|\.bt-dcard-ico$|\.bt-theme-chip i$/,
  /\.bt-settings-close$/,                 // the wide dialog's close: hidden on the phone
]

/** The phone's small targets, named one by one so they can be worked through (audit 批②). Every one of
 *  them is a real target: it is here only until it gets its box, and the list is checked for stale
 *  entries exactly like EXEMPT -- fix it, delete its line, and the test tells you if a line was left
 *  behind after the rule changed under it. */
const WORKLIST = new Map([
['.bt-mobile-acts .bt-attention', '44×40'],
  ['.bt-switch', '36×20'],
  ['.bt-ptab-fav', '14×14'],
  ['.bt-ptab-x', '16×16'],
  ['.bt-ptab-new', '28×32'],
  ['.bt-bcard-fav', '14×14'],
  ['.bt-bcard-x', '22×22'],
  ['.bt-fp-open', '30×30'],
  ['.bt-task-day', '30×30'],
  ['.bt-round', '36×36'],
  ['.bt-nc-plus', '34×34'],
  ['.bt-nc-send', '34×34'],
  ['.bt-swatch', '22×22'],
  ['.bt-avatar-pencil', '22×22'],
  ['.bt-icon-btn', '28×28'],
  ['.bt-tool', '24×24'],
  ['.bt-palette-clear', '18×18'],
  ['.bt-palette-lead', '24×24'],
  ['.bt-palette-cmd', '24×24'],
  ['.bt-palette-agent', '24×24'],
  ['.bt-account', '36×36'],
  ['.bt-theme-chip', '46×30'],
  ['.bt-mem-head .bt-icon-btn', '32×32'],
  ['.bt-mem-reply .bt-icon-btn', '24×24'],
  ['.bt-mobile-left .bt-mobile-nav', '44×40'],
  ['[data-chat-flow-kind=user] [class*="_actions"] button', '24×24'],
  ['.bt-news-x', '20×20'],
  ['.bt-us-month-nav', '28×28'],
  ['.bt-us-day>b', '28×28'],
  ['.bt-us-stub', '4×4'],
])

test('every title-bar icon key is the one shape: 48px of finger, no fill, a 12px press, a 22px glyph', () => {
  const all = rules()
  for (const key of KEYS) {
    const rule = ruleFor(all, key.file, key.selector)
    assert.ok(rule, `${key.file}: no rule declares ${key.selector} (${key.note})`)
    const declared = box(rule.body)
    assert.deepEqual(declared, { width: KEY, height: KEY }, `${key.file}:${rule.line} ${key.note} is ${declared?.width}×${declared?.height}, not ${KEY}×${KEY}`)
    assert.ok(rule.body.includes('background:none'), `${key.file}:${rule.line} the key draws a face of its own; a title-bar key sits on the bar`)
    assert.ok(rule.body.includes(`border-radius:${KEY_RADIUS}px`), `${key.file}:${rule.line} the key\u2019s press shape is not ${KEY_RADIUS}px`)
    assert.ok(!rule.body.includes(':hover'), `${key.file}:${rule.line} a key answers a press, not a hover an Android tap leaves stuck`)
    const glyph = ruleFor(all, key.file, key.glyph ?? `${key.selector} svg`)
    assert.deepEqual(glyph && box(glyph.body), { width: KEY_GLYPH, height: KEY_GLYPH }, `${key.file}: ${key.selector} draws its glyph at ${glyph ? `${box(glyph.body)?.width}px` : 'no declared size'}, not ${KEY_GLYPH}px`)
    assert.ok(read(key.buttonFile).includes(key.button), `${key.buttonFile}: ${key.selector} is not on a <button>, so the skin\u2019s unified :active is not what answers a tap`)
  }
  // The class the settings bar's both keys read underneath: no ring of its own, so the shape above is
  // the whole of what a press paints.
  assert.ok(read('styles.js').includes('.bt-icon-btn{width:28px;height:28px;border-radius:50%;border:0;background:none'), 'the shared icon-button class keeps border:0 and background:none as its base')
  assert.ok(read('styles.js').includes(':active:not(:disabled):not(.bt-swatch-default):not(.bt-nav-tab){background-image:linear-gradient(var(--bt-press),var(--bt-press))!important'), 'and the one press tint still reaches every button on the phone band')
})

test('no rule the phone ends up with declares a target under the floor', () => {
  // The phone's effective sheet is the global rules plus the banded ones -- every rule that is not the
  // desktop band's. Scanning only the rules that spell out html[data-bt-mobile] left the whole global
  // section blind, which is where most of the small boxes live (Lead's dispatch for 批②).
  const offenders = rules()
    .filter(rule => !rule.selector.includes('data-bt-pc'))
    .map(rule => ({ ...rule, declared: box(rule.body) }))
    .filter(rule => rule.declared)
    // A glyph is a drawing inside a target, not a target: its subject is an <svg>.
    .filter(rule => !/(^|\s|>)svg\s*$/.test(rule.selector))
    .filter(rule => !NOT_A_TARGET.some(pattern => pattern.test(rule.selector)))
    .filter(rule => rule.declared.width < FLOOR || rule.declared.height < FLOOR)

  const stale = [...EXEMPT.keys(), ...WORKLIST.keys()].filter(selector => !offenders.some(rule => rule.selector === selector))
  assert.deepEqual(stale, [], `an exemption that no longer names an offender is hiding nothing: ${stale.join(', ')}`)

  const found = offenders
    .filter(rule => !EXEMPT.has(rule.selector) && !WORKLIST.has(rule.selector))
    .map(rule => `${rule.file}:${rule.line} ${rule.selector} ${rule.declared.width}×${rule.declared.height}`)
  assert.deepEqual(found, [], `a target under ${FLOOR}px on the phone: give it the box, or write the reason into EXEMPT`)
})
