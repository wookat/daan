# R415：进模考页不作答 ≠ 一场未交卷模考——空场次不弹续考、不落进度、重开自动回收

## 起点

R414 复验顺带报出（P2）：进入 `exam?paper_id=116` 不作答直接 F5，会弹「继续上次模考？（已答 0/62 题）」，
并在 `exam_attempts` + `exam_progress` 留下空行；首页/卷库还会出「未交卷 · 已答 0/62 · 剩余 1:59:xx」续考卡，
持续到卷时长（真题卷 120 min）走完。

## 生产取证（只读，rev e203afa 容器内）

| 项 | 值 |
|---|---|
| exam_attempts 总 / 已交卷 / 未交卷 | 42 / 17 / 25 |
| 未交卷按时长 | <1d 3 · <7d 13 · ≥7d 9 |
| 未交卷且有进度行 | 7 |
| exam_progress 总 / picks=`{}` | **7 / 6** |
| 未交卷 uid 数 | 17（top `test-w1-vis-data` 4、其余匿名 uid 1–3） |
| 已交卷但 answers 空 | 1 |

即：服务端记下的「未交卷进度」7 行里 6 行一题未答——恰是「进过页面就走」的形态；
25 个未交卷 attempt 里 18 个连进度行都没有（早于 R298 进度同步，或本地 1.5 s 防抖内就退出）。
`start_exam_attempt` 原本只清本人 >24 h 的未交卷 attempt，且**不删对应 exam_progress 行**，
9 条 ≥7d 的行属于再未回来的 uid，自清不到。

## 根因

`exam.vue start()` 拿到 attempt 后立刻 `saveProgress()` → 1.5 s 后 `POST /api/exam/progress picks={}`，
无论用户是否作答；`onLoad` 续考判断与首页/卷库 `parseExamProgress` 都只看「有快照且未过期」，不看已答数。

## 修法（不改 `/api/exam/resume` 契约，不动 SRS/判分）

- 前端 `exam-resume.js`：`countAnswered()`、`shouldPushProgress(picks, marks, pushedBefore)`；
  `parseExamProgress` 已答 0 → `null`（首页 / 卷库不出续考卡）。
- `exam.vue`：续考弹窗多一条 `countAnswered(saved.items) > 0`，0 已答直接按新开考走；
  `pushProgress` 在「无作答、无标记、从未推送过」时不写服务端，推送过一次（或从快照恢复）后一律同步——
  这样「全部取消作答」也能覆盖掉服务端旧进度，不会残留陈旧 picks。
- 后端 `db.start_exam_attempt`：清理范围从「本人 >24 h 未交卷」扩为「本人 >24 h 未交卷 **或** 本人同卷且进度为空/无进度行」，
  并连同 `exam_progress` 行一起删（原实现会留孤儿进度行）。有作答的同卷场次、别卷的空场次、别人的场次不动。
- `latest_exam_progress` / `/api/exam/resume` 不改：既有 R298/R317/R318/R320 单测把「picks {} 也回读」定为契约，
  历史 6 条空进度行由前端 `parseExamProgress` 判空过滤，用户不再看到 0/N 卡。

## 未做 / 如实说明

- 不做历史空 attempt 的一次性清理脚本：25 条未交卷 attempt 无用户可见影响（首页/卷库卡由前端过滤），
  各 uid 下次开考自清；不为洁癖写库。
- 只标记（`_marked`）不作答的场次：服务端会落进度（shouldPushProgress 视标记为有内容），但首页/卷库仍按 0 已答不出卡、
  exam 页也不弹续考——标记本身价值低，保持简单，不为它单独加分支。
- 「进页面读题 N 分钟不作答后离开，再进入按新开考重新计时」是本轮的产品判断（读题不算开考），无竞品一手取证。

## 本地

pytest 435（+1 `test_start_reaps_empty_same_paper_attempts`）/ ruff / pyright 0；
vitest 582（+4 `exam-r415-empty-attempt.test.js`）/ eslint / build:h5 绿。

## 部署与复验

见 handoff 与 PR #619 评论。
