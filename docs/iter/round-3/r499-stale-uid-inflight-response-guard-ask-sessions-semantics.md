# R499：「403 先到 / 退出先落地、旧 uid 回包后到」飞行竞态 5 页只读核 + 问答页 `askSessions` 账号失效后跨账号语义设计论证；命中 ①「个人页退出后飞行中的账号 `growth` 回包后到 → `180累计做题` 复现于匿名态」②「问答页退出后飞行中的账号 `ask/cur` + `ask/sessions` 回包后到 → 旧账号会话落到不分键的设备本地 `askCurSession/askSessions/askCurSid`，并被 `pushCurSession()` 以**匿名 uid** 回传远端」→ 最小修（`7c50b27`：`request()` 带 uid 的 GET 回包按当前身份守卫），生产 `cf95384` → `7c50b27`；ask-session 产品语义与后端 `merge_anon` 不改

日期：2026-09-07（UTC）。改动：`frontend-uni/src/api-policy.js`（`pathUid()` / `isStaleUidResponse()` / `isStaleUidErr()` 纯函数）、`frontend-uni/src/api.js`（`guardStaleUid()`：GET 回包到达时 query 里的 `uid` ≠ 当前 `anonUid` storage → 抛 `staleUid` 错、不交给调用方、不写 snap 缓存、不走网络回落；显式 `timeout` 的 GET 同样过守卫；`export { isStaleUidErr }`）、`frontend-uni/src/pages/home/home.vue` / `book.vue` / `stats.vue`（catch 首行 `isStaleUidErr(e)` → 静默 return，book 顺手 `loading=false`）、源锁 `frontend-uni/tests/api-r499-stale-uid-response.test.js`（9 用例，改前 HEAD 9/9 红）。**不改**：POST/PATCH/DELETE 语义、`setAuth/clearAuth`、`deviceAnonUid` 恢复、`ask.vue` 会话历史的设备本地语义、后端 `merge_anon` / `ask_sessions` / `ask_cur` 合并策略、小程序端。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R498 容器（14:40:54Z 起）至本轮发版共 68 请求；本轮新容器（15:22:02Z 起）34 请求；两窗口 5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针 POST 0；唯一「非探针非 bot」1 条 = `15:05:18Z GET / 403 redroid12_arm64` **直打源站、无 `Cf-Connecting-Ip`/`Cf-Ray`**（R388 无边缘头 403 规则命中的安卓模拟器扫描，不是真人）；`*_ask_click` 真人 0 → `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政且 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge `dismiss/fail/ok/click` 真人 0；`push_subs` 0；`umsacie7…` 12:00Z 后 0 回访、`umst3…` 84 请求全部在 12:00:01–12:00:47Z 那一段（无第二段）；登录分包 / 提醒分包 / `POST logout` 非探针全历史 0；非探针 `/api/auth/*` 仍只有 4 次 `wxlogin 503`；WAL 4,124,152 B 同字节；harness uid（`umr499d…` / `u9499`）在 `answer_log/mistakes/growth_events` **0 行**。
2. **5 页只读核（源码，§2）**：`profile/stats/home/book` 四个 tab 页在 R496–R498 后都有 `authChanged → resetAccountState()`，但 reset 只清**已到手**的字段并按新 uid 重拉——**对已在飞行中的旧 uid 请求无任何处理**：无 uid 比对、无请求代次、无 AbortController；旧回包 `.then()` 照样落到 `this.*` / `snapSave()` / storage。`ask.vue` 无监听且 `syncSessions()` / `restoreCurSession()` 的回包直接 `mergeAskSessions()` → `setStorageSync('askSessions')` / `adoptItems()` → `persistSession()` → 1.5 s 后 `pushCurSession()` 用**发送时刻**的 `anonUid()` 回传。后端 `owns_uid()` 只能挡「新发出的、无本人 token 的账号 uid 请求」，挡不住「发出时 token 还在、鉴权已过、响应后到」的请求（`authLogout()` 撤 token 发生在这些请求之后）。
3. **命中 A（runtime-confirmed，改前生产 bundle `index-Bj2b6Wo3.js`，CDP 375 探针头，`/api/**` 全 mock → 0 账号 0 库写入 0 LLM，§3.1 `profile_race`）**：seed 登录态 `u9499`（`pstats 28 题`、假 `mistakes total 25`、`summary streak 7`、`growth total.n 180`）→ 个人页 `/api/growth?uid=u9499` **挂起**（其它接口正常回）→ 屏上 `28累计做题 / 25错题本 / 7连续打卡` → 退出登录 → R496/R497 清态生效 `0/0/0`、`anonUid = deviceAnonUid`、匿名 `growth` 秒回 → **释放**账号 `growth` 200 → 屏上变 **`180累计做题 / 0错题本 / 0连续做题`**（`stat-c` 第三格标签亦被 `growth` 回包改写）→ 再切 tab 才回 `0/0/0`。即：用户已退出、屏上却显示别人（前账号）的累计做题。
4. **命中 B（runtime-confirmed，同法 §3.2 `ask_race`）**：问答页 `onShow` 发 `/api/ask/cur?uid=u9499` + `/api/ask/sessions?uid=u9499` 挂起 → 切「我的」退出 → 释放两个账号回包 → storage 落 **`askCurSid 777001`、`askCurSession` 1 条（`R499ACCT 账号态进行中问题`）、`askSessions` 1 条（`R499ACCT 账号态历史会话`）**，随后 **`POST /api/ask/cur {uid:"umr499d…"(匿名), sid:777001, items:[账号态 item]}`** 发出（harness abort，未到生产）→ 切回问答页 `msgs 1`、首条 `R499ACCT 账号态进行中问题`。即：旧账号的进行中会话被写进设备本地并**以匿名身份回传远端**——这不是「设备本地历史不分键」的既有语义（R498 §5 登记那条），而是账号数据经竞态**跨身份外泄到远端**。
5. **设计论证（§4）**：ask 会话历史「设备本地 + 远端按 uid 合并」的产品语义本轮**不改**——匿名 → 登录的迁移靠 `merge_anon` 一次性归并、退出回匿名后本机仍能看到自己在本机问过的东西，这是有意的（R491 §5 / R498 §5 已登记），也没有一手用户证据说需要按账号隔离。要改的只是「旧身份回包不得在新身份下落地」这一个技术契约，放在 `request()` 回包层一次性覆盖 5 页 + 全部带 uid 的 GET（比逐页加请求代次少改 30+ 处、且以后新页自动受益）。POST 不守卫：写请求的 uid 在发出时刻已定，服务端 `owns_uid()` 会拒非本人账号 uid；匿名 uid 写请求本来就属本机。`pushCurSession()` 那条「匿名 uid 携带账号 item」的 POST 在修后**不再产生**，因为其上游（旧 `ask/cur` 回包 → `adoptItems → persistSession`）已被守卫截断（§5.2 verified）。
6. **修（`7c50b27`）**：`isStaleUidResponse(path, curUid)` = query 有 `uid` 且 ≠ 当前 storage `anonUid`；`request()` 默认 GET 链路 `rawRequest → guardStaleUid → snapSave`（守卫在写快照之前，旧身份回包不进 snap；抛出的错文案不含「网络/超时」字样、`isNetErr` 为 false，不会走 `stale_fallback` 快照回落）；显式 `timeout` 的 GET `then(d => guardStaleUid(path, d))`。三个 tab 页有 toast/回落的 catch 首行 `if (isStaleUidErr(e)) return`（home 不走 `loadPlan/loadBadges/loadProfile` 回落；book 不走 `getCachedMistakes(旧uid)` 回落且 `loading=false`；stats 不置 `loadErr`/toast）；`profile.vue` 与 `ask.vue` 的相关 catch 均为静默注释 / `.catch(() => {})`，守卫抛错被自然吞掉，无需改。源锁改前 9/9 红。门 vitest 769 / eslint / build 绿；pytest 511 / ruff / `backend/` pyright 0。
7. **发版 + 改后一手（§5）**：宿主 avail 5.5 G / load 0.34 / 无兄弟构建，`--skip-build` 一次 rc=0；容器 `15:22:02Z` healthy 0 重启 `rev=7c50b27`；`index-Cx8gmCr9.js` + ask/book/home/profile/stats 五个分包线上=本机 md5；7/7 200；perf `/` 0.99 LCP 936 / `/tiku/` 1.00 LCP 956。生产改后 `profile_race` 375/1440：`after_release` **`0/0/0`**（改前 `180/0/0`）；`ask_race` 375：`after_release_storage` **`askCurSid/askCurSession/askSessions` 全空**、**无任何 POST**、切回问答页 `msgs 0`（改前 sid 777001 / 1 条 / 1 会话 / 1 条匿名 uid POST）；`errs []`。
8. 触达：生产 `POST /api/auth/logout` 全历史 0、账号域 401/403 非探针 0 → 竞态是可达未触发路径；修的价值在「以后第一个退出/换号的真实账号用户」不会把前账号数据留屏或回传。

## 1. (c) 补量 / 到期项（`~/r499_post.sh` → `~/r499_post.out`、`~/r499_post_b.sh` → `~/r499_post_b.out`、`~/r499_post2.sh` → `~/r499_post2.out`）

| 项 | 发版前（R498 容器 14:40:54Z→15:22Z） | 发版后（新容器 15:22:02Z 起） |
|---|---|---|
| 请求总数 | 68 | 34 |
| 5xx / assets404 / monitor / mpUA 异常 / Traceback | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| 非探针非 bot | 1（`15:05:18Z GET / 403`，UA `redroid12_arm64`，`remote_ip 221.239.90.67`，**无 Cf 头** = 直打源站扫描） | 0 |
| 非探针 POST | 0 | 0 |
| Caddy 401/403 | 仅上面那 1 条 403 | 0 |
| WAL | 4,124,152 B | 4,124,152 B |

DB（不变）：probe=0 `answer_log` (53, 2)；growth probe=0 (26, 4)；`explain_cache qid` nonnull/total (0, 82)；`error_reason` ≥09-11 0；`*_ask_click` probe=0 0；nudge dismiss/fail/ok/click probe=0 `[]`；harness 泄漏检查 `u9499`/`umr499*` 0 行。`umsacie728f4ghcv8` 12:00Z 后 0 请求；`umst3tuisd7lgzaka` 84 请求全在 12:00:01–12:00:47Z。push api 非探针全历史 2（curl + `umsacie7` 那次 `pubkey`）；auth api 非探针全历史 4（全 `wxlogin 503`）；auth POST 探针：`login 401 ×1`、`merge_anon 200 ×1`、`register 200 ×2`。

## 2. 5 页只读核（源码）

| 页 | 账号派生字段 | 带 uid 的 GET | `authChanged` | 旧 uid 回包落点 | 既有守卫 |
|---|---|---|---|---|---|
| `profile.vue` | `stats/badgeInfo/inbox/profile/growth` | `profile / checkin/badges / checkin/summary / inbox/unread / mistakes / growth` | 有（R497） | `this.*` 直接赋值，catch 全静默 | 无 uid / 代次 |
| `stats.vue` | KPI / heatmap / mastery / predict / attempts | `stats / heatmap / checkin/summary / mastery/map / predict / exam/attempts` | 有（R497） | `this.*` + `snapSave`；catch 置 `loadErr` + toast | 无 |
| `home.vue` | `plan* / profile / badgeInfo / svTodayN / dsDone` | `home_bundle`（快照）等 | 有（R498） | `this.*` + `snapSave`；catch 走 `loadPlan/loadBadges/loadProfile` 回落 | 无 |
| `book.vue` | `items/due/dueTotal/mastery*/resumeInfo` | `mistakes / review / mastery/map / review/cur` | 有（R498） | `this.*` + `setCachedMistakes`；catch 走 `getCachedMistakes(anonUid())` 回落 | `_loadSeq` 只防同 uid 重入，不比 uid |
| `ask.vue` | `sessions / curSid / results`（设备本地 storage） | `ask/sessions / ask/cur / review` | **无** | `mergeAskSessions → setStorageSync('askSessions')`；`adoptItems → persistSession → pushCurSession()`（1.5 s 后用当时 `anonUid()` POST） | 无 |

后端：`owns_uid()`（`auth.py`）对账号 uid 要求本人 token；`authLogout()` 先发 `POST logout` 再 `clearAuth()`——飞行中的账号 GET 在 logout 之前已过鉴权，回包合法且后到。401/403 触发的 `clearAuth` 场景下，同一失效 token 的兄弟请求同样被 403，**不会**出现「旧 uid 200 后到」（源码核）；忠实触发面是显式退出 / 换号。

## 3. 改前运行时（生产 bundle，`~/r499_race.py <375|1440> <profile_race|ask_race>`，探针头，`ctx.route('**/api/**')` 全 mock、账号 uid 的 `growth`/`ask/cur`/`ask/sessions` GET 用 Future 挂起、非 GET abort）

### 3.1 `profile_race` 375（`~/r499_prod_profile_race_375.out`）

| 步 | `stat-c` | `acct` | `ls` |
|---|---|---|---|
| before | `28累计做题 / 25错题本 / 7连续打卡` | `R499 139****0000 · 记录多端同步中` | `anonUid u9499`，token 有 |
| mid_after_logout | `0累计做题 / 0错题本 / 0连续打卡` | `未登录 …` | `anonUid = deviceAnonUid`，token 无 |
| **after_release** | **`180累计做题 / 0错题本 / 0连续做题`** | `未登录` | 同上 |
| after_reshow | `0 / 0 / 0` | `未登录` | 同上 |

### 3.2 `ask_race` 375（`~/r499_prod_ask_race_375.out`）

| 步 | hash | msgs | storage |
|---|---|---|---|
| before | `#/pages/ask/ask` | 0 | ask* 全空 |
| mid_after_logout | `#/pages/profile/profile` | 0 | 全空 |
| **after_release_storage** | profile | — | **`askCurSid 777001`、`askCurSession` 1 条 `R499ACCT 账号态进行中问题`、`askSessions` 1 条 `R499ACCT 账号态历史会话`**；随后 **`POST /api/ask/cur {uid:"umr499d…", sid:777001, items:[账号 item]}`** |
| **after_back_to_ask** | `#/pages/ask/ask` | **1** `R499ACCT 账号态进行中问题` | 同上 |

## 4. 设计论证：ask-session 跨账号语义 vs 旧回包契约

| 候选 | 触及面 | 本轮取舍 |
|---|---|---|
| A. 不改码，登记 | — | 否：命中 B 已 runtime-confirmed 会把账号数据以匿名 uid 回传远端 |
| B. `ask.vue` 加 `authChanged` 监听清本地 ask storage | 改产品语义（退出后本机历史消失），与 R491/R498 登记的设备本地语义冲突，且**挡不住飞行中回包**（清完之后回包照样落） | 否 |
| C. 逐页请求代次 / AbortController | profile/stats/home/book/ask 30+ 处 `.then`，新页易漏 | 否（面大） |
| D. **`request()` GET 回包层按当前 `anonUid` 守卫** | `api.js` 一处 + 三页 catch 首行 | **采用**：所有带 uid 的 GET 一次覆盖，POST 不动 |
| E. 后端 `merge_anon` / ask 表按账号分键 | 服务端合并策略、迁移 | 否：无一手用户证据要求账号隔离；命中 B 的外泄源头在客户端回包落地，D 已截断 |

D 的边界（如实）：① 只对 **query 带 `uid=` 的 GET** 生效，POST body 带 uid 的写请求不守卫（写请求 uid 发出时已定，服务端 `owns_uid()` 兜底）；② 守卫比对的是**回包到达时刻**的 storage `anonUid`，若用户退出后又在回包到达前重新登录同一账号，回包会被视为当前身份放行（正确）；③ 不带 uid 的 GET（`announcement`、`questions` 无 uid 变体）永不判旧；④ `snapPeek` 读取到的历史快照仍是按 path（含 uid）分键，旧 uid 快照不会被新 uid path 命中。

## 5. 修后一手

### 5.1 本地门

vitest 103 文件 769 用例绿（新 9 用例改前 HEAD `git stash` 下 9/9 红）；eslint 0；`build:h5` 成功 `index-Cx8gmCr9.js`；pytest 511；ruff 0；`backend/` pyright 0。

### 5.2 发版（`~/r499_deploy.log`）与生产改后

宿主预检 avail 5.5 G / load 0.34 / 无兄弟 build；`./deploy/deploy_h5.sh --skip-build` rc=0；容器 `2026-09-07T15:22:02.074Z` healthy 0 重启；`/api/health {"ok":true,"rev":"7c50b27"}`；`index-Cx8gmCr9.js 1e78280b` 与 ask `318c757a` / book `313fb0c1` / home `5058ed7c` / profile `5a6539f2` / stats `12c6d423` 线上=本机；7/7 200；perf `/` 0.99·1.00·1.00·1.00 LCP 935.88 CLS 0.06 / `/tiku/` 1.00·1.00·1.00·1.00 LCP 956.31 CLS 0.00。

| 用例 | 改前生产 | 改后生产 |
|---|---|---|
| `profile_race` 375 `after_release` | `180累计做题 / 0错题本 / 0连续做题` | **`0累计做题 / 0错题本 / 0连续打卡`**（`~/r499_prod_post_profile_race_375.out`） |
| `profile_race` 1440 `after_release` | 未跑 | **`0 / 0 / 0`**（`~/r499_prod_post_profile_race_1440.out`） |
| `ask_race` 375 `after_release_storage` | sid 777001 / cur 1 / sessions 1 / **匿名 uid POST 1** | **全空 / POST 0**（`~/r499_prod_post_ask_race_375.out`） |
| `ask_race` 375 `after_back_to_ask` | `msgs 1` 账号态问题 | **`msgs 0`**，`askSessions []` |
| `errs` | `[]` | `[]` |

## 6. 登记（不改）

- ask 会话历史设备本地 + 远端按 uid 合并、不随账号切换清除：既有产品语义，等有真实账号用户后再看是否要「按账号隔离」。
- POST/PATCH/DELETE 不做身份守卫；`pushCurSession()` 仍在 1.5 s 后用发送时刻 `anonUid()`（正常场景本机数据归本机，正确）。
- 401/403 自动清态场景不存在「旧 uid 200 后到」（同 token 兄弟请求同样 403），未造用例。
- `stale_fallback` 快照回落只在 `isNetErr` 时触发，守卫错不会误入；未观测生产 `stale_fallback` 增量。
- 如实：CDP 非真机；0 真实登录/退出/合并/问答写入/LLM；`ask_race` 1440 未跑（守卫在 `api.js`，与视口无关；profile 1440 已复跑）；harness 的 `POST /api/ask/cur` 被 abort、未到生产（Caddy 非探针 POST 0 印证）；无 testing agent 录屏（未另行授权）。
