# R358：模考「放弃未交卷」服务端进度同步删除

## 取证（已验证事实）

- R357b 生产实测（testing agent）：卷库「未交卷」条点「放弃」确认后，本地 `examProgress` 被删、条消失；但服务端 `exam_progress` 行不删，刷新后 `syncResume()` GET `/api/exam/resume` 回填，已放弃的 attempt 217 再现。跨设备同理。
- 代码取证（一手）：三类未完成学习资产的「放弃」行为不一致——
  - 练习 `prDrop` / `clearServerProgress`：POST `/api/practice/progress {qids: []}` 清服务端 + `ppClearedAt` 30s 防回填（home.vue:882、practice.vue:1869）；
  - 复习 `rvDrop` / `discardResume`：POST `/api/review/cur {snap: null}` 清服务端 + `rvClearedAt`（home.vue:867）；
  - 模考 `erDrop`（home.vue:917）/ `dropResume`（pkgA/exam/list.vue:240）：**只 `removeStorageSync('examProgress')`，零服务端调用、零 clearedAt 守卫**。
- 后端取证：`/api/exam/progress` POST 只支持 upsert（校验 picks/marks/secs/excl 后 `save_exam_progress`）；删除只有交卷路径 `api_exam_submit` → `clear_exam_progress`（exam_api.py:470）。没有用户主动放弃的删除入口。
- `parseExamProgress`（exam-resume.js）返回对象不含 attemptId，前端放弃时拿不到要删的 attempt；但本机快照 `saved.attemptId` 一定存在（本机写入与 adoptServerExamProgress 均含）。

## 未验证/边界（如实）

- mini 模考（paperId=0）也写 exam_progress（exam.vue 同一 saveProgress 路径），drop 同样适用——生产未单测 mini 分支，由 pytest 覆盖语义。
- 多设备并发：A 放弃后 B 秒级窗口内仍可能 POST 进度重建行——与 practice/review 既有 last-write-wins 口径一致，刻意不做分布式互斥。

## 方案（对齐 practice/review 既有口径，零新 endpoint/零新表）

1. 后端 `/api/exam/progress` 复用为删除入口：body 带 `drop: true` 时，在 uid/attempt 归属校验（404 语义不变）之后、已交卷/超时校验**之前**直接 `clear_exam_progress(attempt_id)` 返回 `{ok:true}`——放弃必须在超时后也能成功（超时快照正是最常见的放弃对象），且对已交卷 attempt 幂等无害。
2. `parseExamProgress` 补 `attemptId`（`Number(saved.attemptId) || 0`），供放弃时定位服务端行。
3. `dropResume`（卷库）与 `erDrop`（首页）确认后：写 `erClearedAt = Date.now()` + POST `{uid, attempt_id, drop:true}`（fail-silent）+ 删本地 + 清卡。
4. 回填守卫：卷库 `loadResume` 与首页 `loadExamResume` 在无本机快照走远端前检查 `erClearedAt` 30s 内直接跳过（同 ppClearedAt/rvClearedAt 口径）。

失败语义：drop POST 失败时本地仍清（用户意图优先），30s 守卫过后服务端行若仍在会回填——与 practice/review 一致的最终一致性。

## 验证方案

- pytest：drop 后 resume 空；错 uid 404；drop 幂等；drop 不受超时限制。
- vitest：parseExamProgress attemptId 透传。
- 生产：放弃→硬刷不回填→全新 context 不回填；DB exam_progress 行确实删除；开始模考/续考回归。
