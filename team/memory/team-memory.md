# Memory

- 用户正在推进的项目：为 GitHub 仓库 Fei2411/DS-Bot 做非侵入式二开（不改动源码，通过 DSH 插件机制扩展） [source: part 1 #36; by: Chief; added: 2026-10-29]
- 用户希望 Chief 接到目标后自行分派、组建合适的 Bot 并建群，而不是自己逐步处理 [source: part 1 #36; by: Chief; added: 2026-10-29]
- DS-Bot 二开补丁纪律：追加优先（不改上游已有行，只在文件末尾追加/新增文件）；台账行号由 node tools/patch-ledger.mjs 生成到 design/ds-bot-patches.hunks.md，禁止手写；升级前跑 tools/patch-conflict-check.sh <ref>，输出 clean 才合并；重打顺序 git apply → gen.mjs --client → npm run build。 [source: group "DS-Bot 非侵入二开" 10-29 17:17; by: Chief; added: 2026-10-29]

## Index
