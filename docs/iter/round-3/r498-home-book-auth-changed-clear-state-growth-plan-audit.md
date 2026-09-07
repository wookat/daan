# R498：其它持有账号派生字段的页面（首页 home / 错题本 book / 成长 `pkgA/stats/*` / 学习计划）是否也漏 `authChanged` 监听——同法「清态在 `onShow` 之外」用例 375/1440 只读审；命中 ①「首页停留中撞 403 → 账号的今日进度/打卡/考试/今日计划/focus 全留屏」②「错题本停留中『标为已掌握』撞 403 → 错题卡/待复习数留屏 + 该 PATCH 失败无 catch（unhandledrejection 打 monitor、用户无反馈）」→ 最小修（`cf95384`），生产 `578d176` → `cf95384`；成长三页 / 问答 tab 页源码核后登记不改

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/home/home.vue`（`onLoad` `$on('authChanged')` / `onUnload` `$off`；抽 `refreshAccountData()` 收拢 `onShow` 全部账号相关拉取并记 `_acctUid`；`resetAccountState()` 清 `plan/planFetched/planToday/profile/profileFetched/badgeInfo/svTodayN/dsDone` → `refreshAccountData()`）、`frontend-uni/src/pages/book/book.vue`（同法监听；`resetAccountState()` 清 `items/due/dueTotal/masteryMods/masteryT3/offlineView/loadErr/aiOpen/aiHtml/aiErr/moreSheet/batchMode/selIds/pageN/reviewing/resumeInfo` + `setBookBadge(0)` → 按新 uid 解析 `reviewSnap` → `load()`；`master()` / `del()` 的 PATCH/DELETE 加 catch → toast「操作失败：…」/「删除失败：…」并 return，不再把失败当成功刷新）、源锁 `frontend-uni/tests/auth-r498-home-book-account-state.test.js`（6 用例，改前 HEAD 6/6 红）。**不改**：`api.js` 的 `setAuth/clearAuth` 与 401/403 policy、`deviceAnonUid` 恢复、toast 文案、首页参数解析/键盘监听/setup sheet、错题本 `reviewSnap` 远端恢复逻辑、后端、小程序端、成长三页、问答页。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R497 容器（14:15:20Z 起）发版前 35 → 至本轮发版共 70 请求；本轮新容器（14:40:54Z 起）32 请求；两窗口 5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针非 bot 0；非探针 POST 0；生产 Caddy 401/403 **0 行**（本轮 harness 的全部 403 都是 CDP `ctx.route` 本地 fulfill，未到边缘）；`*_ask_click` 真人 0（探针 4 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政且 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge `dismiss/fail/ok/click` 真人 0；`push_subs` 0；`umsacie7…` 12:00Z 后 0 回访、`umst3…` 无第二段作答；登录分包 / 提醒设置分包非探针加载全历史 0；`POST /api/auth/logout` 全历史 0；`merge_anon` 非 2xx 0；非探针 `/api/auth/*` 仍只有 4 次 `wxlogin 503`；WAL 4,124,152 B 同字节；harness 匿名 uid（`umr498…`）/ 假账号 `u9498` 在 `answer_log/mistakes/growth_events` **0 行**（0 库写入印证）。
2. **全仓盘点（源码，§2.0）**：tabBar 5 页 `home/book/ask/stats/profile`，R497 后有 `authChanged` 监听的是 `profile/stats`（+ `pkgA/social/discuss.vue`）；**`home`/`book` 无监听**而两者都持有大量账号派生字段（首页：`plan/planToday/profile/badgeInfo/svTodayN/dsDone/szDaily`；错题本：`items/due/dueTotal/masteryMods/masteryT3/resumeInfo`）；`ask` 无监听但其会话历史是**设备本地 `askSessions` storage + 远端合并**、不按 uid 分键（设计语义，见 §5 登记）；成长三页 `pkgA/stats/{mastery-map,practice-history,weekly-report}` 与「学习计划」无独立页面（计划卡在首页 `plan*` 字段、`daily_plan` 在首页 `home_bundle`）——成长页均为 `navigateTo` 叶子页，进入即 `onLoad/onShow → load()` 用当前 uid 拉取，页内唯一写请求 `POST /api/report/weekly/read` 已有空 catch。
3. **命中 A（verified，改前生产 bundle `index-Cqa6rqEs.js`，CDP 375/1440 探针头，`/api/**` 全 mock → 0 生产账号 0 库写入 0 LLM，§2.1 `inpage_home`）：首页停留中撞 403 → 账号数据全留屏**。seed 登录态 `u9498` + 假 `home_bundle`（今日 9/20、连续 7、国考·北京、到期 5、计划 83 天强化期 2 行、focus 资料分析）→ 点计划 focus chip → `POST /api/user_state {uid:u9498}` 403 → toast「登录已过期，请重新登录」、`authToken/authUser` 清、`anonUid = deviceAnonUid`，但 `heroGoal 今日已练 9/20 题`、`heroStreak 连续打卡 7 天`、`exam 国考 · 北京`、`duebar 今日到期复习 5 题`、`planT 今日计划 / 距考试 83 天 · 强化期 / 专项练习 20 题 · 复习到期错题 5 道`、`focusOn [资料分析]` **全部还在**，`calls_after` 只有那 1 条 403 的 POST（无任何重拉）；再切一次 tab（`after_reshow`）才变匿名态 `0/20 · 选择考试 · 无计划 · guide=true`。375 与 1440 逐值相同（`docSW 360/1425`）。
4. **命中 B（verified，同法 §2.1 `inpage_book`）：错题本停留中「标为已掌握」撞 403 → 错题卡留屏 + PATCH 失败无 catch**。seed 4 张假错题（`待掌握 4`、`今日待复习 2 道`）→ 卡片「更多」sheet（`练3道同类 / 标为已掌握 / 删除 / 取消`）→ 点「标为已掌握」→ `PATCH /api/mistakes/900001 {uid:u9498,mastered:1}` 403 → toast「登录已过期」、token 清、`anonUid` 恢复，但 `seg 待掌握 4`、`due 今日待复习 2 道`、`cards 4` **全留屏**；同时 `calls_after` 里多出 **`POST /api/monitor/report {message:"unhandledrejection: 登录已过期，请重新登录"}`**——`master()` 的 `await request(...)` 无 catch，policy 抛出的错成为 unhandled rejection 被 R391 全局 handler 打到监控（真人触发时会计入 monitor 告警行），而用户侧除 policy toast 外**没有「操作失败」反馈**，且 `m.mastered` 也未改（半成功态不存在，只是无反馈）。`del()` 同形态（源码 verified，未单独造用例）。375/1440 逐值相同。
5. **`expire_*`（切回时 403）改前即 0（§2.1）**：`expire_home`/`expire_book` 切回 tab 时账号域 GET 403 → 因 `onShow → refreshAccountData()/load()` 在 403 之后继续按新 uid 重拉，改前 `after` 已是匿名态——与 R497 §5 同结论：能暴露命中的只有「不切页的页内动作撞 403」用例（`inpage_*`）。
6. **修法（最小，§3）**：两页 `onLoad` `this._onAuth = () => { if (anonUid() === this._acctUid) return; this.resetAccountState(); }; uni.$on('authChanged', this._onAuth)`，`onUnload` `$off`；`_acctUid` 在每次 `refreshAccountData()`（首页）/ `onShow`（错题本）记录，同 uid 重复 emit 不重拉；`resetAccountState()` 先清账号态字段再按新 `anonUid()` 整套重拉（首页 `loadExamResume/loadPracticeResume/loadReviewResume/syncDsDone/loadHome`，错题本 `parseReviewSnap(新 uid)` → 无快照则 `restoreRemoteSnap()` → `load()`）。错题本 `master()`/`del()` 加 catch → toast `操作失败：<e.message>` / `删除失败：<e.message>` 并 return——不再走 `uni.showToast('已掌握！')` / `this.load()`，也不再产生 unhandledrejection。源锁 6 用例对 HEAD（`578d176`）跑 **6/6 红** → 改后 6/6 绿。门：vitest 760（102 文件）/ eslint rc=0 / build rc=0；pytest 511 / ruff / `backend/` pyright 0。
7. **发版 + 三点对照（§4）**：宿主 `mem_avail=314MB disk_avail=5.5G load=0.15 other_builds=0 prunes=0`，`--skip-build` 一次 rc=0；容器 `StartedAt 14:40:54.419Z` healthy 0 重启 `rev=cf95384`（`/api/health`）；`pages-home-home.YbQxh49K.js` / `pages-book-book.BoE0THcu.js` 线上=本机 md5（`6ea958700b55` / `83f11ec3bc51`）；7/7 200；bundle `index-Bj2b6Wo3.js` gzip 126 KB ≤160；perf `/` 0.99 · a11y 1.00 · bp 1.00 · seo 1.00 · LCP 1410 / `/tiku/` 1.00 · 1.00 · 1.00 · 1.00 · LCP 965。**生产改后** `inpage_home` 375/1440：403 后**不切页即** `今日已练 0/20 题 · heroStreak null · 选择考试 · duebar null · planT null · focusOn [] · guide=true`，`calls_after` 紧跟 403 出现匿名 uid 的 `exam/resume → practice/resume → review/cur → home_bundle`；`inpage_book` 375/1440：toast 变「**操作失败：登录已过期，请重新登录**」、`seg [] · due null · cards 0 · empty 错题本还是空的…`，`calls_after` 紧跟 PATCH 403 出现匿名 uid 的 `review/cur → mistakes → review → mastery/map`，**`monitor/report` 不再出现**；本地 dist（`r498_local_inpage_{home,book}_375.out`）逐值一致；`errs` 只有 mock 403 的 `Failed to load resource`、`EXC None`。
8. **触达（Caddy 全历史）**：账号域 401/403 非探针 0（R497 §1.1 口径不变）；两条修的都是生产从未对真人触发的路径（可达未触发，R484/R491/R495–R497 同性质）；但 B 的「PATCH 失败无 catch」不限于 401/403——任何网络/5xx 失败同样静默 + 打 monitor，非探针 `PATCH/DELETE /api/mistakes/*` 全历史只有 `PATCH 200 ×3`（`~/r498_mist.sh`），非 2xx 0；`POST user_state` 非探针 0。
9. **登记不改（§5）**：① 成长三页为 `navigateTo` 叶子页，唯一能在挂载中撞 401/403 的是 `weekly/read` POST（已空 catch，报告正文是用户主动打开的账号周报，返回即销毁、stats tab `onShow` 会按新 uid 刷新）——不加监听，未造运行时用例（unverified，源码推断）；② 问答 tab 页 `askSessions` 设备本地 + 远端合并、不按 uid 分键，账号失效后会话历史留屏是**现有设计**（R491 已审），是否按 uid 分键属产品决策，本轮不动；③ 「账号数据请求在飞行中、403 先到、旧 uid 回包后到」的竞态两页均未防（与 profile/stats 同），未造用例；④ `ask` 页 `loadDue()` 的到期复习数同样不监听 `authChanged`（页内无写请求可撞 403，切回即刷新）。

## 1. (c) 补量 / 到期项（`~/r498_post.sh` → `~/r498_post.out` 14:3xZ 发版前；`~/r498_post2.sh` → `~/r498_post2.out` 15:0xZ 发版后）

| 项 | 发版前（R497 容器 14:15:20Z 起，至本轮发版共 70） | 发版后（14:40:54Z 起） |
|---|---|---|
| 容器 | healthy / restarts 0 / `rev=578d176` | healthy / restarts 0 / `rev=cf95384` |
| 宿主 avail / load | 5.5 G / 0.15–0.46 | 5.0 G / 0.33 |
| WAL | 4,124,152 B | 4,124,152 B（同字节） |
| app log Traceback | 0 | 0 |
| 请求数 | 70 | 32 |
| 5xx / assets404 / monitor / mpUA 异常 | 0/0/0/0 | 0/0/0/0 |
| 非探针非 bot / 非探针 POST | 0 / [] | 0 / [] |
| Caddy 401/403（任何来源） | 0 | 0（harness 403 全在 CDP 本地 mock） |
| `*_ask_click` probe=0 | 0（探针 4） | 0 |
| `explain_cache qid` 非空/总 | 0/82 | 0/82 |
| 时政且 qid 非空（answer_log / mistakes） | 0 / 0 | — |
| `error_reason` ≥09-11 | 0 | 0 |
| probe=0 `answer_log` / growth | 53/2 · 26/4 | 53/2 · 26/4 |
| nudge dismiss/fail/ok/click probe=0 | 0（各 1 行探针） | 0 |
| `push_subs` | 0 行 | — |
| 登录分包 / 提醒分包 非探针加载（全历史） | 0 / 0 | — |
| `POST logout` / `merge_anon` 非 2xx（全历史） | 0 / 0 | — |
| `umsacie7…` 12:00Z 后 / `umst3…` 第二段作答 | 0 / 无 | — |
| harness uid `umr498*` / `u9498` 落库 | — | `mistakes 0 · answer_log 0 · growth 0` |

## 2. 运行时一手（`~/r498_expire.py <375|1440> <scen>`，`R498_BASE` 可指本地 dist；改前生产 `~/r498_prod_*.out`、改后本地 `~/r498_local_*.out`、改后生产 `~/r498_prod_post_*.out`；截图 `~/r498_{inpage,expire}_{home,book}_{before,after}_{375,1440}.png`）

harness：`chromium.connectOverCDP('http://localhost:29229')`，context `extra_http_headers={'X-Kg-Probe':'1'}`；`add_init_script` seed `authToken=r498tok` / `authUser={type:'object',data:{uid:'u9498',…}}` / `anonUid=u9498` / `deviceAnonUid=umr498d<ts>`；`ctx.route('**/api/**')`：`home_bundle`（今日 9/20 · streak 7 · 国考·北京 · 到期 5 · `daily_plan` 83 天强化期 2 行 · focus 资料分析）/ `mistakes`（4 条 `R498 占位错题`，`mastered=0`）/ `review`（到期 2）/ `mastery/map` 假数据；`EXP.on` 后凡 body 或 query 含账号 uid 的请求返 `403 {detail:'无权访问该账号数据'}`；匿名 uid 请求 fulfill 空数据；`/api/track` 200 不落库；其余 abort。切 tab 用 `.uni-tabbar__item` 文本点击。

### 2.0 全仓盘点（源码）

| 页 | 类型 | 账号派生字段 | `authChanged` 监听（改前） | 页内可撞 401/403 的写请求 |
|---|---|---|---|---|
| `pages/home/home` | tab | `plan/planToday/profile/badgeInfo/svTodayN/dsDone/szDaily` | **无** | `POST user_state`（focus chip）、`POST profile`（每日目标/组大小/setup）、`POST review/cur|practice/progress|exam/progress`（丢弃续练） |
| `pages/book/book` | tab | `items/due/dueTotal/masteryMods/masteryT3/resumeInfo` | **无** | `PATCH/DELETE mistakes/:id`、`POST mistakes/analysis`、`POST review/*` |
| `pages/ask/ask` | tab | `sessions`（设备本地 + 远端合并）、`due` | 无 | `POST ask/cur`、`DELETE ask/sessions/:id`、`POST explain/stream` |
| `pages/stats/stats` / `pages/profile/profile` | tab | R496/R497 已列 | 有（R497） | — |
| `pkgA/stats/mastery-map` | navigateTo | `map` | 无 | 无（只 GET） |
| `pkgA/stats/practice-history` | navigateTo | `items` | 无 | 无（只 GET） |
| `pkgA/stats/weekly-report` | navigateTo | `report` | 无 | `POST report/weekly/read`（空 catch） |
| 学习计划 | 无独立页 | 首页 `plan*` / `home_bundle.daily_plan` | → 首页 | → 首页 |

### 2.1 清态语义（改前生产 → 改后生产）

| 场景 | 触发 | toast | `authToken` / `anonUid` | 页面字段（不切页，改前） | reshow（改前） | 改后不切页 |
|---|---|---|---|---|---|---|
| `inpage_home` 375/1440 | 点计划 focus chip → `POST user_state` 403 | 登录已过期，请重新登录 | 清 / = `deviceAnonUid` | **9/20 · 连续 7 · 国考·北京 · 到期 5 · 今日计划 83 天 2 行 · focus 资料分析 全留屏**；`calls_after` 仅 1 条 403 | 0/20 · 选择考试 · 无计划 · guide | **即** 0/20 · 选择考试 · 无计划 · guide；`calls_after` 匿名 uid `exam/resume → practice/resume → review/cur → home_bundle` |
| `inpage_book` 375/1440 | 卡片更多 → 「标为已掌握」→ `PATCH mistakes/900001` 403 | 登录已过期，请重新登录 | 清 / = `deviceAnonUid` | **待掌握 4 · 今日待复习 2 道 · 4 卡 全留屏**；`calls_after` = PATCH 403 + **`POST monitor/report unhandledrejection`** | 空态 | **即**空态；toast「**操作失败：登录已过期，请重新登录**」；`calls_after` 匿名 uid `review/cur → mistakes → review → mastery/map`，**无 monitor** |
| `expire_home` 375 | 切回首页，账号域 GET 403 ×3 | 同上 | 清 / 恢复 | 改前 `after` 已匿名态（`onShow` 顺手刷） | 同 | （未复跑，不涉） |
| `expire_book` 375 | 切回错题本，账号域 GET 403 ×5 | 同上 | 清 / 恢复 | 改前 `after` 已空态 | 同 | （未复跑，不涉） |

`errs`：改前 book 多一条产品侧 `登录已过期，请重新登录`（unhandledrejection 文本）+ `net::ERR_FAILED`（monitor 请求被 harness abort）；改后只剩 mock 403 的资源错。`EXC None` 全部。

## 3. 修法（`cf95384`）

- `home.vue`：`onLoad(){ this._onAuth = () => { if (anonUid() === this._acctUid) return; this.resetAccountState(); }; uni.$on('authChanged', this._onAuth); }`、`onUnload(){ if (this._onAuth) uni.$off('authChanged', this._onAuth); }`；`refreshAccountData(){ this._acctUid = anonUid(); this.szDaily = loadSzDaily(this._acctUid); loadExamResume(); loadPracticeResume(); loadReviewResume(); syncDsDone(); return this.loadHome(); }`（`onShow` 原散落拉取收拢到此，`wantSetup` 逻辑挂在其 `.then`）；`resetAccountState(){ plan=null; planFetched=false; planToday=null; profile=undefined; profileFetched=false; badgeInfo=null; svTodayN=null; dsDone=null; refreshAccountData(); }`。
- `book.vue`：`onLoad` 末尾同法监听；`onShow` 记 `_acctUid` 并用它解析 `reviewSnap`；`onUnload` `$off`（保留 H5 键盘监听清理）；`resetAccountState()` 清列表/到期/掌握度/离线态/AI 结果/sheet/批量/分页/复习态 + `setBookBadge(0)` → 按新 uid `parseReviewSnap` → 无快照则 `_reviewIntent=false; restoreRemoteSnap()` → `load()`；`master()`/`del()` `try { await request(...) } catch (e) { uni.showToast({ title: '操作失败：'|'删除失败：' + (e.message || '请稍后重试'), icon:'none' }); return; }`。
- 源锁 `tests/auth-r498-home-book-account-state.test.js`：首页监听 + `$off` / `refreshAccountData` 覆盖五个 loader / `resetAccountState` 先清后拉；错题本监听 + `$off` / `resetAccountState` 清全部字段 / `master`&`del` 有 catch 且 toast 后 return。对 `578d176` 源码 6/6 红。

## 4. 发版（`~/r498_deploy.log`）

4-pre：`mem_avail=314MB disk_avail=5.5G(89%) load=0.15 other_builds=0 prunes=0`；compose 后台 rc=0，轮询 6 次旧 `578d176` 后收敛 `StartedAt 2026-09-07T14:40:54.419Z rev=cf95384 compose_rc=0`；`KG_COMPOSE_EXIT rc=0`；6/6 接口 7/7 200；6b `index-Bj2b6Wo3.js` gzip 126 KB ≤160；Lighthouse `/` perf 0.99 / a11y 1.00 / bp 1.00 / seo 1.00 / LCP 1409.6 / CLS 在预算内；`/tiku/` 1.00 / 1.00 / 1.00 / 1.00 / LCP 964.6。home/book 分包线上=本机 md5。

## 5. 登记不改 / 取证自纠

- 成长三页不加监听（§0.9 ①，源码推断、未造运行时用例）；`ask` 会话历史不按 uid 分键是既有设计（§0.9 ②）；飞行中竞态未防（§0.9 ③）。
- 首版 `r498_post2.sh` 用了不存在的列 `explain_cache.question_id`（正确是 `qid`），已改并重跑；`r498_post.sh` 里 `docker exec … $KG_GIT_REV` 输出空（同 R497 §5），revision 以 `/api/health` 为准。
- 改前 `expire_home`/`expire_book` 与 R497 `expire_profile` 同理不能暴露命中——用例名沿用但结论为「改前即 0」，不计入命中。
- 改前截图与改后截图同名覆盖（`*_before/after_*.png` 是最后一跑=改后生产），改前数值以 `~/r498_prod_inpage_*.out` 为准。

## 6. 如实说明

CDP 仿真非真机；本轮向生产**未发**任何真实登录/退出/合并/错题写入/LLM 请求（Caddy 401/403 0 行、harness uid 落库 0 行印证）；两条命中在生产**从未对真人触发**（账号域 401/403 非探针全历史 0、`PATCH/DELETE mistakes` 非 2xx 0）；成长三页与问答页只做源码核、无运行时用例；改后 `expire_*` 未复跑；无 testing agent 录屏（未另行授权）。
