import { createElement as h, Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CommandPalette } from './palette.js'
import { NewChat } from './new-chat.js'
import { ExchangeDialog } from './exchange.js'
import { VoiceMode } from './voice.js'
import { SettingsDialog } from './settings.js'
import { ContextMenu } from './context-menu.js'
import { PANEL_LINGER_MS, BotPanel } from './browser-pane.js'
import { DeliveredLightbox } from './deliverables.js'
import { MemoryDialog } from './memory-panel.js'
import { useLinger } from './motion.js'

// How long a closing dialog or menu stays for its exit (see their [data-leaving] CSS).
const DIALOG_EXIT_MS = 160
const MENU_EXIT_MS = 120

export function Overlays({ useRoster, useUi, useSessions, useSessionStatus, useActivity, useWork, useRegistry, useBrowserPages, useBrowserTabs, useUpdate, actions }) {
  const roster = useRoster(value => value)
  const ui = useUi(value => value)
  useRegistry(value => value)
  const current = useSessions(list => Object.values(list.byId).find(session => (session?.retainedBy?.mainView ?? 0) > 0)?.id ?? null)
  // An open panel follows the conversation in the main view. Only a change of the
  // main view moves it, so opening details for another id (Rename) is not undone.
  const previous = useRef(current)
  useEffect(() => {
    if (previous.current === current) return
    previous.current = current
    if (current) actions.followPanel?.(current)
  }, [current])
  // A preview stands on its own: it needs no conversation behind it, so the panel opens
  // for it even when no subject is selected at all.
  const open = ui.details
    ? { id: ui.details, view: ui.view ?? 'details', renaming: ui.renaming, tab: ui.tab, preview: ui.preview }
    : ui.preview ? { id: '', view: 'preview', renaming: false, tab: null, preview: ui.preview }
      : ui.products && ui.view === 'products' ? { id: '', view: 'products', renaming: false, tab: null } : null
  const [kept, setKept] = useState(open)
  useEffect(() => {
    if (open) { setKept(open); return undefined }
    const timer = setTimeout(() => setKept(null), PANEL_LINGER_MS)
    return () => clearTimeout(timer)
  }, [ui.details, ui.view, ui.renaming, ui.tab, ui.preview, ui.products])
  const pane = open ?? kept
  const [settings, settingsLeaving] = useLinger(ui.settings, DIALOG_EXIT_MS)
  const [memory, memoryLeaving] = useLinger(ui.memory && roster.byId[ui.memory] ? ui.memory : null, DIALOG_EXIT_MS)
  const [menu, menuLeaving] = useLinger(ui.menu, MENU_EXIT_MS)
  return h(Fragment, null,
    pane ? createPortal(h(BotPanel, { pane, leaving: open === null, roster, actions, useSessions, useSessionStatus, useActivity, useWork, useBrowserTabs, useBrowserPages }), document.body) : null,
    ui.newChat ? createPortal(h(NewChat, { key: ui.newChat, mode: ui.newChat, roster, actions }), document.body) : null,
    ui.palette ? createPortal(h(CommandPalette, { key: ui.palette.token, start: ui.palette.query, token: ui.palette.token, roster, actions, useSessions }), document.body) : null,
    ui.exchange ? createPortal(h(ExchangeDialog, { pair: ui.exchange, roster, actions }), document.body) : null,
    ui.voice ? createPortal(h(VoiceMode, { key: ui.voice, sessionId: ui.voice, roster, actions, useSessions, useSessionStatus }), document.body) : null,
    menu ? createPortal(h(ContextMenu, { key: `${menu.kind ?? ''}:${menu.id}:${menu.x}:${menu.y}`, menu, roster, actions, leaving: menuLeaving }), document.body) : null,
    settings ? createPortal(h(SettingsDialog, { page: settings.page, id: settings.id, tab: settings.tab === true, from: settings.from ?? null, roster, actions, useUpdate, leaving: settingsLeaving }), document.body) : null,
    memory && roster.byId[memory] ? createPortal(h(MemoryDialog, { key: memory, bot: roster.byId[memory], actions, leaving: memoryLeaving }), document.body) : null,
    // A delivered picture reads its bytes first, then opens the platform's own image
    // preview. A read that cannot show it as a picture hands over to the preview page,
    // which keeps the card's two exits in reach.
    ui.lightbox ? createPortal(h(DeliveredLightbox, {
      file: ui.lightbox,
      actions,
      onClose: () => actions.closeLightbox(),
      onUnreadable: () => actions.previewFile(ui.lightbox),
    }), document.body) : null)
}
