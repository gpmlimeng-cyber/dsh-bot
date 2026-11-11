# 0.3.2 合并执行清单（Archi）

- 日期：2026-11-10
- 基线：`gpmlimeng-cyber/dsh-bot` main = `9999b68c`
- 目标：upstream `Fei2411/DS-Bot` tag `v0.3.2` = `84c3cb86`
- merge-base：`6559c9e7`（上游 0.3.1 发布点）
- 本文数字全部来自临时 worktree 实跑，主树未动。复现命令在 §6。

## 1. 实测结论（先看这四条）

1. **真实冲突远小于文件数**：两边都改过的文件 31 个（不含 `ds-bot/client.js`），但 `git merge --no-commit v0.3.2` 跑出来只有 **302 个冲突块，其中 277 个在 `ds-bot/client.js`**（生成物，19,944 行）。扣掉它，手工冲突只有 **25 块 / 12 个文件**。其余 18 个「两边都改」的文件 git 自己合上了。
2. **冲突集中在 5 个文件**：`sidebar.js` 8、`channel.js` 3、`settings.js` 3、`groups.js` 2、`model-menu.js` 2；剩下 7 个文件各 1 块。
3. **`plugins/web-mobile` 不是「被上游删掉所以没载体」**：上游 0.3.2 确实整目录删了它，但**我们自己把它加回来了**（`git diff 6559c9e7 origin/main -- plugins/web-mobile` 全是 `A`），根 `package.json` 的 `"dsh-web-mobile": "file:plugins/web-mobile"` 和 `ds-bot/cordis.patch.yml` 的 insert 行也都在。载体在我们手里，不在上游手里。
4. **手机 web 皮现在就已经不生效了**：6 个 profile（acp / deepseekbot / desktop / team-mode-verify / web / node_modules）**没有一个装了 `dsh-web-mobile`**，desktop profile 只 link 了 `ds-bot`。所以 `data-mobile-nav` 在当前客户端里根本不出现，`html:has([data-mobile-nav="frame"])` 全组规则、⑤ 汉堡、④ 抽屉收起、⑧⑨⑩⑪⑬㉟㊱㊳ 现在就是死代码。

→ 结论：**退役手机 web 皮是主动清理，不是被迫牺牲**。这个区别要写清楚，否则以后有人一句「它其实还能跑」就能把结论推翻。

## 2. 对 Chief 方案的四点修正

| # | Chief 的说法 | 实测 / 更正 |
|---|---|---|
| 1 | `plugins/web-mobile` 被删 → 手机组「失去载体，强制退役」 | 载体是我们 vendored 的，目录、package.json、cordis insert 行都在；真实理由是「所有 profile 都没装，今天就没生效」+「上游已放弃，继续维护=自己 fork 一个死插件」。结论不变，理由要换。 |
| 2 | `model-menu.js` 上游更完整 → ⑯ 整块退役 | 不能整块退。我们的 +4 行是 `ProviderMark`（⑰ 厂商图标）挂点，上游新写法依赖 `agent-routes.js`（新文件），图标要**重新接 1 处**（`ModelRows` 的 name 行 + 触发胶囊），不是删掉。 |
| 3 | `i18n` 210 行改成「末尾追加 + 哨兵注释」 | 有更好的：`i18n.js` 导出 `DICTIONARY = { zh: ZH }`。新建 `zh-extra.js`（甲类，零补丁）里 `Object.assign(DICTIONARY.zh, {...})`，模块加载时执行，早于 `installLocale()` → **`i18n.js` 0 补丁、12 hunk 全撤**，且 `DICTIONARY` 是同一对象引用，`t()` 一定看得到。 |
| 4 | `index.js` MODULES 行改成 cordis `insert` 追加 | cordis patch 改不了 JS 数组字面量。可行做法：**原 MODULES 行一字不动**，文件尾部追加 `import`（ESM import 允许出现在顶层任意位置、会被提升）+ `MODULES.push(...)`，模块求值早于 `apply()`。**代价**：模块注册顺序变到末尾，需跑一遍测试确认没有顺序依赖。 |

| 5 | ④ 抽屉自动收起 / ⑦ 会话「···」菜单归「保留」 | 两者都是手机件的零件：`mode-row.js:6` 注释写明「The drawer's marker belongs to dsh-web-mobile; without the plugin there is no drawer」；`styles.js:1514` `.bt-head>.bt-pmenu{display:none}`，只有 `:1516` 的 `html:has([data-mobile-nav="frame"])` 才 `display:inline-flex`——**⑦ 在桌面从来没显示过**。都归退役。留成桌面功能的话是 1 行栅门改动，得单独拍板（上游 0.3.2 没有等价菜单，`context-menu.js` 只有 pin/改名/删除）。 |
| 6 | ⑯「整份退役，取上游」 | `styles.js:1530` 是 `html:has([data-mobile-nav="frame"]) .bt-model-trigger{display:none}`——**胶囊是桌面专属**，正是用户点名要的那个。上游重写的是 `model-menu.js`（菜单内部），不含头部胶囊。正解：胶囊与挂点留住，菜单实现换上游，⑰ 图标重接 1 处。 |

## 3. 逐文件决定（31 个文件）

图例：**取上游** = 我们这边丢弃；**补回** = 以上游为底手工落我们的改动；**追加化** = 改成只加行、不改上游行；**退役** = 连带载体一起删。

### 3.1 冲突文件（12 + client.js）

| 文件 | 冲突 | 我们改了什么 | 决定 |
|---|---|---|---|
| `ds-bot/client.js` | 277 | 生成物 | **不参与 merge**，解完源码后 `node scripts/build-client.mjs` 重生成 |
| `src/client/sidebar.js` | 8 | ④ 抽屉收起、㉒ rail、㉓ 市场入口、㉚㉛ 分组 | **补回**，但 ④ 随手机皮退役一起删；rail/分组/市场保留 |
| `src/host/channel.js` | 3 | ㊴ 手机端点（`hello` 握手等，+246/−20） | **补回**：上游 0.3.2 没有 host/mobile.js，我们的端点没人替；但上游正做原生 App，标记为「与上游手机协议会撞」 |
| `src/client/settings.js` | 3 | ㉕ 字体、㊳ 手机皮肤开关 | **补回**：字体保留，手机皮肤开关随皮退役 |
| `src/host/groups.js` | 2 | 群里任务就绪提示、读取上限 | **补回**（服务手机端点那套常量） |
| `src/client/model-menu.js` | 2 | ⑰ `ProviderMark` 挂点（+4） | **取上游为底**，把 ProviderMark 重接到上游新结构 |
| `src/client/i18n.js` | 1 | 209 行中文 | **整块撤出** → `zh-extra.js`（见 §2.3），文件 0 补丁 |
| `ds-bot/index.js` | 1 | MODULES 多 8 个模块 + skillMarket 注入 | **追加化**（见 §2.4） |
| `src/client/team-actions.js` | 1 | ④ `dismissDrawerIfOpen` 调用点 | **取上游**（随手机皮退役） |
| `src/client/new-chat.js` | 1 | ⑪ 手机底部抽屉（+84） | **取上游**（随手机皮退役） |
| `test/fold.test.js` | 1 | 我们改过折叠阈值断言 | **补回**，但先跑上游新折叠逻辑，断言跟着我们的 `GROUP_FOLD` 走 |
| `test/install.test.js` | 1 | 我们删了 89 行 | **取上游**（上游重写过） |
| `test/tool-cells.test.js` | 1 | 我们 +87 条断言 | **补回**，只断言我们的约定 |
| `test/composer-plus.test.js` | modify/delete | 我们删了 55 行 | **取上游** |

### 3.2 合上了但要逐条看的（18）

| 文件 | 风险 | 动作 |
|---|---|---|
| `src/client/styles.js` | 合得上，但含 9 个手机 hunk（#5/6/8/9/15/16/18/19/20） | 退役后删手机块；⑫ 只留桌面半；⑭⑮ 保留 |
| `src/client/cells.js` | 我们加了 `GROUP_FOLD`，上游也动了折叠（+11/−4） | 合完必须跑群聊折叠的观感 |
| `src/client/fold.js` | 同上，我们 +135/−35，上游 +15/−9，语义独立改动 | 同上，重点看两者叠加 |
| `src/client/header.js` | ⑤⑦⑯⑲ 混在一个文件 | 退 ⑤⑦，保 ⑯⑲（桌面模型胶囊 + 右侧栏钮） |
| `src/client/context-menu.js` | 上游整块重写（+128/−8），我们 +26 是侧栏分组菜单 | 取上游 + 把分组菜单接回 1 处 |
| `src/client/create-bot.js` | 上游重写（+35/−16），我们 +3 是 GazeRow | 接回 1 行 |
| `src/client/bot-settings.js` | GazeRow（+17/−5） | 接回 1 行，注意上游新增 RunModeCard |
| `src/client/index.js`（client） | ㉓㉔㉞ 市场/MCP + 主题 + 手机皮肤 | 删手机皮肤与 ㉟㊱，其余保留 |
| `src/client/icons.js` | 我们加的图标大部分是手机控件用 | 退手机图标，留 `MoreDotsIcon`/`PanelRightIcon` |
| `src/host/constants.js` | 手机 API 版本常量 | 保留 |
| `src/host/delivery.js` / `parts.js` / `turns.js` / `images.js` | 手机端点配套（读回附件、用量合计、图片 ref） | 保留 |
| `test/bot-messages.test.js` | +27 | 保留 |
| `CHANGELOG.md` / `NOTICE` | 两边都追加 | 两边都留（追加型，天然不冲突） |
| `ds-bot/cordis.patch.yml` | 我们的 +8 就是 web-mobile 的 insert 行 | **退役时删**，取上游 |

### 3.3 随手机 web 皮一起退役的清单

删：`plugins/web-mobile/` 整目录、根 `package.json` 的 `dsh-web-mobile` 依赖、`ds-bot/cordis.patch.yml` 的 `web-mobile` insert 行、`drawer-dismiss.js`。

补丁退役：③、④、⑤、⑦、⑧、⑨、⑩、⑪、⑬；⑫ 只留桌面半；㉟、㊱、㊳ 整条。

测试退役：`test/phone-scope.test.js`、`test/skin.test.js`、`test/mode-row.test.js` 里的手机断言，以及 `test/patch-features.test.js` 的手机断言（这些文件上游没有，属于甲类，删了不影响合并）。

保留：⑫ 桌面半、⑭、⑮、⑯、⑰、⑱、⑲、㉑、㉒、㉓、㉔、㉕、㉖、㉗、㉘、㉙、㉚、㉛、㉜、㉝、㉞、㊴。

## 4. 执行顺序

1. **备份层**：`git diff 6559c9e7 origin/main > /tmp/ours-layer.patch`（解冲突时对照用，别靠记忆）。
2. **合并**：临时 worktree 先行 `git merge --no-commit v0.3.2`，按 §3 填表；`client.js` 冲突直接 `git checkout --theirs -- ds-bot/client.js`，后面重生成。
3. **退役手机皮**：按 §3.3 删，先删载体再删补丁，否则测试会红在中间态。
4. **收口三项**：`zh-extra.js`、`MODULES.push`、⑰ 重接。
5. **重生成**：`npm run build` → `node tools/patch-ledger.mjs`（基线改 `v0.3.2`）→ `tools/patch-conflict-check.sh v0.3.2` 必须 `clean`。
6. **验证**：`npm run build && npm test && node scripts/build-client.mjs --check && npm run lint`（跑前清掉 `DS_*`/`DSH_*` 环境变量，否则多 13 条假红）。

## 5. 需要拍板

1. **手机 web 皮退役** —— 建议同意（理由见 §1.3/§1.4，不是被迫，是清理死代码 + 甩掉一个上游已弃的 vendored 插件）。
2. **`zh-extra.js` 与 `MODULES.push` 这次一起做** —— 建议一起（各半天内），做了以后每次升级少 13 个 hunk。
3. **㊴ 手机端点去留** —— 建议保留，但要接受它大概率与上游原生 App 的协议撞车；要不要现在就和上游的 `docs/plans/2026-10-24-mobile-app.md` 对齐，得你定。

## 6. 复现命令

```bash
# 冲突数
tmp=$(mktemp -d) && git worktree add --detach --quiet "$tmp/t" origin/main
cd "$tmp/t" && git merge --no-commit --no-ff v0.3.2
git diff --name-only --diff-filter=U | while read f; do echo "$(grep -c '^<<<<<<<' "$f") $f"; done
# 手机皮是否被我们 vendored 回来
git -C "/Users/limeng/DeepSeek Bot/repo" diff --name-status 6559c9e7 origin/main -- plugins/web-mobile | head
# 哪个 profile 装过 web-mobile
for p in ~/.dsh/profiles/*/; do ls -d "$p/node_modules/dsh-web-mobile" 2>/dev/null; done
```

## 7. 用户已拍的取舍

| 项 | 内容 | 决定 |
|---|---|---|
| ㉘ | 顶栏（窗口标题带）：品牌块只留文字、`--bt-side-lift` 只测一次、藏宿主折叠钮 | **舍弃**（用户 11-10 定），顶栏回到上游原样 |
| ㉝ | 桌面端顶栏对齐 Web（删 darwin / windows-titlebar 下的 `.bt-side-top` 特例） | **舍弃**（同上） |
| ㉚ ㉛ | 侧栏分组 / 自建分组 | **换上游实现**（用户 11-10 定；原侧栏分组退役）：上游 0.3.2 已有 `saveSection` / `reorderSections` / `deleteSection` + SectionBlock 折叠改名拖拽 + context-menu「移到分组」，功能更全；我们那份要删掉（数据模型变了，旧 local storage 分组读不出来，需迁移或接受清空） |
| ④ | 从抽屉点开的入口自动收起抽屉 | **退役**：抽屉形态属于 `dsh-web-mobile`（`mode-row.js` 注释），插件退役后没有抽屉 |
| ⑦ | 会话头部右上「···」菜单 | **退役**：`styles.js:1514` 桌面本就 `display:none`，只有帧选择器才 `inline-flex`，从未在桌面显示；升级成桌面功能属新功能，另议 |
| ⑯ | 模型选择器 | **保留胶囊 + 挂点**（`styles.js:1530` 说明胶囊是桌面专属），菜单实现换上游，⑰ 厂商图标重接 1 处 |
| ㉜ | 品牌位改成模式选择器（caption 带里的下拉胶囊 + 面板） | **退役**（用户 11-11 定）：模式切换改用上游的「设置 → Mode」+ Agent 模式侧栏「DS Bot」返回钮 |
| ㉟ | 窄屏把模式选择器那一行放进左侧抽屉顶部 | **退役**（同上，随 ㉜ 一起；抽屉本身也随手机皮没了） |

仍未定：A 手机 web 皮退不退、B `zh-extra.js` + `MODULES.push` 是否本次一起做、C ㊴ 手机端点去留。

**用户 11-10 定（「听你的」）**：
- A 手机 web 皮：**退役**（卸 vendored 插件 + 10 组补丁）
- B 收口：**本次一起做**（`zh-extra.js` 承接中文词条；`MODULES.push` 追加注册）
- C ㊴ 手机端点：**先留**，登记「与上游原生 App 协议可能撞车」

## 8. 拆 mode bar 后的上游行为验收清单（Archi，11-11）

**已执行（11-11）**：模式切换器与标题带自绘行全部退役，改用上游方案。dev 改动落在提交 `dcaa4a4e`（拆行）与 `fd13ab41`（台账重生成）：删 `src/client/mode-row.js` 与 `test/mode-row.test.js`，`index.js` 去掉 `modeBar`/`modeMenu`/`bandActions`/`bandPatch`/`placeRow`/`inDrawer`/`paintModeBar` 与 `#bt-modebar-rules`，`styles.js` 去掉 `.bt-modebar*`/`.bt-band-*`/`html.bt-bot` 压制规则。保留的是上游的「设置 → Mode」与 Agent 侧栏「DS Bot」返回钮。下表用于复核这四条上游行为是否真的回来了。

用户 11-11 定：模式切换、标题栏左上那排（模式下拉 + 自绘搜索/新建/折叠）全部拆回上游；只留上游的「设置 → Mode」和 Agent 模式侧栏的「DS Bot」返回钮。

拆的是这一块：`src/client/mode-row.js` 整个文件 + `src/client/index.js` 的 `modeBar`/`modeMenu`/`bandActions`/`bandPatch`/`placeRow`/`inDrawer`/`paintModeBar`，以及它注入的 `#bt-modebar-rules`。

| # | 该恢复的上游行为 | 上游出处 | 我们的代码压掉了什么 | 怎么验 |
|---|---|---|---|---|
| 1 | 宿主自己的侧栏折叠/展开钮 | `dsh-client-ui-sidebar` 的 `HeaderLeadingControls`（logo 行里那枚）；上游 `styles.js` 只在侧栏展开时藏 logo 行 | `#bt-modebar-rules` 里 `button[aria-label="打开侧边栏\|收起侧边栏\|展开侧边栏\|Open sidebar\|Close sidebar"]:not(...){display:none!important}` | 收起侧栏后，`document.querySelectorAll('button[aria-label*="侧边栏"],button[aria-label*="sidebar"]')` 里应有宿主那枚；`document.getElementById('bt-modebar-rules')` 必须是 `null`；且**不能出现两枚展开钮**（我们的 `TitleToggle` 在 `hidden` 时也画一枚，见 note 1） |
| 2 | Agent 模式下 DSH 的 logo 行 | 上游 `styles.js`：非 Windows 标题栏时 `:not([class*="_collapsed"])>[class*="_logoRow"]{display:none}`，收起时显示 | `html.bt-agent [class*="_logoRow"]{display:none!important}`（在 `#bt-modebar-rules` 里） | 切到 Agent 模式：`document.documentElement.classList.contains('bt-agent')` 应为 `false`（我们不再打这个 class）；侧栏展开时 logo 行按上游规则隐藏、收起时显示 |
| 3 | Agent 模式侧栏的「DS Bot」返回钮 | 上游 `sidebar.js:1231` `h('button',{className:'bt-return','aria-label':t('DS Bot')})` | 没压，它在上游版 sidebar 里 | Agent 模式下 `document.querySelector('.bt-return')` 存在，点它回到 Bot 模式 |
| 4 | 设置 → Mode（只显示「要切过去的那个模式」一行） | 上游 `settings.js:164-167`：Bot 模式下显示 `Classic Agent mode` 按钮，Agent 模式下显示 `Bot mode` 按钮，都调 `actions.setSurface(...)` | 没压；但我们 settings 里有 SuperAgent 页与 ㉕㉗ 行，解冲突时容易连带删 | 设置 → General 里有 `Mode` 段，且**只有一行、行内是另一个模式的按钮**；点它切过去后，回头再看这行应变成反向按钮 |

**拆的时候必须一起处理的连带面**

1. **`html.bt-bot` 会变成永不命中的死规则**：`styles.js` 里 `html.bt-bot [class*="_newSession"],html.bt-bot nav[class*="_panelList"],html.bt-bot [class*="_logoRow"]>[class*="_brand"],…{display:none!important}` 只靠 `paintModeBar` 打的 class 生效。class 不再切换后，**Bot 模式下宿主自己的会话行/品牌行可能重新出现**（和我们侧栏重复）。要么删掉这条规则，要么改成上游口径，不能留着。这是拆 mode bar 唯一真正有回归风险的地方。
2. `bt-band-patch` 是给标题带里的行挡拖动区的透明补丁；拆完 `document.querySelector('.bt-band-patch')` 应为 `null`（它随 `dragPatch` 销毁逻辑一起删）。
3. `paintModeBar` 挂的 `window.addEventListener('resize'…)`、`document` 的 mousedown 监听要随块删，别留监听泄漏。
4. `mode-row.js` 删了就别留 `import`：`src/client/index.js` 顶部 `import { drawerSlot, modeRowSlot, placeModeRow } from './mode-row.js'` 必须清；`test/mode-row.test.js` 也要删，否则测试直接挂。
5. **不要把侧栏列顶那三枚一起删掉**：`.bt-side-top`（搜索/新建/折叠）在侧栏列里，不是标题带里那排。判断标准：侧栏展开时列顶部仍有这三枚。
6. `modeBar` 用过的 i18n 词条（Bot mode / Classic Agent mode 之外那些）会变死词条，留在 `zh-extra.js` 不影响功能，收口后清。

Note 1（第 1 项的重复钮）：`sidebar.js` 的 `TitleToggle` 只在「窗口有 Windows 标题栏」或「列被隐藏」时渲染；宿主那枚在 logo 行。两个同时可见就是重复，需要判谁该让位——**先看截图再决定，不要先删代码**。

## 9. 验收记录（v0.3.2 合并，11-11）

- **合入**：`main` = `ac2382c7`；来源分支 `chore/merge-upstream-0.3.2` = `0dc7a695`；两棵树 `git diff --numstat` 为 0 行。
- **台账**（全量口径，含 fork 独有新文件）：84 文件 / 227 hunks / +17508 / −541；`node tools/patch-ledger.mjs` 重跑与 `.hunks.md` 逐字节一致；`git apply --check -R` rc=0；`tools/patch-conflict-check.sh v0.3.2` → **clean**。
- **门禁**：`node scripts/build-client.mjs --check` → exit 0；`npm run lint` → 0 error / 78 warning（454 files）。
- **全量测试**（清 `DS_*`/`DSH_*`，node 24，`DSH_HARNESS=dev/harness`）：2188 tests / 2184 pass / **1 fail** / 0 cancelled / 3 skipped。

### 唯一那条红是环境性的，不是回归

`test/computer.test.js` 的「the provider mounts when the switch comes on and reports its status」（断言在 `fibers[1].config` 那条）期望：

```js
process.platform === 'darwin' ? { agentPreset: false } : {}
```

而 `src/host/computer/index.js:184` 在 **进程环境里有 `DS_BOT_RUNTIME_DIR` 和 `DS_BOT_COMPUTER_HELPER_HOME`**、且 `prepareComputerHelper` 能解析到 helper 时，会往 config 里加 `helperPath`（本机是 `~/Library/Application Support/DeepSeek Bot/computer-use/…`），测试期望对象里没有这个键 → 必红。DS Bot 给 Bot 的 shell 就是导出这两个变量的，所以在 Bot 里跑测试必然踩到；这不是代码变更引起的。

**实测（同一条命令，只差这两个变量）**
```
带变量：ℹ tests 45  ℹ pass 44  ℹ fail 1
env -u DS_BOT_RUNTIME_DIR -u DS_BOT_COMPUTER_HELPER_HOME：ℹ tests 45  ℹ pass 45  ℹ fail 0
```

**干净机器 / 清变量后的预期基线：2188 tests / 2185 pass / 0 fail / 3 skipped。**
注意别把 2184 当 0 fail 的基线：2188 − 3 skipped − 1 fail = 2184，那条红修掉后 pass 是 **2185**。

复核方式：换一台没跑过 computer-use 的机器，或在本机用
`env -u DS_BOT_RUNTIME_DIR -u DS_BOT_COMPUTER_HELPER_HOME npm test`。
**不要为了复现去挪 `~/Library/Application Support/DeepSeek Bot/computer-use`**——那是用户的本机数据。
