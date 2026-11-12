# 0.3.5 合并清单（Archi，11-12）

- 基线：fork `main` = `291f7863`（已含上游 v0.3.2 与我们的二开层）
- 目标：upstream tag `v0.3.5` = `405ee8bb`（2026-11-11 15:20 UTC）
- 我们现有层：84 文件 / 227 hunks（台账口径）
- 本文数字来自临时 worktree 实跑 `git merge --no-commit v0.3.5`，主树未动。

## 1. 上游 0.3.2 → 0.3.5 的变化（225 文件 / +53644 / −2591）

| 模块 | 文件 | 体量 | 是什么 |
|---|---|---|---|
| `ds-bot/src` | 63 | +14552 / −747 | 手机链路落地（`host/mobile.js`、`host/phone.js`、`client/phone-page.js`）、消息台账（`host/ledger.js`，`docs/plans/2026-11-10-message-ledger.md`）、多语言（`client/locales/*` 6 种）、群回复共享模块（`shared/group-replies.js`）、Agent 新建（`client/agent-new.js`）、预览（`preview.js`/`preview-worker.js`） |
| `ds-bot/test` | 43 | +2696 / −247 | 上述功能的新测试（`mobile`/`phone`/`ledger`/`i18n` 等） |
| `mobile/src` | 36 | +7218 | 原生手机 App（Expo/RN）界面 |
| `link/` | 17 | +2943 | 配对与中转：Noise 加密、Relay Server（`link/server`） |
| `app/` | 7 | +1276 | 桌面端：`dist.mjs`、`profile-shadow.mjs` |
| `docs/plans` | 7 | +192 | 手机 API、消息台账等设计文档 |
| `plugins/` | 0 | — | 无（上一版已删 `web-mobile`） |

**上游删掉的**：`ds-bot/src/host/group-log.js`（被 `ledger.js` 取代）。

**关键判断**：上游 0.3.5 的 `host/mobile.js` + `phone.js` 引的是 **同一份** `docs/plans/2026-10-24-mobile-api.md`——我们 ㊴ 手机端点就是按这份计划做的前半截（`hello` 握手、`feed` 首帧 `boot/seq`）。上游这次把它做完了：配对、端到端加密、Relay、二维码。

## 2. 撞车实测

```
临时 worktree: git merge --no-commit v0.3.5
冲突块总计 333：client.js 284（生成物，重建覆盖）+ 49 块 / 12 个文件
特殊形态：ds-bot/src/host/mobile.js = AA（双方都新增，16 块）
          ds-bot/test/i18n.test.js = DU（我们删过，上游新增/改过）
```

| 文件 | 冲突块 | 上游 0.3.2→0.3.5 | 我们的增量 |
|---|---|---|---|
| `src/host/mobile.js` | 16（AA） | 新增 416 行：手机端 API | 新增 488 行：早期手机端点 |
| `src/host/feed.js` | 8 | +23/−6：feed taps 事件钩子 | 8 hunk：`boot`/`seq` 首帧（㊴） |
| `src/host/channel.js` | 8 | +110/−19：staged 附件、语言、手机路由 | 16 hunk：手机 `hello`/`avatar`/`READS` + mcp/goal/tasks 等 |
| `src/host/groups.js` | 6 | +693/−350：消息台账重写 | 14 hunk：任务就绪提示、读取上限 |
| `src/client/settings.js` | 3 | +6/−4：Phone 页、Globe 图标 | 7 hunk：字体/密度/字号、SuperAgent 页 |
| `ds-bot/index.js` | 2 | +4/−2：MODULES 换 ledger/phone/mobile，删 group-log | 5 hunk：`ownModule()` 插入器 |
| `src/host/parts.js` | 1 | +136/−37：改用 `shared/group-replies.js` | 2 hunk：手机 `fileRef` |
| `src/host/delivery.js` | 1 | +54/−2：ledger 导入 | 2 hunk：手机读回附件 |
| `src/client/styles.js` | 1 | +46/−1：二维码、la-sec 新样式 | 19 hunk：我们的 UI 层 |
| `src/client/index.js` | 1 | +36/−16：`agent-new`、`RETURN_TOKENS` | 9 hunk：市场/MCP/主题 |
| `src/client/cells.js` | 1 | +49/−7：群回复共享模块、`closedCards` | 14 hunk：群折叠等 |
| `test/install.test.js` | 1 | +7/−1 | 宽松断言 |
| `test/i18n.test.js` | DU | 新增多语言断言 | 我们删过 |

## 3. 逐条取舍建议

### A. 手机链路整体退回上游（**翻转上一轮「C 先留」的决定**）

退：`src/host/mobile.js`（我们的 488 行）→ 上游 416 行；`src/host/boot.js`、`src/host/remote.js`；`channel.js` 的 `hello`/`avatar`/手机 `READS`；`feed.js` 的 `boot`/`seq`；`parts.js` 的 `fileRef`；`delivery.js` 的读回；`turns.js` 的 usage 合计；`constants.js` 的 `API_MIN/API_MAX`；`index.js` 的 `mobile` 注册；`test/mobile-*.js` 五个测试。

**依据**：上游已按同一份设计文档把手机链路做完（配对 + Noise + Relay + 二维码 + `phone.js` 服务端）。我们那套是同一计划的前半截，协议不与上游互通；留着就是维护一条私有分叉的协议，而且每次上游动手机侧都要再撞一次。
**收益**：本次最大一笔——我们 488 行 `mobile.js` + 相关约 200–300 行 + 5 个测试文件不再需要维护。

### B. `group-log` → `ledger`（**必须**，否则构建直接死）

上游删了 `src/host/group-log.js`，加了 `ledger.js`；我们 `ds-bot/index.js:26` 仍 `import * as groupLog`。处理：删这个 import；MODULES 数组本身已由上游换成 `ledger/phone/mobile`；我们的 `ownModule()` 插入器保留，但 `ownModule(feed, mobile)` 里那个 `mobile` 要删（A 之后我们不再有 `mobile` 模块）。

### C. `groups.js` / `parts.js` / `delivery.js`：**退回上游**

上游是消息台账的大改（`groups` +693/−350、`parts` +136/−37、`delivery` +54/−2）。我们的增量里，`parts`/`delivery` 基本都是手机协议的配套（随 A 一起走），只留 `groups` 的「任务就绪提示」一处，按上游新结构补回。
判断顺序：先取上游 → 跑 `groups`/`group-goal`/`group-tasks` 测试 → 只补还缺的功能。

### D. `channel.js`：**改造（保非手机增量）**

保：`mcp-*` 路由、`goal-view`/`tasks-view`/`task-events`、`superagent` prefs、`folders`、`fail` 的三参签名。
退：`hello`/`avatar`/手机 `READS`/staged 那套（上游已有 staged 附件）。
做法：以上游为底，逐条把「保」的部分补回；不要整份倒回我们版。

### E. i18n：`zh-extra.js` **保留，只做小改**

0.3.5 的 `DICTIONARY` 变成 7 种语言（`zh`、`zh-TW`、`ja`、`ko`、`es`、`fr`、`de`），但 **`zh` 这个键还在**，所以 `Object.assign(DICTIONARY.zh, …)` 继续有效；我们的 210 条只有中文，其它语言会回退到英文 key，可接受。
`test/i18n.test.js` 是 DU（我们 0.3.2 合并时删过、上游新增了多语言断言）：**取上游版本**，再把 `zh-extra` 的断言并进去。

### F. 客户端 UI：**保留**

`styles.js` / `settings.js` / `cells.js` / `client/index.js` / `icons.js` 上游都是小改（`PhoneIcon`/`SwitchIcon`、Phone 设置页、`la-sec` 样式、`RETURN_TOKENS`、`closedCards`）。以我们为底，吸收上游新增。
**注意 `styles.js` 的 `body{--bt-qr-paper}`**：上游新增了二维码配色，合进我们那一个 `body{…}` 基础块，**不要再出现两个 body 块**（上一轮刚合过一次）。

### G. 测试

- 随 A 删：`test/mobile*.test.js`（含 hello/endpoints/avatar 那几个）、`phone` 相关桩
- 取上游：`test/i18n.test.js`、`test/install.test.js` 先看上游版是否已覆盖（上次是我们删了 89 行改宽松断言）
- 按上轮口径：`sidebar-switch`、`style-debt.json`、`tool-cells`、`patch-*`
- 新增：上游 43 个测试文件里的 `ledger`/`phone`/`mobile`/`browser-frame`/`agent-new`

### H. 版本号与台账

- `ds-bot/package.json` → `1.3.5`（规则：(上游主版本 + 1).minor.patch）
- README/CHANGELOG 记「merged upstream v0.3.5」
- 台账基线改 `v0.3.5`，`patch-ledger.mjs` 重生成，`patch-conflict-check.sh v0.3.5` 要 clean

## 4. 需要拍板

1. **A 手机链路整体退回上游** —— 建议：**退**。这也结清上一轮「C 先留、登记撞车」的欠账。
2. **`remote.js`（Typert Remote 方法通道）去留** —— 上游完全没用 Typert Remote（`git grep TypertRemoteService v0.3.5` 为空），它服务的是「只转发 Remote 方法的载体」（dsh-Go）。**dsh-Go 还在用吗？** 还在就留（fork 独有，零冲突）；不用了就随 A 删，少一个依赖。
3. **`groups`/`parts`/`delivery` 整份取上游** —— 建议：是，只补「任务就绪提示」一处。

## 5. 执行顺序

1. A 退手机链路（一次性删干净：`mobile.js`、`boot.js`、REMOTE、channel/feed/parts/delivery/turns/constants 的相关块、5 个手机测试）
2. B 修 `index.js`：删 `groupLog` import、`ownModule(feed, mobile)` 去掉 mobile、按上游新 MODULES 重排
3. C/D 宿主侧：groups/parts/delivery 取上游；channel 以上游为底补非手机增量
4. E/F 客户端：i18n.test 取上游 + zh-extra 断言；styles 的 QR body 变量并进单块
5. `npm run build` → 清 `DS_BOT_*` 跑全量 → 台账基线 `v0.3.5` → `patch-conflict-check v0.3.5` clean
6. 版本号 1.3.5 + README/CHANGELOG 记录

## 6. 复现命令

```bash
tmp=$(mktemp -d) && git worktree add --detach --quiet "$tmp/t" main
cd "$tmp/t" && git merge --no-commit --no-ff v0.3.5
git diff --name-only --diff-filter=U | while read f; do echo "$(grep -c '^<<<<<<<' "$f") $f"; done | sort -rn
git status --porcelain | grep -E '^(AA|DU|UD) '   # add/add 与删除侧冲突
git -C "/Users/limeng/DeepSeek Bot/repo" grep -ln 'TypertRemoteService' v0.3.5 -- ds-bot   # 空 = 上游不用 Remote
```
