# SuperAgent P1 前置验证

只读验证，不改产品代码、不改 `groups.js`、不读用户凭证。两条结论都由**实跑探针**与源码行号
共同支撑，探针只用一次性插件（见文末复跑命令），没有任何提交。

一句话结论：

1. `rt.postToRoom` 只有 `groups.js:829` 一处注入，另有 4 处直调本地函数（845/876/925/954），
   都是「已准入那一轮的延续」，按 B 档定位不算漏，闸门包两个入口即可。
2. `tools/pre-execute` **能拿到工具名**：自注册工具与 ds-bot 已注册工具在 seam 上都读到了名字，
   甚至未注册的名字也会先经过 seam 才被拒。C 档可以直接用这个 seam 拒绝，不需要退回 deliver 前。

---

## 1. `postToRoom` 接缝

```
$ grep -rn "\.postToRoom\s*=" ds-bot/src ds-bot/index.js
ds-bot/src/host/groups.js:829:  rt.postToRoom = postToRoom
```

- **唯一注入点**：`groups.js:829`，本地函数定义在 `:798`。全仓没有第二处赋值（含对象字面量）。
- **外部调用走 `rt`**：`resume.js:226`、`tools.js:592` —— 包装 `rt.postToRoom` 能覆盖这两条。
- **内部直调（绕开 `rt`）共 4 处**，全部在 `groups.js`：

| 行 | 作用 | 判定 |
|----|------|------|
| 845 | late reply（成员答完补一句） | 已准入轮次的延续 |
| 876 | progress（过程汇报） | 同上 |
| 925 | stopped（被停止） | 同上 |
| 954 | failed（模型失败） | 同上 |

这 4 条都不产生新的准入决策，B 档（只记录不拦截）下不计入漏；C 档若要拦，需要改为调用 `rt.postToRoom`
或在这 4 条里加同一道判定 —— 但那是「拦截已经准入的轮次」，与 C 档目标不符，**列为已知接缝即可**。

## 2. `tools/pre-execute` 覆盖

### 2.1 注册面

`ctx.tools.register(...)` 共 **25 条语句 / 26 个工具**（差 1 是因为 `tools.js:856` 的 for 循环
一次注册 `attach_capability` 与 `detach_capability` 两个）。Chief 给的「25」是语句数，工具数是 26。

| 文件 | 语句 | 工具（注册行 → 名称） |
|------|------|----------------------|
| `tools.js` | 16 | 57 `list_bots`、143 `message_bot`、271 `stop_bot`、298 `create_bot`、333 `update_bot`、408 `list_bot_models`、450 `create_group`、479 `update_group`、540 `delete_group`、557 `post_to_group`、611 `ask_user`、670/713 `show_view`（按 agent 作用域注册）、787 `list_capabilities`、811 `save_capability`、841 `delete_capability`、856×2 `attach_capability`/`detach_capability` |
| `groups.js` | 3 | 577 `group_relay`、685 `read_own_chat`、740 `read_group_chat` |
| `memory.js` | 3 | 1113 `remember`、1147 `forget`、1185 `recall` |
| `secrets.js` | 2 | 419 `request_secret`、468 `list_secrets` |
| `browser.js` | 1 | 257 `read_browser` |

另有 `src/host/browser/mount.js:125`：为**每个**浏览器插件工具注册一条（数量随装了哪些插件），
同样走 `ctx.tools.register`，同一条 seam 覆盖，不单列。

### 2.2 seam 实测

探针插件在 `tools/pre-execute` 上挂监听，记录 `exec.name`，然后直接 dispatch 三次
（一次自注册工具、一次 ds-bot 的 `list_bots`、一次不存在的名字）。实跑输出：

```
P1PROBE {"seen":[
  {"name":"p1_probe_ping","agent":null,"root":"p1-p1_probe_ping"},
  {"name":"list_bots","agent":null,"root":"p1-list_bots"},
  {"name":"p1_no_such_tool","agent":null,"root":"p1-p1_no_such_tool"}],
 "results":{"p1_probe_ping":"ok","list_bots":"ok","p1_no_such_tool":"error"},"errors":[]}
```

读法：

- 自注册工具、ds-bot 注册的工具（`list_bots` 实跑成功，body 也执行了）、未注册的名字，
  **三次都先经过 `tools/pre-execute` 并带着名字**。未知名字是在 seam 之后才被拒的，
  所以「拦不拦得住」不取决于工具由谁注册。
- `exec.agent` 在直接 dispatch 时是 `null`（调用方没有 agent）。真实回合里由 agent loop 填：
  `dsh-agent-loop/lib/index.js:511-517` 构造 `exec` 时写入 `agent`，另见
  `ToolExecutionInput.agent` 的注释「set by the agent loop」。所以 C 档拿得到「哪个 Bot 在调工具」。
- 一次性确认过：seam 的返回值是 `{ kind: 'allow' | 'deny' | 'cancel' | 'ask' }`，
  `deny` 会把它方给出的理由变成模型可见的工具错误（`PreToolDecision` 定义在
  `dsh-tools/lib/types/index.d.ts:445`）。

### 2.3 对 C 档的含义

**不需要退回 deliver 前拒绝。** `tools/pre-execute` 覆盖了本插件注册的全部工具（含按 agent 作用域
注册的 `show_view`、浏览器插件的动态工具），并且能拿到工具名与调用方 Agent。C 档的守门点因此可以放在
这个 seam，而不是靠 deliver 前置检查去猜。

## 3. 已知限制

- 探针没有跑真实回合（没有模型），所以 `exec.agent` 的非空只由源码行号支撑，未经运行时复现。
  P2 落码时用一次真实回合确认即可（一条 `console.log` 即可，不必另建探针）。
- `browser/mount.js` 的动态工具数量取决于安装的浏览器插件，未逐个点名。
- 本节只验证「拿得到」，未验证「拦得住后行为如何变化」—— 那是 P3 的事。

## 4. 复跑

探针是仓库外的一次性包，不进产品代码：

```sh
# 1) 探针插件与 profile（profile 只链 ds-bot 与探针）
/root/.dsh/bot/workspace/p1-probe/index.js
/root/.dsh/bot/workspace/p1-home/profiles/web/package.json   # bundles: base, web-app, ds-bot, ds-bot-p1-probe

# 2) 起一个不连模型的 dsh web，读它打出的 P1PROBE 行
cd /root/.dsh/bot/workspace
DSH_HOME=/root/.dsh/bot/workspace/p1-home DEEPSEEK_API_KEY=mock-key \
  DEEPSEEK_BASE_URL=http://127.0.0.1:9/v1 \
  timeout 45 node /usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile web --no-open --port 3999 2>&1 | grep -o 'P1PROBE .*'
```

注意：`ds-bot` 的普通依赖 `deep-view` 在 linked 场景下要能被解析（本机放在
`repo/ds-bot/node_modules/deep-view`，已 gitignore），否则 `bot (ds-bot): failed to import`，
探针仍会跑但 `list_bots` 那行会变成 `error`。
