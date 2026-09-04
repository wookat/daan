# R360：按卷练习「只练剩余」续练——收口 R359 已练进度的行动闭环

## 取证（verified）

- R359 后卷卡外显「已练 X/N 题」，但该进度**不可行动**：`practice.vue startPaper()`（966 行）
  无条件 `this.idx = 0` 全量从第 1 题开始，已练 3/75 再进入仍从头做，进度外显与实际动线断裂。
- `/api/paper_questions?src=` 返回全量活跃题（`ORDER BY id LIMIT 140`），无任何 uid 个性化；
  该端点**不在**边缘缓存 allowlist（edge-policy.js API_CACHE_ALLOWLIST），且边缘对带 uid 请求一律 bypass
  （`isEdgeCacheable` hasUid→false），加 uid 参数无缓存污染风险。
- 竞品（粉笔试卷列表）「已做 X/N」点击默认续做未做题。

## 方案（零新 endpoint/零新表）

1. 后端 `db.paper_questions(source, uid=None)`：uid 命中时一次
   `SELECT DISTINCT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL`
   得已练题集，逐题标 `done: bool`；无 uid 行为零变化（不带 done 字段）。
   `/api/paper_questions` 补可选 `uid`（截断 64，同 papers 口径）。
2. 前端 `startPaper(p, untimed)`：仅 untimed（按卷练习）分支带 `&uid=`；
   加载后统计 `doneN`，当 `0 < doneN < items.length` 弹 showModal
   「已练过 doneN 题——只练剩下的 X 题？」确认→items 过滤为未练集（顺序不变）、
   取消→全量从头（现状）。全练完（doneN==length）或零练过：不弹窗、全量开始（fail-closed）。
   模考（timed）路径不带 uid、零变化。

## 验证计划

- 后端契约测试：无 uid 无 done；uid 命中精确标记；重复作答去重；跨卷不串。
- 本地 ruff/pytest/pyright/lint/vitest/build 全绿。
- 生产 testing agent：真实按卷练 3 题→重进弹窗→只练剩余（首题为第一个未练题、题数=N-3）、
  取消分支全量、零练过不弹窗、模考路径回归、console/网络/0 explain、375/1440。
