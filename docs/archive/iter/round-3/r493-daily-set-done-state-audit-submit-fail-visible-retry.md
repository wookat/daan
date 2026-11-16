# R493：每日一练完成态只读整页审（375/1440，`daily_set` 假数据 mock）——命中「成绩提交失败 → 完成页仍报『打卡成功』、无任何重试入口、分享丢每日文案；首页补投成功后『已完成』要再切一次页才显示」→ 最小修（生产 `08a409d` → `c458a3e`）

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/practice/practice.vue`（完成页 `dailyErr` 失败行 + `sendDailyResult()` / `retryDailySubmit()`；分享每日分支条件放宽；`submitResult()` 复位）、`frontend-uni/src/api.js`（`flushDailySubmit()` 返回 `Promise<boolean>`）、`frontend-uni/src/pages/home/home.vue`（`syncDsDone()`：补投成功后即时刷新「已完成」外显）、源锁 `frontend-uni/tests/practice-r493-daily-submit-fail.test.js`（6 用例）。后端 0 改动，`/api/daily_set*` 协议不变。

## 0. 结论

1. **(c) 补量 / 到期项（§1）**：发版前 R492 容器 79 请求全本机/探针；发版后（12:05:52Z 起）165 请求，5xx / assets404 / monitor / Traceback 0；`*_ask_click` 真人仍 0 行（探针 3 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；H5 非探针 `mistakes/analysis` 仍 0（全历史 4 次全 W7）；非探针 `explain/stream` 0；WAL 4,124,152 B 同字节。
2. **本轮首次出现自然非探针作答增量（§1.2，verified Caddy + DB）**：11:56–12:02Z（我发版前 4–9 分钟）两个 uid 各答 10 题——`umsacie7…` H5 Windows Chrome（`141.11.46.189`，旧 bundle `v:DetvGgWg`）资料分析 10 题 **22 s**（2 s/题，6 对 4 错、4 条 `mistakes`）；`umst3…` W7 小程序（`223.83.2.218`）资料分析 grouped 10 题 **19 s**，其中同材料 5 题 5 s 内全选 B（4 对 1 错）、随后 `POST /api/pk/create` 1 次。probe=0 `answer_log` 33/1 → **53/2**、growth 20/4 → 26/4。**口径**：这是「非探针有写入」不是「真人在学」——1–2 s/题的资料分析作答是点过不是做过；两端同城同时段（R482 已见 `141.11.46.x` 与 `umst3` 分享者同城）推断为同一人两端点测，身份仍不确定。两会话 258 请求全 200/304，无 4xx/5xx；发版重启窗口（12:05:52Z）内 0 请求。都**没进每日一练**（`/api/daily_set` 只在首页被读，`submit` 0），`daily_set_entries` 仍只有 09-06 那 1 行探针。
3. **完成态一手量测（改前生产 bundle `index-DetvGgWg.js`，CDP 375×812 / 1440×900，`X-Kg-Probe: 1`，`/api/daily_set*` 全 mock、其它非 GET abort → 0 库写入，§2）**：进入/加载态/10 题作答/完成态几何（环 70%、`本组完成`、`dsbeat` 43.6 px、榜 10 行 281 px、三按钮 44×306 / 44×650）、已提交态「成绩已记录（首次 9 对）」、首位完成者「你是今天第 1 位完成者」+ 榜 1 行、榜失败仍显成绩、往期日期不提交不显每日行、长昵称 ellipsis、无横向溢出（`docSW 360 = vw−15`）、滚到底最后按钮 755 < 812、分享文案带日期/击败/连续天——**全部通过**。
4. **命中（两视口 verified，源码 + CDP）**：`markDailyDone()` 里 `submitDailySet().then(...)` 无 catch 分支；提交 5xx/断网时 ① toast 仍是「今日一练完成，打卡成功！」（toast 在提交前发出），② 完成页 `dailyStats` 为 null → `.dsbeat` 整行不渲染，用户看不出没上传、也**没有任何重试入口**，③ `shareResult()` 每日分支以 `dailyStats` 为条件 → 回落成普通练习文案「我在错题邦刷了 10 道行测题…」丢掉「每日一练/同题挑战」链接，④ 首页 `onShow` 里 `loadDailySet()` 与 `flushDailySubmit()` 并发，补投成功写 `dailyDone:<uid>` 时 `dsDone` 已按旧 storage 算完 → hero 仍显「今日全站同题 10 题 · 已有 36 人完成」，要再切一次页才变「已完成」（`fail2` 用例 `home` vs `home2`）。`dailyPendingSubmit` 的补投机制本身成立（回首页 `POST submit` 1 次 200 → pending 清、`dailyDone` 写）。与「练习 → 作答 → 成绩 → 分享/排行」闭环冲突点在：失败被当成功、且用户无法在当页自救。
5. **修法（最小，纯前端，§3）**：提交路径抽成 `sendDailyResult(payload)`（成功 → stats + 榜；catch → 仅在无 stats 时 `dailyErr = true`，榜失败不算）；完成页 `v-else-if="!beiMode && dailyErr"` 一行「今日全站同题 · 成绩上传失败，点此重试（回首页也会自动补传）」`role="button"`、`min-height 40px`、`#fef3c7/#b45309` 警示色，点它 `retryDailySubmit()` 只重投 **storage 里同日 pending payload**（不重新拼装成绩）；分享每日分支条件改 `_dailyDoneDate && (dailyStats || dailyErr)`、字段用 `ds = dailyStats || {}` 可缺；`submitResult()` 复位 `dailyErr`。`flushDailySubmit()` 返回 `Promise<boolean>`，首页 `flushDailySubmit().then(ok => ok && this.syncDsDone())`，`loadDailySet()` 也经 `syncDsDone()` 统一算 `dsDone`。**不改**后端幂等/协议、不加轮询、不改 toast 时机（提交前打卡语义是「本地已完成」，改成等提交会让离线完成也不出 toast）。
6. **改后一手（本地 dist → 发版 → 生产 375/1440 同脚本三点一致，§4）**：失败行 375 48×306（`fs 12.5px`）/ 1440 40×650，中心 + `y±19` 命中 ✓；点 → mock 再失败 → 失败行保留（`retry1 dserr 1`）；改 mock 成功再点 → `submit ok` + `push/pubkey` + `board ok` → 每日行「37 人完成 · 击败 64% · 🔥 已连续参与 3 天」+ 榜 10 行，pending 清、`dailyDone` 写；分享在失败态仍是「我完成了错题邦 2026-09-07 每日一练（全站同题 10 题），答对 7 题！同题挑战我：…daily=1&src=share」；`fail2`（提交挂起 → 回首页补投）首页 **首次 onShow 即**「今日全站同题 · 已完成 答对 7/10 · 第 12 名 · 🔥 连 3 天」（改前需 `home2`）；`ok` / `boardfail` 与改前逐项一致（榜失败不出失败行）。
7. **登记不改**：① CDP 上下文 `tabbar_top 0 / tabbar_h 0`（H5 TabBar 在此 context 不可量），375 安全区/TabBar 让位按 `last_btn_bot 755 < vh 812` 判、真机未核；② 「打卡成功」toast 在提交前发出，失败时用户仍先看到成功 toast 再看到失败行（产品取舍，见 5）；③ 往期日期完成不提交（`markDailyDone` 只在 `date === cnDay`）、不显每日行——符合后端「只收当日」契约；④ 每日一练自上线 `daily_set_entries` 仅 1 行探针、非探针 `submit/board` 全历史 0 → 本轮修的是**可达未触发**路径（R484/R491/R492 同性质）。

## 1. (c) 补量 / 到期项

### 1.1 `~/r493_post.sh`（远端 payload）→ 改前 `~/r493_post.out` / 改后 12:09Z `~/r493_post2.out`

```
改前：healthy restarts=0 started=2026-09-07T11:31:25.998Z（R492）  disk 3.4G  WAL 4,124,152 B
      caddy since start 79  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  Traceback 0
改后：healthy restarts=0 started=2026-09-07T12:05:52.498Z（R493）  disk 3.4G  load 1.04  WAL 同字节
      caddy since start 165  5xx 0  assets404 0  monitor 0  mpUA 5  non-probe non-bot 5（全部 58.17.104.21 umst3 小程序 GET reminders/badges/pk/growth/mistakes 200）
      track posts 0  Traceback 0
两次同：*_ask_click rows 3 全探针（book 1 / practice 2）  explain_cache qid 0/82  时政且 qid 非空 0 / 0  error_reason ≥09-11 0
变化：probe=0 answer_log 33/1 → 53/2   growth probe=0 20/4 → 26/4（§1.2）
daily：non-probe /api/daily_set 全历史 18 次全 GET（09-01 1 / 09-02 1 / 09-05 2 / 09-06 9 / 09-07 5）  submit/board 0
       daily_set_entries 1 行（2026-09-06 umtpnhrw… 3/10 probe=1）  growth daily_open probe=NULL 6/5 · probe=1 2/2 · probe=0 0
non-probe mistakes/analysis 全历史 4（09-06 21:41–21:42Z 全 MP）  H5 0
```

### 1.2 非探针作答增量逐请求（`~/r493_who.sh` → `~/r493_who.out`，Caddy 全文件 `Cf-Connecting-Ip` + DB）

| 时刻（UTC） | 端 / 出口 | 动作 | 判 |
|---|---|---|---|
| 11:56:46–48 | H5 Win Chrome `141.11.46.189` `umsacie7…` | 错题本 `mistakes/review/mastery` → 同秒 `attempts+notes+comments/count?question_id=234494`（列表展开卡指纹，R490） | 展开 09-05 那道错题卡 |
| 11:56:52 | 同 | `GET /api/question/234494` + `comments?sort=hot` + `track`（`boot h5 v:DetvGgWg`） | 进讨论/原题页；**无 `book_ask_click`、无 `explain/stream`** |
| 11:56:59–57:01 | 同 | `ask/sessions` GET → `POST ask/cur` | 问答页 TabBar 进出（0 提交，R489 同形态） |
| 11:57:20 | 同 | 首页全套（`comeback_view`） | |
| 11:57:32–57:56 | 同 | `questions?limit=10&real=1&region=国考&module=ziliao` → `answer_log` ×10 间隔 2 s，`mistakes` ×4 | **2 s/题资料分析 = 点过**（6 对 4 错） |
| 11:57:57 | 同 | `practice_result` + `push/pubkey` + track ×2（`login_nudge_show` / `push_nudge_show`） | 完成页；两个 nudge 首次对非探针 uid 显示 |
| 11:58:12–58:37 | 同 | 成长页（`heatmap_view`）→ 首页 | 此后 0 请求 |
| 11:59:38 | W7 小程序 `223.83.2.218` `umst3…` | 首页全套（含 `daily_set` GET） | |
| 11:59:42–12:00:01 | 同 | `questions real=1` → progress ×2 → `questions module=panduan` → progress | 两次开题未答（R477「切换」形态） |
| 12:00:05–00:28 | 同 | `questions grouped=1&module=ziliao` → `answer_log` ×10（后 5 题 22/23/24/25/26 s 全选 B）+ `mistakes` ×4 | **1 s/题同选项 = 点过** |
| 12:00:56–01:54 | 同 | 成长页 → 收藏/卷库/申论列表 → `POST /api/pk/create` 200 | 建了 1 个 PK |
| 12:08:21 | 同 uid，出口切 `58.17.104.21` | 5 个 GET（新容器） | 回访读，无写 |

258 请求全 200（2 条 304），发版重启 12:05:52Z 前后 12:01:54 → 12:08:21 之间 0 请求（部署窗口无人受影响）。`daily_set_entries` 无新增：两人都没开每日一练。

## 2. 完成态一手量测（改前生产 bundle，`~/r493_daily.py` → `~/r493_daily_{375,1440}_{ok,fail,already,first,boardfail,past,fail2}.out`）

方法：CDP 新 context（`X-Kg-Probe: 1`），先进 `/` 拿 uid；`ctx.route('**/api/**')`：`GET /api/daily_set` 回 10 题假数据（`id 9100xx`，日期 = 北京日 / `past` 用 09-01），`POST /api/daily_set/submit` 按模式 `ok`（37 人 / beat 64 / streak 3 / rank 12）/ `fail` 503 / `already` / `first`（`beat_pct null`）/ `fail2`（首次挂起 → 回首页后成功）、`GET /api/daily_set/board` 回 10 行（含 20 字长昵称）或 503（`boardfail`）；其它非 GET abort。写 `practiceLaunch {kind:'daily'}` 后 `goto #/pages/practice/practice`，`uni-button`（非原生 `button`）量热区，`Storage.setItem` 包一层记 pending / done。

| 项 | 375×812 | 1440×900 | 判 |
|---|---|---|---|
| 加载态 → 首题 `q1` / 10 题作答 `answer_log` abort | 可作答、`answers 10` | 同 | 通过 |
| 完成态：卡宽 / 环 `70%` / `本组完成` | 337 / 45.9×23 `19.2px` / 308×28 | 680 / 同 / 650 | 通过 |
| `.dsbeat` 每日行（ok） | 「37 人完成 · 击败 64% · 🔥 已连续参与 3 天」43.6 px `12px` | 29 px 单行 | 通过 |
| 排行榜：行数 / 高 / 长昵称 | 10 / 281.2 / `text-overflow: ellipsis` 单行 | 10 / 306 | 通过 |
| 三按钮 `再来一组 / 分享成绩 / 返回首页` | 44×306 ×3 | 44×650 ×3 | 通过（≥40） |
| 横向溢出 | `docSW 360 = vw−15`（滚动条） | 1425 | 通过 |
| 滚到底 | `sy 660 = max`，`last_btn_bot 755 < 812` | 505 / 843 < 900 | 通过（TabBar 不可量，§0.7） |
| `already`：已提交态 | 「成绩已记录（首次 9 对） · 37 人完成」26.6 px；首页「答对 9/10 · 第 3 名」 | — | 通过 |
| `first`：首位完成 | 「你是今天第 1 位完成者」；榜 1 行 67.8 px；分享无「击败」 | — | 通过 |
| `boardfail`：榜 503 | 每日行仍显「5 人完成 · 击败 50%」，榜 0 行、无错误 | — | 通过 |
| `past`：往期日期 | 不 `submit`、无每日行、普通分享文案、首页仍「已有 36 人完成」 | — | 通过（当日才计） |
| 分享（ok） | 「我完成了错题邦 2026-09-07 每日一练（全站同题 10 题），答对 7 题，击败全站 64%，已连续参与 3 天！同题挑战我：…?daily=1&src=share」 | 同 | 通过 |
| 返回首页（ok） | hero「今日全站同题 · 已完成 答对 7/10 · 第 12 名 · 🔥 连 3 天」，`home_calls` 无 submit | 同 | 通过 |
| **`fail`：提交 503** | toast「今日一练完成，打卡成功！」；`.dsbeat` **不渲染**；DOM 无任何重试元素；`pending` 有 / `done` 无；分享回落「我在错题邦刷了 10 道行测题…击败了 61%…」；回首页 `POST submit ok` → hero 已完成 | 同 | **命中 §3** |
| **`fail2`：提交挂起 → 回首页补投** | 首页首次 onShow hero 仍「今日全站同题 10 题 · 已有 36 人完成」，再切一次页（`home2`）才「已完成」 | — | **命中 §3（竞态）** |

截图（生产改后覆盖同名，改前数值以 `.out` 为准）：`~/r493_daily_{loading,q1,done,done_bottom,home}_{ok,fail,already,first,boardfail,past,fail2,retry,retry2}_{375,1440}.png`。

取证自纠：uni H5 按钮渲染为 `uni-button`，首版 `.card.done button` 选择器超时；剪贴板 hook 要在首个 page 创建前 `add_init_script`，事后加不生效（首版 `share null`）。

## 3. 根因与修法

### 3.1 改前

```js
// practice.vue markDailyDone()
uni.showToast({ title: '今日一练完成，打卡成功！' });          // 提交前
submitDailySet({...}).then((d) => { this.dailyStats = d; ... board ... });   // 无 catch
// 模板：<view v-if="!beiMode && dailyStats" class="beat dsbeat">…</view>    // 失败 → 整行消失
// shareResult(): if (this._dailyDoneDate && this.dailyStats) {…每日文案…} else {…普通文案…}
// home.vue onShow(): this.loadDailySet(); flushDailySubmit();              // 并发；dsDone 在 loadDailySet 回包时按旧 storage 算
```

`api.js submitDailySet()` 已先写 `dailyPendingSubmit` 再请求、成功清除，`flushDailySubmit()` 在首页补投——补投链路成立，缺的是**完成页上的可见性与自救入口**、分享文案、首页即时刷新。

### 3.2 改后（`c458a3e`）

- `practice.vue`：`markDailyDone()` → `this.sendDailyResult({uid,nickname,date,right,total,secs})`；`sendDailyResult(p)`：`dailyErr=false` → `submitDailySet(p).then(stats+board).catch(() => { if (!this.dailyStats) this.dailyErr = true })`；`retryDailySubmit()`：读 `dailyPendingSubmit`，`p.date !== _dailyDoneDate` 则清 `dailyErr` 直接返回，否则 toast「重新上传成绩…」+ `sendDailyResult(p)`；模板加 `v-else-if="!beiMode && dailyErr" class="beat dsbeat dserr" role="button" @click="retryDailySubmit"`；样式 `.dsbeat.dserr{display:flex;align-items:center;justify-content:center;min-height:40px;color:#b45309;background:#fef3c7}`；`shareResult()` 条件 `_dailyDoneDate && (dailyStats || dailyErr)`、`const ds = this.dailyStats || {}`；`submitResult()` 复位 `dailyErr`。
- `api.js flushDailySubmit()`：三个出口分别 `Promise.resolve(false)` / `submitDailySet(p).then(() => true).catch(() => false)`。
- `home.vue`：`flushDailySubmit().then(ok => { if (ok) this.syncDsDone() })`；`loadDailySet()` 回包后 `syncDsDone()`；`syncDsDone()` = `dsDone = done && done.date === dsMeta.date ? done : null`。
- 源锁 `tests/practice-r493-daily-submit-fail.test.js` 6 用例（失败行 + `min-height 40px`；`markDailyDone` 经 `sendDailyResult`；catch 仅无 stats 置错；`retryDailySubmit` 只重投同日 pending；`submitResult` 复位；分享条件；`flushDailySubmit` 布尔 + 首页 `syncDsDone`）。

门：vitest 97 文件 736 用例绿、eslint rc=0（首版 `no-regex-spaces` 改 ` {4}`）、`build:h5` 绿；pytest 510 / ruff / pyright 0。

## 4. 发版 + 改后一手

- 宿主：load 0.21、盘 3.9 G、无兄弟构建；`deploy_h5.sh --skip-build` 一次 rc=0（`~/r493_deploy.log`）：线上 rev `08a409d` 是本机祖先 ✓ → 容器 `StartedAt 12:05:52.498Z` healthy 0 重启 → 线上后端 rev `c458a3e` → bundle `index-DetvGgWg.js → index-hIYH9yMp.js` 本机一致 → 7/7 200 → perf `/` 0.99·1.00 LCP 1405 / `/tiku/` 1.00·1.00 LCP 928。分包 `pages-practice-practice.BcHHPZzW.js` / `pages-home-home.BYayApaM.js` 线上 = 本机 md5（`7eca6ee6…` / `bed48e27…`）。
- 三点对照（本地 dist `http.server 8765` `~/r493_daily_local_*.out` → 生产 `~/r493_daily_prod_{375_retry,375_fail2,1440_retry,375_ok}.out`，生产 bundle `index-hIYH9yMp.js`）：

| 项 | 375 | 1440 |
|---|---|---|
| 失败行文案 / 几何 | 「今日全站同题 · 成绩上传失败，点此重试（回首页也会自动补传）」48×306 `12.5px`，中心 + `y±19` 命中 | 40×650 |
| 点 → mock 再 503 | `retry1` 恰 1 次 submit，失败行保留 | 同 |
| 改 mock 成功再点 | `submit ok` → `push/pubkey` → `board ok`；每日行「37 人完成 · 击败 64% · 🔥 已连续参与 3 天」+ 榜 10 行；pending 清、`dailyDone` 写 | 同 |
| 失败态分享 | 「我完成了错题邦 2026-09-07 每日一练（全站同题 10 题），答对 7 题！同题挑战我：…daily=1&src=share」 | — |
| `fail2` 回首页 | 首次 onShow hero 即「已完成 答对 7/10 · 第 12 名 · 🔥 连 3 天」（改前需 `home2`） | — |
| `ok` / `boardfail` 回归 | 与 §2 逐项一致；榜 503 不出失败行 | — |
| 三按钮 / 横向溢出 / 滚到底 | 44×306 ×3 / 360 / 755 < 812 | 44×650 / 1425 / 843 < 900 |

## 5. 如实说明

- CDP 仿真非真机；TabBar 在该 context 高度 0，375 让位只能按最后按钮底 < 视口高判。
- 修的是真实流量 0 次触发的路径（`daily_set_entries` 1 行探针、非探针 submit 0）；生产本轮 0 次真实 `submit`。
- §1.2 两个非探针会话在我发版前 4–9 分钟出现，与发版无因果；「同一人两端点测」为推断（同城同时段 + R482 同 /24），身份不确定；1–2 s/题不构成学习行为证据。
- 生产验证脚本 `/api/**` 全 mock/abort，唯一到源站的是首页拿 uid 的探针请求；0 库写入、0 LLM。
- 无 testing agent 录屏（未另行授权）。
