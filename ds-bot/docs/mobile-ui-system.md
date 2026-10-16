# ds-bot 移动端 UI 规范

这份文档给改 ds-bot 手机档的人看：一条规则 = 一个**判定标准** + 它在代码里的**依据**（文件:行号）+ 一个**反例**。
「判据」是执行者——规则写成测试（`test/` 下），不靠自觉。没有实现支撑的规则不写进来；还没实现的在最后标「未落」。

## 1. 标题栏图标键

**标准**：手机档的标题栏键一律这一个形状——**48×48 命中**（不是 40，也不靠伪元素凑）、**无底面**（`background:none` + `border:0`）、**按压圆角 12**、**图标 22**、**只用 `:active` 反馈**。压色分两级：主操作键 `--bt-ink`，导航/关闭键 `--bt-ink-2`。
**现役四处**：`peers-page.js:242`（伙伴页「新建」）、`styles.js:1581-1582`（设置页顶部那排）、`browser-pane.js:620`（「全部产物」抽屉 ×，`svg` 在 `:628`）、`discover-page.js:124`（壳面板第二级返回键，`svg` 在 `:129`）。
**例外**：只有行高容不下 48 时下探到 44，且必须在注释写明理由——现值：无例外。
**反例**：① 40×40 加 `::after{inset:-2px}` 凑 44（旧写法，命中靠伪元素是错的，那层填充还画出了一块本不该有的底板）；② `border-radius:999px` 的圆球按压形；③ 把键挂到 `.bt-round`（浮起件皮肤会带白底 + 浮影）。
**判据**：`test/touch-target.test.js` 第一条——逐处读规则，尺寸/无底面/圆角/图标/无 hover/是真 `<button>`。
**右侧键**：标题栏右侧只放**当前页的功能**，**永不做出口**——左侧返回已经是出口，右边再来一颗关闭/返回就是两个出口（用户提过两次）。**依据**：`settings.js:248-253`（只有群聊列表页带 `+ 新建群聊`，其余屏为 `null`）、`peers-page.js:105-109`（伙伴页右侧是「新建」，功能键）、`discover-page.js:75`（发现页只有标题）。**反例**：设置子页右上角再放一颗「关闭设置 ×」。这条暂无 lint（靠评审批次看）。

## 2. 触摸命中区

**标准**：手机档任何**同时声明 `width` 与 `height`（px）**的规则，两边都必须 **≥44**。过不去只有两条路：主语是 `<svg>`（那是目标里的画，不是目标），或在豁免表里写明理由。
**豁免表**：`test/touch-target.test.js` 的 `EXEMPT`——现值三条：抽屉把手（4px 药丸，命中的是它外面 44px 的把手带）、群聊门的头像（`aria-hidden`）、抽屉顶那两个浮球（锁在 40px 搜索框旁，已上报待拍）。豁免失效（不再命中任何规则）同样会红。
**看不到的**（写在这里，别当它是全称）：padding 撑出来的盒子、`min-height`、不带 `html[data-bt-mobile]` 的选择器（宽档是壳和桌面的）。
**反例**：给一个 36px 的图标按钮不加任何放大就交付。

## 3. 按压反馈

**标准**：手指按住才有反馈，用 `:active`，不用 hover；反馈是一层 `--bt-press` 起的 `background-image` 渐变（因此不会盖掉按钮自己的填色，也不动盒模型）；`prefers-reduced-motion` 只关位移/缩放，不关颜色。
**依据**：`styles.js:49`（`--bt-press:var(--bt-active)`，一个名字一处定义）、`:1348`（`-webkit-tap-highlight-color:transparent`，两个触摸档各一次）、`:1349`（统一规则，盖 `button` 与 `[role=*]` 行，排除底栏 tab）、`:1350-1352`（reduced-motion 重置）。
**反例**：给某个键单写一条 `:hover` 当按下态——Android 点一下会把它粘住。

## 4. hover 只给有指针的设备

**标准**：任何 `:hover` 必须包在 `@media (hover:hover)`（或 `pointer:fine`）里；与状态混写的选择器要**拆开**——`[aria-expanded]`、`[aria-pressed]`、`:focus-visible`、`:checked`、`:disabled` 这些触摸也要生效的状态留在媒体外，只把 `:hover` 那段搬进去。
**判据**：`test/mobile-hover.test.js`（跳过注释与媒体条件，现盘 0 处裸 hover）。
**反例**：`.bt-x:hover,.bt-x[aria-expanded=true]{…}` 整条搬进媒体——展开态在手机上就没了。

## 5. 谁在手机档：只看档位属性

**标准**：判档只用 `<html>` 上的属性——`data-bt-mobile`（手机皮肤）、`data-bt-size`（`compact`/`medium`/`expanded`）、`data-bt-portrait`（底栏）、`data-bt-pc`、`data-bt-keyboard`；**每条手机档规则都必须带 `html[data-bt-mobile]` 前缀**（尺寸档再叠 `data-bt-size`）。
**依据**：`mobile.js:22-28`（断点原文：`max-width:840px`，加 `1024px` 内的竖屏；600 / 841 两档）、`mobile.js:89`、`:97`、`:113`、`:127`（属性的发布与回收）。
**反例**：不带档位属性写一条只对手机生效的规则（会漏到桌面）；自己在 CSS 里再写一套 `@media (max-width:…)`。

## 6. 状态栏那一条（chrome-top）

**标准**：铺满屏的层（抽屉、面板、设置层）从 `--dsh-frame-chrome-top` 的**下缘**起算（`inset` 或 `padding-top`），并自己把 `0..那条` 铺成同一个词，不露壳的底色。
**依据**：`styles.js:709`、`:1492`、`:1544`；`:1500`（手机档 `left:0!important` 兜底）。
**不在口径内**：状态栏半透明/磨砂要动 App 原生（透明 status bar + edge-to-edge），属壳改动，需用户点头。

## 7. 颜色：只用 token

**标准**：颜色一律读 `body` 上的 `--bt-*`（`styles.js:49`），不写死色值；浮起件的表面只用共享声明，不另造一套。
**判据**：**未落**——「字面色」lint 还没写（裸 `:hover`、命中 <44 两条已落）。

## 8. 验证手法

**标准**：**核现状一律以源码为准**。活窗里看到的选择器、类名和源码可能不是同一串（壳会哈希自己的类名，WebView/壳侧还可能把选择器规范化），所以「这条规则现在是什么」要去 `src/client/*.js` 读，不要拿活窗里 grep 到的字符串反推源码。
**认版**：读 `<html data-bt-src>`（`client.js` 里是 `__DS_BOT_SRC__`），它就是源码指纹；指纹只覆盖 `src/client/**`（`scripts/build-client.mjs:26-41`），所以只改 `docs/` 或 `test/` **不会**让指纹变，页面不会因此需要重载。
**复现**：`npm run build` 后必须跑 `node scripts/build-client.mjs --check`（两者都要 `ESBUILD_BINARY_PATH`），`--check` 比的是整文件。
**量 DOM**：要摸壳自己的件时用前缀选择器——壳的类名是哈希过的（`[class*="_toBottomSlot"]`，`styles.js:2009`），按源码里的字面类名去 query 会找不到。

## 9. 变更流程

**标准**：先读后改、最小改动；改完 `npm run build` + `node scripts/build-client.mjs --check` + 全量测试（带 `ESBUILD_BINARY_PATH`）；一项一提交、报产物指纹；只推 `better-sidebar`、不推 `main`，push 前先问用户并扫密钥。
