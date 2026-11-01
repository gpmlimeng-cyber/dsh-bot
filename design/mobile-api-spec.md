# 手机端接口（mobile API）规格

> 本仓实现用，不再对外提 issue（2026-11-01 用户决定）。
> 起草：DS Bot 团队（Chief），基于本仓 `v0.2.4` + 本地补丁树实测
> 用途：dsh-Go 手机 App 的原生团队页

---

## 背景

dsh-Go 的原生团队页不是网页套壳：主 Bot 置顶、按活跃度排序、群聊分组、未读角标、Bot 详情都由原生界面渲染。数据来自 DS Bot 现有的两条通道：

- `POST /api/bot`（调用）
- `GET /api/bot/feed`（SSE 推送）

另有两条 DSH Remote 方法 `dsBot/call`、`dsBot/feed` 供 relay 使用。

目前 App 连上后判定为版本不兼容，团队页只显示「暂不支持手机端」。

## 现状（可复现）

```sh
# 1. Remote 方法没有实现
ls <ds-bot>/src/host/remote.js
# ls: cannot access ... No such file or directory

# 2. 通道没有 hello
grep -c "case 'hello'" <ds-bot>/src/host/channel.js
# 0

# 3. feed 首帧的 hello 已经存在，但只带 revision
grep -n "event: hello" <ds-bot>/src/host/feed.js
# 95:  send(own, encoder.encode(`event: hello\ndata: ${JSON.stringify({ revision: state.revision })}\n\n`))
```

所以不是「完全没有 hello」，而是：通道侧没有握手方法，SSE 侧有 `hello` 事件但缺 `api` / `boot` / `seq`。

## 需要什么

### 1. 通道握手 `hello`

入参：

```json
{ "client": { "name": "dsh-go", "version": "0.x.y", "platform": "android" }, "api": [1] }
```

返回至少包含：`api`、`apiMin`、`apiMax`、`plugin.version`、`capabilities`、`boot`、`seq`、`revision`；可选 `readOnly`、`memory`。

判定规则：客户端请求的 `api` 与 `[apiMin, apiMax]` 有交集才可对话，否则返回明确的不兼容错误（不要静默降级）。

### 2. `feed` 首帧

`event: hello` 的 data 补 `api`、`boot`、`seq`，保留 `revision`。之后的事件名一律不变，客户端遇到不认识的事件必须跳过。

### 3. Remote 方法

新增 `src/host/remote.js`，注册 `dsBot/call` 与 `dsBot/feed`，语义与 HTTP 通道完全一致。不可用时返回 `gateway/invocation-unavailable`，不要抛未捕获异常。

### 4. `state` 增量参数

- `since`：只返回该 revision 之后的变化（增量）
- `models`：模型指纹，客户端据此判断是否需要重拉模型列表
- `locale`：按语言返回文案
- `avatars: "ref"`：头像只回引用，不内联图片数据

### 5. 端点清单（29）

```
hello
state
avatar
chat
room-chat
room-continue
send
stop-member-work
create-bot
update-bot
delete-bot
duplicate-bot
set-main
create-room
update-room
delete-room
answer-question
dismiss-question
dismiss-view
view-reply
approval-answer
notices
folders
file-text
memory-view
memory-add
memory-edit
memory-forget
usage-summary
```

## 验收

1. 手机 App 打开「DS Bot」直接出团队列表。
2. 主 Bot 置顶、按活跃度排序、群聊分组、未读角标正确。
3. 进任意 Bot 能看历史、能发消息、能看到流式文本。
4. 群聊能 @ 成员，能看到交回的回合。
5. 版本对不上时有明确提示，不崩溃。
6. relay 下同样可用。

## 约束

- 不改现有端点语义，不新增必填字段。
- 未知字段 / 未知事件一律跳过。
- 网页版不受影响。
- 不引入密钥；`state` 不返回隐私原文。
- 新增端点要有三类单测：版本不匹配、缺字段、未知事件。
