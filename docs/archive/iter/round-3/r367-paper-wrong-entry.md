# R367：卷卡外显本卷错题数 + 已练完卷「只练错题」入口

## 取证（生产一手证据，2026-09-04）

- `GET /api/exam/papers?uid=…`（生产 190 卷）卷卡契约：`n / psource / practiced / best_score / attempt_count`，
  **无任何正确性维度**——按卷练习答完后卷卡只有「已练完全部 38 题 ✓」，本卷错了多少题不可见。
- `GET /api/paper_questions?src=…&pid=133&uid=…` 逐题只有 `done`（是否作答过），无「上次是否答错」。
- 前端 `startPaper()` 全练完分支只有「重新练 / 不用了」二选一：用户想只补本卷错题，必须重开整卷
  或去错题本全量复习；R366 的「重练本卷错题」只在**刚答完的完成页**就地可用，离开完成页（回卷库、
  次日再来）入口即消失。
- 自家模考路径：成绩报告页（R282）随时可回看并「本卷错题重练」；按卷练习是双路径中的口径缺口（与 R366 同类，
  R366 补的是完成页就地入口，本轮补的是卷库持久入口）。
- 竞品：粉笔按卷练习卷卡显示「已做 X/N」并在做完后显示正确率/错题数，错题可就地重做（R360/R366 取证延续；
  本轮未重新实机截图，属沿用一手证据）。

## 目标体验

1. 卷库卷卡（有 psource 且 uid 有作答）：`已练 3/38 题 · 错 1 题` / `已练完全部 38 题 ✓ · 错 5 题`；
   错题数为 0 时文案不变（零噪音）。
2. 已练完的卷再点「按卷练习」：若本卷有错题 → 操作面板「只练错题（W 题）/ 重新练一遍」（取消=不进会话）；
   无错题 → 保持现有「重新练一遍？」弹窗。
3. 「只练错题」会话：题集 = 本卷内**最近一次作答答错**的题（卷面顺序），保留 `_source/_ptitle` 归卷，
   答对后下次卷卡错题数随之减少（口径闭环）。

## 口径

- 「错」= 该题本人**最近一次** answer_log 记录 `correct=0`（重练答对即不再算错；`correct` NULL 视为非错，fail-closed）。
- 与 R359 `practiced` 同源同事务：一次 `SELECT question_id, correct FROM answer_log WHERE uid=? ORDER BY created_at, id`
  同时得到 done 集与 wrong 集，零新增查询次数。

## 方案边界

- 后端（零新 endpoint/表/列）：
  - `db._answer_state(conn, uid) -> (done_qids, wrong_qids)` 纯读函数。
  - `list_exam_papers(uid)` 卷卡补 `wrong: int`（`_qids ∩ wrong`；无 uid → 0）。
  - `paper_questions(uid)` 逐题补 `wrong: bool`（无 uid 契约不变，无 done/wrong 字段）。
- 前端：
  - `paperPracticedState(practiced, n, wrong)` 第三参可选：`wrong` 为正整数且 ≤ practiced 时追加 ` · 错 W 题`，否则文案不变。
  - `paperWrongPlan(items)` fail-closed 纯函数：非数组→`[]`；取 `wrong === true` 的题，浅拷贝清除 `done/wrong`，保持卷面顺序。
  - `practice.vue startPaper()` untimed 全练完分支：`wrong.length>0` → `uni.showActionSheet` 双选项；否则沿用现有 modal。
    部分完成分支（只练剩余/从头练）与 timed 模考零变化。
- 不改动：R360 续练弹窗、R361 完成态样式、R366 完成页 CTA、模考路径。

## 验证

- pytest：`wrong` 最近一次口径（错→对不计、对→错计入）、跨卷不串、无 uid 为 0/无字段、禁用题不计。
- vitest：`paperPracticedState` 第三参追加/非法忽略/超出 practiced 忽略；`paperWrongPlan` 过滤/顺序/清字段/fail-closed。
- 本地门禁：ruff / pytest / pyright / lint / vitest / build:h5。
- 生产：testing agent——答错部分题回卷库→卷卡显「错 W 题」；全练完再点按卷练习→面板「只练错题（W 题）」→会话 1/W 且题集=错题、归卷保留；
  重练答对→卷卡错题数减少；无错题卷回落旧弹窗；模考/普通练习零变化；375/1440 无溢出。
