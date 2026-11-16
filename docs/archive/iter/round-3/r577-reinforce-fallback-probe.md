# R577 · 研究/设计轮（不立项）：后端 `module+submodule` 强化回退生产一手验证 + ec8206e5 后自然样本回看 + 375 登录态「我的」/统计页走查

分支 `devin/1789031058-r576-weak-spot-submodule`（R576 分支，本轮只加文档）；**0 代码改动、0 发版、0 PR 之外的新 PR**。

## 结论（先讲）

1. **R576 UNTESTED 的「后端 `module+submodule` 回退在生产实际取题」已一手坐实**：用只有 2 道活跃题的 `tag3=ZL-JQ-04`（`ziliao / 比重`）发一次真实 `mode=reinforce&limit=5` 请求，生产返回 5 题 = 2 道 `ZL-JQ-04` + 3 道其它 `tag3`（`ZL-BZ-02 / ZL-BZ-01 / ZL-BZ-01`），5 题 `module=ziliao & submodule=比重` 全部一致 → 第二级回退**按题库 `submodule` 列过滤**在线上真实生效，R576 把「练同考点」改为传 `submodule` 列原值的前提成立。
2. ec8206e5 后**窗内**自然 `practice_progress`（daily/redo）/ `stale_fallback` / `question_favs` / `reinforce_log` 均 **0 新增**——只能说「本观测窗无合格自然样本」，不能推出功能未被使用或有缺陷。
3. 375 登录态「我的」/统计页（R576 走查实拍复看）**无 P0/P1**、无溢出/遮挡/误导空态；未找到值得立项的用户可感知缺陷。
4. **本轮不写代码、不发版、不建新 PR**——按「没有一手缺陷证据不下整改令」，把实修/本地门/PR/发版/复验记为**不适用（N/A）**而非完成。

## 研究（一手，生产只读；`~/r577/q577.sh` `q577b.sh` `clean_fb.sh`）

### 宿主 / health

- 两次读：`load 19.97 / 15.81 / 13.84` → `15.94 / 19.31 / 16.71`；`mem_avail ≈ 74–173MB`（total 1935MB）；`disk 42G/50G 89%`；health `200 0.217s` → `0.491s`。进程前列 `uvicorn 18.8% MEM / postgres / node / celery`（他家）。未 kill、未叠 build。
- 生产后端 rev 全程 `ec8206e5`；Pages bundle `index-Cf9A4ts2`（R576）。

### 自然样本（剔 `test-%`）

- `practice_progress` since ec8206e5：**0 行**（`daily`/`redo` 远端身份仍无自然样本）；`stale_fallback`：**0**；`question_favs` 新增：**0**。
- `events` 24h：`boot 39/39 · heatmap_view 1/1 · slow_load 1/1`（次数/uid）。
- `answer_log` 近 3 天：`09-07 20 行/2 uid`、`09-08 3/2`、`09-09 2/2`，其中 `source ∈ {daily, redo, paper, reinforce}` 分账全 0/NULL（旧行无 source）。
- `reinforce_log`：全表 **2 行 / 2 uid**（`umtg4… 08-31 PD-DY-01`、`u14 08-09 PD-LJ-06`），`test-%` 0；R576 发版后 0 新增 → 「练同考点」在窗内无自然触发，**不能**据此判断入口无人用。
- 题库 `tag3` 池（`disabled=0`，剔空/UNKNOWN）：156 个 tag3，`n<5` **6** 个、`5–9` **11** 个、`≥10` 139 个；无 tag3 活跃题 50（`yanyu 45 / shuliang 3 / changshi 1 / ziliao 1`）。
- 错题表 join 题库（剔 test）：259 条错题中 `tag3` 空 6、`question_type` 空 **115**——即真实用户错题里 44% 没有 `question_type`，R576「退到 `submodule`」的分支对真实用户确有覆盖面（推断：该比例是错题快照而非流量口径）。

### 回退分支验证设计与执行

- **教训先记**：第一版用 `group by tag3 ... having` 带子查询全表扫，生产跑 ≈200s 超时被 `timeout` 杀掉；改为先读 `sqlite_master` 拿到 `idx_q_reinforce(tag3, disabled, correct_ratio, id)` / `idx_q_pick(module, submodule, is_real, disabled, ...)`，`indexed by idx_q_reinforce` 只取 `n<10` 的 tag3（17 个），再逐 tag3 点查原字段——**1.3s** 完成。生产 SQLite 探测必须走已有索引、窄列、分组后再点查。
- 候选：17 个 `n<10` 的 tag3 里，同一 tag3 内 `submodule` 多数**不同值**（如 `ZL-JQ-05` 三题三个子模块、`ZL-JQ-03` 五题三个子模块），且 `question_type` 大量 `NULL`——这正是 R576 论证「`tag3` 组内子名 ≠ `submodule`、不能拿 `question_type` 子名当回退键」的又一实证。选 `ZL-JQ-04`：2 题（`245917 / 246821`）`module=ziliao submodule=比重 question_type=NULL`，同子模块池充足（`ziliao/比重` 远超 5 题）。
- 请求（新 uid `test-r577-fb-…`，`X-Kg-Probe: 1`）：
  `GET /api/questions?mode=reinforce&limit=5&uid=…&module=ziliao&submodule=比重&tag3=ZL-JQ-04` → **200 / 3.58s**（宿主慢窗）。
- 回包 5 题回查题库原字段：
  `246821 ziliao/比重 ZL-JQ-04 qt=NULL`、`245917 ziliao/比重 ZL-JQ-04 qt=NULL`、`237136 ziliao/比重 ZL-BZ-02 资料分析-比重`、`375363 ziliao/比重 ZL-BZ-01 资料分析-比重`、`285 ziliao/比重 ZL-BZ-01 资料分析-现期比重`。
  → 精确 tag3 只贡献 2 题，其余 3 题来自同 `module+submodule` 的其它 tag3；未出现 `submodule≠比重` 的题 → 第三级 `module` 回退**未触发**（池够），符合 `reinforce_questions` 顺序 `tag3 → module+submodule → module`。
- 副作用与清理：回包满 5 题 → 后端 `_reinforce_log_add` 写 1 行（`skill = 'ZL-JQ-04'`）；`clean_fb.sh` 枚举含 `uid/user_id/*_uid` 列的表，`before {reinforce_log: 1}` → 只删该 uid 该表 → `after {}`，`reinforce_log` 总数 `3 → 2`；独立只读复核 0 残留。

### 375 登录态「我的」/统计页走查（复看 R576 `~/r576/shots/375-profile-logged*.png` / `375-stats-logged*.png` + 文本快照）

- 我的：头像/手机号/「记录多端同步中」、三格 `累计做题 / 错题本 / 连续打卡`、连续打卡卡（历史最长 · 徽章 0/6）、学习 8 项入口、偏好 6 项、其他 3 项、退出登录、门户 footer、tabBar；toast「本机记录已合并到账号」。无溢出、无被遮挡控件、空态（收藏 0 题 / 学习计划未制定 / 提醒未开启）文案与现状一致。
- 统计：`累计刷题（含模考）11 题 · 27% · 连续 1 天 · 近 12 周 11 次`、能力预测分「再作答 19 题解锁（11/30）」、今日待办到期复习 CTA、热力图、五模块雷达（「0%」见下）、错题模块分布 / TOP10 题型（R567 简称口径正确：`中心理解 / 计算问题 / 类比推理 …`）、近 7 日正确率、练习记录、掌握度地图、学习计划、成就 1/8、学习日历。无 P0/P1。
- 观察项（**不立项，只登记**）：
  - **R577-1（P3，未核实）**：同一会话链路里「我的」`累计做题 4` 而当时每日一练本机进度「已做 3/10」、首页「今日已练 4/20」；完成后统计 `11 题` 而当次记录 `混合 3/10`（10 题）。三处都是服务端 `/api/growth total.n`（我的/统计/首页同源），差值恒 +1，**不是页面之间不一致**；+1 的来源（合并前账号已有 1 行？某次 `answer_log` 重发？复习计入？）本轮数据已按清理规则删除、**无法回溯核实**。下轮若再走查登录链路，在合并前后分别只读 `answer_log` 计数即可一手定性；不据此改代码。
  - **已核实非缺陷**：统计页雷达「数量 0% / 言语 0% → 最薄弱」与首页模块卡「数量关系 · 未开始」看似矛盾，实为**不同时刻 + 不同数据源**：首页截图在每日一练做到 3/10 时拍（本机 `pstats.byModule` 只有判断 1 / 言语 2），统计页在 10 题答完后拍（服务端 `/api/growth` 五模块都有作答，错题分布「数量关系 ×2」证明数量确有 2 错 → 0% 是真实值）。R544 的「未练」口径（`a.n ? pct : '未练'`，`weakAxes` 只取 `n>0`）未被违反。

## 论证：为什么本轮不立项

- 强化回退：生产已验证行为正确，与 R576 设计一致，没有用户可感知缺陷；`reinforce_log` 只在满额时写、不满额不写是既有设计（用于「今日已强化该考点」去重），不是 bug。
- 自然样本：窗内为 0，只能等待，不能拿「0」立项或改埋点。
- UI：两页无 P0/P1；R577-1 无法回溯，不满足「一手证据 → 设计论证 → 写代码」的门槛。
- 因此实修 / 本地门 / PR / 发版 / 生产复验 **N/A**；不把「未做」写成「已做」。

## 验证过 / 未验证

- 验证过（一手）：生产 `module+submodule` 回退取题（`ZL-JQ-04` 2+3）；返回题的 `module/submodule/tag3/question_type` 原字段；`reinforce_log` 满额写 1 行与精确清理 0 残留；索引可用性与窄查询耗时；宿主/health/自然样本计数；375 登录态两页无 P0/P1。
- 未验证：**完整自然 H5 链路**「完成页 → 薄弱考点 → 练同考点 → 强化练习」在 tag3 不足 5 题时的端到端表现（本轮只打了 API，未走页面）；子名 ≠ `submodule` 条目点「练同考点」的实际取题（R576 遗留）；`module|submodule` 分桶（仍仅单测）；第三级 `module` 回退（本例池够未触发）；R577-1 +1 来源；小程序真机（R536-1 累计）、真实 SW/offline、跨设备、其它浏览器。

## 下一轮候选（R578）

1. 登录链路走查时在 `merge_anon` 前后只读 `answer_log` 计数，一手定性 R577-1 的 +1。
2. 挑一个 `n<5` 的 tag3 走**完整 H5 链路**（每日一练/专项练习答错命中该 tag3 → 完成页 → 练同考点），把「API 已验证」升级为「用户路径已验证」；同时覆盖第三级 `module` 回退（选 `submodule` 池也不足的组，如 `ZL-ZZL-04 ziliao/其他`——需先只读核池大小）。
3. 自然样本继续回看（daily/redo/stale/favs/reinforce_log）；宿主压力只登记。
