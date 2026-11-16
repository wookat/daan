# R30 设计方案：讨论区「回复我的」消息收件箱

日期：2026-08-29 ｜ 轮次：round-3 R30 ｜ 前置：R25 讨论双栏、R28/R29 举报审核闭环

## 1. 取证与差距

生产实查（2026-08-29）：

- 讨论区已有发布/点赞/回复/删除/举报，但**回复零感知**：他人回复我的评论后，我方没有任何通知或入口能发现（rg 前端仅有打卡 reminder，后端无任何消息/通知模块）。
- 评论回复模型：两级扁平（`parent_id` 归一为顶层评论 id），回复的被通知对象即顶层评论作者。
- 竞品（粉笔/夸克等討論社区）讨论互动均有「消息中心 / 回复我的」入口与未读提醒（公开 App 界面通用交互；截图取证受登录墙限制，按通用形态对齐）。缺失导致讨论区互动无法形成回访闭环，属功能深度 P1。

## 2. 方案

### 后端（social.py，最小增量）

- 新表 `comment_inbox_reads(uid TEXT PRIMARY KEY, last_read_at REAL NOT NULL)`：记录每用户收件箱已读水位。
- `GET /api/comments/inbox`（require_user）：
  - 查「回复我的」：`question_comments r JOIN question_comments p ON r.parent_id=p.id WHERE p.uid=me AND r.uid!=me AND r.status='ok' AND p.status='ok'`，按 r.created_at DESC，LIMIT 50；
  - 返回每条：回复内容/昵称/时间/question_id/我的原评论摘要 + `unread`（r.created_at > last_read_at）；
  - 顶层返回 `{"items":[...], "unread": n}`。
- `POST /api/comments/inbox/read`（require_user）：UPSERT last_read_at=now，返回 `{"ok":true}`。
- 不引入推送/定时任务；纯拉模型。

### 前端（uni-app H5）

- `api.js`：`fetchCommentInbox()` / `readCommentInbox()`。
- 新页 `pkgA/social/inbox.vue`「讨论消息」：回复列表（昵称+时间+回复内容+「我的评论：…」摘要，未读蓝点），点击跳 `discuss?qid=`；进入页即调 read 清未读；空态文案。
- 入口：「我的」页（profile.vue）社区分组加「讨论消息」行，登录态显示未读数 badge（onShow 拉取，未登录不请求）。
- 响应式：≥768px 沿用全局壳限宽居中 + hover；375 单列。

## 3. 不做

- 不做「赞我的」聚合、站内信、推送通知（后续轮候选）。
- 不做楼中楼精确 @ 定向（两级扁平模型，v1 通知顶层作者）。

## 4. 验收

- 本地 py_compile/ruff（新增零告警）+ H5 build。
- 生产：A 发评论 → B 回复 → A「我的」页出现未读 badge → 收件箱显示 B 回复+我的原评论摘要 → 点击跳对应讨论页 → 返回后未读清零；未登录无入口异常；1440/375 双视口；既有讨论功能回归。
