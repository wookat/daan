# R439 取证：小程序错题本到期口径 + 「今天 00:00」三处同公式合一 + 跨部署 app-log 首批复查

日期 2026-09-06（UTC 15:5x–16:0x）。改动：`backend/app/db.py`（`_day_start` 改为委托 `cn_day_start`）+ `backend/app/plan.py`（内联日界公式 → `db.cn_day_start()`）+ 单测 2（新）。
前端不动、bundle `index-junWyPAm.js` 不变。部署 `7282ff1`。无 DB 写入、无生产数据处置。

## 1. 起点一：小程序 `miniapp-native` 错题本「明天复习」标签是否与 R438 同口径

### 1a 只读源码（`miniapp-native/miniprogram/`）
- 全目录 grep `next_review|明天复习|天后复习|今日到期|next_review_days`：**小程序没有任何客户端到期判断、没有「明天复习 / N 天后复习」标签代码**。
- 出现「今日到期」的两处（`pages/home/home.wxml` 任务卡「今日到期 N 题」、到期复习卡「今日到期复习 N 题」）与练习页「今日还有 N 题到期待复习」（`practice.wxml`）的 N 全部来自 `GET /api/review?uid=`（`api/index.ts:113`）的 `total`，即服务端 `due_review_count()`（`next_review <= time.time()`）。
- 复习完成 toast「下次复习：N 天后」（`book.wxml:33`）的 N 来自 `POST /api/review/{mid}` 返回的 `next_review_days`。
- 结论：小程序到期口径**完全服务端驱动**，R438 把 `next_review` 落到中国日历日 00:00 后，小程序自然同口径，**无需改小程序、无需发版**。H5 `book.vue` 才有客户端 `isDue()`/`Math.ceil()` 标签（R438 已核，不改）。

### 1b 生产复核（只读 `/data/data.db`，2026-09-06 23:56 CST）
- 活跃 `next_review` 非空 29 行，**29/29 落在 CST 00:00**（R438 对齐后无新写入偏离）。
- R425 vivo 小程序设备 `mistake 1952` → `09-07 00:00:00`（09-07 任意时刻打开小程序首页都计入「今日到期」）。
- `GET /api/review?uid=<无数据探针>` → `{"items":[],"total":0}`；`GET /api/plan/today?uid=<无 profile>` → `{"profile":null,"tasks":[]}`，200 / 0.23 s。

## 2. 顺带命中：「今天 00:00」同一公式在后端写了三份

只读 grep `8 * 3600` 发现同一「中国日历日 0 点 Unix 秒」在三处各写一遍：
| 位置 | 用途 | 形态 |
|---|---|---|
| `db.cn_day_start(ts)`（R438 新增） | SRS 到期点 | `int(t+8h)//86400*86400-8h` |
| `db._day_start(offset_days)`（旧） | `reviews_today` / 今日作答 / 今日技能计数等 8 处 | `((now+tz)//86400+offset)*86400-tz`（float 地板） |
| `plan.today_plan` 内联局部变量 `cn_day_start` | 今日计划「今日新错题不计入」的 `created_before` | 同公式，且**变量名与 R438 新函数同名**（只是局部变量、不冲突，但读者易混） |

三者数值相同（单测 `test_day_start_offsets_share_cn_day_start` 断言 `_day_start()==cn_day_start()`、偏移 ±N 天一致、落 00:00）。R438 之前这三处已经都是「中国日历日」口径——**证明产品语义一贯是日历日，只有 `_advance_review` 那一行是滚动秒**，R438 修的方向与既有代码意图一致。

修（去重、无行为变化）：`_day_start = cn_day_start() + offset_days*86400`；`plan.py` 删内联公式改 `db.cn_day_start()`。

## 3. R438 修法对推送 / 今日计划的实际效果（源码可证，单测覆盖）

- `push_api.py`：每日推送 `KG_PUSH_HOUR=8`（08:00 CST）用 `due_review_count(uid)` 组「你有 N 道错题今日到期」。**改前**：昨天 08:00 之后复习过的题在今早 08:00 都还没到期 → 推送数字系统性偏少（昨晚 23:30 复习的题到今晚 23:30 才算）；**改后**：昨天任何时刻复习过的题到期点都是今日 00:00，08:00 推送的 N 与用户白天打开看到的「今日到期」一致。
- `plan.today_plan`：复习任务 `due = due_review_count(uid, created_before=今日 00:00)`，同样受益。
- 单测 `test_plan_counts_last_night_review_as_due_at_push_hour`：昨晚 23:30 答对 → 今日 08:00 `due_review_count==1`、计划「还有 1 道到期」；今日新记错题（立即到期）`due_review_count` 变 2 但计划仍「还有 1 道到期」（既有 `created_before` 边界不变）。
- 如实说明：生产 `push_subs` 是否有真人订阅、R438 前是否有推送数字偏少的真实样本**未查**（推送数字不落库，无法回溯）；这一条是源码推演 + 单测，不是流量证据。

## 4. 起点二：跨部署 app-log 首批复查（R437 归档）

`kaogong-reports/app-log/` 现 4 份：`3c451c9` ×2（R435→R437 窗口）、`83c7522`（R437→R438，680 行）、`fbcda82`（R438→R439，675 行；本轮部署自动归档 `lines=675 bytes=6759`）。
- `83c7522` / `fbcda82`：Traceback 0、5xx 0、locked 0、非 access 行 error/warn/exception 0。
- 累计覆盖仍是 4 个「部署间隔」（每段 10–20 min）而非完整 24 h——今天部署密集，「首个完整 24 h 跨部署样本」要等一个无部署日，继续登记。

## 5. 部署与复验

- `deploy_h5.sh --skip-build` rc=0，宿主快照 `mem_avail 262–399MB / disk 92–93% / load 1.66–3.25 / other_builds=1→0`（等待让行生效）；`KG_COMPOSE_EXIT rc=0`；`/api/health` `{"ok":true,"rev":"7282ff1"}`；容器 healthy、restarts=0；当前容器日志 Traceback/5xx/locked 0。
- 6b 全过：`/` performance 0.97 / LCP 1820 / a11y 1.0；`/tiku/` 1.00 / LCP 927（bundle 不变）。
- WAL：重建后 160 KB（正常写入；64 MiB 上限内，截断周期继续观测）。
- 本地：pytest **499**（+2）/ ruff 0 / pyright 0。

## 6. 到期复查
- `answer_log probe=0` 仍 22 行、最新 09-06 17:24 CST（R425 vivo 设备），之后无新 probe=0 行为。
- `mistakes.error_reason` 非空行与 `probe=0` uid 关联 **0**（≥09-11 再看）。

## 7. 未验证 / 登记
- 小程序真机跨日 UI 未观察（代码层已证明服务端驱动，风险只剩服务端，而服务端已有单测 + 生产 29/29 00:00）。
- 推送数字偏少的历史样本不可回溯；`push_subs` 真人订阅数未查。
- `.sheet-x`/自然旧壳 404 (c) 待下次前端发版；`.trend-kn` 需 4 周样本；WAL 截断继续观测；跨部署 app-log 完整 24 h 样本需无部署日。
- R440：SOP-10 四维审计。
