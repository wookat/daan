# R503：首页首屏「未登录冷启动、无任何数据」态 375/1440 一手对标粉笔公开面 → 命中「新用户错题复习被标『今日已清零 ✓』计入 1/3」→ 最小修上线

日期：2026-09-08 · 分支 `devin/1788611745-r400-formula-dropped-snapshot`（PR #619）· 生产 `ccdbf58` → `34bd4d1`。

## 0. 结论

1. **(c) / 到期项 0 增量**（§1）：R500 容器至本轮发版 5xx/404/monitor/非探针 POST/401·403 全 0，WAL 同字节，probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、时政 qid 非空 0、`error_reason ≥09-11` 0、`push_subs` 0。**无新的外部真人作答/复习证据**。
2. **首页冷启动几何全过**（§2）：375 首屏（812 高）= 顶栏 + landing 卡 + hero + **完整今日任务卡** + 学习计划卡上沿；1440 首屏（900 高）到公告/时政卡；两视口 `docSW == clientWidth`（360/1425）无横向溢出、`pageerror 0`、核心 GET 全 200、非 GET 只有 1440 一条 `POST track`（被 harness abort）。
3. **命中（语义，非几何）**：匿名新 uid `due_mistakes=0` 且从未有过错题，任务卡却渲染「错题复习 ✓ 今日已清零」并计入「今日任务 **1/3**」——用户什么都没做就完成了 1/3。根因是模板只看 `planFetched && !dueReview`，服务端 `daily_plan` 没有「是否有过错题」字段。**这不是复习任务已完成，而是没有错题可复习。**
4. **最小修**（§3）：`daily_plan` 新增 `mistakes_total`（本 uid 全部错题数，含已掌握，`_uid_clause` 隔离）；首页新增 computed `reviewTaskDone`（有到期 → false；`mistakes_total==0` → false；老快照无字段 → 沿用旧口径），任务卡 ✓/done/计数三处改走它，新用户副标题改「答错的题自动进错题本」。改后生产 375/1440 探针读数：「今日任务 **0/3** · 错题复习 · 答错的题自动进错题本」，任务卡几何逐值同改前（567–780 / 488–713）。
5. **粉笔公开面对标**（§2.3）：粉笔首页是门户型（课程/题库/公告/职位表/考试日历/直播/APP 下载），点题即登录墙；本产品「免注册打开即练」是差异化而不是差距。首屏不加功能。

## 1. (c) 补量 + 到期项（`~/r503_post.sh` → 经 VPS ssh 只读执行）

| 项 | 值 |
|---|---|
| 容器（改前） | healthy · restarts 0 · started 09-07 16:01:18Z（R500 发版容器） |
| 容器期请求 | 5xx 0 · assets404 0 · monitor 0 · mpUA 0 · 非探针 POST 0 · 401/403 0 |
| WAL | 同字节 · Traceback 0 |
| probe=0 `answer_log` / growth | 53 / 2 uid；26 / 4 uid |
| `explain_cache qid` / 时政 qid 非空 / `error_reason ≥09-11` / `push_subs` | 0/82 · 0 · 0 · 0 |
| `explain_cache` 真实列 | `key, created_at, module, question_type, question_text, user_answer, explanation, hits, up, down, qid`（R502 末行假设 `id` 列的错误已改 `pragma table_info`） |

题库对外口径只读复核（`~/r503_claims.sh` → `~/r503_claims.out`）：活跃题 109,371 / 活跃真题 15,864 / 五模块齐 / `tag3` 非空 109,327 / `exam_papers` 222 → landing 文案「免费刷 10万+ 行测题」与数据实况一致。

## 2. 首页冷启动一手（`~/r503_home_cold.py <375|1440>` → `~/r503_home_cold_{375,1440}.out` + `.png`/`_full.png`）

harness：接现有 Chrome CDP，独立 context、`X-Kg-Probe: 1`、无登录态、匿名 uid 由前端自生；`/api/**` 只放 GET，非 GET 一律 abort（0 账号 0 库写入 0 LLM）。

### 2.1 几何（改前 = 改后，逐值相同）

| 视口 | 首屏高 | 文档高 | toprow | landing | hero | taskcard | guide 上沿 | 溢出 |
|---|---|---|---|---|---|---|---|---|
| 375 | 812 | 2415 | 56–100 | 109–408（299） | 418–557（139） | 567–780（213） | 790 | sw 360 = cw 360 |
| 1440 | 900 | 1872 | 56–100 | 110–324（214） | 334–478（144） | 488–713（225） | 723 | sw 1425 = cw 1425 |

### 2.2 首屏文案（匿名新 uid）

| 位置 | 改前（`ccdbf58`） | 改后（`34bd4d1`） |
|---|---|---|
| landing | 选择考试 · 免费刷 10万+ 行测题 · 免注册立即开练 · 浏览题库 | 同 |
| hero | 今日已练 0/20 题 · 今日全站同题 10 题 · 来做今天第 1 人 | 同 |
| 任务卡标题 | **今日任务 1/3** | **今日任务 0/3** |
| 错题复习行 | **✓ 错题复习（done）· 今日已清零** | 错题复习 · 答错的题自动进错题本 |
| 刷题目标 / 每日打卡 | 已练 0/20 题 · 去刷题 › / 再打卡 3 天解锁「3 天」徽章 · 日历 › | 同 |
| 三个 `.tk-go` | 43.3×16 / 43.3×16 / 31.8×16（375）；45.1×17 / 45.1×17 / 33.1×17（1440） | 同 |

改前 API：`GET /api/home_bundle?uid=<匿名>` → `plan = {yesterday:{n:0,…}, due_mistakes:0, weak:[], focus:""}`，**无** `mistakes_total`；改后 `GET /api/daily_plan?uid=umtrgv6k19couzmgq` → `due 0 / mistakes_total 0`；对照 `umst3`（有 32 条错题、30 到期）→ `due 30 / mistakes_total 32`，其任务卡仍走「今日到期 30 题」分支不受影响。

### 2.3 粉笔公开面（`curl https://www.fenbi.com/` → `~/r503_fenbi_home.html`，未登录只读）

首页结构：首页 / 课程 / 题库 / 国考 / 省考 / 招考公告 / 职位表 / 资料·讲堂 / 考试日历 / 在线刷题 / 热门直播 / 地区与考试类型入口 / APP 下载与网页版。题库入口点进即登录墙。本产品首屏与之相比：无课程/直播/职位表（不是本产品定位）；「免注册立即开练」+ 匿名即可作答是差异化。**不据此加功能**（没有一手用户证据）。

## 3. 改动（`34bd4d1`）

- `backend/app/db.py` `daily_plan()`：`SELECT COUNT(*) n FROM mistakes WHERE 1=1{uc}` → 返回 `"mistakes_total"`（同 `_uid_clause`，含已掌握）。
- `frontend-uni/src/pages/home/home.vue`：computed `reviewTaskDone`（`!planFetched || dueReview → false`；`mistakes_total == null → 旧口径 true`；否则 `> 0`）；任务卡 `.tk-ck`/`.tk-name` 的 `on`/`done`、`taskDoneN()` 第二项、副标题三态改走它。
- 源锁：`backend/tests/test_r503_plan_mistakes_total.py`（新 uid 0/0、含已掌握计数、uid 隔离、`home_bundle.plan` 透传）；`frontend-uni/tests/home-r503-review-task-fresh-user.test.js`（模板三处不再裸用 `planFetched && !dueReview`、computed 真值表、后端字段锁）。
- 门：pytest 516 / ruff / `backend/` pyright 0；vitest 778 / eslint / build:h5 绿。

## 4. 发版 + 三点对照（`~/r503_deploy.log`）

宿主 avail 5.1 G / load 0.47 / 兄弟构建 0；`--skip-build` 一次 rc=0；容器 `started 16:46:42Z rev=34bd4d1` healthy；回归 7/7 200；perf `/` 0.96 LCP 2290 / `/tiku/` 1.00 LCP 958（预算内）。生产改后 CDP 375/1440：§2.2 右列；`errs []`；非 GET 只有 1440 `POST track`（abort）。

## 5. 登记（不改）

- 首页 landing 卡「拍题 AI 讲解 · 错题本按遗忘曲线复习 · 迷你模考」三卖点在 375 是 3 行小字，粉笔无对应项可比；无用户证据不动。
- 「每日打卡 · 再打卡 3 天解锁」对 0 天新用户文案成立；未核 1–2 天态（需构造 `pstats.days`）。
- 匿名首屏发出的 `POST /api/track` 是 R380 白名单埋点，harness abort 不代表生产失败；真人流量下该行为在 R441 已核。
- 老 H5 壳（服务端已新、前端旧 bundle）不受影响：旧模板不读 `mistakes_total`；新 bundle 撞老服务端（不会发生，同容器发布）走 `t == null` 旧口径。
