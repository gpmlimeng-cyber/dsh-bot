# ds-bot 本地补丁台账

已登记的改动：① Gaze 形象一排（头像编辑器 + 新建 Bot）；② 去图片头像的 1px 内描边；③ 移动端两条纯 CSS；④ 从抽屉点开的入口自动收起抽屉；⑤ 窄屏会话头部的展开汉堡；⑥ 全站圆角走 `--dsw-corner-shape`；⑦ 会话头部右上「···」会话操作菜单；⑧–⑪ 移动端头部悬浮面、输入框、控件图标、底部抽屉；⑫ PC 端输入框回到宿主原生（布局 + 按钮 + 间距）；⑬ 移动端三个自绘控件的密度对齐 OpenMausBot；⑭ 全站统一的悬浮面（实底 + 0.5px 发丝环 + 浮动投影）；⑮ 输入框形态对标 OpenMausBot（圆角 26/24、内边距 6x12、正文 15px/24px）；⑯ 会话标题右侧的模型选择器（桌面，样式对标 OpenMausBot 的头部模型胶囊）。
**追加优先**：能写在文件末尾的绝不改上游已有行，把上游合并冲突面积压到最小。

- 基线：**上游 `4a7b550`**（①②③ 已进提交 `f03bc73`，所以补丁必须相对 `4a7b550` 生成，`git diff` 相对 HEAD 只剩 ④⑤）
- 补丁：`design/ds-bot-patches.patch`（默认 `-U3`，16 个手改文件）
- hunk 数：**47**（`grep -c '^@@' design/ds-bot-patches.patch`）
- **行号**：见 `design/ds-bot-patches.hunks.md`，由 `node tools/patch-ledger.mjs` 生成，勿手改。
  这里**不写行号**：手写行号已经错了三次，机械表是唯一来源。
- minus 行分布在 12 个文件：`styles.js` 32、`sidebar.js` 6、`icons.js` 6、`new-chat.js` 5、`bot-settings.js` 5、`team-actions.js` 4、`create-bot.js` 2、`composer.js` 2、`browser-pane.js` 2、`index.js` 1、`header.js` 1；`i18n.js`、`about.js`、`member-status.js` 2、`drawer-dismiss.js` **0** 个 minus
- 冲突自检：`tools/patch-conflict-check.sh <ref>`（升级前先跑，输出 `clean` 才合并）

## 1. 手改的文件（进补丁，共 16 个）

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

| ⑫ PC 输入框 | `styles.js` | `_add` 隐藏、三处按钮间距、`:focus-within` 底色都收进 `html:has([data-mobile-nav="frame"])`；桌面新增 `html:not(:has(...)) [data-composer-card]{flex-direction:row;flex-wrap:wrap;align-items:center;gap:0;padding:6px 8px}`，藏掉自绘 `.bt-plus/.bt-mic/.bt-voice`；输入框行高与占位文字 24→20、占位 `top` 2→0（游标与文字同一行盒）；发送键 `transform:none` 由移动端改为两端通用 | 宿主 2.0.19-next 的卡片是 `flex-direction:column`（输入一行、控件一行），上游那批拆行 + order 1/2/3 是为旧的一行结构写的，撞上去就在桌面摊成「加号右上、麦克风右下」。现在两端都是一行胶囊：桌面用宿主自己的「+」和发送键，手机用自绘控件；圆角与占位文字两端通用不动。行高原为 24px，游标按行高绘制就比 14px 文字高 4px；占位又比行盒低 2px，游标和文字本来就没对齐。宿主给发送键的 `translateY(-2px)` 也一并去掉，桌面实测三个居中量都相等。**代价：PC 上没有听写与语音对话**，宿主 PC 端本身不提供，这两个是自绘控件 |
| ⑬ 移动端控件密度 | `styles.js` | `.bt-plus` 与 `.bt-mic/.bt-voice` 28→**32px**，两者 `svg` 22→**18px**；移动端发送键 28→32px、图标 14→16px | 对标 OpenMausBot 的胶囊（`src/components/Composer.tsx`：`size-8`=32px 按钮 + 17–18px 图标，图标只占按钮直径 56%）。我们原来是 22px 图标塞 28px 按钮、占 79%，看着图标撑满没呼吸，也没有 44px 触控目标。桌面不动：宿主自己的「+」28px、发送 34px。触发方式不抄它（它按视口 767.98px，我们只能按 `data-mobile-nav="frame"`，因为卡片 DOM 不归我们） |
| ⑭ 统一悬浮面 | `styles.js`、`member-status.js` | 四个变量：`--bt-float-surface`（= `--bt-main`，实底）、`--bt-float-ring`（`color-mix(ink 10%)`）、`--bt-float-shadow`（`0 4px 12px -1px rgba(28,28,28,.08), 0 2px 4px -2px rgba(28,28,28,.06)`）、`--bt-float-hover`（`color-mix(main, ink 7%)`）；`.bt-head-btn`、`.bt-mw-pill`、`[data-composer-card]` 三处统一为：**实底 + `0 0 0 .5px` 外环 + 浮动投影**，hover 走 7% 混合。删掉移动端独有的 72% / 88% 底色与两套硬阴影 | 严格对齐 OpenMausBot 的 `ELEVATED_FLOAT`（`src/components/elevated.ts`）：`bg-composer ring-[0.5px] ring-ink/10` + `shadow-(--shadow-float)`，hover `color-mix(底色, ink 7%)`。它底色是**不透明** token、`--shadow-float` 默认 `0 0 #0000`（Daylight 皮肤才给上面那组淡影），所以这里也不加半透明、不加 blur —— 试过半透明 + `blur(14px)` 一版，用户口径是「不要更浮」，已回退。环用外环（`0 0 0 .5px`）而不是内阴影，对齐它 `ring-[0.5px]` 的画法。变量挂在 `body` 上而不是 `:root`，因为 `--bt-ink` 定义在 `body` |
| ⑮ 输入框形态 | `styles.js` | 手机胶囊圆角 22→**26px**、内边距 `2px 7.5px`→**`6px 12px`**；桌面胶囊圆角补成 **24px**（内边距本来就是 6x8）；输入框 `min-height/line-height` 20→**24px**、字号 14→**15px**、占位文字同步 15/24；输入区间距两端都收到 **加号图标右沿到光标 5px**（桌面 `margin-left:-22px`、手机 `-10px`，宿主 8px 内边距 + 行间距 12px 被抵消），与用户桌面上的 DS Bot 官方客户端一致 | 对标 OpenMausBot 的手机胶囊 `rounded-[26px] px-3 py-1.5`（26px、12x6）与桌面 `rounded-3xl px-2 py-1.5`（24px、8x6），正文 `text-[15px] leading-6`。我们的 14px/20px 行盒是上一轮为了让游标别高过文字压出来的，换成 15px/24px 后游标与文字同高、也更接近参考的呼吸感。手机实测胶囊 300x44、三个 32px 控件中点都在 809；桌面 992x46、圆角 24。**注**：桌面圆角是宿主 token（原本 28），这里为了形态一致主动覆盖，其余交互动效仍走宿主 |
| ⑯ 头部模型选择器 | `header.js`、`styles.js` | `header.js` 在标题胶囊之后挂一个 `ModelMenu`（`run: promise => Promise.resolve(promise)`），复用现有的模型 + 思考等级菜单（`model-menu.js`，含 `ModelRows` / `EffortRows` / 管理模型入口）；`styles.js` 加 `.bt-head>.bt-model-trigger`：30px 高胶囊、圆角 999、共享悬浮面（实底 + 0.5px 发丝环 + 浮影）、13px 名称 + 12px 折角，隐藏 `.bt-model-provider` 的第二行；位置 `right:max(16px,calc((100% - 992px)/2))`，右边缘与内容列/输入框胶囊对齐 | 对标 OpenMausBot 的 `ModelPicker` 头部胶囊（`src/components/ModelPicker.tsx`：`rounded-full py-1 pl-2 pr-2.5 text-[13px]`，`ELEVATED_FLOAT` + `ELEVATED_HOVER`，内容 = provider 标 + 模型名 + ChevronDown，点击开菜单）。它只在非手机显示（`!phone && <ModelPicker/>`），我们也一样：手机把右上角留给 ⑦ 的「···」。改模型走既有的 `actions.updateBot(bot.id, { model })`，没有新增写路径 |
| ⑰ 厂商图标 | `provider-marks.js`（新）、`model-menu.js`、`styles.js` | 新建 `provider-marks.js`：12 家厂商的 path（DeepSeek / OpenAI / Anthropic / Google / xAI / Moonshot / Qwen / 小米 / MiniMax / 字节 / Meta / Mistral），每家带自己的 `viewBox`（以实测墨迹包围盒为中心、边长为 `max(宽, 高×1.32)`，即**按墨迹高度归一**），所以不管原始网格是 24 还是 256、图形是宽扁还是方正，渲染出来都是同一个 16px 见方；`ProviderMark` 按 provider 名做别名匹配（`deepseek-official`、`xiaomi-token-plan-cn`、`moonshotai-cn` 都能落到厂商）。接进模型菜单每行与头部模型胶囊；`.bt-provider-mark{flex:none;align-self:center}`。胶囊位置改为 `right:24px` | 图标取自 Simple Icons（CC0 1.0），OpenAI 那条来自 OpenMausBot（Apache-2.0），两者都在 `NOTICE` 里登记了。等大靠「每条 path 的 getBBox → 当 viewBox」实现：原来统一 `viewBox="0 0 24 24"` 时，词标类（DeepSeek/Meta 高 16/24）显得小、OpenAI（256 网格）直接被裁一半。位置按用户口径「靠右但不贴边」：距窗口右沿 24px |
| ⑱ 圆钮表面 + 更粗的三点 | `styles.js`、`icons.js` | `.bt-round`（助手详情右上、面板里的圆形按钮）由 `border:1px solid var(--bt-line)` + 实底改成共享悬浮面（实底 + `0 0 0 .5px` 发丝环 + 浮动投影），hover 走 7% 混合；另新增 `MoreDotsIcon`（20px、点位 4/10/16、线宽 **2.9**）给详情页右上「更多」按钮 —— 那个按钮原来用的是通用 `DotsIcon`（15px、线宽 1.5，点直径仅 1.1px），所以看起来几乎没点；`BigDotsIcon`（会话头部那枚）保持原样 22px/3.2 不动 | 用户口径：「助手详情的这些按钮也使用统一表面质感」「三个点大气点、用粗点」。改 `.bt-round` 一处即覆盖详情页那一排圆形按钮，和其它悬浮面同一条配方；三点加粗后 22px 渲染下每点直径 3.5→4.8px |
| ⑲ 右侧栏开关 | `header.js`、`index.js`、`icons.js`、`styles.js`、`i18n.js` | 标题右侧、模型胶囊右边加一枚 32px 圆钮（`PanelRightIcon`：圆角 3.5 + 圆头分隔线，和 `SidebarIcon` 同一套线条语言），点击走新增的 `actions.toggleRightPanel()` → `ctx.get('sidebarRight')?.toggleExpanded()`；模型胶囊右移让位（`right:66px`），新按钮 `right:24px`；文案 `Toggle right panel` 补进 ZH 表。只在非移动端显示 | 用户要求「模型选择器右侧增加折叠展开按钮，点击打开 DSH 右侧边栏」。没新造 API：`sidebarRight` 服务插件已经在用（`canOpenTerminal`/`openFiles` 都走它），`toggleExpanded()` 就是宿主那个「⌘⌥B」命令的同一入口，比自己派发键盘事件稳 |

「切换 Agent 模式」走 `setSurface`，**故意不接**。

## 2. 生成物（不进补丁）

| 文件 | 类别 | 重生成方式 |
|---|---|---|
| `ds-bot/src/client/gaze.js` | **随仓库交付的资产**，37,448 B（4 张 base64 PNG），sha256 `d581144d2c977f38d231a59d2c05260e8ded4261e70442b99d8a340abbc676a8` | 生成器 `ext/avatar-gaze/gen.mjs` 与 4 张源图**已随换设备丢失**（`repo/ext/` 不存在）。有 `ext/` 时用 `node ext/avatar-gaze/gen.mjs --client` 重生成；没有就跳过这一步，直接使用仓库里的这个文件，校验 sha256 即可 |
| `ds-bot/client.js` | 构建产物 | `cd repo/ds-bot && npm run build` |

两者都不进 `.patch`：`client.js` 是打包结果，升级后必须重生成；`gaze.js` 是 ①Gaze 排的唯一来源，缺它就编译不过，所以按资产交付、用 sha256 固定。
`gaze.js` 头部写明来源（DiceBear gaze，CC0 1.0）与重生成命令。

## 3. 重打方式

每一行都靠这条命令重放；顺序不能反，`gaze.js` 必须先于 build 就位：

```sh
git -C repo apply design/ds-bot-patches.patch \
  && { [ -d ext ] && node ext/avatar-gaze/gen.mjs --client || echo "ext/ 已丢失，跳过 gaze.js 生成（用仓库内资产，sha256 d581144d…）"; } \
  && (cd repo/ds-bot && npm run build)
```

升级前先自检出冲突面：

```sh
tools/patch-conflict-check.sh <upstream-ref>   # 输出 clean / 冲突文件
```

## 4. 验证

```sh
cd repo/ds-bot && npm run build && npm test && node scripts/build-client.mjs --check && npm run lint
git -C repo apply --check -R design/ds-bot-patches.patch   # 当前树 = 基线 + 本补丁
bash tools/patch-conflict-check.sh 4a7b550                 # 对基线整包可干净重放（HEAD 已含①–⑤，对 HEAD 必冲突）
node tools/patch-ledger.mjs > design/ds-bot-patches.hunks.md  # 台账行号重新生成

`npm test` 直接跑会红 13 条：宿主自己的 `DS_BOT_APP` / `DSH_HOME` 等变量会漏进来。清掉再跑：

```sh
env -u DS_BOT_APP -u DS_BOT_USER_DSH_HOME -u DS_BOT_WORKSPACE -u DSH_HOME -u DSH_PROFILE \
    -u DSH_PROFILE_DIR -u DSH_SESSION_ID -u DSH_SHELL -u DSH_WEB_URL \
    node --import ./test/harness-resolve.mjs --test "test/*.test.js"
```
```
