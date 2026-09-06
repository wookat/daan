# R440 · SOP-10 四维审计：「复习流 / 今日计划 / 推送」簇

> 承接 R438（SRS 到期落 CST 00:00）/ R439（小程序到期口径服务端驱动、日界公式合一）。
> 竞品维度：粉笔错题本次级屏仍需账号登录，**本轮无一手竞品截图、零竞品陈述、不据二手加功能**，只审我方面一手量测。

## 0. 结论

| # | 命中 | 严重度 | 处置 |
|---|------|--------|------|
| A | 首页 `home.vue` 样式块 **35 处 20–23rpx**（375 下 10–11.5px）、提醒设置 `reminders.vue` **4 处 20–23rpx**，低于 R411/R420/R430 定的 24rpx 下限；覆盖今日任务卡副标 `.tk-sub`/`.tk-go`、到期卡副标 `.duebar-s`、今日计划 `.plan-days/.plan-edit/.task-sub/.plan-prog-t`、复习勾选框 `.tk-ck/.task-ck` 等本簇核心文案 | P2（可用性） | 全部抬到 24rpx + 源锁单测 |
| B | 首页两处行内文字链「补练往期 ›」`.hero-ds-arc` / 「往期 ›」`.sz-arc` 只有文字高度（~22rpx ≈ 11px）无热区 | P2 | `display:inline-block` + `margin:-12px 0 -12px` / `padding:12px` → 纵向热区 ≥40px、布局不变 + 源锁 |
| C | 口径不对齐：首页「今日到期 N 题」/到期卡/错题本队列/推送用 `due_review_count(uid)`（含今日新错），今日计划复习任务用 `created_before=cn_day_start()`（有意排除今日新错，R439 已锁）；同一屏上方说「今日到期 2 题」，下方计划说「还有 1 道到期」或「今日到期错题已清」 | P2（文案一致性） | 计划副标点出被排除的今日新错数（`_review_sub`），任务 target/done 语义不变 + 单测 2 |
| D | `test_answer_log_client_ts` 在 CST 00:00–02:00 跑必假失败（`now-7200` 跌进昨天的 checkin 桶）——stash 对照同样失败，非本轮引入 | 测试缺陷 | `t2 = max(now-7200, cn_day_start(now)+1)` |
| E | `db.daily_plan` 仍内联 `((now+tz)//86400)*86400-tz`（R439 合一漏一处） | 登记 | 数值同 `cn_day_start()`、无行为差，本轮不动，下轮顺手 |
| — | 推送：`build_push_payload` 用 `due_review_count(uid)`（含今日新错，与首页同口径，**与今日计划不同口径但语义正当**——08:00 推送时今日新错几乎为 0）；`_push_loop` 按 CST `PUSH_HOUR` + `seo_meta.push_last_day` 防重 | 不改 | 生产 `push_subs` **0 行**、无 push/VAPID 日志行 → 无真人推送样本可观测 |

## 1. 一手取证

### 1.1 源码（复习流 / 今日计划 / 推送）

- `backend/app/plan.py::today_plan`：`due = db.due_review_count(uid, created_before=db.cn_day_start())`；副标改前 `"还有 N 道到期" / "今日到期错题已清"`。
- `backend/app/db.py::daily_plan`：`due_mistakes` = 全部到期（含今日新错）→ 首页 `dueReview`（任务卡「今日到期 N 题」+ 到期卡「今日到期复习 N 题」）。
- `backend/app/study_api.py` `/api/review`：`total` 同全部到期；`/api/review/{mid}` 回 `next_review_days`。
- `backend/app/push_api.py`：`_send_daily` 逐订阅 `due_n = db.due_review_count(uid)`；无推送历史表。
- `frontend-uni/src/pages/book/book.vue` `isDue/nextReviewText`：客户端逐行标签（R438 已证明与服务端 00:00 口径一致）。
- 字号：`grep -cE 'font-size:\s*(1\d|2[0-3])rpx'` → home.vue 35、reminders.vue 4（分布：20rpx×1、21rpx×13、22rpx×17、23rpx×4 / 20×1、21×1、23×2）。

### 1.2 生产只读（`/data/data.db?mode=ro`，2026-09-06 CST 深夜快照）

```
profiles 8（probe 归属全 null/none）
push_subs 0 行
profile_uids 8 中 due_all != due_old 的 0 个（当下无「今日新错」样本）
mistakes_created_by_profile_uids_days 2
reminder_prefs 3 行
seo_meta.push_last_day = 2026-09-06（推送循环在跑、当日已发——发给 0 个订阅）
当前容器 + R437 归档 app-log：push / VAPID 关键词 0 行
```

→ 命中 A/B/C 均为**源码可证的结构事实**，无已发生真人受害样本；推送簇无真人订阅，不改。

## 2. 修法（最小、不加功能）

- `plan.py`：新增 `_review_sub(due, new_today)`；`new_today = max(0, due_review_count(uid) - due)`（多一条 COUNT，索引命中、与 `due` 同谓词）。任务 `target/done_n/done` 不变——今日新错仍不计入任务，只在副标点出「另 N 道今日新错可随时巩固」。
- `home.vue` / `reminders.vue`：样式块所有 <24rpx → 24rpx；`.hero-ds-arc/.sz-arc` 负外边距热区。
- 单测：`test_r439_plan_due_day_boundary.py` 原断言按新文案更新 + 新增 `test_r440_review_sub_reconciles_home_due_count`（今早清零后再新错 1 → `daily_plan.due_mistakes=1`、任务仍 done、副标带「另 1 道」）；vitest `home-r440-fontfloor.test.js` 源锁 3。
- `test_answer_log_client_ts.py`：D。

## 3. 本地验证

pytest **500 passed**（+1；改前 499 中 1 个是 D 的时段假失败）/ ruff / pyright 0；vitest **619**（+3）/ eslint / build:h5 绿。

## 4. 部署 / 生产复验

见 handoff R440 节与 PR #619 评论（rev、health、healthy、5xx/Traceback/locked、6b 预算、testing agent 375/1440 录屏）。
