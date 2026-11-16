# R496：「退出 → 重登 → 再合并」运行时复验 + 个人页 / 统计页登录态·退出路径 375/1440 只读整页审——storage 语义 / 重登再合并 / 几何 / 弹窗 / toast 全过；命中「退出登录后账号派生数据（连续打卡、徽章、热力图、未读）留在屏上，要再切一次 tab 才回匿名态」→ 最小修（`f7ae2c7`），生产 `f281539` → `f7ae2c7`

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/profile/profile.vue` / `frontend-uni/src/pages/stats/stats.vue`（各新增 `refreshAccountData()` 收拢 `onShow` 里全部账号相关拉取；`doLogout()` 确认后 `clearAuth()` → 先清账号态字段 → `refreshAccountData()`，不再各自挑着重拉）、源锁 `frontend-uni/tests/logout-r496-account-state-refresh.test.js`（2 页 × 2 用例）。**不改**：`authLogout()` / `clearAuth()` / `setAuth()` 语义、`deviceAnonUid` 恢复路径、退出确认文案、toast 时机、后端任何文件、小程序端。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R495 容器（13:19:59Z 起）发版前 88 请求 → 本轮发版后新容器（13:44:32Z 起）32 请求，5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针 POST 0；`*_ask_click` 真人 0（探针 4 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；非探针 `mistakes/analysis` / `explain/stream` 0；probe=0 `answer_log` 53/2、growth 26/4；WAL 4,124,152 B 同字节；`umsacie7…` 0 回访、`umst3…` 仍只有 R493 那 84 请求无第二段作答；nudge `dismiss/fail/ok` 真人首行仍 0（三事件各 1 行全 R494 探针）；**登录分包 `pkgA-user-login.*.js` 非探针加载全历史 0 次**（R495 修的路径至今无人走到）。
2. **登录/退出链路生产触达（§1.1，Caddy 全历史 + DB）**：`POST /api/auth/logout` 全历史 **0 次**（含探针）——生产上从没有人（也没有探针）在 H5 退出过登录；`merge_anon` 全历史 1 次（探针 200）、非 2xx 0；`users` 16 行、有 token 的用户里若干无 `merged_anon` 行（08-04–08-08 早期账号，R495 已登记「覆盖不全」）；`/api/*?uid=u<digits>` 无 token 的账号域 403 共 70 次**全探针**（本轮 R495 harness 拿 mock token 落 stats 页读生产所致，非用户可见）。→ 本轮审的「退出 → 重登」是**可达未触发**路径（R484/R491/R495 同性质）。
3. **storage 语义运行时复验（verified，改前生产 bundle `index-gUxy9rlY.js`，CDP 375 探针头，`/api/**` 全 mock → 0 生产账号 0 库写入 0 LLM，§2.1）**：seed `anonUid=umr496…` → mock 登录 → `setAuth()` 落 `deviceAnonUid=umr496…`、`anonUid=u9496`、`authToken`；退出确认 → `POST /api/auth/logout` 1 次 → `authToken`/`authUser` 清空、**`anonUid` 恢复为 `deviceAnonUid`**；再登录 → `POST /api/auth/login` → 因 `anonUid(umr496…) !== user.uid(u9496)` 进合并分支 → **`POST /api/auth/merge_anon {anon_uid: umr496…}` 再次发出** → toast「本机记录已合并到账号」、`deviceAnonUid` 不变。R495 提示文案「退出后重新登录会再次合并」在运行时成立（375 改前 + 1440 改后各一跑）。
4. **几何 / 交互（§2.2）**：个人页 375 登录态账号卡「RR496 139****0000 · 记录多端同步中」、`退出登录` 329.3×44（top 1408）、`docSW 360`；1440 `docSW 1425` 无横向溢出；退出确认 modal 文案「退出后将回到本机匿名记录，账号数据仍保留在云端。」+ 取消/确定；toast「已退出登录」；退出后账号卡→「未登录 登录后错题、做题记录多端同步 登录 / 注册」。统计页 375 `退出` 55.7×42.2 / 1440 58×44，modal 文案「退出后本机回到匿名模式，账号数据仍保留在云端」，退出后顶部换回登录条「登录后错题与记录多端同步 登录/注册 ›」。均无缺陷。
5. **命中（verified，改前生产两页三视口）：退出登录后账号派生数据留在屏上**。个人页 375：退出后 `stats = ['0累计做题','0错题本','**7连续打卡**']`、`badgeHead = '当前连续 **7** 天 历史最长 **12** 天'`、`badgesUnlocked = **2**`、`讨论消息 **3 条未读**`——直到再切一次 tab（`after_reshow`）才全部归 0。统计页 375/1440：退出后 KPI `['0累计刷题','0%总正确率','**7连续打卡(天)**']`、375 热力图 `学习 **102** 次` / 亮格 **7**，同样要 reshow 才归 0。根因（源码）：`doLogout()` 只重拉了各自挑的一部分（个人页 `loadRemote()`；统计页 `load()/loadGrowth()/loadReco()/loadSlStats()`），`loadBadges()`/`loadInbox()`/`loadHeatmap()`/`checkin/summary`/`mastery`/`exam/attempts` 没重拉，而这些字段又不随 `user=null` 失效——退出后的 `calls_after` 里个人页缺 `checkin/badges`，统计页缺 `checkin/summary`/`predict`/`mastery/map`/`exam/attempts`（§2.3 表）。用户视角：点了「退出登录」、toast 说已退出、账号卡变匿名，但打卡天数/徽章/热力图/未读数还是账号的——与「退出后回到本机匿名记录」的确认文案自相矛盾；下一步若立刻去登录页用**另一个账号**登录，这些数字也会串一屏直到 onShow。
6. **修法（最小，§3）**：两页各抽 `refreshAccountData()` = `onShow` 里全部账号相关拉取（个人页 `getAuthUser / loadRemote / loadBadges / loadInbox`；统计页 `getAuthUser / pstats / loadHist / loadHeatmap / predict.load / loadGrowth / loadReco / loadSlStats / loadMastery / loadExamTrend / load`），`onShow` 只调它；`doLogout()` 确认后 `clearAuth()` → 清账号态字段（个人页 `mistakeN/profile/growth/badgeInfo/inboxUnread`；统计页 `hmDays/svStreak/kmCov/examAttempts/examTarget/growth/reco/slStats`）→ `refreshAccountData()`（此时 `anonUid` 已是 `deviceAnonUid`，全部按匿名身份重拉）。源锁：`onShow` 只调 `refreshAccountData()` 且后者覆盖全部 loader；`doLogout` 清字段在前、`refreshAccountData()` 在后、不再直接调任一 loader（改前 2 页 × 2 用例 4/4 红，改后 4/4 绿）。门：vitest 747（100 文件）/ eslint rc=0 / build rc=0；pytest 511 / ruff / pyright 0。
7. **发版 + 三点对照（§4）**：宿主 avail 5.5 G / load 0.28 / 无兄弟构建 / prunes 0，`--skip-build` 一次 rc=0；容器 `StartedAt 13:44:32.383Z` healthy 0 重启；`pages-profile-profile.DBA7R53k.js` / `pages-stats-stats.DDVB-96q.js` 线上=本机 md5（`2f28601e` / `6db3b725`）；7/7 200；perf `/` 0.99 / `/tiku/` 1.00 LCP 965 CLS 0。**生产改后**：个人页 375 退出后即 `['0累计做题','0错题本','0连续打卡']` / `当前连续 0 天 历史最长 0 天` / 徽章 0 / `讨论消息`（无未读）✓，`calls_after` 多出 `GET /api/checkin/badges`；统计页 375/1440 退出后即 KPI 全 0 / `学习 0 次` / 亮格 0 ✓，`calls_after` 多出 `checkin/summary`/`predict`/`mastery/map`/`exam/attempts`；1440 重登 → `merge_anon` 再发 + 「本机记录已合并到账号」✓；`errs 0`。本地 dist（375 profile/stats、1440 profile、375 relogin）逐值一致。
8. **登记不改**：① 个人页 `authLogout()` 不 await、统计页 `await authLogout()`——两页节奏不同但 `authLogout()` 自带 `.catch(() => {})`，退出接口失败对用户不可见、本机仍清态（语义即「本机退出」），不立项；② 401/403 自动清态路径（`api-policy.js` → `clearAuth()` + toast「登录已过期」）本轮只源码核未运行时复验；③ 退出确认文案两页措辞不一致（「回到本机匿名记录」vs「回到匿名模式」）纯文案，不动；④ 生产从未有人退出过登录（logout 0 次）——修的是可达未触发路径。

## 1. (c) 补量 / 到期项（`~/r496_post.sh` 远端 payload → `~/r496_post.out` 13:3xZ 发版前；`~/r496_post2.sh` → `~/r496_post2.out` 13:4xZ 发版后）

| 项 | 发版前（R495 容器 13:19:59Z 起） | 发版后（13:44:32Z 起） |
|---|---|---|
| 容器 | healthy / restarts 0 | healthy / restarts 0 |
| 宿主 avail / load | 5.5 G / 0.78 | 5.5 G / 0.58 |
| WAL | 4,124,152 B | 4,124,152 B（同字节） |
| app log Traceback | 0 | 0 |
| 请求数 | 88 | 32 |
| 5xx / assets404 / monitor / mpUA 异常 | 0/0/0/0 | 0/0/0/0 |
| 非探针非 bot / 非探针 POST | 0 / [] | 13 / []（§1.2 全为本机） |
| `*_ask_click` probe=0 | 0（探针 4） | 0 |
| `explain_cache qid` 非空/总 | 0/82 | — |
| 时政且 qid 非空 | 0 | — |
| `error_reason` ≥09-11 | 0 | — |
| probe=0 `answer_log` / growth | 53/2 · 26/4 | — |
| nudge dismiss/fail/ok probe=0 | 0（各 1 行探针） | — |
| 登录分包非探针加载（全历史） | 0 | — |

### 1.1 登录 / 退出链路生产触达（Caddy 全历史 `…-access*`，`Cf-Connecting-Ip` + `X-Kg-Probe` 判探针）

| 项 | 值 |
|---|---|
| `POST /api/auth/logout`（任何来源） | **0** |
| `POST /api/auth/merge_anon` | 1（探针 200）；非 2xx 0 |
| `POST /api/auth/login` 401 / `register` 200·400 / `sso` 401 | 1 / 2·2 / 4，**全探针** |
| `POST /api/auth/wxlogin` 503 | 非探针 4 + 探针 5（R495 已析） |
| `/api/*?uid=u<digits>` 无 token 403 | 70，全探针（R495 harness mock token 落 stats 页读生产） |
| `users` 行 | 16 |
| `growth_events` 含 `logout` 事件 | 0（无该埋点，本轮不加） |

### 1.2 发版后 13 条「非探针非 bot」逐条

全部 `Cf-Connecting-Ip = 140.232.64.4`（= 本机出口，`api.ipify.org` 一手）：13:44:58Z–13:45:03Z 12 条 `GET /api/{exam/resume,practice/resume,review/cur,announcement,home_bundle,daily_set,question_counts,questions}?uid=umtraltg9w200icoa` UA `moto g power (2022)` = 部署脚本 6b Lighthouse 移动仿真（新鲜 profile 的匿名 uid，UA 里**没有** `Chrome-Lighthouse` 字样所以没被 bot 规则截住）；13:46:06Z `GET /sw.js 304` UA `X11; Linux x86_64` = 本机 CDP 浏览器。**外部非探针 0**。

## 2. 运行时一手（`~/r496_logout.py <375|1440> <profile|stats|relogin>`，`R496_BASE` 可指本地 dist；改前 `~/r496_prod_{profile_375,stats_375,stats_1440,relogin_375}.out`）

harness：`chromium.connectOverCDP('http://localhost:29229')`，context `extra_http_headers={'X-Kg-Probe':'1'}`，`ctx.route('**/api/**')`：`auth/logout` 200、`auth/login` 200 `{token,user:{uid:'u9496',…}}`、`auth/merge_anon` 200、`auth/me` 200；账号域读接口 fulfill 假数据（`profile` 180 题 / `checkin/badges` 连续 7 最长 12 解锁 2 / `inbox/unread` 3 / `stats` 180·70% / `checkin/summary` streak 7 / `heatmap` 102 次 7 格）；匿名 uid 请求 fulfill 空数据；其余 abort。seed storage：`anonUid=umr496d…`、`authToken`、`authUser`（`{type:'object',data:{…}}` 包裹）。切页用 H5 TabBar `.uni-tabbar__item` 文本点击（CDP 页面里 `uni.switchTab` 不存在）。

### 2.1 storage 语义（`relogin`，375 改前 / 1440 改后）

| 步骤 | `anonUid` | `authToken` | `deviceAnonUid` | 请求 |
|---|---|---|---|---|
| seed（匿名） | `umr496d…` | — | — | — |
| mock 登录 `setAuth()` | `u9496` | `r496tok` | `umr496d…` | — |
| 退出确认 | `umr496d…`（恢复） | 清 | `umr496d…` | `POST /api/auth/logout` |
| 再登录 | `u9496` | `r496tok2` | `umr496d…` | `POST /api/auth/login` → `POST /api/auth/merge_anon {anon_uid:'umr496d…'}` Bearer r496tok；toast「本机记录已合并到账号」 |

### 2.2 几何 / 弹窗 / toast

| 项 | 375 | 1440 |
|---|---|---|
| 个人页 `docSW` | 360 | 1425 |
| 个人页账号卡（登录态） | 「RR496 139****0000 · 记录多端同步中」 | 同 |
| 个人页 `退出登录` | 329.3×44（top 1408.2） | （改后未量，改动不涉几何） |
| 个人页 modal | 「退出登录 退出后将回到本机匿名记录，账号数据仍保留在云端。取消 确定」 | 同 |
| 统计页 `退出` | 55.7×42.2（top 68） | 58×44（top 69） |
| 统计页 modal | 「退出登录 退出后本机回到匿名模式，账号数据仍保留在云端 取消 确定」 | 同 |
| toast | 「已退出登录」 | 同 |
| 退出后账号区 | 个人页「未登录 … 登录 / 注册」；统计页登录条「登录后错题与记录多端同步 登录/注册 ›」 | 同 |

### 2.3 命中：退出后屏上残留（改前 `after` vs `after_reshow`；改后 `after`）

| 页 / 视口 | 字段 | 改前 `after`（退出后立即） | 改前 `after_reshow`（再切 tab） | 改后 `after` |
|---|---|---|---|---|
| profile 375 | stats | `0 / 0 / **7连续打卡**` | `0 / 0 / 0` | `0 / 0 / 0` |
| profile 375 | badgeHead / unlocked | `连续 **7** 最长 **12**` / **2** | `0 / 0` / 0 | `0 / 0` / 0 |
| profile 375 | 讨论消息 | `**3 条未读**` | （无） | （无） |
| profile 375 | 退出后请求 | logout, mistakes, profile, growth, announcement | — | + `checkin/badges` |
| stats 375 | kpis | `0 / 0% / **7连续打卡**` | `0 / 0% / 0` | `0 / 0% / 0` |
| stats 375 | hmTotal / hmLit | `学习 **102** 次` / **7** | `学习 0 次` / 0 | `学习 0 次` / 0 |
| stats 1440 | kpis | `0 / 0% / **7**` | `0 / 0% / 0` | `0 / 0% / 0` |
| stats | 退出后请求 | logout, stats, growth, recommend, shenlun/stats, mistakes, review | — | + `checkin/summary`, `predict`, `mastery/map`, `exam/attempts`, `profile` |

## 3. 修法（`f7ae2c7`）

```js
// profile.vue
onShow() { /* 本机偏好读取不变 */ this.refreshAccountData(); },
refreshAccountData() { this.user = getAuthUser(); this.loadRemote(); this.loadBadges(); this.loadInbox(); },
doLogout → success(confirm):
  authLogout(); clearAuth();
  this.mistakeN = null; this.profile = null; this.growth = null; this.badgeInfo = null; this.inboxUnread = 0;
  this.refreshAccountData(); toast('已退出登录')

// stats.vue
onShow() { this.refreshAccountData(); },
refreshAccountData() { this.authUser = getAuthUser(); this.pstats = …; this.history = this.loadHist(); this.loadHeatmap();
  if (this.$refs.predict) this.$refs.predict.load(); this.loadGrowth(); this.loadReco(); this.loadSlStats(); this.loadMastery(); this.loadExamTrend(); this.load(); },
doLogout → success(confirm):
  await authLogout(); clearAuth();
  this.hmDays = this.svStreak = this.kmCov = this.examAttempts = this.examTarget = this.growth = this.reco = this.slStats = null;
  this.refreshAccountData(); toast('已退出登录')
```

取舍：不做「`authChanged` 事件驱动全页重置」（两页 `onShow` 已是唯一真源，抽方法复用最小）；不加 logout 埋点（本轮无观测诉求）；不改 `authLogout()` 失败静默（本机退出语义）。

## 4. 发版 + 三点对照

### 4.1 本地 dist（`python3 -m http.server 8796 --directory dist/build/h5`，`R496_BASE=http://127.0.0.1:8796`；`~/r496_local_{profile_375,stats_375,profile_1440,relogin_375}.out`）
四场景退出后立即全 0 / 徽章 0 / 未读清 / 热力图 0；relogin 再发 `merge_anon`。`errs` 仅本地 `/sw.js` 404（SKILL 已记噪音）。

### 4.2 部署（`~/r496_deploy.log`）
2b 谱系闸 OK（线上 `f281539` 是 HEAD 祖先）；4-pre `mem_avail=312MB disk_avail=5.5G load=0.28 other_builds=0 prunes=0`；compose rc=0，容器 `13:44:32.383Z`（R495 容器 13:19:59Z 存活 24.5 min）；4a 线上 rev `f7ae2c7`；6b perf 全过。

### 4.3 生产改后（`~/r496_prod_post_{profile_375,stats_375,stats_1440,relogin_1440}.out`）
见 §2.3「改后 `after`」列 + §2.1 1440 重登；`errs []`；分包 md5 线上=本机。

## 5. 如实 / 未验证 / 登记

- CDP 仿真非真机；`/api/**` 全 mock——退出/登录/合并接口在生产**未被真实调用**（本轮 0 生产账号 0 库写入 0 LLM）；生产 Caddy `logout` 0 次也印证 harness 未漏到生产。
- 「退出后立刻换另一账号登录会串一屏」为源码推断（改前 `after` 残留 + 登录页成功尾 `leave()` 到 stats/返回页才触发 `onShow`），未单独造用例。
- 401/403 自动清态（`api-policy.js`）与 `authLogout()` 接口失败两条路径本轮只源码核，未运行时复验；1440 个人页改后未复跑（改动不涉几何，375 改后已核）。
- 修的是生产从未触发的路径（logout 全历史 0）。
- 无 testing agent 录屏（未另行授权）。
- 取证自纠：发版后「非探针非 bot 13」首看像外部流量，逐条按 `Cf-Connecting-Ip` 对本机出口 IP 才确认是自家 Lighthouse（UA `moto g power (2022)` 无 `Lighthouse` 字样）+ CDP；bot 规则按 UA 截不住 Lighthouse 移动仿真，判归属要看 IP + 时刻对齐部署日志。

## 6. 脚本 / 输出

`~/r496_post.sh` → `~/r496_post.out`（发版前远端）；`~/r496_post2.sh` / `~/r496_post3.sh` → `~/r496_post2.out` / `~/r496_post3.out`（发版后）；`~/r496_logout.py` → `~/r496_prod_*.out`（改前生产）`~/r496_local_*.out`（改后本地）`~/r496_prod_post_*.out`（改后生产）；`~/r496_host.sh`；`~/r496_deploy.log`。
