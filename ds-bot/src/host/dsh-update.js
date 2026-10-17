// DSH updates: a released DS Bot may name the DSH release it was verified
// against (`dsBot.verifiedDsh` in package.json); a release that names none
// offers nothing. The newest released bot wins: offering that version and
// nothing newer keeps the update path away from DSH releases we have not
// checked. A DSH installed from npm swaps with `npm i -g`; a packaged app's
// runtime lives inside its bundle and only its own updater moves it, to the
// newest release it finds, so the client offers it only when that release is
// the verified one.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  CHECK_TTL_MS, cleanVersion, encodeName, fetchJson, installSpecOf,
  newer, registryPlan, repoSlug, sourceOf,
} from './update.js'

const PKG = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const APP_BOOT = '@deepseek-ai/dsh-app-boot'
const DSH_PACKAGE = '@deepseek-ai/dsh'

// 引擎版本检查固定看官方上游，与插件自身的更新来源（我们自己的仓库）分开。
// 两件事混在一个 repoSlug() 上会让"插件检查更新"跟着跳去官方，反过来也一样。
const OFFICIAL_DSH_NPM = 'https://registry.npmjs.org/@deepseek-ai/dsh/latest'
const OFFICIAL_DSH_RELEASES = 'https://github.com/deepseek-ai/dsh/releases'

// Android 上**不提供一键升级引擎**：本机 runtime 靠一组安卓补丁（koffi/node-pty 桩、
// require-builtin JS 回退、rgPath 前缀改写、flock、apiProxy、webview-polyfill、
// collapsedWidth=0）才跑得起来，而官方 release 里没有这些补丁——直接替换只会得到
// 一个起不来的引擎。这里只给出版本号与更新日志入口。
const ANDROID_MANUAL_ONLY = process.platform === 'android'

export function install(rt) {
  const { ctx, config } = rt
  const enabled = config.updateCheck !== false

  const status = {
    current: null, verified: null, kind: 'npm', blockedBy: null,
    checkedAt: 0, phase: 'idle', installed: null, error: null,
    // 官方引擎最新版（只读展示用）：{ version, releasesUrl }
    official: null,
  }
  // 是否只允许"查看官方版本"：Android 默认是；桌面/CI 可用 config 关掉以便一键升级
  const manualOnly = config.manualDshUpgrade === false ? false : (config.manualDshUpgrade ?? ANDROID_MANUAL_ONLY)
  let target = null
  let checking = null
  let running = null

  // A newer `minBot` than the running bot gates the offer: the bot goes first.
  const blocked = () => status.blockedBy !== null && newer(status.blockedBy, PKG.version)

  const view = () => ({
    current: status.current, verified: status.verified, kind: status.kind, blockedBy: status.blockedBy,
    checkedAt: status.checkedAt, phase: status.phase, installed: status.installed, error: status.error,
    // 官方最新版与更新日志入口（只读）；manualOnly=true 时前端应只显示"查看官方版本"
    official: status.official, manualOnly,
    // Nothing is offered without a current version to compare against.
    available: !manualOnly && status.phase !== 'installed' && target !== null && status.current !== null
      && status.verified !== null && status.verified !== status.current && !blocked(),
  })

  // The version of the DSH that is running us: the app-boot export, or — where
  // that import cannot see it — the nearest @deepseek-ai package.json above the
  // entry script.
  async function currentDsh() {
    try {
      const loader = ctx.get?.('loader')
      const loaded = await loader?.import?.(APP_BOOT)
      const appBoot = loader?.unwrapExports?.(loaded) ?? loaded?.default ?? loaded
      const version = cleanVersion(appBoot?.getDshRuntimeVersion?.())
      if (version) return version
    } catch { /* the export is not visible here: read the install instead */ }
    let dir = dirname(String(process.argv[1] ?? ''))
    for (let depth = 0; depth < 12; depth += 1) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
        if (manifest?.name?.startsWith?.('@deepseek-ai/')) {
          const version = cleanVersion(manifest.version)
          if (version) return version
        }
      } catch { /* not a package directory */ }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

  // A bundled package manager means the runtime came with the app and only the
  // app's own updater can move it.
  const installKind = () =>
    typeof ctx.get?.('profileContext')?.packageManager?.command === 'string' ? 'app' : 'npm'

  // The newest released DS Bot's `dsBot` block, through the same channel the bot
  // itself updates from: its registry, or the public repo's latest release.
  async function releasedDeclaration(source) {
    if (source.kind === 'registry') {
      for (const registry of await registryPlan(config, ctx.get?.('pluginManager'))) {
        try {
          const manifest = await fetchJson(`${registry}${encodeName(PKG.name)}/latest`)
          if (manifest?.dsBot?.verifiedDsh) return manifest.dsBot
        } catch { /* unreachable or not published there: ask the next one */ }
      }
      return null
    }
    const repo = repoSlug()
    if (!repo) return null
    try {
      const release = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, { 'user-agent': `${PKG.name}/${PKG.version}` })
      const tag = cleanVersion(release?.tag_name)
      if (!tag) return null
      const manifest = await fetchJson(`https://raw.githubusercontent.com/${repo}/${release.tag_name}/ds-bot/package.json`, { 'user-agent': `${PKG.name}/${PKG.version}` })
      return manifest?.dsBot?.verifiedDsh ? manifest.dsBot : null
    } catch { return null }
  }

  /**
   * 官方引擎最新版（只读）。来源是 npm registry 的 latest，不是我们仓库的 release：
   * 引擎版本的权威来源是上游，插件版本的权威来源才是我们自己。
   * 返回 null 表示查不到（离线/限流），此时前端只显示"未知"，不提供任何安装动作。
   */
  async function officialRelease() {
    try {
      const manifest = await fetchJson(OFFICIAL_DSH_NPM, { 'user-agent': `${PKG.name}/${PKG.version}` })
      const version = cleanVersion(manifest?.version)
      return version ? { version, releasesUrl: OFFICIAL_DSH_RELEASES } : null
    } catch { return null }
  }

  async function runCheck() {
    try {
      status.current = await currentDsh()
      status.kind = installKind()
      // The release the running package itself verified stays the floor: a bot
      // older than its own declaration has nothing newer to offer.
      const declared = [{ verifiedDsh: PKG.dsBot?.verifiedDsh }]
      const released = await releasedDeclaration(sourceOf(await installSpecOf(ctx)))
      if (released) declared.push(released)
      const newestDeclared = declared
        .filter(entry => cleanVersion(entry.verifiedDsh))
        .sort((a, b) => (newer(cleanVersion(a.verifiedDsh), cleanVersion(b.verifiedDsh)) ? -1 : 1))[0]
      status.verified = cleanVersion(newestDeclared?.verifiedDsh)
      // A release may gate the DSH update on a newer bot: offer nothing until
      // the bot itself is at least `minBot`.
      status.blockedBy = cleanVersion(newestDeclared?.minBot)
      target = status.current !== null && status.verified !== null && status.verified !== status.current
        ? { version: status.verified }
        : null
      status.official = await officialRelease()
      status.error = null
    } catch (error) {
      rt.warn('ds-bot: dsh update check failed: %s', error?.message ?? error)
      status.verified = null
      status.blockedBy = null
      target = null
    }
    status.checkedAt = Date.now()
  }

  /** Read current and verified DSH versions; a fresh check ignores the last answer. */
  async function check({ fresh = false } = {}) {
    if (!enabled) return view()
    if (checking) return checking
    if (!fresh && Date.now() - status.checkedAt < CHECK_TTL_MS) return view()
    checking = runCheck().finally(() => { checking = null })
    await checking
    return view()
  }

  /** Swap an npm-installed DSH for the verified version; the answer comes back through `check`. */
  function start() {
    if (status.phase === 'installing') return view()
    if (target === null || blocked()) throw new Error('No DSH update is available')
    if (status.kind !== 'npm') throw new Error('This DSH updates with its app')
    const chosen = target
    Object.assign(status, { phase: 'installing', error: null })
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const args = ['install', '-g', `${DSH_PACKAGE}@${chosen.version}`]
    const runner = rt.dshSpawn ?? ((command, argv, options) => spawn(command, argv, options))
    running = runner(npm, args, { windowsHide: true })
    let output = ''
    running.stdout?.on?.('data', chunk => { output = `${output}${chunk}`.slice(-4000) })
    running.stderr?.on?.('data', chunk => { output = `${output}${chunk}`.slice(-4000) })
    const done = new Promise((resolve, reject) => {
      running.once?.('error', reject)
      running.once?.('close', code => (code === 0 ? resolve() : reject(new Error(`npm exited ${code}`))))
    })
    void done
      .then(() => Object.assign(status, { phase: 'installed', installed: chosen.version }))
      .catch((error) => {
        rt.warn('ds-bot: dsh update to %s failed: %s', chosen.version, error?.message ?? error)
        Object.assign(status, { phase: 'failed', error: `${error?.message ?? error}${output ? ` — ${output.trim().slice(-400)}` : ''}`.slice(0, 600) })
      })
    return view()
  }

  // Whatever npm is still running when the plugin unloads dies with it.
  ctx.effect(() => () => running?.kill?.(), 'ds-bot: dsh update install')

  Object.assign(rt, { dshUpdateCheck: check, dshUpdateStart: start, dshUpdateView: view })
}
