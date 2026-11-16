# R29 设计方案：管理台评论举报审核工作台

日期：2026-08-29 ｜ 轮次：round-3 R29 ｜ 前置：R28（PR #202 评论举报 + 阈值自动隐藏）

## 1. 取证与差距

生产实查（2026-08-29）：

- R28 上线后，去重举报 ≥3 的评论自动 `status='hidden'`，但**没有任何处理路径**：
  - 管理台（backend/app/admin/）11 个页面均无「评论」或「举报」相关 UI（rg 全目录零命中）。
  - `GET /api/admin/comment-reports` 聚合接口已上线但无消费方。
  - hidden 评论无恢复手段（误报只能直改 SQL）；R28 测试遗留的 cid=8 即处于此状态。
- 竞品（粉笔/夸克）讨论区举报后有运营审核处理（删除违规/恢复误报），我方审核闭环缺失属 P0 功能深度差距。

## 2. 方案

### 后端（backend/app/social.py，最小增量）

- 新增 `POST /api/admin/comments/{cid}/restore`（x-admin-token）：
  - 评论不存在 404；
  - `status → 'ok'`（hidden/deleted 均可恢复）；
  - **同时清空该评论的 comment_reports 记录**（阈值复位，否则下一次任意 1 人举报立即再次隐藏）；
  - 返回 `{"ok": true}`。
- 复用既有：`GET /api/admin/comment-reports`（聚合）、`GET /api/admin/comments?status=`（R28 已支持 hidden）、`DELETE /api/admin/comments/{cid}`（删除定性）。

### 管理台前端（backend/app/admin/）

- 新增 `pages/comments.js`，注册 `comments` 页（「用户」分组导航「评论与举报」）：
  - 顶部 KPI：待审核（hidden 数）/ 被举报评论数 / 累计举报次数。
  - 「举报队列」表：评论内容/作者/题目跳转/举报数/理由分布/状态/操作（恢复=误报、删除=违规）。
  - 「评论浏览」区：status 筛选（ok/hidden/deleted）分页列表，同样支持恢复/删除。
- `index.html`：用户分组加导航项 + script 标签。

## 3. 交互规格

- 恢复/删除均二次 confirm；成功 toast 并就地更新行状态。
- 表格布局沿用 admin.css 既有 .tbl/.card/.kpis 规范，无新增样式体系。

## 4. 不做

- 不做举报人通知/处理进度回执（R28 已定不做）。
- 不做评论编辑；不改 C 端。

## 5. 验收

- 本地：py_compile + ruff（新增部分零告警）。
- 生产：admin 登录 → 举报队列显示 R28 遗留 cid=8（3 举报/hidden）→ 恢复后 C 端列表重新可见且举报记录清零 → 删除路径验证 → C 端讨论功能无回归。
