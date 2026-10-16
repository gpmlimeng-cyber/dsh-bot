# ds-bot 移动端 UI 规范

这份文档给改 ds-bot 手机档的人看：一条规则 = 一个**判定标准** + 它在代码里的**依据**（文件:行号）+ 一个**反例**。
「判据」是执行者——规则写成测试（`test/` 下），不靠自觉。没有实现支撑的规则不写进来；还没实现的在最后标「未落」。

## 1. 标题栏图标键

**标准**：手机档的标题栏键一律这一个形状——**48×48 命中**（不是 40，也不靠伪元素凑）、**无底面**（`background:none` + `border:0`）、**按压圆角 12**、**图标 22**、**只用 `:active` 反馈**。压色分两级：主操作键 `--bt-ink`，导航/关闭键 `--bt-ink-2`。
**现役四处**：`peers-page.js:242`（伙伴页「新建」）、`styles.js:1615-1616`（设置页顶部那排）、`browser-pane.js:620`（「全部产物」抽屉 ×，`svg` 在 `:628`）、`discover-page.js:124`（壳面板第二级返回键，`svg` 在 `:129`）。
**例外**：只有行高容不下 48 时下探到 44，且必须在注释写明理由——现值：无例外。
**反例**：① 40×40 加 `::after{inset:-2px}` 凑 44（旧写法，命中靠伪元素是错的，那层填充还画出了一块本不该有的底板）；② `border-radius:999px` 的圆球按压形；③ 把键挂到 `.bt-round`（浮起件皮肤会带白底 + 浮影）。
**判据**：`test/touch-target.test.js` 第一条——逐处读规则，尺寸/无底面/圆角/图标/无 hover/是真 `<button>`。
**右侧键**：标题栏右侧只放**当前页的功能**，**永不做出口**——左侧返回已经是出口，右边再来一颗关闭/返回就是两个出口（用户提过两次）。**依据**：`settings.js:248-253`（只有群聊列表页带 `+ 新建群聊`，其余屏为 `null`）、`peers-page.js:105-109`（伙伴页右侧是「新建」，功能键）、`discover-page.js:75`（发现页只有标题）。**反例**：设置子页右上角再放一颗「关闭设置 ×」。**判据**：`test/ux-rules.test.js` 第一条——设置页顶栏那一段里必须出现「+ 新建群聊」、不得出现 `t('Close` 或右箭头。

## 2. 触摸命中区

**标准**：手机档任何**同时声明 `width` 与 `height`（px）**的规则，两边都必须 **≥44**。过不去只有两条路：主语是 `<svg>`（那是目标里的画，不是目标），或在豁免表里写明理由。
**豁免表**：`test/touch-target.test.js` 的 `EXEMPT`——现值两条：抽屉把手（4px 药丸，命中的是它外面 44px 的把手带）、群聊门的头像（`aria-hidden`）。抽屉顶那两颗浮球原本靠一条豁免活着，现在真做成 44×44（`styles.js:1477`），那条豁免已删。豁免失效（不再命中任何规则）同样会红。
**带不了档位属性的件**：记忆页头那两颗键在宽档是 32×32（`styles.js:1058`），手机档显式覆盖成 48（`styles.js:1064`）；这条由 `test/ux-rules.test.js` 第六条单独看住——命中 lint 只扫带 `html[data-bt-mobile]` 的规则，看不见它。
**不许用盒子外的画当命中**：`::after{inset:-Npx}`、或给一个真元素负 inset 撑大——这类"命中画在盒子外"的做法要么改成控制件自己的盒子，要么进 `test/ux-rules.test.js` 的 `REASONS` 表写明理由（现值两条：色轮那个真 `<input type=color>` 本身就是目标；壳的附件删除键不归我们改尺寸——后者是待办，不是认可）。
**看不到的**（写在这里，别当它是全称）：padding 撑出来的盒子、`min-height`、不带 `html[data-bt-mobile]` 的选择器（宽档是壳和桌面的）。
**反例**：给一个 36px 的图标按钮不加任何放大就交付。

## 3. 按压反馈

**标准**：手指按住才有反馈，用 `:active`，不用 hover；反馈是一层 `--bt-press` 起的 `background-image` 渐变（因此不会盖掉按钮自己的填色，也不动盒模型）；`prefers-reduced-motion` 只关位移/缩放，不关颜色。
**依据**：`styles.js:62`（`--bt-press:var(--bt-active)`，一个名字一处定义）、`:1367`（`-webkit-tap-highlight-color:transparent`，两个触摸档各一次）、`:1368`（统一规则，盖 `button` 与 `[role=*]` 行，排除底栏 tab）、`:1369-1371`（reduced-motion 重置）。
**按下之后不留圈**：Android 点一下会把 `:focus` 留在被点的元素上，于是 UA 那圈 outline 就成了"点完还亮着"的同一个毛病——手机档因此收掉它（`styles.js:1382`）：`[class^="bt-"]`/`[class*=" bt-"]` 前缀只覆盖本皮肤自己的件（壳的类名是哈希的，且壳整份 CSS 里 `bt-` 出现 0 次），键盘的 `:focus-visible` 圈一律保留。**判据**：`test/ux-rules.test.js` 第五条（选择器必须带手机档、且只能是我们自己的类）。
**反例**：给某个键单写一条 `:hover` 当按下态——Android 点一下会把它粘住。

## 4. hover 只给有指针的设备

**标准**：任何 `:hover` 必须包在 `@media (hover:hover)`（或 `pointer:fine`）里；与状态混写的选择器要**拆开**——`[aria-expanded]`、`[aria-pressed]`、`:focus-visible`、`:checked`、`:disabled` 这些触摸也要生效的状态留在媒体外，只把 `:hover` 那段搬进去。
**判据**：`test/mobile-hover.test.js`（跳过注释与媒体条件，现盘 0 处裸 hover）。
**反例**：`.bt-x:hover,.bt-x[aria-expanded=true]{…}` 整条搬进媒体——展开态在手机上就没了。

## 5. 谁在手机档：只看档位属性

**标准**：判档只用 `<html>` 上的属性——`data-bt-mobile`（手机皮肤）、`data-bt-size`（`compact`/`medium`/`expanded`）、`data-bt-portrait`（底栏）、`data-bt-pc`、`data-bt-keyboard`；**每条手机档规则都必须带 `html[data-bt-mobile]` 前缀**（尺寸档再叠 `data-bt-size`）。
**依据**：`mobile.js:22-28`（断点原文：`max-width:840px`，加 `1024px` 内的竖屏；600 / 841 两档）、`mobile.js:89`、`:97`、`:113`、`:127`（属性的发布与回收）。
**判据**：`test/ux-rules.test.js` 第二条——任何提到 `data-bt-size`/`data-bt-portrait`/`data-bt-keyboard` 的规则，选择器里必须同时出现 `html[data-bt-mobile]`。
**反例**：不带档位属性写一条只对手机生效的规则（会漏到桌面）；自己在 CSS 里再写一套 `@media (max-width:…)`。

## 6. 状态栏那一条（chrome-top）

**标准**：铺满屏的层（抽屉、面板、设置层）从 `--dsh-frame-chrome-top` 的**下缘**起算（`inset` 或 `padding-top`），并自己把 `0..那条` 铺成同一个词，不露壳的底色。
**依据**：`styles.js:722`、`:1526`、`:1578`；`:1534`（手机档 `left:0!important` 兜底）。
**判据**：`test/ux-rules.test.js` 第三条——手机档里 `position:fixed` 且 `top:0` 的层，必须带 `--dsh-frame-chrome-top` 或 `--bt-top-inset`。
**不在口径内**：状态栏半透明/磨砂要动 App 原生（透明 status bar + edge-to-edge），属壳改动，需用户点头。

## 7. 颜色：只用 token

**标准**：颜色一律读 `body` 上的 `--bt-*`（`styles.js:62`，token 块；深色档在同处 `:63`）。**一个颜色一个 token**；中性色（`#000`/`#fff`、r=g=b 的 rgb/rgba，用于阴影与遮罩）除外；值一模一样的色只能活在 token 块和两份调色板（`themes.js`/`inks.js`）里。浮起件的表面只用共享声明，不另造一套。
**判据**：`test/no-literal-colour.test.js`——扫全部 client 模块、跳注释，token 块与调色板放行；**两个不在 CSS 里的值在 ALLOW 表里各带一条理由**（`characters.js` 头像里那支 SVG、`settings.js` 强调色输入框的默认值）；豁免失效也红。
**`--bt-ink-3` 只许非文本**（实测对比度 **2.30:1**，连大字 3:1 都不到）：图标、分隔、装饰、禁用态的辅助线；凡承载**文字**（含 `::placeholder`）一律用 `--bt-ink-2`（**4.77:1**，过 AA 正文）。对比度实测：`--bt-ink` 17.96 · `--bt-ink-2` 4.77 · `--bt-ink-3` 2.30。
**反例**：新写一条 `color:#e02135`（该读 `var(--bt-danger)`）；把品牌蓝写成主题强调色——每套主题 accent 都不同（claude `#d97757`、sky `#1e86ff`），DeepSeek 标记会跟着变色，凡"不随主题走"的固定色要给它自己的 token（如 `--bt-brand`）。
**未落**：一个语义色若要在深色档取**另一个值**，得在 `styles.js:63` 的 `body[data-ds-dark-theme]` 里补一份覆盖——现在这 14 个 token 都只在 `body`（`:62`）定义，深档不覆盖，因此两套主题同值（与改前逐字一致）。

## 8. 验证手法

**标准**：**核现状一律以源码为准**。活窗里看到的选择器、类名和源码可能不是同一串（壳会哈希自己的类名，WebView/壳侧还可能把选择器规范化），所以「这条规则现在是什么」要去 `src/client/*.js` 读，不要拿活窗里 grep 到的字符串反推源码。
**认版**：读 `<html data-bt-src>`（`client.js` 里是 `__DS_BOT_SRC__`），它就是源码指纹；指纹只覆盖 `src/client/**`（`scripts/build-client.mjs:26-41`），所以只改 `docs/` 或 `test/` **不会**让指纹变，页面不会因此需要重载。
**复现**：`npm run build` 后必须跑 `node scripts/build-client.mjs --check`（两者都要 `ESBUILD_BINARY_PATH`），`--check` 比的是整文件。
**量 DOM**：要摸壳自己的件时用前缀选择器——壳的类名是哈希过的（`[class*="_toBottomSlot"]`，`styles.js:2036`），按源码里的字面类名去 query 会找不到。
**先让状态稳定，再取证**（同一条原则的两个实例，各踩过一次）：
- **网络**：采 `api/file?path=` 这类请求记录之前先 `performance.clearResourceTimings()`。这页的 resource 缓冲会满到浏览器上限（实测 250 条，`/api/bot` 与 `android/dir-pick/poll` 一直在写），旧条目被挤掉，**查不到 ≠ 没发生**。
- **视觉/像素**：浮层类读数（遮罩、入场、淡出、拖拽中的尺寸）一律**等动画结束（≥250ms）再采**，或连拍取后一帧。本皮肤 `.bt-scrim` 是 `animation:bt-fade .22s`（`styles.js:738`）、抽屉是 `bt-sheet-in .26s`（`browser-pane.js:623`），打开瞬间采到的就是"还没画上"的那一帧：某帧读全屏 `252`（未压暗）曾据此报了一个假 bug，稳定复测 `171 = 252×0.68` 才是真值。
- **报数标单位**：WebView 截图的坐标是**物理像素 = CSS × dpr**（本机 425 CSS → 1169 宽，dpr 2.75），CSS 与物理混着报会让人把 `34` 和 `93` 读成矛盾；状态栏那一条在本机是**页面自己铺的**（同样会被遮罩压暗），不是"系统层压不到"。
- **一帧不算证据**：凡结论是"没画 / 没生效 / 没发生"，必须在**同一状态的稳定帧**复测一次再上报。

## 9. 变更流程

**标准**：先读后改、最小改动；改完 `npm run build` + `node scripts/build-client.mjs --check` + 全量测试（带 `ESBUILD_BINARY_PATH`）；一项一提交、报产物指纹；只推 `better-sidebar`、不推 `main`，push 前先问用户并扫密钥。
