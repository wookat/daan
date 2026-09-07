# R497：401/403 自动清态 + `authLogout()` 接口失败两条路径运行时复验 + 设置页/提醒设置项登录态·匿名态 375/1440 只读整页审——清态 / toast / `merge_anon` 排除 / logout 失败静默全过；命中 ①「401/403 自动清态发生在**已挂载**的个人页/统计页上时，账号派生数据留在屏上要再切 tab 才归匿名态」（R496 只修了显式退出那条路）②「提醒时间 picker 触发区高 15–16 px」→ 最小修（`578d176`），生产 `f7ae2c7` → `578d176`

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/profile/profile.vue` / `frontend-uni/src/pages/stats/stats.vue`（`onLoad` 监听 `authChanged`，uid 真变了才 `resetAccountState()` = 清账号态字段 → `refreshAccountData()`；显式退出改为只 `clearAuth()`，清态/重拉统一由监听器做）、`frontend-uni/src/pkgA/settings/reminders.vue`（`.time-v` 加 `min-height:40px; display:inline-flex; align-items:center; padding-left:24rpx`）、源锁 `frontend-uni/tests/logout-r496-account-state-refresh.test.js`（改写：`resetAccountState` 覆盖全部字段且先清后拉 / 显式退出不再直调 loader / `authChanged` 仅 uid 变才 reset / 顶层 user 对象替换但 uid 不变不重拉）+ `frontend-uni/tests/reminders-r497-picker-hitarea.test.js`（3 用例）。**不改**：`api.js` 的 `setAuth/clearAuth/authLogout/classifyHttpError` 语义、`api-policy` 的 401/403 判定、`deviceAnonUid` 恢复路径、toast 文案、推送订阅/权限逻辑、后端任何文件、小程序端。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R496 容器（13:44:32Z 起）发版前 44 请求 → 本轮新容器（14:15:20Z 起）35 请求，5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针非 bot 0；非探针 POST 0；`*_ask_click` 真人 0（探针 4 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；非探针 `mistakes/analysis` / `explain/stream` 0；probe=0 `answer_log` 53/2、growth 26/4；`daily_set_entries` 1/1；WAL 4,124,152 B 同字节；`umsacie7…` 12:00Z 后 0 回访、`umst3…` 仍只有 R493 那 84 请求（10 题 12:00:08–27Z）无第二段作答；nudge `dismiss/fail/ok` 真人首行仍 0（`login_nudge_dismiss`/`push_nudge_dismiss`/`push_nudge_fail` 各 1 行全 R494 探针）；`push_subs` 0 行；登录分包 / 提醒设置分包非探针加载全历史 **0**；`POST /api/auth/logout` 全历史 **0**；`merge_anon` 非 2xx 0；非探针 `/api/auth/*` 仍只有 4 次 `wxlogin 503`。
2. **401/403 真实发源盘点（§1.1，Caddy 全历史 + 源码）**：生产全历史 `/api/*` 401 里非探针只有 6 次 `GET /api/admin/{ops_status,batches}` 无 bearer（管理台探活，不是用户账号过期）；`/api/comments/inbox`（个人页唯一 `require_user` 接口）只有探针 200、真实 401 0；带 Bearer 的请求非探针 0；账号域 `?uid=u<digits>` 无 token 403 共 70 次全探针。→ 本轮复验的两条路径（401 过期清态 / 403 越权清态）**生产从未对真人触发过**，可达未触发（R484/R491/R495/R496 同性质）。
3. **401/403 自动清态运行时复验（verified，改前生产 bundle `index-BG4B8rtD.js`，CDP 375/1440 探针头，`/api/**` 全 mock → 0 生产账号 0 库写入 0 LLM，§2.1）**：seed 登录态 → 切回个人页/统计页时账号域接口 mock 成 `401 {detail:'未登录或登录已过期'}` 或 `403 {detail:'无权访问该账号数据'}` → 700 ms 内 toast「登录已过期，请重新登录」、`authToken`/`authUser` 清空、**`anonUid` 恢复 = `deviceAnonUid`**；`/api/auth/merge_anon` 返 401 → **不**触发全局清态、`authToken` 仍在、登录页自己的 catch 提示「已登录，但本机记录合并失败；退出后重新登录会再次合并」（R495 文案）——`classifyHttpError` 的 `!path.startsWith('/api/auth/')` 排除在运行时成立。
4. **`authLogout()` 接口失败路径（verified，§2.2）**：`POST /api/auth/logout` mock 503 → 本机仍 `clearAuth()`、toast「已退出登录」、账号卡→匿名、`anonUid = deviceAnonUid`、`calls_after` 按匿名 uid 重拉——接口失败对用户不可见、本机退出语义成立（R496 登记项 ① 由「源码核」升级为「运行时 verified」，改前/改后生产各一跑一致）。
5. **命中 A（verified，改前生产 profile 375 `inpage_profile`/`expire401_profile` + stats 375/1440 `expire_stats`）：自动清态发生在已挂载页面上时账号派生数据留在屏上**。个人页停留中点「每日目标」→ `POST /api/profile` 撞 403 → toast「登录已过期」、账号卡已变「未登录」，但 `stats = ['180累计做题','25错题本','7连续打卡']`、`badgeHead = '当前连续 7 天 历史最长 12 天'`、徽章 2、`讨论消息 3 条未读`、`学习计划 国考 · 2026-11-29` **全部还在**；统计页切回撞 403 后 KPI `['180累计刷题','70%总正确率','7连续打卡(天)']`、`学习 102 次`、亮格 7 同样留屏；都要再切一次 tab（`after_reshow`）才归 0。根因（源码）：R496 的清字段 + `refreshAccountData()` 只挂在 `doLogout()` 确认回调里；`api-policy` 走的是 `clearAuth()` → `uni.$emit('authChanged')`，两页对该事件**无监听**，字段不随 `user=null` 失效。用户视角：屏幕顶部说「未登录」、下面还是账号的打卡/徽章/未读/报考画像——比 R496 显式退出那条更隐蔽（用户没做任何「退出」动作）。
6. **命中 B（verified，改前生产 375/1440 登录态+匿名态）：提醒时间 picker 触发区过小**。`<picker mode="time">` 的可点区 = 唯一子元素 `.time-v`（`27rpx` 文本 `20:30 ›`）本体：375 `h 15–16 × w 51–53`、1440 `h 16 × w 53.3`，所在 `.set-row` 行高 57 但整行不可点；开关 `26×43.6` 是 uni 原生 switch 不动。R410+ 全站可点元素 ≥40px 口径下这是唯一漏审项（`pkgA/settings/*` 从未整页过审）。
7. **其余全过（§2.3）**：个人页入口 `.wd-cell`「学习提醒未开启」375 `46.9×329.3` / 1440 `48×512`；三行 `.set-row` 56/57 高、`docSW 360/1425` 无横向溢出；开关 → `remindOn=1`、`remindTime=20:30` 落 storage、时间行 `dim` 解除、toast「已开启 · 每天 20:30 提醒」；`Notification.permission` mock `denied` → 黄条「浏览器通知权限被拒绝 请在浏览器地址栏左侧站点设置中允许「通知」后刷新页面。」、`default` → 「需要开启浏览器通知权限 … 开启通知权限」按钮、`granted` → 无 warn；关 → toast「已关闭提醒」、时间行回 dim；「每日一练离线推送」权限未授予 → toast「需要通知权限才能推送」不发订阅；synthetic `granted` + mock `PushManager.subscribe` 抛错 → toast「开启失败，请稍后再试」（VAPID/PushManager 全 stub，**不据此判产品缺陷**）；登录态/匿名态几何与状态转换逐值一致（该页所有状态本机 storage 持久、不区分账号）；返回 → `#/pages/profile/profile`。
8. **修法（最小，§3）**：A：两页 `onLoad` `uni.$on('authChanged', …)`（`onUnload` 对称 `$off`），监听器比对 `getAuthUser()?.uid` 与页面 `user/authUser?.uid`——**变了才** `resetAccountState()`（清账号态字段 → `refreshAccountData()`），同 uid 重复 emit（如 `setAuth` 刷新 user 对象）不重拉；`doLogout()` 确认后只 `authLogout()` + `clearAuth()` + toast，清态/重拉交给监听器（R496 那条路径行为不变，只是收口到一处）。B：`.time-v` `min-height:40px; display:inline-flex; align-items:center; padding-left:24rpx`，字号 `27rpx`/行布局 `56px`/picker 结构不变，不把整行做成可点区（避免与 switch 行不一致）。源锁改前 R496 测试文件改写后 4/4 红 → 改后绿；`reminders-r497-picker-hitarea.test.js` 改前 1/3 红。门：vitest 754（101 文件）/ eslint rc=0 / build rc=0；pytest 511 / ruff / `backend/` pyright 0（根目录跑 pyright 会读不到 `backend/pyrightconfig.json` 报 121 假错，见 §5）。
9. **发版 + 三点对照（§4）**：宿主 avail 5.5 G / load 0.45 / 无兄弟构建 / prunes 0，`--skip-build` 一次 rc=0；容器 `StartedAt 14:15:20.868Z` healthy 0 重启 `rev=578d176`；`pages-profile-profile.ClPnjNua.js` / `pages-stats-stats.ClhDOgZH.js` / `pkgA-settings-reminders.Dk8oCkyj.js` 线上=本机 md5（`412f24ba` / `3c7e831d` / `a7f51a58`）；7/7 200；perf `/` 0.96·1.00 LCP 1397 CLS 0.06 / `/tiku/` 1.00·1.00 LCP 951。**生产改后**：`inpage_profile` 403 → 不切页即 `['0累计做题','0错题本','0连续打卡']` / `当前连续 0 天` / 徽章 0 / `讨论消息`（无未读）/ `学习计划 未制定` ✓，`calls_after` 紧跟 `POST /api/profile 403` 出现匿名 uid 的 `mistakes/checkin/badges/profile/…`；`expire401_profile` 同 ✓；`expire_stats` 375/1440 撞 403 后即 KPI 全 0 / `学习 0 次` / 亮格 0 ✓；`profile_logoutfail` 与改前一致 ✓；`relogin_mergeauth401` 仍不清态 + 合并失败 toast ✓；设置页 375 登录态 `.time-v` `40×65.3`（`initial` 40×62.6）✓、行高 57 不变、开关/状态转换/toast 逐值同改前；本地 dist（375 auth / 1440 anon）逐值一致；`errs` 只有 mock 401/403/503 的 console 资源错。
10. **登记不改**：① 提醒页 `remindOn/remindTime` 只落本机 storage、不随账号——登录态/匿名态一屏相同、退出不清；换设备不同步（产品现状，不立项）；② synthetic push 失败 toast「开启失败，请稍后再试」无重试入口，但真实 `PushManager` 路径本轮未触（VAPID stub），生产 `push_subs` 0 行、`push/pubkey` 非探针 1 次（`umsacie7` 11:57Z）——等真人首条再审；③ `picker` 在 CDP/H5 的原生时间选择弹层形态未测（真机项）；④ 修的两条都是生产 0 次触发路径。

## 1. (c) 补量 / 到期项（`~/r497_post.sh` 远端 payload → `~/r497_post.out` 14:0xZ 发版前 → `~/r497_post2.out` 14:2xZ 发版后）

| 项 | 发版前（R496 容器 13:44:32Z 起） | 发版后（14:15:20Z 起） |
|---|---|---|
| 容器 | healthy / restarts 0 | healthy / restarts 0 / `rev=578d176`（`/api/health`） |
| 宿主 avail / load | 5.5 G / 0.45 | 5.0 G / 0.46 |
| WAL | 4,124,152 B | 4,124,152 B（同字节） |
| app log Traceback | 0 | 0 |
| 请求数 | 44 | 35 |
| 5xx / assets404 / monitor / mpUA 异常 | 0/0/0/0 | 0/0/0/0 |
| 非探针非 bot / 非探针 POST | 0 / [] | 0 / [] |
| `*_ask_click` probe=0 | 0（探针 4） | 0 |
| `explain_cache qid` 非空/总 | 0/82 | 0/82 |
| 时政且 qid 非空（answer_log / mistakes） | 0 / 0 | 0 / 0 |
| `error_reason` ≥09-11 | 0 | 0 |
| probe=0 `answer_log` / growth | 53/2 · 26/4 | 53/2 · 26/4 |
| nudge dismiss/fail/ok probe=0 | 0（各 1 行探针） | 0 |
| `push_subs` | 0 行 | 0 行 |
| 登录分包 / 提醒设置分包 非探针加载（全历史） | 0 / 0 | 0 / 0 |
| `umsacie7…` 12:00Z 后 / `umst3…` 第二段作答 | 0 / 无 | 0 / 无 |

### 1.1 401/403/logout 真实发源（Caddy 全历史，`Cf-Connecting-Ip` + `X-Kg-Probe` 判探针）

| 项 | 值 |
|---|---|
| `/api/*` 401 非探针 | 6，全是 `150.109.230.174 GET /api/admin/{ops_status,batches}` 无 bearer（09-01 / 09-05） |
| `/api/*` 401 探针 | `auth/login` 1、`auth/sso` 4、`admin/*` 22、`questions/export` 3 |
| `/api/comments/inbox`（个人页唯一 `require_user`） | 探针 200 ×18；401 0 |
| 带 `Authorization: Bearer` 的请求（任何状态） | 非探针 0 |
| `/api/*?uid=u<digits>` 无 token 403 | 70，全探针（R495/R496 harness） |
| `POST /api/auth/logout` | 0（含探针） |
| `POST /api/auth/merge_anon` 非 2xx | 0 |
| `/api/auth/*` 非探针 | 4 × `wxlogin 503`（R495 已析） |

## 2. 运行时一手（`~/r497_expire.py <375|1440> <scen>`、`~/r497_settings.py <375|1440> <auth|anon> [grant]`，`R497_BASE` 可指本地 dist；改前 `~/r497_prod_*.out`、改后本地 `~/r497_local_*.out`、改后生产 `~/r497_prod_post_*.out`）

harness：`chromium.connectOverCDP('http://localhost:29229')`，context `extra_http_headers={'X-Kg-Probe':'1'}`，`ctx.route('**/api/**')`：账号域读接口 fulfill 假数据（`profile` 180 题·国考 2026-11-29 / `checkin/badges` 连续 7 最长 12 解锁 2 / `inbox/unread` 3 / `stats` 180·70% / `checkin/summary` streak 7 / `heatmap` 102 次 7 格）；`EXP.on` 打开后，`EXP.only` 集合内的接口改返 `403 {detail:'无权访问该账号数据'}`（`expire401_*` 场景返 `401 {detail:'未登录或登录已过期'}`）；`auth/logout` 200（`*_logoutfail` 503）、`auth/login` 200、`auth/merge_anon` 200（`relogin_mergeauth401` 401）；匿名 uid 请求 fulfill 空数据；其余 abort。切页用 `.uni-tabbar__item` 文本点击。

### 2.1 自动清态语义（改前生产）

| 场景 | 触发 | 700 ms toast | `authToken` | `anonUid` | 页面字段（不切页） | reshow |
|---|---|---|---|---|---|---|
| `expire_stats` 375/1440 | 切回统计页，账号域 GET 403 | 登录已过期，请重新登录 | 清 | = `deviceAnonUid` | **KPI 180/70%/7、学习 102 次、亮格 7 留屏** | 全 0 |
| `expire401_profile` 375 | 切回个人页，`comments/inbox` 401 | 同上 | 清 | = `deviceAnonUid` | **180/25/7、连续 7 最长 12、徽章 2、3 条未读留屏** | 全 0 |
| `inpage_profile` 375 | 停留中点「每日目标」→ `POST profile` 403 | 同上 | 清 | = `deviceAnonUid` | **同上留屏**（`calls_after` 只有那 1 条 POST，无任何重拉） | 全 0 |
| `expire_fresh` 375 | 无 token 直达个人页，5 次 403 | — | 本无 | 不变 | 匿名态 | — |
| `relogin_mergeauth401` 375 | 退出 → 重登 → `merge_anon` 401 | 已登录，但本机记录合并失败；退出后重新登录会再次合并 | **仍在**（`r497tok2`） | = `user.uid` | — | — |

### 2.2 `authLogout()` 失败（`profile_logoutfail` 375，改前/改后生产各一跑）

`POST /api/auth/logout` 503 → toast「已退出登录」、账号卡「未登录 … 登录 / 注册」、`authToken/authUser` 清、`anonUid = deviceAnonUid`、`calls_after` 按匿名 uid `mistakes/checkin/badges/profile/…`；`errs` 仅 1 条 503 资源错。改前改后一致。

### 2.3 设置页 / 提醒设置项（改前生产 `~/r497_settings_{375_auth,375_anon,1440_auth,375_auth_grant}.out`）

| 项 | 375 登录态 | 375 匿名态 | 1440 登录态 |
|---|---|---|---|
| 个人页入口 `.wd-cell` | 46.9×329.3「学习提醒未开启」 | 同 | 48×512 |
| `docSW` | 360 | 360 | 1425 |
| `.set-row` ×3 高 | 56 / 57 / 56 | 同 | 同 |
| switch | 26×43.6 | 同 | 同 |
| **`.time-v`（picker 可点区）** | **15×51.1 → 开后 16×53.3** | 同 | **16×53.3** |
| 开 → storage / toast / warn | `remindOn=1 remindTime=20:30` / （denied 态无 toast）/ `default`：「需要开启浏览器通知权限…开启通知权限」 | 同 / 「已开启 · 每天 20:30 提醒」/ `denied`：「浏览器通知权限被拒绝…」 | 同匿名列 |
| 关 → toast / 时间行 | 已关闭提醒 / 回 dim | 同 | 同 |
| 离线推送（权限未授） | toast「需要通知权限才能推送」、`calls_push []` | 同 | 同 |
| `grant`（synthetic granted + subscribe 抛错） | toast「开启失败，请稍后再试」（stub，不判缺陷） | — | — |
| 返回 | `#/pages/profile/profile` | 同 | 同 |

改后（本地 dist 375 auth / 1440 anon；生产 375 auth）：`.time-v` `40×62.6`（initial）/ `40×65.3`（开后），`top` 122.4/123（1440 124）与行内垂直居中；其余全部逐值同改前。

## 3. 修法（`578d176`）

- `profile.vue` / `stats.vue`：`onLoad(){ this._onAuth = () => { const u = getAuthUser(); if ((u?u.uid:null) === (this.user?this.user.uid:null)) return; this.resetAccountState(); }; uni.$on('authChanged', this._onAuth); }`、`onUnload(){ uni.$off('authChanged', this._onAuth); }`；`resetAccountState()` = R496 清字段（profile `mistakeN/profile/growth/badgeInfo/inboxUnread`；stats `hmDays/svStreak/kmCov/examAttempts/examTarget/growth/reco/slStats`）→ `refreshAccountData()`；`doLogout()` 确认回调只 `authLogout()` + `clearAuth()` + toast。
- `reminders.vue`：`.time-v { …; min-height: 40px; display: inline-flex; align-items: center; padding-left: 24rpx; }`。
- 源锁：`logout-r496-account-state-refresh.test.js`（改写为 R496+R497：全部字段在 `resetAccountState` 内且先清后拉 / `doLogout` 不直调 loader / `authChanged` 监听按 uid 比对 / 同 uid 不重拉）+ `reminders-r497-picker-hitarea.test.js`（`.time-v` 仍是 picker 唯一子元素 / `min-height:40px` 用 px 且 `inline-flex` 居中不改 `27rpx` / `.set-row` 仍 `min-height:56px`）。

## 4. 发版（`~/r497_deploy.log`）

4-pre：`mem_avail=353MB disk_avail=5.5G(89%) load=0.45 other_builds=0 prunes=0`；compose 后台 rc=0，`StartedAt 2026-09-07T14:15:20.868Z`、healthy、restarts 0；6/6 接口 7/7 200；6b `index-Cqa6rqEs.js` gzip 126 KB ≤160；Lighthouse `/` perf 0.96 / a11y 1.00 / bp 1.00 / seo 1.00 / LCP 1397 / CLS 0.06；`/tiku/` 1.00 / 1.00 / 1.00 / 1.00 / LCP 951 / CLS 0。三个分包线上=本机 md5。

## 5. 取证自纠

- 根目录 `npx -y pyright` 报 121 errors——读不到 `backend/pyrightconfig.json`；正确门是 `cd backend && npx -y pyright app` → 0。
- `r497_post.sh` 里 `docker exec … echo $KG_GIT_REV` 输出空（容器内无该 env），revision 以 `/api/health` 的 `rev` 与 deploy 日志 poll 行为准。
- 改后复跑时 403 场景名是 `expire_profile`/`expire_stats`（不是 `expire403_*`），首跑用错名得到空场景输出（已删）。
- `expire_profile` 场景（切回个人页时 403）改前 `after` 已是 0——因为切回本身触发 `onShow → refreshAccountData()` 且 403 发生在其内部；能暴露命中的是 `inpage_profile`（不切页）与 `expire401_profile`（`comments/inbox` 401 在 `onShow` 拉取之后），统计页 403 场景则因 `load()` 早于账号域拉取而暴露。写用例时「清态发生在 onShow 之外」这一条件必须显式构造。

## 6. 如实说明

CDP 仿真非真机；本轮向生产**未发**任何真实登录/退出/合并/推送订阅/LLM 请求（全 mock，Caddy `logout 0`、`push_subs 0` 印证）；401/403 清态与 logout 失败在生产**从未对真人触发**；synthetic push 失败不算产品缺陷证据；picker 原生弹层未测；无 testing agent 录屏（未另行授权）。
