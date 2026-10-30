# ds-bot 本地补丁台账

已登记的改动：① Gaze 形象一排（头像编辑器 + 新建 Bot）；② 去图片头像的 1px 内描边；③ 移动端两条纯 CSS；④ 从抽屉点开的入口自动收起抽屉；⑤ 窄屏会话头部的展开汉堡；⑥ 全站圆角走 `--dsw-corner-shape`；⑦ 会话头部右上「···」会话操作菜单；⑧–⑪ 头部悬浮面、输入框、控件图标、底部抽屉。
**追加优先**：能写在文件末尾的绝不改上游已有行，把上游合并冲突面积压到最小。

- 基线：**上游 `4a7b550`**（①②③ 已进提交 `f03bc73`，所以补丁必须相对 `4a7b550` 生成，`git diff` 相对 HEAD 只剩 ④⑤）
- 补丁：`design/ds-bot-patches.patch`（默认 `-U3`，15 个手改文件）
- hunk 数：**48**（`grep -c '^@@' design/ds-bot-patches.patch`）
- **行号**：见 `design/ds-bot-patches.hunks.md`，由 `node tools/patch-ledger.mjs` 生成，勿手改。
  这里**不写行号**：手写行号已经错了三次，机械表是唯一来源。
- minus 行分布在 11 个文件：`styles.js` 22、`sidebar.js` 6、`icons.js` 6、`new-chat.js` 5、`bot-settings.js` 5、`team-actions.js` 4、`create-bot.js` 2、`composer.js` 2、`browser-pane.js` 2、`index.js` 1、`header.js` 1；`i18n.js`、`about.js`、`member-status.js`、`drawer-dismiss.js` 各 **0** 个 minus
- 冲突自检：`tools/patch-conflict-check.sh <ref>`（升级前先跑，输出 `clean` 才合并）

## 1. 手改的文件（进补丁，共 15 个）

hunk 编号与 `hunks.md` 的 `#` 列一一对应。

| # | 文件 | 改前 → 改后 | 为什么 |
|---|---|---|---|
| 1 | `ds-bot/src/client/bot-settings.js` | — → `import { GAZE } from './gaze.js'` | 取到四个 Gaze 形象 |
| 2 | `ds-bot/src/client/bot-settings.js` | 无 → `export function GazeRow({ current, onPick })` | 两个选择器共用的那一排；`aria-pressed` 标出当前用的是哪张 |
| 3 | `ds-bot/src/client/bot-settings.js` | `tab === 'bot' ? h(CharacterGrid, …)` → 外包 `h(Fragment, null, …, h(GazeRow, …))` | 排到 Bot 页角色网格下面；点击走已有的 `actions.updateBot(bot.id, { avatar: { …bot.avatar, image } })`，与头像库同一条写入路径 |
| 4 | `ds-bot/src/client/create-bot.js` | `import { CharacterGrid }` → `+ GazeRow` | 新建表单复用同一排 |
| 5 | `ds-bot/src/client/create-bot.js` | lookbar 之后 → `h(GazeRow, { current: image, onPick: setImage })` | 新建时选中即进预览，Create 时随 payload 带上 |
| 6 | `ds-bot/src/client/i18n.js` | — → `Gaze: '凝视'`（`ZH` 映射**末尾**，不在中间插） | 中文文案；key 就是英文原文，没有第二张语言表 |
| 7 | `ds-bot/src/client/styles.js` | 无 → 追加 `.bt-mark-img{box-shadow:none}` 与 `.bt-avedit{max-height:calc(100dvh - 96px);overflow-y:auto}` | ① 去掉图片头像的描边（同特异性、后写胜出，**不改** 第 24 行上游原行）；② 头像浮层自身滚动，短视口（含 844×390 横屏手机）下 Gaze 那排够得到 |
| 8 | `ds-bot/src/client/styles.js` | 无 → 追加 `@media (pointer:coarse){…}`，`.bt-plus/.bt-mic/.bt-voice` 与底栏发送按钮 28→32px | 触屏按钮放大到可点。发送按钮原规则带 `!important`，这里同样用 `!important` 覆盖 |

hunk 3、5 是唯一的 minus 行（挂载点，各 1 处组件插入），其余 6 个 hunk 全是纯 `+`。

第 7 条的 `max-height` **不带 media 包装**：浮层是 `position:absolute` 挂在头像按钮下方，横屏手机宽度 844 不命中 `max-width:640px`，所以无条件生效；长窗口不会出滚动条。

**已知副作用（已批准）**：第 7 条去掉的是所有图片头像的描边，用户自己上传的照片同样不再有那圈线（该行唯一消费者是 `mark.js:77`）。

## 1b. 补丁 ④⑤ 的逐条理由

| 部位 | 文件 | 改前 → 改后 | 为什么 |
|---|---|---|---|
| ④ 持有者 | 新文件 `drawer-dismiss.js` | 无 → `holdDrawerDismiss` / `dismissDrawerIfOpen` | 抽屉开合状态没有文档化读接口（`ctx.layout` 只有 `toggleSidebar`，侧栏 slot 只给 `wide`），所以由调用方说明来源；没有持有者时是 no-op，不会误 toggle |
| ④ 折叠实现 | `sidebar.js` | 新增 `collapseDrawer` + `useEffect(holdDrawerDismiss(...))` | 只有这个组件同时有 `wide`、`expandSidebar` 和 `closing` latch，条件与 `navigate` 完全一致（`wide && innerWidth < 1024 && !closing.current`）；**不读 DOM** |
| ④ 抽屉侧调用点 | `sidebar.js` | 搜索、新建（宽/rail 两处）、抽屉内打字搜索、行右键设置、账号菜单（`seat === false` 时）带 `{ fromDrawer: true }` | 判据是「点击时用户看到的是抽屉里的元素」；命令面板 `palette.js` 不传（它本身是浮层，抽屉早收了） |
| ④ 汇聚点 | `team-actions.js` | `openNewChat` / `openPalette` / `openSettings` / `openConnectors` 加可选 `opts`，进入前调 `dismissDrawerIfOpen` | 7 个调用点自然覆盖，不用改 7 处；不传就是绝不收 |
| ④ 面板入口 | `index.js` | `selectPanel(id, opts)` 同样先 `dismissDrawerIfOpen` | 账号菜单的「Automation tasks」走的是 `selectPanel`，不在那三个 action 里，漏了就是没修 |
| ⑤ 按钮 | `header.js` | `bt-head` 内新增 `.bt-menu-btn`，`onClick: actions.toggleSidebar()` | dsh-web-mobile 的 toggle 注册在被 ds-bot shadow 的 slot 里，真机实测 `[data-mobile-nav="toggle"]` 为 null，结构性缺失，只能自己画。按钮放在药丸**之后**，DOM 里第一个按钮仍是药丸（键盘顺序与既有测试都依赖这点） |
| ⑦ 会话菜单 | `header.js` | `bt-head` 尾部新增 `SessionMenu`（复用 `PanelMenu`） | 右上角与汉堡对称。只放四项：重命名、记忆、置顶、归档；**记忆只在能解析出 Bot 时出现，归档只在能解析出 Agent 会话时出现**，解析不出就不渲染，不留点了没反应的死项。弹层用 `PanelMenu` 现成的右对齐 popover，不自造 |
| ⑦ 样式 | `styles.js` | 追加 `.bt-head>.bt-pmenu{right:8px;top:4px}`、弹层 `pointer-events:auto`、命中区镜像 `inset:-6px -6px -6px 0` | `.bt-head` 是 `pointer-events:none` 且 `PanelMenu` 自身没声明，不补则弹层能画不能点；热区镜像后不会向左长进药丸 |
| ⑤ 样式 | `styles.js` | 追加 `.bt-menu-btn`（44×44、绝对定位、`pointer-events:auto`）+ `html:has([data-mobile-nav="frame"]) .bt-menu-btn{display:flex}` | 绝对定位不参与 `.bt-head` 的 flex 居中；`pointer-events:auto` 必须显式写（`.bt-head` 是 `none`，漏了就是死按钮）；可见性用 dsh-web-mobile 的标记而非宽度，rail 模式不会多出按钮，标记消失时安全失败（原生按钮回归，不会两个汉堡） |

「切换 Agent 模式」走 `setSurface`，**故意不接**。

## 2. 生成物（不进补丁）

| 文件 | 类别 | 重生成方式 |
|---|---|---|
| `ds-bot/src/client/gaze.js` | 生成物，37 KB（4 张 base64 PNG） | `node ext/avatar-gaze/gen.mjs --client`（**离线**，只读 `ext/avatar-gaze/out/*.png`，缺文件报错退出） |
| `ds-bot/client.js` | 构建产物 | `cd repo/ds-bot && npm run build` |

两者都不进 `.patch`：`client.js` 是打包结果，升级后必须重生成；`gaze.js` 由命令产出，不需要人合并。
`gaze.js` 头部写明来源（DiceBear gaze，CC0 1.0）与重生成命令。

## 3. 重打方式

每一行都靠这条命令重放；顺序不能反，`gaze.js` 必须先于 build 就位：

```sh
git -C repo apply ../design/ds-bot-patches.patch \
  && node ext/avatar-gaze/gen.mjs --client \
  && (cd repo/ds-bot && npm run build)
```

升级前先自检出冲突面：

```sh
tools/patch-conflict-check.sh <upstream-ref>   # 输出 clean / 冲突文件
```

## 4. 验证

```sh
cd repo/ds-bot && npm run build && npm test && node scripts/build-client.mjs --check && npm run lint
git -C repo apply --check    ../design/ds-bot-patches.patch   # HEAD 上可干净重放
git -C repo apply --check -R ../design/ds-bot-patches.patch   # 当前树可反向撤销
node tools/patch-ledger.mjs > design/ds-bot-patches.hunks.md  # 台账行号重新生成
```
