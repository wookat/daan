# R312：成绩报告解析浮层「题目纠错」入口

## 取证（生产 + 代码，2026-08-29）

- 刷题页（practice.vue）与错题本（book.vue）均有完整题目纠错链路：入口 →「题目纠错」sheet（7 类型 chips + 500 字补充）→ `POST /api/question_report`（限速 qreport 30/h、同 uid 同题幂等更新）→ 管理台 question_reports 审核工作台（R29）。
- 模考报告解析浮层经 R290（连看）/R291（收藏）/R292（q-social-bar）已成为复盘工作台，但纠错入口为零——复盘恰是用户最容易发现「答案/解析有误」的场景，发现问题只能记住题目再回刷题页碰运气遇到同题。
- 竞品：粉笔逐题解析页有「纠错」入口，模考解析与刷题解析同权。

## 方案（纯前端，零后端/零契约变化）

report.vue 解析浮层 dexp 解析块之后、q-social-bar 之前挂纠错入口行（对齐 practice.vue 文案「题目有问题？纠错」/「已提交纠错，感谢反馈」），点击打开与 practice/book 同构的纠错 sheet（同 7 类型、500 字上限），提交 `POST /api/question_report`（question_id 取 `detail.question_id`，无 question_id 的题不渲染入口，fail-closed）。

- 已提交态按 question_id 记 `reportedIds`（页面级瞬时态，不进 storage/URL），连看切题各题独立。
- sheet 复用浮层既有 mask/sheet 视觉与 Esc/焦点管理先例；提交中防重（reportBusy）。
- 不抽共享组件：practice/book 为既有内联实现，本轮不做范围外重构，report 侧同构内联（≈60 行）。

## 边界

- `detail.question_id` 缺失（历史脏数据）→ 不渲染入口。
- 未选类型 → 提交按钮 disabled。
- 服务端 4xx/5xx/429 → toast 失败，不置已提交态，可重试。
- 同 uid 同题重复提交 → 服务端幂等更新（既有语义），前端第二次提交仍 toast 成功。

## 验证矩阵

- 本地：lint / vitest / build 全绿。
- 生产 1440/375：浮层纠错入口就位 → 选类型+补充说明提交 → toast + 已提交态；服务端 question_reports 实际落库（type/detail/uid/question_id 正确）；连看切题后新题入口回到未提交态；R290 连看/R291 收藏/R292 social-bar 不回归；console 0 error、无横向溢出。
- 清理：删除测试 uid 的 question_reports 及模考数据，回读 leftover=0。
