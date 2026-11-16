# R506（2026-09-08）：学习计划表单第 2/3 步 + 「生成」后计划卡刷新链路 375/1440 只读审 → H5 几何/状态/链路全过；小程序端同形态源码核命中「首页仍渲染『距考试 -1 天』+ 表单放行已过日期」→ 最小修（小程序 3 文件 + 新 util，未发小程序）；H5 随本轮把 W5 表单迁移合入并发版（生产 `bf1807a6` → `591bbd59`）

> 原则：没有调查就没有发言权。本文只记一手读数；「事实 / 推断 / 未核」分开写。
> 所有对生产的访问只发 GET（CDP 探针头 `X-Kg-Probe: 1`，非 GET `/api/**` 全 abort 或本地 mock），生产库 `mode=ro`，**0 账号 / 0 profile 写入 / 0 作答 / 0 LLM**。

## 0 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | R505b 发版后 (c) / 到期项 | 全 0 增量；`mistakes_total` 非探针触达仍 0；无新的外部真人证据 | 生产 Caddy + DB 只读，事实 |
| 2 | H5 表单第 2/3 步 375/1440（生产 `bf1807a6`） | 选项/选中态/摘要/CTA/回退保留全过；**唯一读数缺陷**：375 第 3 步标签「每日可用时长」在旧行式布局里折成两行（`每日可用时\n长`，label 宽 63.7 px），1440 不折 | 生产 CDP 读数，事实 |
| 3 | 「生成」→ 计划卡刷新链路 | `POST /api/profile`（mock）→ 真实 `GET /api/plan/today?uid=…` 200 → sheet 关 → toast「学习计划已生成」→ 计划卡 `0/4` + 4 行任务 + focus 重绘，`homePlanCard=1`；375/1440 同 | 受控链路（POST mock），**不是生产生成验证** |
| 4 | 第 2 项在合并后分支（main W5 表单迁移）上 | 本地 dist + 生产 GET 转发：第 3 步标签单行、`kg-chip-row` 4 个时长 chip 单行、summary/CTA 44 px、链路同 #3 → 不另改 H5，随本轮发版把 W5 表单迁移送上生产 | 本地 CDP 读数，事实 |
| 5 | 小程序端（W7/main 已合入本分支的 `miniapp-native`）同形态 | **命中 2 处**：① 首页计划行/计划 sheet 标题直接拼 `days_left` → 已过日期渲染「距考试 -1 天」（R504 H5 同病）；② 表单第 1 步 picker 用 `new Date()` 本地日期作下限、已过日期无标示、「下一步」放行、CTA 会存回（R505 H5 同病）→ 最小修 | 源码一手，运行时**未核**（无微信开发者工具运行） |
| 6 | 小程序 `mistakes_total` / `_sz` / `mergeAnon` 空 catch | 源码核实缺口存在（详 §4.2），**本轮不改**：`mistakes_total` 需先改 `DailyPlanResp` 契约 + 首页任务卡三处口径，与本轮「计划表单」簇不同，且 W7 端无运行时复验手段；`_sz`/`mergeAnon` 是历轮已登记给 W7 合 main 的项 | 源码一手，登记 |
| 7 | **发版后 Lighthouse `/` 回归**（§3.2） | perf 0.98→**0.78–0.83**（5 采样）、LCP 1562→**4315–5133 ms**、a11y 1.00→**0.95**（`color-contrast`）；`/tiku/` 仍 1.00。LCP 元素换成 main W5 首页里的公告横幅 `kg-banner__t`（284×75，依赖 `GET /api/announcement` 回包后才绘）；a11y 是 main W5 把 `.searchbar-t` 从 `--ink-3` 改为 `--ink-4`（#b0b4c0/#fff = 2.07:1）。两处都来自已合入的 main（`f4ca1904` W5 整合），不是本分支 R506 改动，但由本轮发版送上生产 → **登记 R507 处理**（对比度 1 行可直接修；LCP 需按 R442 同机交替 A/B 定修法，不拍脑袋改布局） | 本机 Lighthouse 5 采样 + LHR 明细，事实；归因为 git diff，事实 |

## 1 (c) 补量 + 到期项（R505b 容器，`~/r506_post.sh` → `~/r506_post.out`，VPS 上只读）

- 容器 `deploy-kaogong-1` healthy、0 重启、`rev=bf1807a6`（17:25:27Z 起）；app log Traceback 0；WAL `4,124,152 B`（与 R466 起同字节）。
- Caddy 本容器窗口：5xx 0、静态 404 0、monitor 0、mpUA 0、非探针非 bot 0、非探针 POST 0、401/403 0。
- DB（`mode=ro`，先 `pragma table_info`）：probe=0 `answer_log` 53 行 / 2 uid、`growth_events` 26 / 4、`explain_cache` qid 非空 0/82、`mistakes.error_reason ≥09-11` 0、probe=0 `*_ask_click` 0、`push_subs` 0、harness uid 落库 0。
- `mistakes_total` 非探针触达：Caddy 非探针 `home_bundle`/`daily_plan` 自 R503 发版后仍 **0**。
- `user_profile`（13 列，`pragma table_info` 后取）：9 行，`exam_date` 空 0；按东八区 09-08 判 已过/今天/未来 = **1 / 0 / 8**（唯一已过 `umst3tui… · 2026-09-07 · 国考`，R502 判疑内部）；`target_score` 70×8 / 75×1；`base_level` 零基础×8 / 有基础×1；`daily_minutes` 60×9；`exam_type` 国考×9；`target_region` NULL×8 / 全国×1。
- **结论**：无新的外部真人作答/复习/计划生成证据；生产上 9 份计划全部走默认值（目标 70 / 零基础 / 60 分钟），第 2/3 步在生产上没有被任何非探针用户改过——本轮几何/链路审是「先于用户」的只读审。

## 2 H5 表单第 2/3 步 + 生成链路（`~/r506_setup_form.py <375|1440> <uid> [BASE]`）

harness：CDP 连生产 Chrome，`X-Kg-Probe: 1`，注入 `anonUid=umst3tuisd7lgzaka`（唯一已过日期 profile 的 uid，R504/R505 同一 uid），非 GET `/api/**` 全 abort，**只 mock `POST /api/profile`**（回 `{ok:true, profile:<请求体>}`，不发往生产），其余 GET 真打生产。

### 2.1 第 1 步：过 R505b 拦截需要一个「未过」日期

- 首次尝试用 CDP 拖动 picker 列：列 UI 变成 `2026/11/01` 但 Vue `pf.exam_date` 仍 `2026-09-07 · 已过，请重选`（`pickerTry.ok=false`）——uni `picker` 在 CDP 合成拖动下不触发 `change`，**该次读数作废**。
- 改为浏览器内存注入 `vm.pf.exam_date='2027-03-20'`（不发请求）：日期框 `2027-03-20`、class `pf-date`（无 `past`）→ 「下一步」放行到 2/3。R505b 拦截本身仍在（初态 `pf-date past`）。

### 2.2 第 2 步「制定学习计划 · 目标（2/3）」

| 读数 | 375（生产 `bf1807a6`） | 1440（生产） | 375 本地合并后 | 1440 本地合并后 |
|---|---|---|---|---|
| 目标分选项 | `60+ 65+ 70+ 75+ 80+`（初选 `70+`） | 同 | 同 | 同 |
| 基础选项 | `零基础 有基础 二战`（初选 `零基础`） | 同 | 同 | 同 |
| 点 `80+` / `二战` 后 `is-on` | `[["80+"],["二战"]]` | 同 | 同 | 同 |
| 换行/溢出 | 两行 chip 各单行；`docSW==cw` | 同 | 同 | 同 |

### 2.3 第 3 步「制定学习计划 · 每日时长（3/3）」

| 读数 | 375 生产 | 1440 生产 | 375 本地合并后 | 1440 本地合并后 |
|---|---|---|---|---|
| 副标题 | `决定每日任务量` | 同 | 同 | 同 |
| 时长选项 | `30/60/90/120 分钟`（初选 60） | 同 | 同 | 同 |
| **标签「每日可用时长」** | **折两行**（label 63.7 px 宽，`每日可用时\n长`）；4 个 chip 折两行 | 单行；chip 单行 | **单行**（W5 `set-kwrap` 纵向布局） | 单行 |
| 点 `90 分钟` 后 | `[["90 分钟"]]` | 同 | 同 | 同 |
| 摘要 | `国考 · 2027-03-20 · 目标 80+ · 二战 · 每天 90 分钟` | 同 | 同 | 同 |
| CTA | `生成我的学习计划` 325.5×36 | 484×36 | 328×**44** | 448×44 |
| `上一步` → 2/3 → 1/3 | 选中态保留 `80+/二战`、日期 `2027-03-20` | 同 | 同 | 同 |
| 再前进到 3/3 | `90 分钟` 保留、摘要不变 | 同 | 同 | 同 |
| `pageerror` | `[]` | `[]` | `[]` | `[]` |

- 事实：生产 `bf1807a6` 375 第 3 步标签折行是旧「标签 + 副标题横排」布局在 375 下的既有形态（R505 只审第 1 步没读到）。main 的 W5 表单迁移（已合入本分支 `a3f59f07`）把标签/副标题改纵排 `set-kwrap` + 共享 `kg-chip-row`，本地 dist 读数单行 → **不另写 H5 修**，随本轮发版上线即消。
- CTA 高度 36 → 44：W5 `kg-button` 带 `--hit-min`，同为合并带来。

### 2.4 「生成」→ 计划卡刷新链路（受控）

四组读数一致（`getsAfterGenerate` / `mockedPosts` / `afterGenerate3s`）：

1. 点 CTA → **`POST /api/profile`**（mock）body `{uid, exam_type:"国考", target_region:"", exam_date:"2027-03-20", target_score:80, daily_minutes:90, base_level:"二战"}` —— 与 `home.vue saveProfile()` 契约一致，字段齐。
2. 随即 **`GET /api/plan/today?uid=umst3tuisd7lgzaka` 200**（真实生产 GET；生产 profile 未变，故回包 `days_left=-1`）。
3. sheet 关闭（3 s 后 `sheetOpen=false`，600 ms 时为关闭动画中）、toast **`学习计划已生成`**。
4. 计划卡重绘：头 `考试日期已过 · 点「编辑」更新`（来自真实 `days_left=-1`，R504 文案）、`0/4`、任务 4 行（`错题复习 10 道 / 专项练习：定义判断 13 题 / 专项练习：增长率 8 题 / 本周模考 1 次`）、focus 行；storage `homePlanCard=1`。
5. 全程非 GET 只有被 abort 的 `POST /api/track`；`errs []`。

- **如实说明**：这证明「前端 POST 成功后 → 重拉 `plan/today` → 关 sheet → toast → 卡片刷新」的链路在生产 bundle 上可达且顺序正确；**不证明**生产 `/api/profile` 写入 + 新 profile 驱动的计划变化（POST 被 mock，生产 profile 保持已过日期）。生产上没有任何非探针用户生成过非默认计划（§1）。

## 3 发版（合并后分支，H5 无本轮专属改动）

- 本轮 H5 侧无新代码；发版内容 = R506 前已合入本分支的 main（W5 表单/组件迁移 + W7 小程序）+ 本轮小程序改动（对 H5 无影响）。目的：把 §2.3 读到的 375 折行形态换成 W5 布局，并让生产与 PR #619 头一致。
- 宿主预检：`df` 4.7 G（首查瞬时 2.9 G，`softcopyright:prod` 同机 10 分钟前刚 build）、load 1.65→2.99、兄弟 build/prune 0；`--skip-build` 一次 rc 见 `~/r506_deploy.log`。
- 发版后三点对照 + 改后生产 375/1440 复跑 `r506_setup_form.py` 见 §3.1（发版完成后补）。

### 3.1 改后生产读数

- 发版：`--skip-build` 一次 rc=0，`compose_rc=0`；容器 `19:24:43Z rev=591bbd59` healthy、0 重启；本机 = 线上 rev；接口回归 7/7 200；主 bundle `index-BnZsi5NU.js` gzip **123 KB**（R505b 126 KB）。
- 改后生产 375 / 1440（`~/r506_setup_post_{375,1440}.out`）：第 1 步日期框仍「`2026-09-07 · 已过，请重选`」`pf-date past`（R505b 未回退）；注入未来日期后第 2 步 `80+`/`二战`、第 3 步 `90 分钟` 可选；**第 3 步标签「每日可用时长」单行**（375 kBox 84×20，改前 63.7 px 折两行）、4 个时长 chip 单行（`lines=1`，chipsSW 328/448 = 容器宽，无横向溢出）；摘要「国考 · 2027-03-20 · 目标 80+ · 二战 · 每天 90 分钟」；CTA 328×44 / 448×44（改前 36 高）；「上一步」36 高。生成链路同 §2.4：`GET plan/today?uid=…` 200 一次、`sheetOpen=false`、toast「学习计划已生成」、`0/4` + 4 行 + focus、`homePlanCard=1`；`errs []`；非 GET 仅 `POST track`（abort）；`docSW==cw`。
- 发版后宿主：load 2.17–2.99、`MemAvailable` 309–381 MB（同机 `softcopyright` 容器占用），本轮发版未受影响。

### 3.2 发版脚本 6b Lighthouse `/` WARN → 复采 + 归因（不当发版失败，脚本设计即 WARN 不阻塞）

| 采样 | perf | a11y | LCP ms | 备注 |
|---|---|---|---|---|
| 发版 6b（宿主 load 2.9） | 0.78 | 0.95 | 5133 | `~/r506_deploy.log` |
| 复采 ×3 `perf-budget.sh /`（本机 load ≤0.4） | 0.79 / 0.79 / 0.79 | 0.95 ×3 | 4323 / 4315 / 4332 | CLS 0.09、BP 1.00、SEO 1.00 |
| 直跑 lighthouse 留 LHR `~/r506_lh_root.json` | 0.83 | 0.95 | 4345 | FCP 1500 / SI 1727 / TBT 40 / TTI 4360；observed LCP 348 ms（模拟节流放大） |
| 对照 R505b 发版 6b（`bf1807a6`） | 0.98 | 1.00 | 1562 | R505 文档 |
| `/tiku/` 本轮 | 1.00 | 1.00 | 967 | 未变 |

- **LCP 元素**（LHR `lcp-breakdown-insight` node）：`uni-view.kg-two__main > uni-view.strip > uni-view.kg-banner > uni-text.kg-banner__t`，bbox 284×75 @top 300，文本 = 公告「欢迎使用错题邦（原上岸错题）：品牌升级…」——main W5 把公告从原来首屏下方的 `.card.ann` 改成首屏内 hero 下的 `kg-banner` 横幅（`git diff bf1807a6 HEAD -- home.vue`），且横幅文本要等 `GET /api/announcement` 回包（首屏 XHR 8 条之一）才绘 → 成为最大文本块、LCP 从「静态壳/hero 文字」变成「XHR 后文字」。首屏静态资源也从少数 chunk 变成 ~45 个 1–3 KB 的 `kg-*`/`wd-*` 组件 chunk + css（W5 组件按文件分包），是否是 LCP 4.3 s 的主因**未证**（需 A/B）。
- 对照 `--blocked-url-patterns='*/api/announcement*'` 一次：LCP 元素变回 `#kg-splash div.s`、LCP 3658 / FCP 2591（`~/r506_lh_root_noann.json`）——单采样噪音大（FCP 从 1500 跳到 2591），只能说明「公告横幅是当前 LCP 元素」，**不能**说明去掉公告就回到 R505b 水平。
- **a11y `color-contrast`** 唯一失败项：`uni-view.toprow > uni-view.searchbar > uni-text.searchbar-t > span`「搜题目 / 考点 / 试卷」#b0b4c0 on #ffffff 13 px = **2.07:1**（要求 4.5:1）。改前 `.searchbar-t { color: var(--ink-3) }`（#6b7280 = 4.83:1），main W5 改为 `--ink-4`。同 diff 里还有 `.set-sub`/`.skel-hint`/`.custom-note`/`.pf-date.empty`/`.task.is-done .task-t` 用 `--ink-4` 做 12–14 px 正文色（冷启动首屏不渲染、Lighthouse 未扫到，但同一对比度）。
- **处置**：不在 R506 内改（本轮簇是计划表单；LCP 修法要 A/B 证据），**R507 起点** = ① `.searchbar-t` 等 `--ink-4` 小字回 `--ink-3`（或 W5 token 层定 `--ink-4` 只用于装饰/禁用态）；② 本机同机交替 Lighthouse A/B（R442 方法，`bf1807a6` dist vs HEAD dist，各 ≥5 次）定 LCP 是「公告横幅位置/时机」还是「组件 chunk 数」；③ 修后发版复采。

## 4 小程序端（`miniapp-native`，W7/main 已合入本分支）同形态源码核

### 4.1 命中并修（`pages/home/home.{ts,wxml,wxss}` + 新 `utils/plan-label.ts`，源锁 `frontend-uni/tests/miniapp-r506-plan-label.test.js`）

| 项 | 改前源码事实 | H5 对应 | 改法 |
|---|---|---|---|
| 首页计划行 `desc` | `'距考试 ' + daysLeft + ' 天　' + phaseName`，`daysLeft` 直接来自 `plan.days_left`（可为 -1） | R504 `planDaysLabel()` | `planDaysLabel(days_left, phase_name)`：<0 →「考试日期已过　点「编辑计划」更新」、0 →「今天考试」、>0 →「距考试 N 天　阶段」、非整数 → 空串不渲染 |
| 计划 sheet 标题 | 同上拼接 | 同 | `daysTitle = planDaysLabel(days_left)` |
| 表单第 1 步日期框 | `{{pf.exam_date || '选择日期'}}`，无已过标示 | R505b `examDateFieldText()` + `.past` | `pfDateText` / `pfDatePast`（`examDateFieldText`/`isExamDatePast`，今天用既有 `cnDayKey()` 东八区），`.pf-date.past` 错误色 + 边框 |
| 「下一步」 | 第 1 步只校验 `exam_date` 非空 | R505b `setupNext()` 拦截 + toast | `onSetupNext()` 第 1 步 `isExamDatePast` → 拦截 + toast「考试日期已过，请重新选择」 |
| picker 下限 | `start="{{today}}"`（`new Date()` 本地日期） | R505 登记项（H5 也未改） | **不改**（只影响最早可选日；模拟器/真机时区一般为东八区） |

- 「今天」口径：直接用 `utils/cn-date.ts` 既有 `cnDayKey()`（`now + tzOffset + 8h`）——与 R505b 教训一致，不用本地日期。
- 门：`miniapp-native` `npm run typecheck` 0 错 / `npm run lint` 0 错（19 条既有 warning，未新增）；vitest 源锁 4 用例（改前红/改后绿；文案内的全角空格写成 `\u3000` 转义，否则 eslint `no-irregular-whitespace`）。
- **未核**：本机无微信开发者工具运行环境，小程序改动只过 typecheck/lint/源锁，**运行时形态未验**；小程序不在本轮发版范围（H5 发版不含小程序）。

### 4.2 核到但本轮不改（登记）

| 项 | 源码事实 | 为何不改 |
|---|---|---|
| 首页任务卡「错题复习」 | `home.wxml` 仍用 `dueLoaded && !dueReview` → `今日已清零` 计入 `taskDoneN`；`api/grow.ts DailyPlanResp` 无 `mistakes_total` | R503 H5 修法要改契约 + 三处口径，属另一簇；W7 端无运行时复验手段；生产 `mistakes_total` 非探针触达 0，无用户侧证据催促 |
| `pkgGrow/daily/daily.ts logAttempts()` | `qid: q.id \|\| null`，无 `_sz` 守卫（同文件 `saveWrong()` 已有 `q._sz ? null : q.id`） | R485 起已登记给 W7 合 main 时处理，非本轮簇 |
| `pages/practice/practice.ts onDeepExplain()` | `qid: q.id \|\| null`，无 `_sz` 守卫 | 同上 |
| `pages/login/login.ts` | 两处 `mergeAnon()` 空 catch（`/* 合并失败不阻断登录 */`） | 设计上有意不阻断；未见用户可见缺陷证据 |
| 表单第 2/3 步 | 目标分 `60/65/70/75/80` / 基础 `零基础/有基础/二战` / 时长 `30/60/90/120` 与 H5 同集合；`onSetupSave()` → `saveProfile` → `loadPlanToday` 同链路 | 无缺口 |

## 5 登记（不改）

- 后端 `/api/profile` 仍接受已过 `exam_date`（R505 登记，等非 H5 写入证据）。
- 小程序 picker `start` 用本地日期（同 H5 `dateStart` 登记项）。
- 小程序 `mistakes_total` / `_sz` / `mergeAnon`（§4.2）。
- 生产 9 份 profile 全默认值：第 2/3 步选项从未被非探针用户改过——若后续有真人，`target_score`/`daily_minutes` 分布是第一个可读的「表单被用过」信号。

## 6 脚本 / 输出

- `~/r506_post.sh` → `~/r506_post.out`（VPS 上只读）；`~/r506_profiles.out`（`user_profile` 分布）。
- `~/r506_setup_form.py` → 改前生产 `~/r506_setup_{375,1440}.out` + `~/r506_prod_step{2,3}_375.png` / `~/r506_prod_generated_{375,1440}.png`；本地合并后 dist `~/r506_local_setup_{375,1440}.out` + `~/r506_local_step3_375.png`。
- `~/r506_deploy.log`；改后生产 `~/r506_setup_post_{375,1440}.out`。
- Lighthouse：`~/r506_lh_root.json`（+`.err`）、`~/r506_lh_root_noann.json`；`perf-budget.sh /` 三次复采输出在会话记录（未落文件）。
