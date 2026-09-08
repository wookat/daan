# R546：错题本重练返回 URL 同步（P2 既有）+ 复习单题 `secs` 上送 + 列表卡「连对 n/6」

日期 2026-09-08 · 前序 R545（`docs/iter/round-3/r545-type-groups.md`）· 分支 `devin/*-r546-book-url-resync-review-secs-streak`（从合入 #685 后 main `cf3f5e37` 开）

## 1. 一手证据

### 1.1 P2 既有：筛选 → 重练 → 页内返回，地址栏丢 `mod/kp/qt`

- 来源：R545 生产黑盒复验（rev `a707322a`）——组+细分筛选与旧 `mod=shuliang` 对照都复现，UI 保留筛选、刷新即丢。
- 机制（本地 `node_modules/@dcloudio/uni-h5` + `vue-router` 源码核，非生产实探）：
  1. `book.vue` `syncBookUrl()` 用 `history.replaceState(null, '', url)` 重写地址栏 → **顺带把 vue-router 写在 `history.state` 里的 `{ back, current, forward, position, __id__ }` 清成 null**；
  2. 进入重练页 `navigateTo` → router `push` 前先 `replaceState` 一次「当前条目」，此时它从自己缓存的 `currentLocation`（不含筛选 query）取地址，把我们改过的 URL 覆写回无筛选版；
  3. `navigateBack` → `history.go(-1)` 回到该条目 → 地址栏即无筛选版；`onShow` 里只 `load()`，`syncBookUrl` 只挂在筛选字段 watcher 上，字段没变故不触发。
- 结论：修复点两处——`onShow` 补一次 `syncBookUrl()`；`replaceState` 第一参传 `window.history.state` 保住 router 状态（`position/__id__` 丢了会影响 router 的 back/forward 判定）。

### 1.2 主循环三候选（生产只读 `~/r545/q546.py`，`file:/data/data.db?mode=ro`，非 `test-%` uid）

| 候选 | 数据 | 判定 |
|---|---|---|
| 错题本列表 streak 可视 | 未掌握错题 `review_streak` 0:264 / 1:15 / 2:6，正 streak 用户 5 | **有真实样本**（21 道）；此前 streak 只在复习判定文案里一闪而过，列表卡看不到「离掌握还差几次」→ 本轮实修 |
| 复习 `secs` 上送 | 近 30 天 `review_log` 35 行 `with_secs=0`（`via` 全 NULL：R544 前存量，R544 后无自然复习行） | **确认缺口**：H5/小程序复习 POST 无计时器，历次作答里复习行永远没有用时 → 本轮实修 |
| 每日一练 answer_log `mid` | 近 30 天 `answer_log` `source` 全 NULL 53 行（43 带 qid）；未掌握无 `question_id` 错题 28 | 练习页 `logAttempts` 已带 `mid: q.mistake_id`（R371/R542），**生产无 `source=daily` 样本可分辨每日一练**，无法证实/证伪 → 不立项，保留观察 |

## 2. 实修

### 2.1 H5 `book.vue` URL 同步
- `onShow()`：`load()` 后 `if (!this._pendingKp && !this._pendingKp3) this.syncBookUrl();`——深链首进 `kp/qt/kp3` 尚未由 `applyPendingKp` 落地，此时同步会把入参抹掉，故让位。
- `syncBookUrl()`：`replaceState(window.history.state, '', ...)`。
- 测试 `tests/r546-book-url-resync.test.js`（4）：onShow 守卫 / applyPendingKp 三出口仍同步 / 保留 history.state / 模拟「筛选→出→回」后地址含 `mod/kp/qt` 且 state 同引用。

### 2.2 复习单题 `secs`
- `review-snap.js` / `utils/review-snap.ts` 新 `reviewElapsedSecs(startMs, nowMs)`：round 秒，**下限 1、上限 3600**，无起点/时钟回拨 → `undefined`（JSON 序列化缺省，不上送）。
- H5：`resetQ()`（开始/下一题）与 `resumeReview()`（断点续做）记 `_qStart`；`record()` POST `/api/review/{mid}` 带 `secs: this.reviewSecs()`。
- 小程序：`_qStart` 同步；`postReviewRecord(mid, correct, picked?, secs?)`。
- 后端 `study_api.api_review_record`：`secs` 仅接受有限正数，`int()` 后 **86400 兜底**（原实现 `int(secs)` 直落，超大/inf 会 500 或写脏）。`picked/correct/uid/SRS` 不动。
- 测试：`test_attempts_timeline.test_review_secs_upper_clamp`（10^12 → 86400、5.7 → 5）；`tests/r546-review-secs.test.js`（6）。

### 2.3 列表卡「连对 n/6」
- `review-summary.js` / `utils/review-verdict.ts`：`MASTER_STREAK = 6`（= `REVIEW_INTERVALS_DAYS` 5 档 +1，第 6 次连对 mastered）、`streakProgressText(streak)` → `1..5` 出「连对 n/6」，0 / ≥6 / 非数 → ''。
- H5 卡片 `mhead`：「错 N 次」之后、「已掌握 / 下次复习」之前挂 `tone="ok"` 标签；`/api/mistakes` 走 `SELECT m.*` 已带 `review_streak`，无后端改动。复习完返回 `onShow → load()` 即刷新。
- 小程序：`MRow.streakText`（页面层算好）→ `book.wxml` `m-meta` 尾 `.m-meta-ok`（`--ok-strong`）；`Mistake.review_streak?`。
- 测试：`test_attempts_timeline.test_mistakes_list_carries_review_streak`（0 → 2 → 答错清零）；`tests/r546-streak-card.test.js`（3）。

### 2.4 源锁改口径（非行为变更）
`r544-ux-gaps.test.js` 复习 POST 形态 + `postReviewRecord` 签名；`book-r541-review-mastered-verdict.test.js` 两处 import 行。

## 3. 本地门
pytest 623（+2）/ ruff / pyright 0（`--pythonpath ~/venv-kg/bin/python`）；vitest 151 文件 1020（+13）/ eslint + tokens + edge 0 / build:h5；miniapp tsc 0 / eslint 0；`git diff --check` 空。

## 4. 生产（发版与复验回填见 handoff R546）
待 `deploy_h5.sh` + testing agent 黑盒：深链 `?mod=&kp=&qt=` 恢复 → 重练 → 返回地址栏仍含筛选 → 刷新仍在；复习 POST `secs` ∈ [1,3600]；列表卡连对标签随 streak 1→2→答错消失；375/1440；console/runtime/HTTP 分类计数；测试 uid 清零。

## 5. 如实
- 每日一练 `mid` 无生产样本可判，**未立项未改动**。
- 小程序改动（secs / 连对标签）未上真机（R536-1 累计）。
- `MASTER_STREAK=6` 是前端常量镜像服务端 `REVIEW_INTERVALS_DAYS` 长度，服务端改档位需同步两处（H5 / 小程序）。
