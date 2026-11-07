import { createElement as h, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChatsIcon, ClockIcon, GoalIcon, ImageIcon, MicIcon, PaperclipIcon, PeopleIcon, PlusIcon, WaveIcon } from './icons.js'
import { canSetGoal } from './goal.js'
import { BotMark } from './mark.js'
import { stepMenuFocus, useLinger, useViewport, viewBottom } from './motion.js'
import { t } from './i18n.js'
import { insertComposerNewline, sendsOnEnter } from './enter-key.js'
import { enterSteers, steerable } from './enter-steer.js'

// -------------------------------------------------------------------------
// Composer: dictation mic and the voice-chat button. The shell's send
// button stays the submit path; CSS swaps it with the voice button while the draft is
// empty (the send button is disabled then).

export const speechApi = () => window.SpeechRecognition ?? window.webkitSpeechRecognition
const keepComposerFocus = event => event.preventDefault()

export function useDictation(onText) {
  const [listening, setListening] = useState(false)
  const [note, setNote] = useState('')
  const recognition = useRef(null)
  const latest = useRef(onText)
  latest.current = onText
  useEffect(() => () => recognition.current?.abort(), [])
  useEffect(() => {
    if (!note) return undefined
    const timer = setTimeout(() => setNote(''), 2600)
    return () => clearTimeout(timer)
  }, [note])
  const start = ({ continuous = true, onEnd } = {}) => {
    const Api = speechApi()
    if (!Api) { setNote(t('Dictation is not available in this browser')); return false }
    const engine = new Api()
    engine.lang = navigator.language || 'zh-CN'
    engine.interimResults = true
    engine.continuous = continuous
    engine.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) { if (text.trim()) latest.current(text, true) } else interim += text
      }
      if (interim) latest.current(interim, false)
    }
    engine.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      setNote(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? t('Microphone access is blocked') : t("Couldn't hear that"))
    }
    engine.onend = () => { setListening(false); recognition.current = null; onEnd?.() }
    recognition.current = engine
    try { engine.start(); setListening(true); return true } catch { setNote(t("Couldn't start dictation")); return false }
  }
  const stop = () => recognition.current?.stop()
  return { listening, note, start, stop }
}

export function ComposerVoice({ sessionId, inputActions, actions, useUi, useRoster }) {
  const enterToSend = useRoster(state => sendsOnEnter(state.prefs))
  const composerRoot = useRef(null)
  useEffect(() => {
    const root = composerRoot.current?.closest('[data-composer-card]')
    if (enterToSend || !inputActions || !root) return undefined
    const onKey = event => insertComposerNewline(event, inputActions)
    root.addEventListener('keydown', onKey, true)
    return () => root.removeEventListener('keydown', onKey, true)
  }, [enterToSend, inputActions])
  const dictation = useDictation((text, final) => {
    if (final && inputActions) inputActions.insertText(text, inputActions.captureInsertion())
  })
  // Reply from a message's hover toolbar quotes it into this composer.
  const quote = useUi(state => (state.quote?.sessionId === sessionId ? state.quote : null))
  useEffect(() => {
    if (!quote || !inputActions) return
    actions.clearQuote(quote.token)
    const excerpt = quote.text.replace(/\s+/g, ' ').trim()
    const line = `> ${excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt}\n\n`
    inputActions.insertText(line, inputActions.captureInsertion())
    const box = document.querySelector('[class*="_centerCol"] [role=textbox][contenteditable=true]')
    if (box instanceof HTMLElement) {
      box.focus()
      const selection = window.getSelection()
      selection?.selectAllChildren(box)
      selection?.collapseToEnd()
    }
  }, [quote?.token])
  if (sessionId === undefined) return null
  // With the Voice Input plugin on, its own microphone sits in this composer.
  const pluginMic = actions.speech() !== undefined
  return h(Fragment, null,
    pluginMic ? null : h('button', {
      type: 'button', className: 'bt-mic', 'aria-label': dictation.listening ? t('Stop dictation') : t('Dictate'),
      'aria-pressed': dictation.listening, title: dictation.listening ? t('Stop dictation') : t('Dictate'),
      onMouseDown: keepComposerFocus, onClick: () => (dictation.listening ? dictation.stop() : dictation.start()),
    }, h(MicIcon)),
    h('button', {
      ref: composerRoot, type: 'button', className: 'bt-voice', 'aria-label': t('Start voice chat'), title: t('Voice chat'),
      onMouseDown: keepComposerFocus, onClick: () => actions.openVoice(sessionId),
    }, h(WaveIcon)),
    dictation.note ? h('span', { className: 'bt-mic-note', role: 'status' }, dictation.note) : null)
}

// Character marks for the "@" menu rows. Each Bot keeps one component, so the menu
// does not remount its mark on every keystroke.
export function menuIcons(roster) {
  const marks = new Map()
  return (row) => {
    if (!row.bot) return PeopleIcon
    const id = row.bot.id
    if (!marks.has(id)) marks.set(id, ({ size = 14 }) => h(BotMark, { bot: roster.getSnapshot().byId[id] ?? row.bot, size }))
    return marks.get(id)
  }
}

// The composer's "+" in a Bot's chat or a group chat: add files, reference another
// chat, or set a scheduled task for this chat. It stands in for the shell's command
// menu, whose plan, permission, model and compact rows reach past what DS Bot keeps
// for its Bots; "/" still opens that menu. Files go through the shell's own file
// input beside it.
export function ComposerPlus({ sessionId, inputActions, useInput, useRoster, actions }) {
  const roster = useRoster(value => value)
  const [open, setOpen] = useState(null)
  const [shown, leaving] = useLinger(open, 120)
  const button = useRef(null)
  const menu = useRef(null)
  const tick = useViewport()
  // The selector runs on every input change, so inputNow stays live for the key
  // handler while `ready` re-renders only when steerability flips.
  const inputNow = useRef(undefined)
  const ready = useInput?.((state) => { inputNow.current = state; return steerable(state) }) === true
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (![button.current, menu.current].some(node => node?.contains(event.target))) setOpen(null) }
    const onKey = (event) => {
      if (stepMenuFocus(menu.current, event, button.current)) return
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(null) }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  // No deps: the "+" can mount after this effect first ran, and the card swap on a
  // session switch must pick the placeholder up again.
  useEffect(() => {
    const card = button.current?.closest('[data-composer-card]')
    if (!ready || card === null || card === undefined) return undefined
    card.style.setProperty('--bt-placeholder', JSON.stringify(t('Press Enter to steer queued messages')))
    return () => card.style.removeProperty('--bt-placeholder')
  })
  useEffect(() => {
    let steering = false
    const onKey = (event) => {
      if (steering || event.defaultPrevented || open) return
      const target = event.target
      if (typeof target?.closest !== 'function') return
      const card = button.current?.closest('[data-composer-card]')
      if (card === null || card === undefined || target.closest('[data-composer-card]') !== card) return
      if (target.closest('[contenteditable=true]') === null) return
      if (target.closest('[data-composer-composing]')) return
      if (target.ownerDocument?.querySelector('[role="listbox"]')) return
      if (!enterSteers(event, inputNow.current)) return
      event.preventDefault()
      event.stopPropagation()
      steering = true
      void Promise.resolve(actions.steerQueued(sessionId)).finally(() => { steering = false })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, sessionId])
  // Hooks stay above the early return below: the roster may not know the Bot yet, and a
  // render that skips a hook breaks the composer's slot when the roster arrives.
  // Anchored to the "+" each render: the visible viewport can move (on-screen
  // keyboard) while the menu is open.
  const place = useMemo(() => {
    if (!shown || !button.current) return null
    const rect = button.current.getBoundingClientRect()
    return { left: rect.left, bottom: viewBottom() - rect.top + 8 }
  }, [shown, open, tick])

  const target = roster.byId?.[sessionId]?.id ?? roster.roomsById?.[sessionId]?.id
  if (sessionId === undefined) return null
  // A composer without a file input has nothing to hand the picker. The card is
  // looked up through the button first; when the phone layout moves the plus out of
  // the card, the card is still found on its own before giving up.
  // Our own picker inputs must never be the target: handing the files back to them
  // would only re-enter this component and leave the shell's intake untouched.
  const SHELL_INPUT = 'input[type=file]:not(.bt-menu-input)'
  const fileInput = () => button.current?.closest?.('[data-composer-card]')?.querySelector(SHELL_INPUT)
    ?? document.querySelector?.(`[data-composer-card] ${SHELL_INPUT}`)
    ?? document.querySelector?.(SHELL_INPUT)
    ?? null
  const toggle = () => {
    if (open) { setOpen(null); return }
    setOpen({ files: Boolean(fileInput()) })
  }
  // The two upload rows are plain buttons that click their own input: a click on a
  // label or on the input itself loses its default action in this page's capture
  // handlers, while a button's handler still runs (the rows beside them work so).
  // The shell's own field is marked `hidden`, and a WebView opens no picker for a click
  // on a hidden control: it is shown off-screen for that click and put back at once. The
  // files then reach the shell through its own change handler, as its paperclip would.
  const pickFile = (kind) => {
    const input = fileInput()
    setOpen(null)
    if (input === null) {
      // No shell field at all: our own input collects the files and hands them over.
      ;(kind === 'image' ? imagePick : filePick).current?.click()
      return
    }
    const accept = kind === 'image' ? 'image/*' : null
    const prior = { accept: input.getAttribute('accept'), hidden: input.hasAttribute('hidden'), style: input.getAttribute('style') }
    if (accept !== null) input.setAttribute('accept', accept)
    if (prior.hidden) {
      input.removeAttribute('hidden')
      input.setAttribute('style', 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0')
    }
    // Put back only after the chooser has taken the request (and never before the files
    // arrive): restoring on the same tick could undo it in a WebView that reads the
    // field later.
    const restore = () => {
      if (prior.hidden) {
        input.setAttribute('hidden', '')
        if (prior.style === null) input.removeAttribute('style')
        else input.setAttribute('style', prior.style)
      }
      if (accept !== null) {
        if (prior.accept === null) input.removeAttribute('accept')
        else input.setAttribute('accept', prior.accept)
      }
    }
    input.addEventListener('change', restore, { once: true })
    input.click()
    setTimeout(restore, 30_000)
  }
  const filePick = useRef(null)
  const imagePick = useRef(null)
  const handFiles = (event) => {
    const picked = event.target.files
    const input = fileInput()
    if (event.target.value !== undefined) event.target.value = ''
    setOpen(null)
    if (!input || !picked || picked.length === 0) return
    try {
      const transfer = new DataTransfer()
      for (const file of picked) transfer.items.add(file)
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    } catch {
      // Without a transferable FileList the shell's own click path is the only one left.
      input.click()
    }
  }
  const schedule = () => {
    setOpen(null)
    actions.openSettings('schedules', target)
  }
  // The chats open in the shell's "@" menu at the caret, so the pick lands where the
  // user was typing.
  const reference = () => {
    setOpen(null)
    actions.referenceChat(sessionId, inputActions?.captureInsertion?.())
  }
  const canReference = target !== undefined && typeof inputActions?.captureInsertion === 'function' && actions.canReferenceChat()
  const room = roster.roomsById?.[sessionId]
  const goal = () => {
    setOpen(null)
    actions.composeGoal(room.id)
  }
  return h(Fragment, null,
    h('button', {
      ref: button, type: 'button', className: 'bt-plus', 'aria-label': t('Add'), title: t('Add'),
      'aria-haspopup': 'menu', 'aria-expanded': Boolean(open), onMouseDown: keepComposerFocus, onClick: toggle,
    }, h(PlusIcon)),
    shown ? createPortal(h('div', {
      ref: menu, className: 'bt-menu bt-menu-up bt-plus-menu', role: 'menu', 'aria-label': t('Add'),
      style: place ?? {}, 'data-leaving': leaving || undefined,
    },
    shown.files ? h('button', { type: 'button', role: 'menuitem', onClick: () => pickFile('file') }, h(PaperclipIcon), h('span', { className: 'bt-menu-label' }, t('Add files'))) : null,
    shown.files ? h('button', { type: 'button', role: 'menuitem', onClick: () => pickFile('image') }, h(ImageIcon), h('span', { className: 'bt-menu-label' }, t('Add image'))) : null,
    shown.files ? h('input', { ref: imagePick, type: 'file', accept: 'image/*', multiple: true, className: 'bt-menu-input', onChange: handFiles }) : null,
    shown.files ? h('input', { ref: filePick, type: 'file', multiple: true, className: 'bt-menu-input', onChange: handFiles }) : null,
    canReference ? h('button', { type: 'button', role: 'menuitem', onMouseDown: keepComposerFocus, onClick: reference }, h(ChatsIcon), h('span', { className: 'bt-menu-label' }, t('Reference a chat'))) : null,
    canSetGoal(room, roster) ? h('button', { type: 'button', role: 'menuitem', onClick: goal }, h(GoalIcon), h('span', { className: 'bt-menu-label' }, t('Set a goal'))) : null,
    target !== undefined ? h('button', { type: 'button', role: 'menuitem', onClick: schedule }, h(ClockIcon), h('span', { className: 'bt-menu-label' }, t('Scheduled task'))) : null), document.body) : null)
}
