# DS-Bot 非侵入二开：扩展点调研与可行方向

- 仓库：`repo/`（Fei2411/DS-Bot v0.2.3）
- 本机 DSH：`/usr/local/lib/node_modules/@deepseek-ai/dsh` @ `0.2.1-rc.2`
- 依据：仓库源码 / 官方 DSH 文档副本（`dsh-plugin-guide` 知识库 `references/official-docs/`）
- 状态：调研完成，等用户选方向

---

## 0. 结论先行

ds-bot 是**一个标准 DSH 插件**，不是宿主。它对外只有「DSH 文档化的扩展点」这一层接口，**没有导出任何 Cordis service**，所以不存在插件对插件的私接缝。

因此二开只有下面几张牌，且都在 DSH 层面。

**先说明口径**：按 §2 第 3 条，凡依赖 ds-bot 内部实现（源码常量、未文档化 HTTP 端点）的，**都不算"零"**，只能标「灰区」并单列风险。下表按此诚实标注。

| 方向 | 机制 | 侵入度 | 可靠度 |
|---|---|---|---|
| **A. 并行 Host 插件**（推荐先做） | `ctx.tools` / `ctx.commands` / `agent/*`、`tools/*` 事件 / `system-prompt` | **零** | ★★★★★ 全是文档化契约 |
| **B1. Slots 增量共存** | `ctx.slots.inject/register` 到 list slot | **零** | ★★★★☆ 文档化 slot，与 ds-bot 并存 |
| **B2. Slots 接管界面** | 抢 `sidebar.workspaces` 等 `single` slot | **灰区**（依赖 `BOT_PRIORITY` 源码常量） | ★★☆☆☆ 技术上能赢，上游一改就静默失效 |
| **C1. webhookRuntime 外部触发** | `ctx.webhookRuntime.register` + provider adapter | **零** | ★★★☆☆ 只能建普通 Session，进不了 Bot 名册 |
| **C2. 直连 `/api/bot`** | 打 ds-bot 的未文档化 HTTP + SSE | **灰区**（未文档化内部 API） | ★★☆☆☆ 能真以 Bot 身份收发，但会随时碎 |
| **D. 纯配置层**（不算二开，但免费） | `cordis.patch.yml` 按 id 覆盖 | **零** | ★★★★★ 只能改 ds-bot 暴露的配置项 |

**推荐顺序：D（顺手做）→ A → B1 → C1。**
B2 / C2 不是"更高级"，是两条**灰区降级路**：只有用户明确接受「界面可能被静默替换」或「锁 ds-bot 版本」，才允许做。

---

## 1. 关键事实（带源码依据）

### 1.1 ds-bot 是纯插件，无对外服务

`ds-bot/index.js:43-58` 的全部导出：

```js
export const name = 'ds-bot'
export const inject = ['llm','tools','systemPrompt','sessionController','sessions','sessionTitle','workspaceRegistry','connection']
export function apply(ctx, config = {}) { createRuntime(ctx, config) }
export function createRuntime(ctx, config = {}) { ... }
export { COLORS } from './src/host/constants.js'
```

- 全仓 `grep "provide(" src index.js` → **0 条**。没有 `ctx.provide(...)`，没有 `Service` 子类。
- 它只**消费**别的插件的服务：`ctx.get('tokenMeter' | 'compaction' | 'agentPresets' | 'schedule' | 'shellEnv' | 'goals')`（`src/host/parts.js:253,294-299`、`schedules.js:81`、`secrets.js:574`、`tools.js:754`）。
- 结论：**任何插件都无法通过服务调用 ds-bot 的内部函数**。想复用 Bot 名册、分组、投递逻辑，只能读它的 `state.json`（未文档化，升级即碎）或走 `/api/bot`（同样未文档化）。这两条都**不建议**作为正式路径。

### 1.2 ds-bot 已经在用 DSH 的全部文档化扩展点

| 扩展点 | ds-bot 用法 | 位置 |
|---|---|---|
| `ctx.tools.register` | 自有工具 **25 处**（`list_bots`/`message_bot`/`show_view`/`ask_user`/`save_capability` …） | `src/host/tools.js` 16、`groups.js` 3、`memory.js` 3、`secrets.js` 2、`browser.js` 1 |
| 逐 Bot 工具策略 | `agent.ctx.tools.restrict({ deny })` | `src/host/agents.js:56-61`、`tools.js:717-723` |
| 全局工具守卫 | `ctx.tools.guard(...)` 拦 Bot 会话里的提问工具 | `src/host/tools.js:732` |
| 工具执行 hook | `ctx.on('tools/execute', (exec, next) => …)` | `src/host/tools.js:382` |
| 提示词装配 | `system-prompt/assemble` | 1 处 |
| 会话事件 | `session/event`、`agent/created`、`agent/pre-step`、`agent/status`、`agent/assistant-stream`、`agent/request-error`、`agent/inbox/discarded`、`approval/request`、`llm/stream` | 全仓 24 处 `ctx.on(...)` |
| HTTP 路由 | `ctx.connection.fetch.register({ path: '/api/bot' })`（POST） | `src/host/channel.js:556` |
| 实时推送 | `ctx.connection.fetch.register({ path: FEED_ROUTE })`（SSE） | `src/host/feed.js:85` |
| 客户端 UI | `ctx.slots.inject` / `ctx.slots.register`，76 个源文件 | `src/client/index.js:583,748-751` |
| 打包 | `package.json` 的 `dsh.bundle.patch` | `ds-bot/package.json` |

**含义**：ds-bot 没有留"第三方钩子"，但它把 DSH 的标准扩展点全都用上了。第三方插件的正确姿势不是"插进 ds-bot"，而是"**站在同一层，改同一个 ctx**"。

### 1.3 最容易踩的坑：`agent.ctx.tools.restrict`

ds-bot 用 `agent.ctx.tools.restrict({ deny })` 给每个 Bot 收窄工具集（来自 `src/host/agents.js:56`）。

后果：
- 你在**根 ctx** `ctx.tools.register` 的新工具，**所有 Bot 都能看到**（除非用户给该 Bot 配了 deny 策略）。
- 你**不能**用 `agent.ctx.tools.restrict` 去"给 Bot 加工具"——`restrict` 只能移除，不能新增。
- 想按 Bot 区分能力，正确做法是走 ds-bot 自己的 **Capabilities**（MCP / skill 挂到某个 Bot），那是配置，不是代码。

### 1.4 ds-bot 的 UI 是"slot 阴影 + 故意让位"

`src/client/index.js:744-750`（常量在 **747**）：

```js
// A Bot surface owns the cells it shadows. It starts far below the -10 that plugins
// commonly use and goes below whatever already holds the cell, so a plugin that
// shadows the same cell neither breaks the install nor shows through.
const BOT_PRIORITY = -100
const shadow = (name, options, component) => ctx.slots.inject(name, () => ctx.slots.register({
  name, ...options, ...(options.priority === undefined ? {} : { priority: freePriority(ctx.slots.entries(name), options) }),
}, component))
```

`freePriority`（`src/client/surface.js:80`）实际算的是 `Math.min(priority, ...每个已占位者的 priority-1)`：

```js
export function freePriority(entries, { priority, key, id }) {
  if (priority === undefined) return undefined
  const taken = entries
    .filter(entry => (key === undefined || entry.options?.key === key) && (id === undefined || entry.options?.id === id))
    .map(entry => (entry.options?.priority ?? 0) - 1)
  return Math.min(priority, ...taken)
}
```

这是**源码里写明的兼容承诺**，注册顺序无关：

- 插件**先**注册 → ds-bot 后注册时算 `min(-100, 插件priority-1)`，仍压在插件下面；
- 插件**后**注册 → 插件用自己声明的优先级（常用 -10），高于 -100。

所以第三方 UI 插件**必然抢得到** `sidebar.workspaces`、`conversation.session.header` 这类 `single` slot。但有三个坑必须写进方案：

- 抢到 = **接管**，用户看到的就不再是 ds-bot 原界面（ds-bot 设计成"不让出来也不露出来"）。
- **同优先级注册会 throw**（`freePriority` 上方的注释明写）。B2 不能照抄 `-100`。
- 上游一旦把 `BOT_PRIORITY` 改成更高值，抢位**静默失效**：不报错，用户还是看到 ds-bot 界面。→ **B2 必须自带自检**（见 §3 方向 B）。

想共存只能用**增量 list slot**：`conversation.session.header.actions`、`conversation.input.activity`、`plugins.bundle.config`、`settings.*` 卡片。

### 1.5 配置层能改什么（方向 D）

`ds-bot/cordis.patch.yml` 给出的行 id 是 `bot` 和 `web-search-auto`。ds-bot 的 `apply(ctx, config)` 只读三个键（`index.js:60-67`）：

```js
const home    = config.home    ?? join(dshHome, 'bot')   // 状态文件目录
config.mainName ?? 'Chief'                                // 首个 Main Bot 名
config.mainRole ?? 'Chief of Staff'
```

DSH 的 patch 语义（`docs/user/develop/basic/publish.md`）：按 id **整行替换 config**，可 `insert` 新行。层顺序 = profile 的 bundle 层 → profile 自己的 `cordis.patch.yml` → home patch → `--patch` 覆盖。上游若删了某个 id，覆盖会**静默失效**（升级后用 `dsh --profile <name> --dump-config` 查 `patch: entry not found`）。

### 1.6 已实测的两条事实（Dev 在隔离 profile 上验证，非文档推断）

1. **linked 插件靠 peer 解析拿宿主的 `@deepseek-ai/*`。** 插件包不在 profile 目录里，也能 `import { defineTool } from '@deepseek-ai/dsh-tools'`；DSH 的 peer 拦截把它解析到宿主安装的那一份。**不需要**往 profile 里塞 `node_modules` 或复制依赖。
2. **`headless` 会单独发一条无工具的标题生成请求。** 验证"工具真的注册了"时要**逐条**看请求，不能只看最后一条——最后那条常常是标题生成，`toolNames: []` 是正常的，不是插件没生效。

实测链路（可复用）：`apply()` 执行 → `--dump-config` 出插入行 → 工具进请求 → 假模型发 `tool_use` → `tool_result` 回传 → `dsh plugin remove` 后工具数复原、dump-config 无该行。

---

## 2. 「非侵入」判定标准（可执行验收表）

来源：Rev 提议的 6 条 + Chief 认可的 2 条硬门槛 + 本节补充的可验证方法。**Rev 按这张表逐条打勾，不再临时议标准。**

以下 8 条是**准入门槛**，任一条不过即判侵入：

| # | 条目 | 检查方式 |
|---|---|---|
| 1 | **零源码改动**：`repo/ds-bot/**` 无任何修改、无新增未跟踪文件 | `cd repo && git status --porcelain ds-bot/` 输出为空 |
| 2 | **零 DSH 本体改动**：不写 `/usr/local/lib/node_modules/@deepseek-ai/dsh/**`，代码不按绝对路径 import DSH 安装目录的文件 | 见 §2.1 的可验证方法；`grep -rn "node_modules/@deepseek-ai/dsh" src/` 为空 |
| 3 | **只用文档化接缝**：每个挂接点能在 DSH 官方文档找到（`architecture.md` 的 "Where new behavior goes" 表 / `cookbook/extension-cookbook.md` / `subsystems/*.md`） | 方案里每个接缝附文档路径；找不到即降级为灰区 |
| 4 | **可独立装卸**：自己的包 + 自己的 patch 片段（`insert`），不改 `ds-bot/cordis.patch.yml`，不改 DSH profile 默认层 | `dsh plugin add` / `remove` 往返一次，ds-bot 行为复原 |
| 5 | **不抢不改别人的贡献**：不改写 ds-bot 注册的工具/事件/UI；只覆盖自己的新增项 | 代码 review；UI 接管必须用户书面同意并写进方案 |
| 6 | **禁止所有变通**：禁止 monkey-patch 原型/全局、禁止 wrap ds-bot 的导出对象、禁止 `require('ds-bot/src/host/*')`（其 `package.json` exports 只放行 `.` / `./client` / `./web-search` / `./package.json`）、禁止复制其内部实现后改 | `grep` 检查 import 路径；`package.json` 的 `exports` 对照 |
| 7 | **不碰用户已有数据**：不读写用户已有数据；ds-bot 的 `state.json` **连只读都不作为接缝**；不碰用户真实 `DSH_HOME`。扩展自己的状态只能写自己目录 | 测试用独立 `DSH_HOME`（如 `.dsh-test-<name>/`），`~/.dsh` 零访问 |
| 8 | **测试门槛**：`npm test`、`node scripts/build-client.mjs --check`、`npm run lint` 全过；新功能至少一条单测（可用 `dev/mock-llm.mjs`，免 key） | 三条命令的退出码 |

**两条 Chief 已点头的硬性红线（写在这里，不接受自我说服）：**

- **「先临时改一行验证，再回滚」= 侵入。** 回滚后的代码无法随上游升级自动跟随，本质是补丁而非扩展。验收时问一句：删掉扩展、`git checkout .`，ds-bot 是否仍是未被触碰的版本？不是就判侵入。
- **能力若只有靠 ds-bot 内部实现才能做到，就判侵入。** 方案应改为向上游 / DSH 提需求，不许硬塞。

**附加判定（灰区项必须同时满足）：**

- **升级友好**：不 pin 死 ds-bot 版本；ds-bot 升级后扩展至少能加载、不炸宿主。→ 这一条与 C2「锁 ds-bot 版本」**直接冲突**，所以 C2 只能作为「用户显式接受风险」的降级项，且必须带失效检测（见 §3 方向 C）。
- **静默失效必须带自检**：任何依赖 ds-bot 源码行为从而"改了就静默失效"的挂接（B2 / C2），**必须自带运行时自检**，确认自己真的挂上了；不允许"看起来生效"。

### 2.1 「DSH 本体零改动」的可验证方法

不要用肉眼。装扩展前后各取一次指纹并比对：

```sh
# 装之前
find /usr/local/lib/node_modules/@deepseek-ai/dsh -type f \
  -exec sha256sum {} + | sort > /tmp/dsh-before.sha256
# 装/跑之后
find /usr/local/lib/node_modules/@deepseek-ai/dsh -type f \
  -exec sha256sum {} + | sort > /tmp/dsh-after.sha256
diff /tmp/dsh-before.sha256 /tmp/dsh-after.sha256 && echo "DSH 未改动"
```

并检查代码没有 import 任何包的 `exports` 之外子路径——这条对 DSH 和 `ds-bot` 同样适用（见第 6 条）。

---

## 3. 三个可行方向

### 方向 A：独立 Host 插件（并行挂载在 DSH 上）

**做什么**：新建一个 npm 包（如 `ds-bot-ext-<name>`），自己声明 `dsh.bundle.patch`，向同一个 profile 插入一行。用 DSH 文档化的 Host 扩展点加能力。

**能做的具体事**（都有文档依据）：

| 能力 | 接缝 |
|---|---|
| 给所有 Bot 加新工具（如 `query_db`、`send_email`、`translate`） | `ctx.tools.register(defineTool({...}))` |
| 加人类斜杠命令（`/deploy`） | `ctx.commands.register(...)`（`subsystems/commands.md`） |
| 审计/记录工具调用（写审计日志） | `tools/result` 只观察（最弱一档，推荐） |
| 拦截/二次确认（敏感操作审批） | `tools/pre-execute` 返回 `ask`/deny |
| 拦截/改写模型请求（注入额外上下文、按 Bot 替换提示词） | `agent/pre-step` waterfall（必须 `next()`，改写要展开 decision） |
| 给 Bot 注入持久上下文（项目规范、外部知识） | `ctx.systemPrompt.section()` 或 `agent.inject()` |
| 换模型供应商 / 加新 provider | `ctx.llm.registerAdapter()` |
| 定时任务 | 自注册工具 + `agent.followup()` |

**侵入风险：低。** 唯一实质风险是注册到根 ctx 的工具**对全部 Bot 可见**，会改变每个 Bot 的提示词体积和行为——这是语义风险，不是技术风险；需在方案里说明是否要按 Bot 限制（限制手段只能用 ds-bot 的 Capabilities，不能用自己的 restrict）。

**机制强度阶梯**（弱 → 强，取够用的最弱一档）：`tools/result`（只观察）< `tools/pre-execute`（allow/deny/ask）< `ctx.tools.guard()`（单调拒绝）< `tools/execute`（包裹分发）< `tools/post-execute`（替换结果）< `system-prompt/assemble`（整段替换）。审计与统计停在 `tools/result`，不要升到 `post-execute`。

**最小实物**：见 [`plan-a-audit.md`](./plan-a-audit.md)（工具调用审计，零提示词影响，可直接实现）。

**技术难点**：
1. 依赖的 `@deepseek-ai/dsh-*` 包**只能放 peerDependencies + devDependencies**，绝不能放 dependencies（profile 内副本会遮蔽运行时版本，导致核心服务注册失败）。
2. peer 范围会被**安装期强制**：`dsh plugin add` 拿运行时版本比对，不匹配直接拒绝。范围只能表达"能不能装"，表达不了"某个 API 在不在"。
3. 打包要补展示元数据（`locale/*.json` 的 `meta.title`/`meta.description`、可选 `./icon`），否则用户看不到标题描述。
4. `dsh` 版本线混乱（本机 `0.2.1-rc.2`；npm `latest` 是 `0.2.0-rc.2`，更旧）。`engines.dsh` 要按目标宿主写。

**推荐顺序：第一。**

### 方向 B：客户端 Slots UI 插件

**做什么**：独立 Web client 插件，用 `ctx.slots.inject('<slot>', () => ctx.slots.register({...}, Component))` 往界面加东西。

**两条子路**：

- **B1 增量共存（建议）**：挂 `conversation.session.header.actions`（list）、`conversation.input.activity`（list）、`settings.*` 卡片、`plugins.bundle.config`。按钮/面板与 ds-bot 界面并存。
- **B2 接管（灰区，需用户书面同意）**：挂 `sidebar.workspaces` 或 `conversation.session.header`。因为 ds-bot 用 `freePriority` 把自己压到 -100，你的插件**必然赢**——用户看到你的界面替代 ds-bot 的。技术上注册不会失败，产品上是"换皮/换壳"。

**侵入风险：B1 零；B2 灰区。** B1 几乎无风险。B2 按 §2 第 3 条**不能标"零"**：它依赖源码常量 `BOT_PRIORITY`（`index.js:747`）与 `freePriority` 的行为（`surface.js:80`），这两处都不是文档化契约。另：注册未声明的 slot 在激活期直接失败。

**B2 的强制自检**（不做就等于交付一个"看起来生效"的空壳）：注册后必须验证自己真的是该 cell 的当前赢家，例如在**注册完成后**比对 `ctx.slots.entries('<cell>')` 中自己那条的 `priority` 是否确实低于 ds-bot 的条目；不是就在控制台/插件诊断里报错（"B2 接管失败：上游优先级变了"），不允许静默。

**技术难点**：
1. 只能渲染 slot 里的 React 组件，禁止 iframe 托管页面；不能 `require` 任何 Harness Client 包（抛错组件会把整个 slot 搞白）。
2. `dsh.client.inject` **必须是静态数组**。
3. 样式只能用 `--dsw-alias-*` 主题 token；不在组件外写 DOM、不往 `document.body` 追加。
4. **无法复用 ds-bot 的组件**：它的 UI 全部打进 `client.js`，不是公开导出。想画"Bot 名册"只能自己重建，或者走它自己的 `/api/bot` + SSE（未文档化，见 C2）。
5. UI 卡片 presenter 必须是纯函数（禁 I/O、时钟、随机）。

**推荐顺序：第二**（做 B1，不做 B2，除非用户要"魔改界面"）。

### 方向 C：外部渠道旁路

**做什么**：让外部系统（GitHub、IM、内部服务）能触发 Bot 干活或收到 Bot 的输出。

**两条子路**：

- **C1 文档化路线（推荐）**：`ctx.webhookRuntime.register(rule)` + 一个 provider adapter（`subsystems/webhook.md`）。短信/IM/webhook → 校验 → 创建**普通 root Session** 跑 agent。
  - 局限（文档明写）：创建的是普通 DSH Session，**不是某个 Bot 的会话**，不进入 Bot 名册/分组，不能用 ds-bot 的 `message_bot`/`post_to_group` 语义。它是"外部触发一次 agent 任务"，不是"外部给某个 Bot 发消息"。
- **C2 未文档化路线（灰区，降级项，不是备选方案）**：外部直接 `POST /api/bot`（`src/host/channel.js:556`）+ 订阅 SSE（`feed.js:85`）。
  - 能做到 C1 做不到的：真正以某个 Bot 的身份说话、发到分组。
  - 风险：**这是源码里的内部 API**，非文档、非版本化，ds-bot 一升级就可能变；浏览器 cookie 认证语义也要自己处理。

**侵入风险：C1 零；C2 灰区。**
C2 依 §2 第 3 条不算零侵入，且**与「升级友好」直接冲突**，所以它只能作为用户显式接受风险的降级项，必须同时交付三样东西：

1. **锁版本**：`package.json` 把 `ds-bot` 固定到具体版本（如 `0.2.3`），并在 README 写明"升级 ds-bot 前必须重跑契约测试"。
2. **失效检测**：每次启动探测一次端点契约（如发一个只读 `endpoint` 并校验返回结构），不对就**禁用功能并明确报错**，而不是让它静默返回错数据。
3. **契约测试**：至少一条覆盖所用 `endpoint` 的请求/响应形状，ds-bot 升级后先跑它。

**技术难点**：
1. C1 的 rule 回调是**任意受信代码**，必须尊重 `signal`（卸载要中断）。
2. runtime **无队列、无重试、无去重、无崩溃重放**——重复投递会重复建 Session，业务侧要自己去重。
3. C2 要自己拿会话凭据，且 `fetch` 路由是共享 `/api` 通道上的精确路径，路径冲突会直接注册失败。

**推荐顺序：第三**，且先确认用户要哪种"外部渠道"（只触发任务 vs 以 Bot 身份收发）。

### 补记：single slot 的遮蔽语义——**最低 priority 渲染，dispose 即可让宿主回来**

> **本节第一版结论（「single slot 单占、宿主列表回不来」）已作废。** 错在把 `kind: "single"` 读成「一个 slot 只能有一条 entry」。源码不是这样。

**状态（2026-10-30）：经典模式这条线已被用户整体撤销**（fork main 已强推回 `3e84754`，`cd910a3`..`483242d` 共 11 个提交移除）。下面的实现路径**不执行**，仅作 slot 语义与踩坑记录保留——`seats` 分组、`mode` 订阅、`verifySidebar` 那条 gate，都是下次再碰 slot 分组时直接可用的结论。

依据（`@deepseek-ai/dsh-client-ui-slots/lib/index.js`，本机 `0.2.1-rc.2`）：

| 事实 | 位置 | 原话/行为 |
| --- | --- | --- |
| **同 cell 不同 priority 可以共存** | `:170-175` | `case "single"`：只有 `(e.options.priority ?? 0) === priority` 才 `throw`；priority 不同就允许注册第二条。报错提示自己写着 `register at a different priority to shadow it (lowest renders)` |
| **entries 按 priority 升序排** | `:221` | `next.sort(... (a.options.priority ?? 0) - (b.options.priority ?? 0))` |
| **渲染取每 cell 第一条活 entry** | `entriesOfSlot()` `:284-291` | 按 priority 序遍历，`seenCells` 去重后取首条 → **priority 最低者渲染** |
| **dispose 是 register 的返回值** | `:236-241` | `return () => { rec.entries = rec.entries.filter(e => e !== entry); ... }`，移除后次低者立刻接位 |

所以：宿主 `ui-workspace` 与 ds-bot 的 `TeamSidebar` **同时**在 `sidebar.workspaces` 里（`kind:"single"`, `scope:"root"`，`ui-sidebar/lib/client.js:507`），ds-bot 只是以 `BOT_PRIORITY = -100` 压过宿主的常规优先级（`-10` 一档）。**dispose 掉 ds-bot 那条，宿主立刻回来**；再注册回来即可恢复。不需要自绘、不需要代渲染。

`settings.trigger` / `settings.launcher` 同理（`ds-bot/src/client/index.js:812,815`）：它们只是同 cell 的低优先级 entry，撤掉就是宿主 `ui-settings` 的设置行回来。

**正确的最小实现路径（给实现阶段）**：ds-bot **已经有**挂载/撤下的机制——`surface.js:7` `groupsFor()` + `:26` `surfaceGroups()`，`installShell()` 里那一串 `shadow(...)` 每步都返回 disposer（`index.js:751` 的 `ctx.slots.inject` 包装）。缺的不是机制，是一个「经典模式要撤掉这三个座位」的 group：

1. 在 `surfaceGroups` 的 `GROUPS` 里加第三个 group（如 `seats`），把 `sidebar.workspaces` / `settings.trigger` / `settings.launcher` 三步挪进去；`brand.mark` / `brand.name`（顶部模式行）留在 `shell`。
2. `groupsFor()` 里 `seats: mode !== 'classic'`。
3. **必须把 `mode.js` 的 `subscribe` 也接进 `reconcile`**：目前 `reconcile` 只订阅 `surface`（`index.js:964-966`），而经典模式是另一个 store（`mode.js`，key `ds-bot:mode`，属性 `data-bt-mode`），不订阅就不会实时切。
4. **陷阱**：`verifySidebar()`（`index.js:936-960`）用「`TeamSidebar` 是否落在 `sidebar.workspaces`」判断 shell 是否装好，经典模式下它必然为假 → 会误判并 `groups.remount('shell')`。必须一并 gate 在 `seats` 的 wanted 上，否则经典模式会反复重装、偶发把宿主列表顶掉。

留下不需要动的东西：`styles.js:925/926` 那两条 `display:none` 在座位被撤后已无对象，但可留着当兜底；`styles.js:934` 的 `overflow:visible!important` 与工作区无关（修的是经典模式下拉被 `_regionArea` 裁切），**不许删**。

---

## 4. 明确不确定 / 需要用户拍板的点

1. **二开目标是什么**——加工具？改界面？接外部渠道？三方向成本差别大，方案不预设功能就无法细化。
2. **方向 B 是否允许"接管界面"**（B2）。技术上注册会成功（ds-bot 用 `freePriority` 让位），但会替换用户看到的 UI，且属灰区（依赖源码常量、上游一改就静默失效）。这是产品决策，需用户点头并接受 B2 的强制自检。
3. **方向 C 用哪条**：C1 零侵入但 Bot 团队参与不进去；C2 灰区，能真集成但必须锁 ds-bot 版本 + 带失效检测 + 契约测试。若选 C2，需用户显式接受这三条成本。
4. **目标宿主 DSH 版本**：本机 `0.2.1-rc.2`，但 ds-bot README 面向 `0.2.1-rc.2`，npm `latest` 更旧。要以哪个为准写 `engines.dsh` 和 peer 范围。
5. **是否需要多 Bot 差异化**：根 ctx 注册的工具对所有 Bot 生效。要按 Bot 区分只能借 ds-bot 的 Capabilities（配置层），不能写代码硬控——需用户接受这个限制。
6. ~~**未验证项**~~ → **已通过（Dev 实测）**：第三方 bundle 经 `dsh plugin add` 装入隔离 profile，`apply()` 执行、工具进请求、execute/schema 闭环、`dsh plugin remove` 后原状恢复、repo 干净、全程未碰 `~/.dsh`。详见 §1.6。

---

## 5. 附：给实现阶段的最小骨架（方向 A）

```
repo-ext/                          # 独立仓库/目录，不在 repo/ 内
├── package.json                   # dsh.bundle.patch + peerDependencies(@deepseek-ai/dsh-*)
├── cordis.patch.yml               # - insert: [{ id: ext, name: ds-bot-ext }]
└── index.js                       # export const name / export function apply(ctx, config)
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: ds-bot-ext
      name: ds-bot-ext
```

`index.js`（工具示例，按官方 `docs/user/develop/basic/tool.md` 的形态）：

```js
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'ds-bot-ext'
export const inject = ['tools']   // Cordis 等到工具注册表就绪

export function apply(ctx) {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'example_tool',
    description: '...',
    parameters: {                  // DSH 工具参数方言，不是 JSON Schema
      input: { type: 'string', required: true, description: '...' },
    },
    output: {
      schema: { type: 'string' },  // execute 必须返回这里声明的规范值
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) { return `ok: ${args.input}` },
  })), 'ds-bot-ext: example tool')
}
```

要点：
- `execute` 只返回 `output.schema` 声明的规范 JSON 值；给模型看的字符串由 `output.render` 生成。
- `tools.register` 返回 disposer，注册即 effect；用 `ctx.effect` 包住以保证卸载时自动撤销。
- `inject` 只列自己真正用到的服务（`ctx.<service>` 只对 `inject` 里声明过的服务合法）。

---

## 6. 修订记录（评审对照）

**v3**

- §1.6 新增 Dev 在隔离 profile 上的两条实测事实（linked 插件走 peer 解析；`headless` 的标题生成请求无工具）。
- §4.6 由"未验证"改为**已通过**。
- §3 方向 A 补机制强度阶梯；拆分"审计"与"拦截"两条，审计停在 `tools/result`。
- 新增最小实物方案 [`plan-a-audit.md`](./plan-a-audit.md)。

**v2（按 Rev 评审意见修订）**

| Rev 意见 | 处理 |
|---|---|
| 补：禁止 monkey-patch / wrap 导出 / require 内部路径 | §2 第 6 条，并注明 `exports` 只放行 `.`/`./client`/`./web-search`/`./package.json` |
| 补：测试门槛 | §2 第 8 条（三命令 + 单测 + mock-llm） |
| 补：写明「临时改再回滚 = 侵入」 | §2 硬红线第 1 条 |
| 矛盾：§0 标 B/C "零"但与第 3 条冲突 | §0 表拆成 B1/B2、C1/C2，灰区项明确标 **灰区**；§0 前置口径说明 |
| 矛盾：第 6 条"升级友好" vs C2"锁版本" | C2 降级为「用户显式接受风险」项，要求锁版本 + 失效检测 + 契约测试；§2 附加判定里点明冲突 |
| 第 7 条措辞反了 | §2 第 7 条改为「不读写任何用户数据；`state.json` 连只读都不作为接缝」 |
| 实操：B2 依赖 `freePriority`，上游一改静默失效 | §1.4 补 `freePriority` 实现与调用顺序分析；§3 B2 增加**强制自检**；补"同优先级注册会 throw" |
| 实操：DSH 零改动缺可验证方法 | 新增 §2.1 sha256 前后比对命令 |
| 行号错误 | `BOT_PRIORITY` 修正为 `src/client/index.js:747`，`freePriority` 为 `src/client/surface.js:80` |
