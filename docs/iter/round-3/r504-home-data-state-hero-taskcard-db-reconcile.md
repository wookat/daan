# R504（2026-09-08）：首页「有数据态」hero / 任务卡 / 到期条 / 今日计划 与 DB 一手对账（375/1440）→ 数值口径全部一致，命中「考试日期已过仍倒计『距考试 -1 天』」→ 最小修上线（生产 `34bd4d1` → `65580c6`）

## 0. 边界（如实）

- 生产只读：`umst3tuisd7lgzaka` 是库里已有数据的 probe=0 uid（R502 判为疑内部设备），本轮只用它发 GET；CDP harness 对所有非 GET `/api/**` abort（实际只拦到一条 `POST track`），0 作答/复习/错题/账号/LLM 写入。发版后 harness uid 落库核 0 行。
- CDP 非真机；1440 改前未跑（改前只跑 375，1440 只跑改后）。
- `mistakes_total`（R503 新字段）非探针首次触达仍 **0**：Caddy 全历史 `/api/home_bundle` 非探针 35 次全在 R503 发版前，发版后只有探针 4–6 次。

## 1. (c) 补量 + 到期项（R503 容器 16:46:42Z → 发版；新容器 17:02:40Z →）

| 项 | 值 |
|---|---|
| R503 容器至发版 / 新容器 | 5xx 0 · assets404 0 · monitor 0 · mpUA 0 · 非探针非 bot 0 · 非探针 POST 0 · 401/403 0 |
| WAL | 4,124,152 B 同字节 |
| probe=0 `answer_log` / growth | 53/2 · 26/4（不变） |
| `explain_cache qid` / 时政 qid 非空 / `error_reason ≥09-11` | 0/82 · 0 · 0 |
| `*_ask_click` / nudge 真人 / `push_subs` | 0 · 0 · 0 |
| 宿主 | avail 4.6 G · load 0.03–0.37 · Traceback 0 |

无新的外部真人作答/复习证据。

## 2. 对账：DB 一手 ↔ `home_bundle` ↔ 页面文案（375 改前 `~/r504_home_data_375.out`）

DB（VPS 上 `mode=ro`，CN 今日 2026-09-08；`~/r504_post.sh`）：`umst3` 今日 `answer_log` 0 · 今日 `review_log` 0 · 累计 `answer_log` 45 · 学习日 `09-03/09-06/09-07` · `mistakes` total/open/due = 32/30/30 · profile `('国考', '2026-09-07', None)`。

`home_bundle?uid=umst3`（`~/r504_bundle_umst3tuisd7lgzaka.json`）：`summary.today_n 0 · streak 2 · total 45 · days_to_exam None`；`plan.due_mistakes 30 · mistakes_total 32 · weak [定义判断 4/25%, 增长率 3/33%]`；`plan_today.days_left -1 · phase_name 冲刺期 · progress 0/4 · tasks [错题复习 10 道/还有 30 道到期, 专项定义判断 13, 专项增长率 8, 本周模考 1]`；`badges.streak 2 · 3 天未解锁`。

| 页面区块 | 文案 | 数据源 | 一致 |
|---|---|---|---|
| hero | `今日已练 0/20 题` | `summary.today_n 0` ↔ DB 今日 0；20 = 默认 `daily_goal`（profile 为 null） | ✓ |
| hero | `连续打卡 2 天` | `summary.streak 2` ↔ DB 09-06、09-07 连续两日（今日未练不计） | ✓ |
| 任务卡 | `今日任务 0/3` | 三项均未完成（今日 0 题、到期 30 未清、今日未打卡） | ✓ |
| 任务卡 | `错题复习 · 今日到期 30 题` | `plan.due_mistakes 30` ↔ DB due 30（`mistakes_total 32` → 走有到期分支，不走 R503 新用户文案） | ✓ |
| 任务卡 | `连续 2 天 · 再打卡 1 天解锁「3 天」徽章` | `badges.streak 2` ↔ 3 天徽章 | ✓ |
| 到期条 | `今日到期复习 30 题` | 同上 | ✓ |
| 计划卡 | `0/4` + 4 条任务 | `plan_today.progress/tasks` | ✓ |
| 计划卡 | 弱项「定义判断 25% / 增长率 33%」 | `plan.weak` | ✓ |
| 顶栏 | `国考` | profile `exam_type` | ✓ |
| **计划卡头** | **`距考试 -1 天 · 冲刺期`** | `plan_today.days_left -1`（`exam_date 2026-09-07` 已过） | **语义命中** |

几何：375 `docSW == cw == 360`、1440 `1425`，`over.bad []`；核心 GET 8/8 200；`errs []`；tk-go 热区字号 11.52 px ≥ 24rpx 口径。

## 3. 命中与设计取舍

- `summary.days_to_exam` 对已过日期回 `None`（首屏 hero 不显示），而 `plan.today_plan()` 的 `_days_left()` 直接回负数、前端模板 `距考试 {{ days_left }} 天` 原样渲染 → 同一屏两个口径不一致，用户看到「-1 天 · 冲刺期」并不知道该做什么。
- 不改后端 `_days_left`/阶段划分（`phase` 仍按负数落 `chongci`，服务端语义「考试临近/已到」本身自洽，小程序端亦读该字段）；只在 H5 表现层收口：`frontend-uni/src/plan-days-label.js` `planDaysLabel(daysLeft, phaseName)`：
  - `>0` → `距考试 N 天 · 阶段`；`0` → `今天考试 · 阶段`；`<0` → `考试日期已过 · 点「编辑」更新`；非整数/null → `''`（模板不渲染）。
- `home.vue` 模板改 `<text v-if="planDaysText">{{ planDaysText }}</text>`，computed 走 helper。源锁 `tests/home-r504-plan-days-label.test.js` 6 用例（含模板不再直接拼 `days_left`）。

## 4. 门 + 发版 + 改后复验

- vitest 784（改前 778 + 6）/ eslint / build:h5 绿；pytest 516 / ruff / pyright 0。
- 宿主 avail 4.6 G / load 0.35 / 兄弟构建 0；`--skip-build` 一次 rc=0；容器 `17:02:40Z rev=65580c6` healthy 0 重启；7/7 200；perf `/` 0.98 LCP 1414 / `/tiku/` 1.00 LCP 941。
- 改后生产 375/1440（`~/r504_home_data_post_{375,1440}.out`）：计划卡头 **`考试日期已过 · 点「编辑」更新`**，其余读数（`0/20 · 2 天 · 0/3 · 到期 30 · 0/4 · 国考`）与改前逐值相同；几何 375 blocks top/bottom 逐值同改前（landing 109–408 / hero 490–630 / taskcard 640–853 / plancard 933–1308）；`posts_blocked ["POST track"]`、`errs []`。
- 发版后二次只读盘点（`~/r504_post2.out`）：新容器 39 请求全 0 异常，DB 各观察项不变，harness uid 落库 0。

## 5. 登记不改

- `phase` 对已过日期仍为 `chongci`（服务端）；小程序端如显示 `days_left` 需同法（W7 合 main 时顺带）。
- `today.n` 与 `summary.today_n` 两处同源不同路径（`plan_today.today` / `summary`）本轮读数一致，未造「跨日界」用例。
- `umst3` 第二段仍无；`mistakes_total` 非探针首次触达继续观察。

## 6. 文件

- 改动：`frontend-uni/src/plan-days-label.js`（新）、`frontend-uni/src/pages/home/home.vue`（`65580c6`）；源锁 `frontend-uni/tests/home-r504-plan-days-label.test.js`。
- 脚本/输出：`~/r504_pre.sh`、`~/r504_post.sh`→`~/r504_post.out`、`~/r504_post2.sh`→`~/r504_post2.out`、`~/r504_home_data.py`→`~/r504_home_data_{375,post_375,post_1440}.out` + `.png`、`~/r504_bundle_umst3tuisd7lgzaka.json`、`~/r504_deploy.log`。
