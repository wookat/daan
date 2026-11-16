# R31 设计方案：讨论消息收件箱补「赞我的」

日期：2026-08-29 ｜ 轮次：round-3 R31 ｜ 前置：R30 回复收件箱

## 1. 取证与差距

- R30 收件箱只有「回复我的」单流；竞品讨论社区消息中心均为「回复我的 + 赞我的」双流。
- 现状代码实查：`comment_likes(comment_id, uid, created_at)` 已有点赞时间戳，具备聚合条件；点赞后作者零感知。
- 属 R30 同域功能深度补齐，P1。

## 2. 方案

### 后端（social.py）

- `GET /api/comments/inbox` 扩展：在原回复流外，新增查「赞我的」：
  `comment_likes l JOIN question_comments c ON l.comment_id=c.id WHERE c.uid=me AND l.uid!=me AND c.status='ok'`，按 l.created_at DESC LIMIT 50；
- 返回结构：items 增加 `type` 字段（`reply`/`like`），like 项含点赞时间/question_id/我的评论摘要（点赞者身份不外显，竞品惯例聚合展示「收到 n 个赞」可后置，v1 逐条+匿名「有人赞了我的评论」）；
- 两流合并按时间排序，unread 用同一 last_read_at 水位（read 接口不变）。

### 前端

- `inbox.vue`：顶部 tab「回复 / 赞」或单列表混排？——取竞品简形：单列表混排，like 项样式区分（👍 icon +「赞了我的评论」+ 我的评论摘要，无回复正文）；点击同样跳 discuss?qid=。
- 「我的」页未读 badge 自动包含两类（接口 unread 已合并）。

## 3. 不做

- 点赞者昵称外显（comment_likes 无昵称冗余，且竞品多做匿名聚合）。
- 赞聚合去重（同评论多人点赞逐条展示，v2 可聚合为「n 人赞了」）。

## 4. 验收

- py_compile/ruff 新增零告警 + H5 build。
- 生产：B 赞 A 的评论 → A 未读 +1 → 收件箱出现赞条目（与回复条目混排、样式区分）→ 点击跳讨论页 → 已读清零；回复流回归；1440/375。
