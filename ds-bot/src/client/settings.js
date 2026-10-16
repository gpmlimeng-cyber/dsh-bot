import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { ACCENT_INKS, INKS } from './inks.js'
import { isMainOf } from './sources.js'
import { AccountCard, AccountPage, loadAccount, saveAccount } from './account.js'
import { allThemes } from './themes.js'
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, ConnectorIcon, InfoIcon, PlugIcon, PlusIcon, SlidersIcon, SETTINGS_ICONS } from './icons.js'
import { AdminStar, BotAvatar, RoomAvatar } from './mark.js'
import { openHarnessSettings } from './sidebar.js'
import { useMobile } from './mobile.js'
import { useEscape } from './overlay-hooks.js'
import { BotSettingsForm } from './bot-settings.js'
import { MOTIONS, MotionSection, SetRow, SetSection } from './set-rows.js'
import { Segmented, useGlide } from './motion.js'
import { GroupSettingsForm, NewGroupForm } from './group-settings.js'
import { CreateBot } from './create-bot.js'
import { KeyIcon, SecretsPage } from './secret-card.js'
import { UsagePage } from './usage-page.js'
import { ConnectorsPage } from './connectors.js'
import { CapabilitiesPage } from './capability-settings.js'
import { SchedulesPage } from './schedules.js'
import { FeedbackIcon, FeedbackPage } from './feedback.js'
import { AboutPage } from './about.js'
import { t } from './i18n.js'

const capitalize = word => word[0].toUpperCase() + word.slice(1)

// Settings dialog: a 198px page list beside the page. Bots and group chats each list
// their members, and one opens on its own settings form. Usage widens the dialog.
// `account` is a page without a row of its own: 我的's account card opens it (account.js), the way the
// 群聊 door opens the group chats' page. It is listed here so the dialog knows the page exists.
const SETTINGS_PAGES = [['general', 'General'], ['bots', 'Bots'], ['groups', 'Group chats'], ['account', 'Account settings'], ['connectors', 'Connectors'], ['capabilities', 'Capabilities'], ['schedules', 'Scheduled tasks'], ['usage', 'Usage'], ['secrets', 'Secrets'], ['feedback', 'Feedback'], ['about', 'About DS Bot']]
// What the phone's back arrow is called, per door the layer came in through (index.js sets `from`):
// the arrow's name and the arrow's action are one answer, so a button that returns to the 伙伴 list
// is not named for Settings' own list. A new door adds one line here.
const BACK_TO = { peers: 'Back to Peers' }
const PAGE_ICONS = { ...SETTINGS_ICONS, connectors: ConnectorIcon, capabilities: PlugIcon, schedules: ClockIcon, secrets: KeyIcon, feedback: FeedbackIcon, about: InfoIcon }
const PAGE_TEXT = Object.fromEntries(SETTINGS_PAGES)
// The phone draws the list as cards under group headings. The wide dialog's 198px column
// is the same rows with those shells flattened away (display:contents), so one structure
// serves both and the rows never drift apart.
const SETTINGS_GROUPS = [
  // "Common", not "General": the first row inside this card is the General page, and a
  // heading and a row of the same name read as a mistake.
  ['Common', ['general', 'usage']],
  ['Team', ['bots', 'groups']],
  ['Connections & automation', ['connectors', 'capabilities', 'schedules', 'secrets']],
  ['Other', ['feedback', 'about']],
]

function GeneralPage({ roster, actions, run }) {
  const prefs = roster.prefs ?? {}
  const themes = allThemes()
  const current = themes[prefs.theme] ? prefs.theme : 'deepseek'
  const [custom, setCustom] = useState(prefs.accent ?? '#4d6bfe')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const pickCustom = (value) => {
    setCustom(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => run(actions.setPrefs({ accent: value })), 350)
  }
  return [
    h(SetSection, { key: 'look', title: t('Appearance') },
      h(SetRow, { label: t('Theme'), hint: t('Colors for the whole team, on every device.') },
        h('select', { className: 'bt-select', 'aria-label': t('Theme'), value: current, onChange: event => run(actions.setPrefs({ theme: event.target.value })) },
          Object.entries(themes).map(([id, theme]) => h('option', { key: id, value: id }, t(theme.label))))),
      h(SetRow, { label: t('Accent'), hint: t('Unread marks, badges, and the brand mark.') },
        h('div', { className: 'bt-swatches' },
          h('button', { type: 'button', className: 'bt-swatch bt-swatch-default', title: t('Theme accent'), 'aria-label': t('Theme accent'), 'aria-pressed': !prefs.accent, onClick: () => run(actions.setPrefs({ accent: null })) }),
          ACCENT_INKS.map(ink => h('button', {
            key: ink, type: 'button', className: 'bt-swatch', title: t(capitalize(ink)), 'aria-label': t(capitalize(ink)), 'aria-pressed': prefs.accent === INKS[ink][0],
            style: { background: INKS[ink][0] }, onClick: () => run(actions.setPrefs({ accent: INKS[ink][0] })),
          })),
          h('label', { className: 'bt-swatch bt-swatch-custom', title: t('Custom accent'), 'data-on': Boolean(prefs.accent) && !ACCENT_INKS.some(ink => INKS[ink][0] === prefs.accent) },
            h('input', { type: 'color', value: custom, 'aria-label': t('Custom accent'), onChange: event => pickCustom(event.target.value) }))))),
    h(SetSection, { key: 'mode', title: t('Mode') },
      h(SetRow, { label: t('Classic Agent mode') },
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => actions.setSurface('agent') }, t('Switch')))),
  ]
}

// The first Main Bot is the sidebar tile. Picking another Bot there hands it the role
// in one step; more Main Bots can sit beside it.
function MainBotsSection({ roster, actions, run }) {
  const mains = (roster.mainBotIds ?? []).map(id => roster.byId[id]).filter(Boolean)
  const [first, ...others] = mains
  const candidates = roster.bots.filter(bot => !isMainOf(roster, bot.id))
  return h(SetSection, { title: t('Main Bot') },
    h(SetRow, {
      label: t('Main Bot'),
      hint: first ? t('First in the sidebar. Pick another Bot to hand it the role; {name} then stops being a Main Bot.', { name: first.name }) : undefined,
    },
    h('select', {
      className: 'bt-select', 'aria-label': t('Main Bot'), value: first?.id ?? '',
      onChange: event => run(actions.setMain(event.target.value, true, first ? { replace: first.id } : {})),
    }, first ? null : h('option', { value: '' }, t('Choose a Bot…')), roster.bots.map(bot => h('option', { key: bot.id, value: bot.id }, bot.name)))),
    others.map(bot => h(SetRow, { key: bot.id, label: bot.name, hint: t('Also a Main Bot.') },
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => run(actions.setMain(bot.id, true, { primary: true })) }, t('Move to first')),
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => run(actions.setMain(bot.id, false)) }, t('Remove Main Bot role')))),
    candidates.length > 0 ? h(SetRow, { label: t('Add a Main Bot'), hint: t('Main Bots can create and change Bots, and run every group chat.') },
      h('select', {
        className: 'bt-select', 'aria-label': t('Add a Main Bot'), value: '',
        onChange: (event) => { if (event.target.value) void run(actions.setMain(event.target.value, true)) },
      }, h('option', { value: '' }, t('Choose a Bot…')), candidates.map(bot => h('option', { key: bot.id, value: bot.id }, bot.name)))) : null)
}

function BotsPage({ roster, actions, run }) {
  const [creating, setCreating] = useState(false)
  return [
    h(MainBotsSection, { key: 'main', roster, actions, run }),
    h(MotionSection, { key: 'motion', roster, actions, run }),
    creating
      ? h(CreateBot, { key: 'create', roster, actions, inline: true, onBack: () => setCreating(false), onCreated: bot => actions.openSettings('bots', bot.id) })
      : h('div', { key: 'new', className: 'bt-actions' },
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm bt-with-icon', onClick: () => setCreating(true) }, h(PlusIcon), t('New Bot'))),
    h(SetSection, { key: 'bots', title: t('Bots · {count}', { count: roster.bots.length }) },
      roster.bots.map(bot => h('button', { key: bot.id, type: 'button', className: 'bt-set-row', onClick: () => actions.openSettings('bots', bot.id) },
        h('span', { className: 'bt-set-bot' },
          h(BotAvatar, { bot, size: 28, badge: false, live: false }),
          h('span', { className: 'bt-row-title' }, bot.name),
          bot.role ? h('span', { className: 'bt-tag' }, bot.role) : null,
          isMainOf(roster, bot.id) ? h('span', { className: 'bt-tag' }, t('Main Bot')) : null,
          bot.hidden && !isMainOf(roster, bot.id) ? h('span', { className: 'bt-tag' }, t('Hidden')) : null),
        h('span', { className: 'bt-chevron' }, h(ChevronRightIcon))))),
  ]
}

function GroupsPage({ roster, actions, run, creating, setCreating, mobile }) {
  return [
    creating
      ? h(NewGroupForm, { key: 'create', roster, actions, run, onCancel: () => setCreating(false), onCreated: room => actions.openSettings('groups', room.id) })
      // The row is the wide dialog's own door to the form: a phone raises it from the bar instead
      // (styles.js, the title row), so the same control is not drawn twice there.
      : mobile ? null : h('div', { key: 'new', className: 'bt-actions' },
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm bt-with-icon', disabled: roster.bots.length < 2, title: roster.bots.length < 2 ? t('A group chat needs at least two Bots') : undefined, onClick: () => setCreating(true) }, h(PlusIcon), t('Create group chat'))),
    h(SetSection, { key: 'groups', title: t('Group chats · {count}', { count: roster.rooms.length }) },
      roster.rooms.length === 0
        ? h(SetRow, { label: t('No group chats yet.'), hint: t('A group chat lets several Bots work on one thing with you.') })
        : roster.rooms.map((room) => {
            const admin = roster.byId[room.admin]
            return h('button', { key: room.id, type: 'button', className: 'bt-set-row', onClick: () => actions.openSettings('groups', room.id) },
              h('span', { className: 'bt-set-bot' },
                h(RoomAvatar, { room, roster, size: 28 }),
                h('span', { className: 'bt-row-title' }, room.name),
                h('span', { className: 'bt-tag' }, t('{count} members', { count: room.members.length })),
                admin ? h('span', { className: 'bt-tag bt-tag-admin' }, h(AdminStar), admin.name) : null,
                room.hidden ? h('span', { className: 'bt-tag' }, t('Hidden')) : null),
              h('span', { className: 'bt-chevron' }, h(ChevronRightIcon)))
          })),
  ]
}

// While `leaving`, the dialog plays its exit and takes no input.
//
// `tab` says which kind of surface this is on a phone, where the layer is the whole screen either
// way: true when one of the four pages opened it (我的, and 发现's own rows -- index.js, openSettings'
// `door`), false when it is a dialog over the conversation. The layer carries it as `data-tabpage`,
// and the skin draws the two differently (styles.js): a page appears, a dialog fades in over the
// conversation it covers. Every step inside Settings is still that same surface, so the rows and the
// back arrow keep whichever door the layer came in through.
export function SettingsDialog({ page, id, tab = false, from = null, roster, actions, useUpdate, leaving = false }) {
  const [error, setError] = useState('')
  const close = useCallback(() => actions.closeSettings(), [])
  const run = promise => Promise.resolve(promise)
    .then(() => { setError(''); return true })
    .catch(failure => { setError(failure?.message ?? String(failure)); return false })
  // A Bot or group deleted while its form is open leaves its page on the list.
  const bot = page === 'bots' && id ? roster.byId[id] : undefined
  const room = page === 'groups' && id ? roster.roomsById[id] : undefined
  const shown = SETTINGS_PAGES.some(([key]) => key === page) ? page : 'general'
  const usageFocus = shown === 'usage' && id ? id : null
  const label = t(SETTINGS_PAGES.find(([key]) => key === shown)[1])
  const back = bot ? t('Back to Bots') : room ? t('Back to group chats') : usageFocus ? t('All usage') : null
  const mobile = useMobile()
  // A phone shows one screen at a time: the list of pages, or one page under a back
  // arrow. Opened straight onto a page -- a Bot's settings from its row, a schedule from
  // the plus menu -- it starts there; opened from the account launcher, which asks for
  // General and nothing more, it starts on the list.
  const [screen, setScreen] = useState(shown !== 'general' || (id ?? null) !== null ? 'page' : 'list')
  // The group chats' create form, raised by the phone bar's own control (the row that used to hold it
  // is gone there) and by the wide dialog's row (which has no bar to raise it from). Leaving the page
  // puts it away: the form belongs to the visit, not to the dialog.
  const [creatingGroup, setCreatingGroup] = useState(false)
  useEffect(() => { setCreatingGroup(false) }, [shown])
  // The user's own details, read once and saved on every change: this is a local record, not an
  // account (account.js), so there is nothing to wait for and nothing to fail.
  const [account, setAccount] = useState(() => loadAccount())
  const updateAccount = (patch) => setAccount(current => {
    const next = { ...current, ...patch }
    saveAccount(next)
    return next
  })
  const nav = useGlide(shown, { axis: 'y' })
  // A page enters from the right when it is one level in, from the left when it comes
  // back out, and from below beside it. Usage keeps its own entrance and its data
  // across its own levels, so they share one page.
  const pageKey = `${shown}:${bot?.id ?? room?.id ?? ''}`
  const depth = bot || room ? 1 : 0
  const last = useRef({ key: pageKey, depth, move: 'up' })
  if (last.current.key !== pageKey) {
    last.current = { key: pageKey, depth, move: depth > last.current.depth ? 'in' : depth < last.current.depth ? 'out' : 'up' }
  }
  // Usage stays mounted from its first visit until Settings closes: coming back to it
  // shows the same page at once instead of loading it again. Meanwhile it keeps its
  // rendered state off screen (content-visibility).
  const [usageOpened, setUsageOpened] = useState(shown === 'usage')
  if (shown === 'usage' && !usageOpened) setUsageOpened(true)
  const errorLine = error ? h('div', { className: 'bt-error', role: 'alert', style: { padding: 0 } }, error) : null
  // The phone's title bar is drawn once, outside both screens, so it does not move when
  // the list hands over to a page. Back goes up one level; from the list, which is the
  // top level, it leaves Settings. The wide dialog keeps its own head inside the column.
  // The arrow goes up one level; a page with nothing above it leaves Settings the way it came in.
  // `from` is that way in (index.js): a page opened from the 伙伴 list returns to that list, and one
  // reached from Settings' own list shows that list -- the page the user actually came through.
  const stepBack = () => {
    if (back !== null) { actions.openSettings(shown); return }
    if (from !== null) close()
    else setScreen('list')
  }
  // Escape goes up one level, exactly as the back arrow does: a page inside Settings returns to
  // Settings' own list rather than leaving it, and only the list itself leaves. Opened from 发现,
  // that leave is what lands back on 发现's own list (closeSettings reads the row it came from).
  useEscape(() => { if (screen === 'list') close(); else stepBack() })
  const pageTitle = bot?.name ?? room?.name ?? label
  // The same rule the arrow itself follows (stepBack): the level above when there is one, the door it
  // came in through when there is not, and Settings' own list otherwise.
  const backLabel = screen === 'list' ? t('Close settings') : back ?? t(BACK_TO[from] ?? 'Back to all settings')
  return h('div', { className: 'bt-settings-layer', 'data-tabpage': tab ? '' : undefined, 'data-leaving': leaving || undefined },
    h('div', { className: 'bt-scrim', onMouseDown: close }),
    h('div', { className: 'bt-settings', role: 'dialog', 'aria-modal': true, 'aria-label': t('DS Bot settings'), 'data-wide': shown === 'usage' ? '' : undefined, 'data-screen': mobile ? screen : undefined },
      // Phone only: back, the title centred on the dialog rather than on the space left
      // between the two side buttons, and the close. A wider button on one side cannot
      // pull the title off centre because it is out of their flow. The close is drawn
      // one level in only: on the list the left button already leaves Settings, and two
      // buttons doing the same thing in one bar read as two different actions.
      h('div', { className: 'bt-settings-top' },
        h('button', {
          type: 'button', className: 'bt-icon-btn', 'aria-label': backLabel, title: backLabel,
          onClick: () => { if (screen === 'list') close(); else stepBack() },
        }, h(ChevronLeftIcon)),
        h('h2', null, screen === 'list' ? t('All settings') : pageTitle),
        // The right-hand control: on the group chats' list it is that page's own action -- the same
        // one the list's row carries on the wide dialog -- and everywhere else it still closes
        // Settings. Two buttons that both left the page was the user's complaint: the left one
        // already goes back, so the right one now does the page's work instead.
        screen === 'list' ? null
          : shown === 'groups' && !room ? h('button', {
            type: 'button', className: 'bt-icon-btn', 'aria-label': t('Create group chat'), title: roster.bots.length < 2 ? t('A group chat needs at least two Bots') : t('Create group chat'),
            disabled: roster.bots.length < 2,
            onClick: () => setCreatingGroup(true),
          }, h(PlusIcon))
            : h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Close settings'), title: t('Close settings'), onClick: close }, h(CloseIcon))),
      // A div with role="navigation" rather than a <nav>: the Android responsive skin
      // tags the first [role=dialog][aria-modal] holding a direct nav child as the
      // upstream settings panel (data-dsh-settings-dialog) and reflows its nav into a
      // horizontal tab strip. The accessible role is unchanged.
      h('div', { ref: nav.box, role: 'navigation', className: 'bt-settings-nav', 'aria-label': t('Settings pages') },
        // 我的's own top card, above the page list: who the user is on this device, and the door to the
        // page that edits it. Only the phone draws this list as a page of its own -- the wide dialog's
        // 198px column has the account in its footer launcher instead.
        mobile ? h(AccountCard, { account, onOpen: () => actions.openSettings('account') }) : null,
        h('span', { ref: nav.thumb, className: 'bt-thumb', 'aria-hidden': true }),
        SETTINGS_GROUPS.map(([group, keys], index) => h('section', { key: group, className: 'bt-settings-group' },
          h('h3', { className: 'bt-settings-group-head' }, t(group)),
          h('div', { className: 'bt-settings-group-card' },
            keys.map(key => h('button', {
              key, type: 'button', className: 'bt-settings-item',
              // A phone's list is the top level, and no row on it is current: the page a row
              // would open is not the page you are on. Marking one said otherwise -- it drew
              // that row filled, and the glide thumb, whose selector matches [aria-current],
              // parked behind it. Shown on a page, the phone hides this list anyway.
              'aria-current': !mobile && shown === key ? 'page' : undefined,
              onClick: () => { setScreen('page'); actions.openSettings(key) },
            }, h(PAGE_ICONS[key]), h('span', { className: 'bt-settings-name' }, t(PAGE_TEXT[key])), h('span', { className: 'bt-set-go', 'aria-hidden': true }, h(ChevronRightIcon)))),
            // Harness settings is the last row of the last card: on the wide dialog it
            // keeps the margin that holds it at the foot of the column.
            index === SETTINGS_GROUPS.length - 1 ? h('button', {
              type: 'button', className: 'bt-settings-item bt-settings-shell', title: t('Models, providers, and the rest of DeepSeek Harness'),
              onClick: () => { close(); openHarnessSettings() },
            }, h(SlidersIcon), h('span', { className: 'bt-settings-name' }, t('Harness settings')), h('span', { className: 'bt-set-go', 'aria-hidden': true }, h(ChevronRightIcon))) : null)))),
      h('div', { className: 'bt-settings-main' },
        h('div', { className: 'bt-settings-head' },
          // The arrow goes up one level: a Bot's form back to the Bot list, a page back
          // to the page list. On the wide dialog it only appears where there is a level
          // above; the phone draws its own bar instead.
          back === null ? null : h('button', {
            type: 'button', className: 'bt-icon-btn', 'aria-label': back, title: back,
            onClick: stepBack,
          }, h(ChevronLeftIcon)),
          h('h2', { key: bot?.id ?? room?.id ?? shown }, pageTitle)),
        shown === 'usage' ? null : h('div', { key: pageKey, className: 'bt-settings-scroll bt-settings-page', 'data-move': last.current.move },
          errorLine,
          shown === 'general' ? h(GeneralPage, { roster, actions, run }) : null,
          shown === 'account' ? h(AccountPage, { account, onChange: updateAccount }) : null,
          bot ? h('div', { className: 'bt-settings-form' }, h(BotSettingsForm, { key: bot.id, bot, roster, actions, run })) : null,
          shown === 'bots' && !bot ? h(BotsPage, { roster, actions, run }) : null,
          room ? h('div', { className: 'bt-settings-form' }, h(GroupSettingsForm, { key: room.id, room, roster, actions, run })) : null,
          shown === 'groups' && !room ? h(GroupsPage, { roster, actions, run, creating: creatingGroup, setCreating: setCreatingGroup, mobile }) : null,
          shown === 'connectors' ? h(ConnectorsPage, { roster, actions }) : null,
          shown === 'capabilities' ? h(CapabilitiesPage, { roster, actions, run }) : null,
          shown === 'schedules' ? h(SchedulesPage, { roster, actions, start: id ?? undefined }) : null,
          shown === 'secrets' ? h(SecretsPage, { roster, actions, run, Section: SetSection }) : null,
          shown === 'feedback' ? h(FeedbackPage, { actions, run, Section: SetSection, Row: SetRow }) : null,
          shown === 'about' ? h(AboutPage, { useUpdate, actions, run, Section: SetSection, Row: SetRow }) : null),
        usageOpened ? h('div', { key: 'usage', className: 'bt-settings-scroll bt-settings-usage', 'data-off': shown === 'usage' ? undefined : '', 'aria-hidden': shown === 'usage' ? undefined : true },
          shown === 'usage' ? errorLine : null,
          h(UsagePage, { roster, actions, focusId: usageFocus })) : null),
      h('button', { type: 'button', className: 'bt-settings-close', 'aria-label': t('Close settings'), onClick: close }, h(CloseIcon))))
}
