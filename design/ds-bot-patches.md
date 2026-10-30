# ds-bot 本地补丁台账

已登记的改动：① Gaze 形象一排（头像编辑器 + 新建 Bot）；② 去图片头像的 1px 内描边；③ 移动端两条纯 CSS；④ 从抽屉点开的入口自动收起抽屉；⑤ 窄屏会话头部的展开汉堡；⑥ 全站圆角走 `--dsw-corner-shape`；⑦ 会话头部右上「···」会话操作菜单；⑧–⑪ 移动端头部悬浮面、输入框、控件图标、底部抽屉；⑫ PC 端输入框回到宿主原生（布局 + 按钮 + 间距）；⑬ 移动端三个自绘控件的密度对齐 OpenMausBot；⑭ 全站统一的悬浮面（实底 + 0.5px 发丝环 + 浮动投影）；⑮ 输入框形态对标 OpenMausBot（圆角 26/24、内边距 6x12、正文 15px/24px）；⑯ 会话标题右侧的模型选择器（桌面，样式对标 OpenMausBot 的头部模型胶囊）；⑰ 模型厂商图标（12 家，按墨迹高度归一）；⑱ 桌面「更多」与三个点的粗细；⑲ 侧栏折叠钮与 32px 侧栏按钮；⑳ 折叠后的 56px 单列图标栏；㉑ 底部「连接应用」入口；㉒–㉔ 应用市场弹窗：插件发现页、磨砂玻璃面板、连接器/能力列表；㉕ 字体设置（系统默认 / Geist / Inter，随主题一起应用）；㉖ Codex 主题（浅色与深色两套调色板）；㉗ 字号与密度；㉘ 顶栏去掉品牌标、行贴到窗口最顶（固定定位）并修掉上提抖动；㉙ 侧栏行尾时间；㉚ 侧栏列表分组（置顶 / Bot / 群聊，可折叠）。
**追加优先**：能写在文件末尾的绝不改上游已有行，把上游合并冲突面积压到最小。

- 基线：**上游 `4a7b550`**（①②③ 已进提交 `f03bc73`，所以补丁必须相对 `4a7b550` 生成，`git diff` 相对 HEAD 只剩 ④⑤）
- 补丁：`design/ds-bot-patches.patch`（默认 `-U3`，23 个手改文件，含宿主侧 `src/host/channel.js`；`gaze.js` 与 `client.js` 不进补丁，见第 2 节）
- hunk 数：**76**（`grep -c '^@@' design/ds-bot-patches.patch`）
- **行号**：见 `design/ds-bot-patches.hunks.md`，由 `node tools/patch-ledger.mjs` 生成，勿手改。
  这里**不写行号**：手写行号已经错了三次，机械表是唯一来源。
- minus 行共 **86**，分布在 14 个文件：`styles.js` 41、`sidebar.js` 8、`icons.js` 6、`bot-settings.js` 5、`new-chat.js` 5、`index.js` 5、`team-actions.js` 4、`browser-pane.js` 2、`composer.js` 2、`create-bot.js` 2、`details-drawer.js` 2、`member-status.js` 2、`header.js` 1、`settings.js` 1；`about.js`、`drawer-dismiss.js`、`i18n.js`、`market.js`、`model-menu.js`、`provider-marks.js`、`fonts.js`、`themes.js` **0** 个 minus
- 冲突自检：`tools/patch-conflict-check.sh <ref>`（升级前先跑，输出 `clean` 才合并）

## 1. 手改的文件（进补丁，共 23 个）

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
| ⑳ 侧栏顶部按钮 32px | `styles.js` | `.bt-side-top .bt-round{width:32px;height:32px}` —— 搜索 / 新建 / 收起侧栏 三枚从 36px 收到 32px，与标题右侧那枚右侧栏按钮（32px）同尺寸 | 用户口径「侧栏这几个按钮小一点，参考 MausBot 顶部那两个；或者和刚才的折叠一样大小」。MausBot 侧栏顶部是 `size-8`（32px），我们原来 36；现在左栏三枚、右栏折叠钮全是 32 |
| ㉑ 桌面端标题行 | `styles.js` | 桌面端（`data-platform=darwin` / `data-windows-titlebar`）把 `.bt-side-top` 抬到红绿灯那条 38px 标题带（`height:38px`、`padding:0 8px 0 0`、`margin-top:-var(--dsh-frame-chrome-top)`），三枚按钮 32px 在其中居中（实测 y=9）；并恢复 ds-bot 自己的折叠钮 —— 原来 `html[data-platform=darwin] .bt-side-collapse{display:none}` 把它藏了，现在改成只在**非**桌面端隐藏，折叠钮用回原生 `SidebarIcon` + `actions.toggleSidebar()`，表面仍是 `.bt-round` 的全局悬浮风格 | 用户要求「桌面端这三个按钮都放在红绿灯行，参考 MausBot」「折叠按钮使用原 DS BOT 的折叠按钮」。桌面窗口的原生标题栏在浏览器里看不到（`osascript` 读窗口位置被辅助访问权限拒绝），所以按宿主提供的 `--dsh-frame-chrome-top` / 标题栏变量对齐，实际观感需在桌面端确认 |
| ㉒ 折叠成单列图标 | `styles.js`、`sidebar.js`（不改 JS） | 桌面端折叠后 `.bt-side.bt-rail` 变成 `position:fixed` 的 56px 单列（`left:0`、`top:calc(var(--dsh-frame-chrome-top) + 38px)`、`padding:8px 0`）—— 整块从红绿灯那条标题带下方开始；并且**去掉了 rail 的发丝环**（`box-shadow` 置空），不再有任何分割线，图标从红绿灯那条标题带下方开始（实测首项 y=42）；rail 顶部按钮之间 8px 间距（`.bt-rail{gap:8px}`）；账号在 rail 底部自己渲染（宿主折叠时会把 `sidebar.footer.action` 槽整个卸载，子节点为 0，所以改成 `AccountLauncher` 直接挂在 `.bt-rail-foot`，`margin-top:auto` 贴底）；rail 行改成 40px 圆角块居中（`width:40px;border-radius:12px;margin:0 auto`），hover 不再横跨整列；`.bt-rail,.bt-rail>*{box-sizing:border-box;max-width:100%;min-width:0}` + `overflow-x:hidden` 防横向滚动条；`.bt-side.bt-rail` 加 `bt-rail-in` 入场动画（180ms、从 -10px 滑入 + 淡入，`prefers-reduced-motion` 下关闭）——宿主把列宽瞬间归零、rail 要等下一次 React 渲染（实测约 200ms）才挂载，不加入场就是「先全隐藏再啪一下出现」；标题行三枚改成**纯图标**（`.bt-side-top .bt-round` 28px、无底色无描边、间隙 2px，hover 才出底色），并藏掉宿主自己的侧栏开关（`header button[aria-label*=sidebar/侧边栏]`，与本插件两枚按钮排除）；标题行的上提只在宿主真留了标题带时生效（运行时量一次 `getBoundingClientRect().top`，>6px 才上提 38px 且左缩进 78px 避开红绿灯，浏览器里本来就是 0 什么都不做）；rail 的第一枚是「展开侧边栏」（`SidebarIcon` + `toggleSidebar()`），下面才是新建与 Bot 头像；折叠按钮本身仍是 ds-bot 原生的 `SidebarIcon` + `actions.toggleSidebar()` | 用户要求「点击应该折叠成单列图标，按 DS BOT 原来的」。根因：宿主 `dsh-client-ui-sidebar` 在 macOS 桌面**折叠时整列隐藏、没有 rail 状态**（其 `HeaderLeadingControls` 注释写明），DS BOT 的 rail 被塞进 0 宽列里只剩几个固定定位的图标。现在 rail 自带 56px 列。**已知限制**：宿主不预留这一列，所以 rail 浮在聊天区左缘之上（消息左边缘被压住 56px）—— 要真正让位需要宿主提供 rail 宽度，插件做不到 |
| ㉓ 应用市场 | `market.js`（新）、`sidebar.js`、`styles.js`、`i18n.js` | 「连接应用」打开一个大弹窗：`createPortal` 到 body、`min(1040px,92vw) × min(800px,88vh)`、圆角 20、遮罩点击/ESC 关闭。左右布局：左侧 240px 导航（市场标题 + 关闭、四个分类：插件/连接器/能力/技能、下面「已安装」列表，点击已安装项显示该条目详情，详情里有「返回」）；右侧标题 + 副标题 + 搜索，正文是列表行，样式按 DSH 自己的设置页：整块圆角容器 + `inset 0 -.5px` 细线分隔，每行 12×14 内边距、30px 标记（图标 20px）、14px 半粗名称、13px 灰色一行说明、右侧 28px 高胶囊按钮；hover 出底色。数据：连接器取 `roster.connectors` 真实状态（未连接 → 连接 / 已连接 → 管理），能力是本插件四项，插件/技能取 `roster.plugins` / `roster.skills`；所有动作跳既有页面，原连接器页不动。**注意**：面板只在打开时挂载（`market ? h(MarketPanel…) : null`），常驻渲染会触发 React #310（hook 数量不一致）导致整个 `sidebar.workspaces` 槽崩掉 | 用户口径：先要主内容区左右布局，后改回大弹窗（「类似 DSBOT 设置那么大」），尺寸按他圈的范围取 1040。首版不含 Gmail/Notion 这类应用目录（要宿主暴露目录接口）。**探路结论**：宿主三个 Remote 在我们上下文里都拿得到 —— `remote.pluginManager`（`listPlugins/listBundles/installBundle/removeBundle/setPluginEnabled/inspect`）、`remote.pluginMarket`（`listIndexes/search/install/remove`）、`remote.pluginInventory`（`list`），返回值是 `{ok,value}` 包一层。已加 `actions.pluginsList` 把 `listPlugins()` 解开成 `{id,name,detail,enabled}` 列表，但 `listPlugins()` 返回的条目没有 name/title 字段（实测 200+ 条全空），**结论**：宿主插件页是全局主面板，id 就是 `plugins`（`ui-plugin-manager` 的 `PANEL_ID`），所以「插件」分类现在 `ctx.layout.selectPanel('plugins')` 让宿主把页面渲染出来，**再把宿主 `[data-slot="main"]` 这个容器整个搬进弹窗的右栏**（搬的是容器不是页面，React 只管自己的树、容器在文档哪都行），关闭时按原位置放回（`isConnected` 校验 + try/catch 兜底），弹窗打开期间自绘的搜索/副标题隐藏（原生页自带）。评估过三种：① 内嵌 DOM 搬移 = 视觉最佳、依赖宿主 `[data-slot=main]` 这个结构；② `selectPanel` 交接 = 零风险但离开弹窗；③ 移植源码 = 要长期维护副本。选 ①，②保留为兜底。**后按用户口径改为「只渲染插件列表、不内嵌原页面」**：内嵌已移除，「插件」分类改由 `remote.pluginManager.listPlugins()` 取数据（实测条目形如 `{entryId, moduleName, enabled, fiberPhase, meta:{title:{en,zh}, description:{en,zh}}}`，202 条），映射成 `{id,name,detail,enabled}` 后用我们的列表行渲染（32px 圆角标记板 + 14px 名称 + 13px 说明 + 右侧静默「已启用/已停用」状态，不再是蓝色按钮），左栏「已安装」只显示前 8 条避免与右栏重复；底部入口改为「打开插件管理页」→ `selectPanel('plugins')`（不再 DOM 搬移） —— 面板关闭、主内容区渲染宿主自己的插件页（已安装/发现/插件市场/内置插件配置全都在），这是宿主唯一支持的「渲染原生页」方式；条目字段不用再摸；三个包是 MIT、源码在 `deepseek-ai/deepseek-harness` 的 `packages/client/ui-*`，移植合规 |
| ㉔ 插件发现页 | `market.js`、`index.js`、`i18n.js`、`styles.js` | 「插件」分类改成宿主插件市场发现页的样子：`actions.pluginsMarket(query)` 走 `remote.pluginMarket.search(url, { sort, offset, limit, text?, category?, labels?, refresh? })`（签名是两个参数，`query` 必须带 `sort`/`offset`/`limit`，否则 `gateway/input-invalid`），把 `{title, metadata:{categories,labels,sortKeys}, entries, total, nextOffset}` 映射成条目；工具栏 = 市场下拉（多索引时，宽度按当前索引名自适应：可见的 span 自宽、原生 select 透明铺在上面只负责弹菜单）+ 搜索（防抖 300ms）+ 标签多选 + 排序（默认顺序 / ✨ 智能推荐 / GitHub 星标数 / 随机 / 最新发布；同样自适应宽度，且整块是一个点击目标，select 铺满整个 label）+ 刷新；分类页签只占一行，放不下的收进末尾的深色「更多 ⌄」下拉（用隐藏的等高副本量宽 + `ResizeObserver`，选中的页签即使被折叠也不另起一枚，而是让「更多」按钮直接显示该页签名、变深色并打上选中态；未选中的页签与标签用白色胶囊底，选中态用灰底）；卡片照宿主：50px 圆角图标板 + 14px 标题 + 11px 标签胶囊（顺序按下载量→更新时间→活跃度→认证，不是索引里的顺序）+ 13px ★说明 + 12px「版本 · 作者 · 日期」+ 右侧 28px「安装」；安装走 `remote.pluginManager.installBundle(spec, { registry })`，落地状态来自 `installation.status`。面板改磨砂玻璃：`background:color-mix(var(--bt-main) 80%,transparent)` + `backdrop-filter:blur(64px) saturate(2)`（透光不透内容：看不清背后的文字，只透一点点光），外部只留 `color-mix(var(--bt-ink) 10%,transparent)` 的普通遮罩（用户口径：非弹窗区不要磨砂、面板只轻微透） | 用户口径「照抄宿主发现页的卡片和分类页签」「页签一行、溢出进更多下拉」「面板要 MausBot 那种磨砂玻璃感，但别太透」「非弹窗区普通遮罩」。索引实测 854 条、两个市场源；分类顺序写死成宿主的 `tools, workflow, integrations, memory, skills, interface, development, providers, appearance, usage, knowledge`；图标缺省的条目用 `PlugIcon` 兜底（宿主用自己的标，我们不用它的资源）。**踩坑**：locale 判断要用 `i18n.js` 的 `language()`（`ctx.get('locale').current` 不是 `'zh'`，否则整页英文）；`i18n.js` 已有 `More`/`Show more`/`Loading…`，重复添加会让 esbuild 以「Duplicate key」直接失败 |
| ㉕ 字体设置 | `fonts.js`（新）、`themes.js`、`settings.js`、`index.js`、`styles.js`、`i18n.js`、`host/channel.js` | 「Bot 设置 → 通用 → 外观」在主题下面加一行「字体」：系统默认 / Geist / Inter。`fonts.js` 以 data URL 内嵌两个可变字体（Inter 4.1 latin 48,256 B sha256 `3100e775…`，Geist 1.5 latin 29,400 B sha256 `19f9c925…`，都来自 `@fontsource-variable/*`），`SHELL_CSS` 前置两段 `@font-face`；`--bt-font` 改成 `var(--bt-font-choice, var(--dsw-font-family, …))`，选择通过 `fontCss(font)` 与主题一起写进同一个 style 元素，所以全站所有 `--bt-font` 规则一行不用改；`setFontPref` 先写 localStorage 再重画（本机立即生效），同时 `setPrefs({font})` 交给宿主，`channel.js` 的 `setPrefs` 加了白名单（system 删键、geist/inter 写入），宿主重载后就是全队同步；`FONT_CHOICES` 在 `themes.js`，`fontOf(prefs)` 兜底 system。CJK 仍回落系统字体，与宿主一致 | 用户口径：我们的正文不如 MausBot 清晰好看，要在通用设置的外观里加字体选择，并梳理主流产品的字体放法。**梳理结论**：MausBot 的 UI（`Resources/ui/assets/index-*.css`）用 `--font-sans:"Geist Variable", -apple-system, …`，另备 Inter Variable，等宽用 Geist Mono Variable，`-webkit-font-smoothing:antialiased`；nightly-labs/openbot 的 `packages/brand/src/tokens.css` 里 `--openbot-font-sans:"Inter Variable", -apple-system, …`，等宽走 `ui-monospace/SF Mono`；宿主 DSH 自己是系统栈（`--dsw-font-family` → SF Pro / 苹方）。所以三家都是「一个可切换的 grotesk + 系统栈兜底 + 等宽另一套」，我们把可切换的两个（Geist、Inter）内置进来，默认仍是系统栈，不动宿主的 `--dsw-font-family`。字体是 OFL 1.1，已写进 NOTICE；不复制任何产品的字体文件，两个 woff2 直接取自 fontsource 的官方包 |
| ㉖ Codex 主题 | `themes.js` | `THEMES.codex`：浅色按 `surface #ffffff / ink #1a1c1f / accent #339cff / diffAdded #00a240 / diffRemoved #ba2623 / skill #924ff7`，深色按 `surface #181818 / ink #ffffff / accent #339cff / diffAdded #40c977 / diffRemoved #fa423e / skill #ad7bf9`；语义色走该主题的 `css` 字段（`html body` 与 `data-ds-dark-theme` 两段），其余八个 `--bt-*` 走既有 `themeVars`；用户消息气泡用强调色的浅染（浅色 `#e4eefb` + `#1a1c1f` 字，深色 `#22303f` + 白字），与灰调的机器人气泡分开 | 用户直接给的两段 `codex-theme-v1`（light/dark），要求「增加 codex 主题」「浅色和深色」。`contrast` 与 `opaqueWindows` 在我们的模型里没有对应项，没有引入；`fonts` 为 null，所以主题不绑字体，字体仍由「字体」那一行单独选 |
| ㉗ 字号与密度 | `themes.js`、`settings.js`、`index.js`、`styles.js`、`i18n.js`、`host/channel.js` | 外观里再加两行：**字号**（小 13 / 标准 14 / 大 15 / 特大 16）与**密度**（紧凑 / 标准 / 宽松）。字号骑宿主自己的内容令牌 `--dsh-content-font-size`（宿主把它写在 body 的**行内样式**里，所以我们也写行内，标准档删掉该属性还给宿主），次要字号与两个 delta 由 `html body[data-bt-size]` 推出来；密度只改一个 `data-bt-density` 属性，`.bt-row` / `.bt-tile` / `.bt-market-card` / `.bt-market-inst` / `.bt-market-cat` 的高度与内边距由基表按属性给（46/54/62px 三档）。两者都走 `actions.localPref(key, value)`：先落本机 localStorage + 重画，再 `setPrefs` 交给宿主 | 用户口径：「在外观里增加更多可自定义的内容，你来梳理，但不要太多，聚焦核心影响交互体验的，MausBot 可作参考」。对照 MausBot 的实际设置项（`settings.*` 文案：主题、界面字体、聊天宽度、侧栏密度、给自己消息上色、显示工具调用、发送键、通知等），**只加了这两条**：字号直接决定读得清不清，密度决定一屏能看多少。刻意不加：聊天宽度（已有文字宽度/气泡宽度）、发送键（属宿主语义，口径 B 不动）、工具调用显示与通知（归宿主）、给自己消息上色（Codex 主题已按主题给气色）。**踩坑**：宿主的 `html body{--dsh-content-font-size:14px}` 在样式表里更靠后，靠选择器优先级压不住，只能同时压行内样式；上一版只写 CSS 时该变量仍读 14px |
| ㉘ 顶栏 | `sidebar.js`、`styles.js` | 品牌块只留文字「DS Bot」，去掉鲸鱼标；`--bt-side-lift` 改为**只测一次**（测量前先把 lift 清零），上限抬到 64px，行贴到窗口最顶（`top:0`），三个圆钮在 38px 高的 caption 带里垂直居中，内缩 78px 避让红绿灯 | 用户口径：「这里还是没有上去，把 LOGO 去了我不需要，三个按钮放最顶部」。**根因**：原来的 `useLayoutEffect` 没有依赖，每帧都用「当前」行位置算 lift——行已经被提上去后测得 0，于是下一帧又放回带里，来回抖；改成首次测量并缓存后抖动消失 |
| ㉙ 侧栏行尾时间 | `sidebar.js`、`styles.js` | 每条 Bot / 群聊 / DSH Agent 行的第一行右侧加时间：复用已有的 `relativeShort(at)`（刚刚 / N 分钟 / N 小时 / N 天 / 月日），`at` 取列表排序已经在用的那份时间戳（主 Bot 取 `Sessions.updatedAt`，其余取 `order` 里的 `entry.at`），样式 11px、`--bt-ink-3`、等宽数字、`margin-left:auto` 贴右 ；主 Bot 的瓦片下不再显示角色标签（用户口径：「这里的标签不用显示，隐藏掉」），角色仍在 Bot 设置里可改 |
| ㉚ 侧栏分组 | `sidebar.js`、`styles.js`、`storage.js`、`i18n.js` | 列表按 MausBot 的分段画：**置顶**（`item.pinned`）/ **Bot**（Bot + DSH Agent）/ **群聊**，空段不画；每段一条 26px 的段头（折叠箭头 + 名称 + 条数），点击折叠，状态存 `localStorage['ds-bot:folded']`（本机、不占团队 pref）；段内仍用原来的行组件，顺序沿用既有的「置顶优先 + 时间倒序」 | 用户口径：「参考 MausBot，增加左侧栏列表的分组功能」。MausBot 的做法是固定段（`sidebar.section.pinned/bots/botChats/channels`）外加**用户自建部门**（`sidebar.section.newContext`）+ 拖动归组；这一版只做了固定段 + 折叠，自建分组与拖拽归组留到下一步（要新增持久化与拖拽，改动面更大）。折叠状态放 localStorage 而非 `prefs`，因为它是本机视觉偏好，不该同步给团队 |



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
