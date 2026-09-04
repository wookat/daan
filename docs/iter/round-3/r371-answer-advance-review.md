# R371 任意场次答对曾错题 → 推进错题复习计划（服务端归一）

## 生产证据（2026-09-04，容器 /data/data.db 实查）
- mistakes 全量 222 条：mastered=1 为 **0**；review_count=0 为 202（91%）；review_streak 分布 0:205 / 1:11 / 2:6。
- review_log 全量仅 24 条正确复习、18 个 mistake；近 30 天 30 行 / 5 uid——「错题本→复习」入口几乎没人走。
- 但 21 条未掌握错题（3 uid）在错题建立之后已有 **答对** 的 answer_log（其中 9 条 review_count 仍为 0，6 条已答对 ≥2 次），错题本对这些题仍显示「今日待复习」+ 新错（lv-new）。
- 来源核对：这 21 条全来自普通刷题（answer_log.source 为空）；按卷「只练错题」/完成页 CTA 重练（R366–R370）刚上线且 R370 之前重练根本不落库，后续按卷答对的量会更大。
- 不对称根因（代码实证）：
  - 答错：practice.vue saveWrong → POST /api/mistakes → db.save_mistake 命中 question_id 去重 → `times+1, mastered=0, review_streak=0, next_review=now`（任何场次答错都会重置复习）。exam_api 交卷同样调 save_mistake。
  - 答对：只有错题本「重练」场次（redoSet，有 mistake_id）在完成页 syncRedoReviews 逐题 POST /api/review/{mid}；普通刷题、按卷练习、按卷只练错题、模考、PK、每日一练答对同一题 → 只写 answer_log，错题的 review_count/streak/next_review/mastered 一律不动。
- 竞品标尺：粉笔错题本「斩题」——任何场次做对即推进/移出；我们在 R367/R369 已经用 answer_log 最近一次作答口径判「是否还错」，但错题本 SRS 字段与之脱节。

## 方案（零新表/零新端点）
1. **服务端归一**：`db.save_answer_log(uid, items)` 落库后，对 `correct=1` 且能定位到本 uid 未掌握错题的条目，走与 `/api/review/{mid}` 完全相同的 SRS 推进（review_log 一行 + review_count+1 + streak+1 + next_review + 满 streak 达成掌握）。
   - 定位顺序：条目自带 `mid`（错题重练场次的 mistake_id，兼容 question_id 为空的文本匹配错题）→ 否则 `question_id` + uid。
   - 同批同一错题只推进一次；mastered=1 的不再推进；无 uid 的调用不动。
   - 覆盖面自动扩展到 exam_api（模考交卷）与 team.py（PK 作答）这两个也调 save_answer_log 的入口，与其答错走 save_mistake 对称。
2. `/api/answer_log` 返回 `{"saved": n, "reviewed": [{"mistake_id", "streak", "mastered"}]}`（原 `saved` 字段不变）。
3. 前端 practice.vue：
   - logAttempts 条目附带 `mid: q.mistake_id`（仅错题重练题有），记录请求 promise 与响应 `reviewed`；
   - syncRedoReviews 不再逐题 POST /api/review（避免双重推进），改为等待在途 answer_log 请求后，用累计的 `reviewed` 统计「达成掌握」；已纠正/仍错仍按本地作答计算；
   - 非重练场次（普通/按卷/只练错题/CTA 重练）完成页新增一行 `fixReport`：「本组答对 N 道曾错题，复习计划已推进（M 道达成掌握）· 回错题本 ›」。
   - quit()/新一轮开始清空累计，避免串场。
4. 掌握阈值（streak > 5）本轮不动——需要单独取证（粉笔 1 次即斩 vs SRS 5 级），先让数据流通再谈阈值。

## 实现边界
- 后端：db.py（抽 `_advance_review(conn, mid, correct, uid)` 供 record_review / save_answer_log 共用；save_answer_log 返回值保持 int，新增 `save_answer_log_detail` 供端点用）、study_api.py 端点返回 `reviewed`。
- 前端：practice.vue（logAttempts / syncRedoReviews / 完成页一行）。
- 不改 book.vue 读路径：它已按 review_count/next_review 渲染，数据对了展示自然对。
- 离线队列补传走同一端点 → 同样推进（补传时 mastered 统计不进完成页，非关键）。

## 验证
- backend：pytest 新增 test_answer_advance_review.py（答对推进/答错不推进/mid 定位/同批去重/已掌握不动/exam 交卷推进/返回结构），ruff。
- frontend：vitest 全量、eslint、build:h5。
- 生产：1440/375 —— 按卷只练错题答对 → 错题本该卡由「今日待复习」变「明天复习」、review_count=1；错题重练场次 review_log 只 +1（不双计）；普通刷题答对曾错题完成页出现 fixReport 行；清理测试 uid（mistakes/answer_log/review_log/growth_events）。
