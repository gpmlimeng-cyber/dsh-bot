# 团队档案：提示词与记忆

这台机器上 DS Bot 团队的可搬运部分：每个 Bot 的指令、群公告、以及团队/群/Bot 三类记忆的快照。
换一台设备时照这里的文件重建，就能接着干。

## 文件

| 文件 | 内容 |
|---|---|
| `bots.md` | 每个 Bot 的名字、角色标签、模型、以及完整的自定义指令原文 |
| `group.md` | 群聊成员、管理员、回复模式、群公告原文 |
| `memory/team-memory.md` | 团队共享记忆（所有 Bot 都读） |
| `memory/group-*.md` | 该群聊的群记忆与各主题 |
| `memory/<bot>-*.md` | 各 Bot 自己的记忆与各主题 |

## 在另一台设备上继续

1. 用 `create_bot` 按 `bots.md` 建同名的 Bot，角色标签和指令逐字照抄（指令里已经写死了分工和纪律）。
2. 建同名群聊，把 `group.md` 里的群公告原文贴进 `notice`，成员按原样加入。
3. 记忆按归属粘回去：`team-memory.md`、`group-*.md`、`<bot>-*.md` 分别写到团队、群、对应 Bot 的记忆里（主 Bot 用 `remember scope="team"`、`scope="<Bot名>"`）。
4. 项目本体是仓库里的 `ds-bot/` 与 `design/`，接线看 `design/ds-bot-patches.md`。

## 边界

- 只含提示词、公告、记忆，**不含**任何密钥、会话记录、`state.json`、`avatars/`。
- 记忆是**快照**，不会自动同步回写；以本机为准，这个目录是导出副本。
- 补丁台账在仓库 `design/` 下并随仓库推送：`ds-bot-patches.md`（说明与逐项批准记录）、`ds-bot-patches.hunks.md`（脚本生成的机械表，勿手改）、`ds-bot-patches.patch`（可重放的补丁）、`extension-points.md`（slot 注入点与已验证的结论）。
