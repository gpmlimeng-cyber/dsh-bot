# 升级策略与分支口径（决策记录）

- 状态：已拍板（用户授权 Chief 定稿），**本文只记决策，不改任何产品代码**
- 记录时间：2026-11-01
- 依据的仓库状态：`HEAD = a31cdd56`，工作树干净（`git status --porcelain` 为空）
- 适用对象：`repo/`（DS-Bot 非侵入二开工作区），只涉及 `design/`、`tools/` 流程，不涉及 `ds-bot/` 源码

## 0. 一句话结论

这个仓库在 **git 层面早就是 fork + merge**（496 个 merge 提交，`Merge upstream v0.2.4 into the fork` = `d958a544` 在 HEAD 祖先链上），补丁台账只是叠在上面的文档层。所以本轮要定的不是「要不要转分支」，而是**两套真源谁说话、以及什么时候承认补丁模式失效**。下面五条即为答案。

## 1. 升级动作正名为「merge upstream + 台账核对」

- **不再**用 `git apply design/ds-bot-patches.patch` 逐包重放来升级。
- 升级动作固定为：`git merge <upstream>` → 解冲突 → 用 `design/ds-bot-patches.md` + `design/ds-bot-patches.hunks.md` **核对**每一项改动是否还在、是否走了样 → `npm run build` → 打 tag（见第 4 条）。
- `design/ds-bot-patches.md` 仍是**唯一真源**，但角色从「合并手段」改为「核对清单 + 可重放证据」。`.patch` 与 `.hunks.md` 保留，用途收窄为：
  1. `tools/patch-conflict-check.sh <ref>` 升级前自检（输出 `clean` 才往下走）；
  2. 整包逆向回滚（第 4 条）；
  3. 回答「我们到底改了上游哪些行」的审计问题。
- 台账里的生成命令 `git diff v0.2.4 HEAD -- ds-bot …` 必须与 `tools/patch-ledger.mjs` 的口径保持一致；台账数字一律由脚本产出，禁止手写（手写行号已错过三次）。

## 2. 转正式分支的阈值（不口头约定）

出现下列任一情况，**停下来做一次「是否转分支」评审**，评审结论写回本文：

- **整组件重写**：某个上游文件的改动不再是「插入 / 追加 / 改少量行」，而是整体重写出一个新版本；
- **单次改动重写文件数 > 5**：一次任务里 `minus > 0` 的文件超过 5 个。

判定数据一律来自机械统计（见附录 A 的口径），不靠印象。

当前基线（2026-11-01 实测）：补丁共 **69 个文件 / 192 hunks / minus 452 行**，其中 `sidebar.js` 245 行、`styles.js` 71 行、`test/sidebar-switch.test.js` 33 行，前三名占 **77%**；其余 60 多个文件基本是追加式。**离阈值最近的是 `sidebar.js`**：它已经是 245 行重写，再加一轮侧栏/移动端交互就可能触发「整组件重写」。

## 3. `client.js` 当纯产物，不计入冲突面

- `ds-bot/client.js` 是 esbuild 生成物（当前 1,835,277 B），**不进补丁**（`grep -c 'b/ds-bot/client.js' design/ds-bot-patches.patch` = 0）。
- merge upstream 时固定处理：`git checkout --ours ds-bot/client.js && npm run build`，冲突不再在生成物上解。
- 不能从 git 删掉它：`link:` 与 npm 安装靠它开箱即用；且 `npm run build --check` 的整文件比对依赖它存在。

## 4. 上线打 tag、台账记 sha、回滚路径

- 每次上线打 tag：`v0.2.4-patch.N`（N 自增）。
- 台账头部记下该 tag 对应的 commit sha。
- 整包回滚：`git apply --reverse design/ds-bot-patches.patch` → `npm run build` → 刷新页面。该路径已验证可逆（见附录 A）。
- 局限（已记录、不隐瞒）：整包回滚救不了「运行时要退、外观要留」，那是第 5 条的事。

## 5. 待办：单项 kill switch（本轮识别的真缺口）

工具策略（`tool-policy` observe/auto）、SuperAgent 授权这类**运行时项**缺少**单项独立开关**；整包回滚粒度过粗。单独立项，不在本文件内解决。

在此之前的安全默认值：`tool-policy` 只保留 observe，auto 不上线（`auto` 的 ask 路径尚未 bench）。

## 6. 复核发现（本轮顺带查出，未修）

1. **基线 tag 本地不存在**：台账写「本仓标签 `v0.2.4`（`f823773`）」，但 `git tag -l | wc -l` = **0**，`git rev-parse v0.2.4` 失败。实测 `git diff f823773 HEAD -- ds-bot ':!ds-bot/client.js' ':!ds-bot/src/client/gaze.js'` 的输出与 `design/ds-bot-patches.patch` **逐字节一致**（18545 行、hunk 数相同），说明基线提交是 `f823773`，缺的只是那个 tag 对象。第 4 条打 tag 的机制建立前，先把 `v0.2.4` 补到 `f823773` 上，否则台账第一条生成命令按字面执行会失败。
2. **台账 minus 数字漂移**：台账正文写「minus 行共 443（sidebar 236）」，同一份 `.patch` 实测为 **452（sidebar 245）**，差 9 行。`.patch` 与 `f823773..HEAD` 的 diff 完全一致，所以漂的是台账正文的旧数字。属于台账数字未机械生成的老问题，本文只记录、不手改台账。

## 附录 A：机械统计口径（复现命令）

```bash
cd repo

# patch 与实际 diff 是否一致（应为 0 行输出）
git diff f823773 HEAD -- ds-bot ':!ds-bot/client.js' ':!ds-bot/src/client/gaze.js' \
  | diff - design/ds-bot-patches.patch

# 包规模（69 / 192）
grep -c '^+++ b/' design/ds-bot-patches.patch
grep -c '^@@'    design/ds-bot-patches.patch

# minus 行总数与分文件排名（排除 `--- a/…` 文件头）
awk '/^\+\+\+ /{f=$2} /^(-[^-]|-$)/{c[f]++; t++} END{print "total", t; for(k in c) print c[k], k}' \
  design/ds-bot-patches.patch | sort -rn | head

# 整包可逆（应 exit 0）
git apply --reverse --check design/ds-bot-patches.patch

# 基线 tag
git rev-parse --verify -q v0.2.4 || echo 'NO TAG'
```
