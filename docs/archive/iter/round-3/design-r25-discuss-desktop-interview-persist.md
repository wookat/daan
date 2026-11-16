# R25 设计方案：题目讨论页桌面化 + 面试 session 提前落库

日期：2026-08-30 ｜ 轮次：round-3 R25 ｜ 范围：`frontend-uni/src/pkgA/social/discuss.vue`、`backend/app/interview.py` + 本文档

## 1. 取证

- 讨论页 `/#/pkgA/social/discuss?qid=…`：生产 1440 实测 `.wrap` 约 704px 单列（题目摘要卡、排序 chips、评论列表、公约、底部固定输入栏纵向堆叠）。
- R24 走查实证（生产真实流量复现）：`/api/interview/answer/stream` 的 `_save_session` 在点评 SSE 流**全部结束后**才执行——用户在「考官正在撰写点评…」阶段关页/断网，若服务端生成中断则该次练习记录（已出评分）整条丢失。评分已展示≠已保存，属数据丢失缺陷。

## 2. 方案

### 2.1 interview.py（后端，小改动）
- `gen()` 中评分完成后**立即** `_save_session(..., review="")` 落占位记录，`meta` 事件即携带 `session_id`。
- 新增 `_update_review(sid, review)`：流结束后 `UPDATE interview_sessions SET review=? WHERE id=?` 回填完整点评。
- `done` 事件保持原样（含 session_id）。非流式 `/answer` 不变（一次性完成无中断窗口）。
- 兼容性：history/detail 查询不变；review 为空字符串时详情页正常渲染（点评区为空，评分完整保留）。

### 2.2 discuss.vue（H5 媒体查询 + 包裹层，零 JS 逻辑改动）
- ≥768px：`.wrap` 1044px 居中；`.inputbar` 内容居中限宽 1044；chip/up/op/send hover cursor。
- ≥1024px：`.dc-cols` 双栏——左 `.dc-side`（题目摘要卡+社区公约，380px sticky）；右 `.dc-main`（排序 chips+评论列表）。输入栏保持贴底（全宽度、内容限宽），移动端交互零变化。
- <1024px：单列零变化。

## 3. 不做

- 不改评论接口/点赞/删除逻辑；不改面试评分与点评 prompt；不做评论分页重构。

## 4. 验收

- 1440/1280：讨论页双栏 sticky、输入栏内容居中；无横向溢出。
- 375：讨论页单列、底部输入栏零变化。
- 面试流式：meta 事件含 session_id；模拟中断（收到 meta 后立即断开）后 history 仍可见该条记录（评分在、点评空）；正常完成后点评完整回填。
- 干净重载 console 0 error。
