# DS-Bot 非侵入二开：三条路线与推荐顺序

- 日期：2026-10-30
- 基线：`repo/` = ds-bot 0.2.3，当前树 = 补丁 ①–⑪ 已应用（`git apply --check -R` 通过）
- 宿主：DSH 0.2.1-rc.3（`dsh --version`；桌面 `runtime/primary-runtime/runtime.json` 的 `desktopVersion` 同）
- 依据：本机源码 / `repo/design/extension-points.md` / `/Users/limeng/DSH/DS-Bot-Dev`（已实测的扩展包）
- 状态：**待用户拍板**（§5）

---

## 0. 结论

**推荐顺序：P0 补补丁工具链 → 方向一 能力插件 → 方向二 界面增量 → 方向三 外部渠道；灰区永远不做。**

一句话分工：

| 要改什么 | 走哪条 | 为什么 |
|---|---|---|
| 新能力（工具、自动化、通知、审计） | 方向一：独立 bundle 插件 | 零改源码，可装卸，卸载即复原 |
| 某个 Bot 专属能力（MCP / 技能） | Capabilities 配置 | 唯一能按 Bot 差异化的口子 |
| UI 深度改动（改 ds-bot 自己的组件） | 补丁台账（B 口径） | 文档化接缝做不到，只能最小补丁 |
| UI 增量（并排加按钮/面板） | 方向二：slot 增量 | 不动 ds-bot 渲染 |
| 接管界面 / 以 Bot 身份直连 | 灰区 | 依赖源码常量与未文档化 API，**不做** |

---

## 1. 现状（五条，都有代码依据）

1. **ds-bot 是纯插件，没有对外服务。** `ds-bot/index.js:43-44` 只导出 `name`/`inject`；全仓 `grep "provide("` 为空。第三方插件**无法调用**它的内部函数，想复用名册/分组/投递只能读 `state.json` 或打 `/api/bot`，两者都算灰区。
2. **它把文档化接缝用满了。** 工具注册在 6 个 host 文件；全局守卫 `tools.js:732`；逐 Bot 收窄 `agents.js:61`；11 类 `ctx.on` 事件（`tools/execute`、`agent/pre-step`、`system-prompt/assemble` 等）；两条 HTTP 路由 `channel.js:556`（`/api/bot`）与 `feed.js:85`（SSE）；客户端 `slots` 用 `BOT_PRIORITY = -100`（`src/client/index.js:748`）压住宿主。
3. **本地已落地 11 条补丁**，48 hunks / 15 文件，全部在 `ds-bot/src/client/**`。台账与重放包在 `design/ds-bot-patches.*`。
4. **补丁工具链只补了一半（P0 风险）。** 台账 §3/§4 引用的三个脚本原本都不存在；**10-30 10:09 工作区里已出现 `tools/patch-ledger.mjs` 与 `tools/patch-conflict-check.sh`**（未跟踪，应为 Dev 在补），但还没跑验收；`ext/avatar-gaze/gen.mjs` 仍然缺。后果：`hunks.md` 与冲突自检有脚本了，但 `gaze.js` 无法按文档重生成。
5. **工作区外已有一个跑通的扩展包**：`/Users/limeng/DSH/DS-Bot-Dev`（`ds-bot-ext` 0.1.0，bundle 形态，自带隔离测试台，实测 `PASS 70 / FAIL 0 / SKIP 1`）。但它验证的是 **DSH 0.2.1-rc.2 + ds-bot 0.1.7**，与当前基线差两个 minor，必须先重新验证。

---

## 2. 三条路线

### 方向一：能力插件（Host 半，推荐第一）

**形态**：独立 npm 包，`dsh.bundle.patch` 指向自己的 `cordis.patch.yml`，只 `insert` 自己；装进 profile 层栈。
**注意**：插件不 import ds-bot，也不生成指向 `bot` 的 patch 行——它在同一层再注册自己的东西。

| 能做 | 接缝 | 已验证？ |
|---|---|---|
| 给所有 Bot 加工具 | `ctx.tools.register(defineTool(...))` | ✅ DS-Bot-Dev |
| 观察工具调用（审计/统计） | `ctx.on('tools/result')` | ✅ DS-Bot-Dev |
| 加 HTTP 路由（供外部或 UI 调） | `ctx.connection.fetch.register` | ✅ DS-Bot-Dev（`/api/ds-bot-ext/status`） |
| 敏感操作二次确认 | `ctx.on('tools/pre-execute')` 返回 `ask`/deny | 未实测 |
| 注入提示词 | `ctx.on('system-prompt/assemble')` | 未实测 |
| 斜杠命令 | `ctx.commands.register` | 未实测（ds-bot 自己不用命令） |
| 判断 ds-bot 是否挂载 | `ctx.tools.get('list_bots')` + `tools/change` | ✅ DS-Bot-Dev |

**限制（写进验收）**：
- 根 ctx 注册的工具**对所有 Bot 可见**，会改每个 Bot 的提示词体积；按 Bot 收窄只能靠 ds-bot 的 Capabilities（配置），不能用自己的 `restrict` 去加。
- `apply` **不许 throw**：一次 throw 会被报成 `plugin tree failed to load`，可能带崩整个 profile。所有失败降级为一条 warn。
- 依赖声明口径三处不一致，**以本机实测为准**（详见 §6）：`make-dsh-plugin` 的 0811 口径说不要声明 `@deepseek-ai/*`；ds-bot 自己声明了 `peerDependencies`；DS-Bot-Dev 用 optional peer + 运行时检测。本项目应复制 DS-Bot-Dev 的做法。
- 宿主侧 `tools.get` 这类未写进文档的读取方法，属于「文档化服务的方法」而非服务本身，需在评审时逐条确认。

**成本**：骨架已有，新增一个能力约 0.5–1 天（含单测 + 装卸往返）。**验收**：`dsh --dump-config` 出现 insert 行；工具进模型请求；`dsh plugin remove` 后复原；`git status` 干净。

### 方向二：界面增量（Client 半，第二）

**形态**：同一个包加 `dsh.client` + `exports["./client"]`，浏览器半走 `__ModuleLoader__.load`。

| 能做 | 接缝 | 已验证？ |
|---|---|---|
| 侧栏底部加按钮 | `sidebar.footer.action`（list） | ✅ DS-Bot-Dev |
| 全屏浮层 | `shell.overlay`（list） | ✅ DS-Bot-Dev |
| 会话头部加动作 | `conversation.session.header.actions`（list） | 未实测（slot 需已声明） |
| 设置页加卡片 | `settings.*` | 未实测 |

**限制**：
- **不能复用 ds-bot 的组件**：它的 UI 全打进 `client.js`，`package.json` 的 `exports` 只放行 `.` / `./client` / `./web-search` / `./package.json`。
- 注册**未声明**的 slot 在激活期直接失败；同 cell 同 priority 会 throw（`dsh-client-ui-slots` 的 `single` 分支）。
- 样式只能用主题 token，组件外不写 DOM；卡片 presenter 必须纯函数。
- `client.js` 是生成物，改 `src/client/` 后必须重建并提交（`--check` 守新鲜度）。

**成本**：构建链已有（esbuild + `__ModuleLoader__` 包装），加一个入口约 0.5 天。**风险**：黑天白夜、移动端（含 844×390 横屏）三套适配，容易回归。

### 方向三：外部渠道（第三，需求未定）

| 子路 | 做什么 | 侵入度 | 代价 |
|---|---|---|---|
| C1 `webhookRuntime` | 外部事件 → 建**普通 Session** 跑一次 | 零 | 不进 Bot 名册，不能用 `message_bot`/群语义 |
| C2 直连 `/api/bot` + SSE | 真以某个 Bot 身份收发 | **灰区** | 锁 ds-bot 版本 + 启停自检 + 契约测试 |

**先回答一个问题再谈方案**：外部系统要的是「触发一次任务」还是「以某个 Bot 的身份说话」。前者走 C1，后者只能 C2，且必须接受长期维护成本。

### 底座（不算独立方向，但必须定）

- **Capabilities（MCP / skill / pack）**：唯一能按 Bot 差异化能力的路径，纯配置、零代码。代价：只能通过 ds-bot 的 UI / `save_capability` 配，插件写不了。
- **配置覆盖**：`- id: bot` 的 config 可改 **20+ 个键**（`workspace`/`home`/`checkRatio`/`memory`/`browser`/`updateCheck`…，见 README "Configuration"；`grep -rho "config\.[a-zA-Z]*"` 命中 20 个，另有 `config?.checkRatio` 写法）。注意是**整行替换**，id 消失会静默失效。
- **补丁台账**：UI 深度改动唯一合法通道。**先补工具链**（§1 第 4 条），否则台账只是文档。
- **灰区**（`B2` 接管 `single` slot、`C2` 直连）：技术上能赢（`BOT_PRIORITY=-100` 让位，slot 取最低 priority 渲染），但依赖源码常量与未文档化 API，上游一改就静默失效。**默认不做**，除非用户签字并接受锁版本 + 启停自检 + 契约测试。

---

## 3. 推荐顺序

| 序 | 做什么 | 为什么排这里 | 粗估 |
|---|---|---|---|
| P0 | 补 `ext/avatar-gaze/gen.mjs`；验收已有的 `tools/patch-ledger.mjs`、`patch-conflict-check.sh` | 没有它，上游升级时 11 条补丁无法机械自检；这是纯治理，不改行为 | 0.5 天 |
| P1 | 收编 DS-Bot-Dev 骨架 → 在 DSH 0.2.1-rc.3 + ds-bot 0.2.3 上重跑 `dev/verify.sh` | 直接复用已验证的非侵入手法（检测、路由、slot 并排），改版本差异即可 | 1 天 |
| P2 | 方向一：落地第一个真实能力 | 收益立即可见，零侵入，失败不炸宿主 | 0.5–1 天/能力 |
| P3 | 方向二：界面增量（仅在确有 UI 需求时） | 需构建 + 三套适配，收益偏外观 | 0.5–1 天 |
| P4 | 方向三：外部渠道 | 需求未定，且 C2 有长期成本 | 待定 |

---

## 4. 现有 11 条补丁能不能迁到插件？

**结论：没有一条能无损迁移。** 它们全部改 ds-bot 自己的渲染或组件逻辑，而插件拿不到它的组件与内部状态；纯样式那几条只有「另写一层样式去覆盖」的理论替代，代价不低于补丁。

| 补丁 | 改的是什么 | 能否迁到插件 |
|---|---|---|
| ① Gaze 形象一排 | `bot-settings.js`/`create-bot.js` 组件内部 | ❌ 需要改组件树 |
| ② 去头像描边、⑥ 圆角变量、③⑧⑨⑩ 移动端样式 | `styles.js` 里的 CSS | ⚠️ 理论可另写样式层，但依赖私有类名与 `!important` 竞争，收益不抵风险 |
| ④ 抽屉收起、⑤ 汉堡按钮、⑦ 会话菜单 | ds-bot 组件逻辑 + 槽位遮蔽的事实 | ❌ 需要改组件逻辑 |

所以：**补丁台账会长期存在**，治理它（P0）不是可选项。反过来说，以后**新**加的东西应优先问一句「插件能不能做」，能就不进补丁。

---

## 5. 需要拍板

1. **第一个二开能力做什么？** 现在只有骨架示例（状态工具 + EXT 按钮）。要落一个真需求：审计日志？会话导出？外部通知？还是别的？没这个，P2 只能继续给骨架。
2. **P0 只差收尾：** `tools/` 下两个脚本已出现（未跟踪、未验收），`ext/avatar-gaze/gen.mjs` 仍缺。批准后由 Dev 补完，我出验收标准（`hunks.md` 重生成后与现文件一致、`patch-conflict-check.sh <上游 ref>` 输出 `clean`）。
3. **骨架放哪？** `/Users/limeng/DSH/DS-Bot-Dev` 在工作区外，且是独立 git 仓。选项：(a) 迁进本工作区 `repo-ext/`，与 `repo/` 并列；(b) 直接在那个仓继续做，本仓只放方案。**我建议 (b)**：不污染 fork 的 DS-Bot 仓库，`repo/` 保持上游可合并。
4. **接不接受「新工具对所有 Bot 可见」？** 接受 → 方向一最省事；不接受 → 每个 Bot 的能力只能走 Capabilities 配置，代码里做不了差异化。
5. **灰区默认不做，是否同意？**（B2 接管界面、C2 直连 `/api/bot`）

---

## 6. 依据与不确定

**依据（可直接复核）**
- 无服务：`grep -rn "provide(" repo/ds-bot/src repo/ds-bot/index.js` → 空
- 路由：`repo/ds-bot/src/host/channel.js:556`、`feed.js:85`
- 槽位遮蔽：`repo/ds-bot/src/client/index.js:748`（`BOT_PRIORITY=-100`）、`806/810/813`
- slot 注册语义：`~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js`（`register` 按 priority 升序排序，`entriesOfSlot` 每 cell 取首条 = 最低 priority 渲染）
- 扩展包实测：`/Users/limeng/DSH/DS-Bot-Dev/dev/verify.sh`，README 记录 `PASS 70 / FAIL 0 / SKIP 1`
- 配置键：`repo/ds-bot/README.md` "Configuration" + `grep -rho "config\.[a-zA-Z]*"`

**不确定（别当结论用）**
1. **官方 DSH 文档副本不在本机。** `extension-points.md` 引用的 `references/official-docs/` 已不存在；本机能核对的只有源码、`make-dsh-plugin` skill 的 `references/`（0811 口径）和 CLI help。口径冲突处（依赖声明）以实测为准。
2. **DSH 版本**：CLI/桌面 runtime 是 `0.2.1-rc.3`，但 `~/.dsh/profiles/node_modules/@deepseek-ai/*` 是 `0.1.5-rc.2`。slot 语义我按 0.1.5-rc.2 源码核对，结论与 `extension-points.md` 记录的 0.2.1-rc.2 行为一致，但**真实宿主版本需 Dev 在装上插件后用 boot graph 再确认一次**。
3. **`ctx.tools.get` / `tools/change`** 是 DS-Bot-Dev 在 0.2.1-rc.2 上跑通的用法，未在 0.2.1-rc.3 复验；这是方向一依赖检测的地基。

**对 `extension-points.md` 的两处订正**
- §1.5 说 `apply(ctx, config)` 只读 `home`/`mainName`/`mainRole`：只对 `index.js` 成立；其余模块还读 20+ 个键（`workspace`、`checkRatio`、`memory`、`browser`、`updateCheck`…）。
- §3 方向 A 引用的 `plan-a-audit.md` 不存在；审计样例实际在 DS-Bot-Dev 的 `src/host/metrics.js`。
