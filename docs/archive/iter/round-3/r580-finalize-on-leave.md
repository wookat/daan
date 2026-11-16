# R580 · 全部答完停在末题反馈态就离开（顶栏/浏览器返回、页内退出）→ 这一组被静默丢掉：不落成绩、每日一练不打卡 —— 视同完成（`finalizeIfAnswered`，H5 only）；R579-2 两出口语义论证不改

分支 `devin/1789041045-r580-finalize-on-leave`（从 #758 分支开，链含 #742–#758）；**H5 only，0 后端，小程序不动**。

## 结论（先讲）

1. **R579-2 论证结论：顶栏返回 ≠ 页内退出，不强行统一。** 一手核 R563 设计（`quit()` 只挂页内「退出」按钮与骨架/完成页「返回」；uni-h5 顶栏返回 `onPageHeadBackButton → navigateBack → removePage → onUnload`，浏览器 Back 走 `history.listen direction==='back' → removeCurrentPages → onUnload`），两条出口都**不丢进度**（每答一题 `saveSession()` 已落盘 + `pushPracticeProgress` 节流上送），差别只是页内退出多一层「保留 / 结束 / 继续」选择。把顶栏返回也拦成退出层要 hook `onBackPress`（H5 不支持）或劫持运行时，收益只是多问一句 → **不改**。
2. **但核两出口时坐实一条真实丢数据缺陷（本轮实修）**：10 题全部答完、停在第 10 题反馈态没按「完成」就离开（顶栏返回 / 浏览器 Back / 页内退出图标）——基线 `leave(false)` 只做 `removeStorageSync('pendingSession') + clearServerProgress()`，`onUnload()` 什么都不做，`submitResult()` 只在「完成」按钮 / 自动完成里调 → 这一组**不落 `practice_results`、每日一练不打卡（`daily_set/submit` 不发）、首页 hero 仍「来做今天第 1 人」、续练卡也没了**（本机 + 远端快照都被清）。`quitSummary()` 对全答完返回 `null`，所以页内退出也不弹层、直接 `leave(false)`，三条出口同一结局。每日一练答错最后一题想看解析再返回是最常见的离开时刻。
3. 实修：`finalizeIfAnswered()`（有会话 / 非模考 / 非背题 / 非时政 / `allAnswered(items)`）→ `markDailyDone(true)` + `submitResult(true)`，挂在 `leave()` 开头与 `onUnload()`；`resultSent` 作幂等闸（`leave → onUnload` 二次触发不重复上报）；`submitDailySet` 同 `(date, uid)` 在途去重（离页后首页 `onShow` 立刻补投与在途 POST 重叠时复用同一 Promise）；往期补练不打今日卡。
4. 生产复验：375 A（顶栏返回）/ B（页内退出图标）/ E（浏览器 Back）/ C（中途 1/10 退出层语义不变 + 自然完成不重复上报）/ D（往期补练不打卡）+ 1440 见下表。**fin11 一轮 B/E 的 FAIL 是宿主级**：`practice_result` / `daily_set/submit` 在离页那刻已发出（`sent` 有记录），宿主 ≈60s 无回包（同刻 E 收到 4 条 503），harness 硬 reload 把在途请求 `ERR_ABORTED`；服务端只读对账 B 的 `answer_log 10 / daily_set_entries 1` 落了、`practice_results` **丢**，E 三者全落（服务端已处理、客户端才 abort）。换 uid 重跑（fin12）B/E 25/25 PASS。
5. R580 研究项（375 走查往期每日一练 / 错题重练**中途**退出的恢复落点，`resumeIndex` 同函数）：P-0…P-6 / R-pre…R-5 **全 PASS**（本机 + 远端两路都落其后第一道未答题、顶栏「往期每日一练 · 2026-09-09」/「错题重练」、放弃后无续练卡）——R579 挂账的两条 UNTESTED 升级为生产实拍。
6. 自然样本：`practice_results` 非探针 288 行里 **287 行 `uid` 为空**（`uid` 列是后加的，历史上不送），无法与 `answer_log` 按 uid 对账得出「答满 10 题却无成绩」的自然发生率——**只登记，不据此定量**；ec8206e5 后 `practice_progress(daily/redo)` / `stale_fallback` / `merge_anon` 窗内仍 0 新增。

## 研究（一手；`~/r580/walk.py` 走查、`~/r580/probe_relaunch.py` 生命周期探针、`~/r580/q580*.sh` 只读 SQL）

### 宿主 / health

- `load 15–28`、`mem_avail 94–300MB`（total 1935）、`disk 88–89%`；health `200 0.2–3.1s`，fin11 窗口 ≈60s 无回包 + 4×503；后端 rev 全程 `ec8206e5`。未 kill、未叠 build。

### 两出口的运行时路径（读线上 `index-*.js` 反查 uni-h5 runtime）

- 顶栏返回：`onPageHeadBackButton()` → 栈 1 页 `uni.reLaunch({url:'/'})`，否则 `uni.navigateBack({from:'backbutton'})` → `removePage()` → `invokeHook(pageVm, ON_UNLOAD)`。
- 浏览器 Back：`history.listen((_to,_from,info) => info.direction==='back' && removeCurrentPages(|delta|))` → 同上 `onUnload`。**同 Document 只改 hash 的伪导航**（探针第一版）会让 vue-router 的 `direction` 不是 `back` → 不 removePage → `onUnload` 不触发，这是 harness 现场问题不是产品行为（改 `about:blank` 冷加载 + 首页 CTA 真 `navigateTo` 后 `trace ['hook:onUnload', ...]` 命中）。
- 页内退出：`quit()` → `quitSummary(items, eligible)`；已答 0 或全答完返回 `null` → 直接 `leave(false)`；部分已答 → R563 三选项层 → `quitPick(keep)` → `leave(keep)`。

### 基线行为（`f260a702`，修前）

```js
leave(keep) {
  if (!this.beiMode && this.items.length) this.logAttempts(this.items);
  ...
  if (keep) { pushPracticeProgress(); }
  else { uni.removeStorageSync('pendingSession'); clearServerProgress(); }
  ...
}
onUnload() { /* 只拆 H5 keydown 监听 */ }
```

全答完 → `pendingSession` 与远端 `practice_progress` 都被清，`practice_results` / `daily_set/submit` 不发；`answer_log` 每答一题已单发（`logAttempts([this.cur])`），所以**作答记录/错题本在，成绩、打卡、练习历史、全站榜单没有**。

### 中途退出恢复落点走查（研究项，`run375e.log`，uid `test-r580-v375e`）

| 场 | 步 | 结果 |
|---|---|---|
| 往期每日一练（`补练往期 › 2026-09-09`） | 答 1 题停反馈态 → 顶栏返回不经退出层落首页 → 续练卡「往期每日一练 · 2026-09-09 · 已做 1/10」→ 继续落 2/10 无反馈选项可点 → 删本机两键 F5 → 远端卡同文案 → 恢复落 2/10 → 放弃 → 无续练卡 | P-0…P-6 **7/7 PASS** |
| 错题重练（错题本「错题重练」入口卡） | 同序列；顶栏返回落 `/pages/book/book`（栈内上一页）；卡「错题重练 · 已做 1/10」；本机/远端落 2/10 | R-pre…R-5 **7/7 PASS** |

## 论证：为什么改、改哪里

- 用户可感知：答完 10 题（每日一练尤甚）返回首页，hero 仍「今日全站同题 10 题 · 来做今天第 1 人」，打卡/连续天数/全站排名/练习历史全无，且续练卡也没了——**用户以为做完了，产品当他没做**。与「完成」按钮只差一次点击，语义上就是完成。
- 备选 ① 顶栏返回/浏览器 Back 也拦成退出层：H5 无 `onBackPress`，要劫持运行时；且退出层三选项对「已全答完」没有意义（保留什么进度？）。② 全答完自动进完成页：改变 R558「答错停留看解析」的既有语义（用户主动停在反馈态）。③ **离页那刻视同完成**：不改任何页内交互，只补数据落地，三条出口同一函数 → 选 ③。
- 边界：模考（`examMode` 有自己的交卷）/ 背题（无成绩）/ 时政（`_shizheng` 无 practice_result）排除；`items` 为空或任一题无 `_picked` 不算；`resultSent` 已 true（自然完成后再离页）不重复；往期补练 `_dailyPast` 只落成绩不打今日卡（R557 语义）。
- `silent` 语义：`submitResult(true)` 只做数据（`practiceHistory` / `practice_result` / `logAttempts` 补报 / 清本机+远端快照），跳过完成页才有的 `syncRedoReviews` / `loadDueReview` / `initPushNudge` / `login_nudge_show` 埋点；`markDailyDone(true)` → `sendDailyResult(payload, silent)` 不在已卸载页面上摆榜单。
- 幂等：`leave()` 先 `finalizeIfAnswered()` 再 `navigateBack` → 运行时 `removePage` 又触发 `onUnload → finalizeIfAnswered()`，第二次被 `resultSent` 闸掉；`logAttempts` 先标 `_logged` 再发，`leave()` 里那次与 `submitResult` 里那次不重复。payload 全部在首个 `await` 之前同步取值，随后 `leave()` 清 `items/session` 不影响（单测锁）。
- 首页外显：离页后首页 `onShow` 立刻 `flushDailyPending()` 与练习页在途 `daily_set/submit` 重叠 → `submitDailySet` 同 `(date, uid)` 共用一个在途 Promise；结清后 `syncDsDone` 刷新 hero（不刷新也切完成态，B-3c/E-3c 断言）。

## 实修（3 个提交）

- `026a2090` `frontend-uni/src/pages/practice/practice.vue`：新 `finalizeIfAnswered()`；`submitResult(silent)` / `markDailyDone(silent)` / `sendDailyResult(payload, silent)` 加 silent 分支；`leave()` 开头调、`done` 时不再重复清快照；`onUnload()` 调。`frontend-uni/src/quit-summary.js`：新纯函数 `allAnswered(items)`。
- `ce51309f` `frontend-uni/src/api.js`：`submitDailySet` 同 `(date, uid)` 在途去重；首页 `flushDailyPending` 结清即 `syncDsDone`。
- `13223574` `frontend-uni/tests/r580-finalize-on-leave.test.js`：`allAnswered` 六例 / `finalizeIfAnswered` 门槛与调用顺序源锁 / `leave()`、`onUnload()` 接线 / silent 早退 / payload 首个 `await` 前取值 / `resultSent` 幂等 / `submitDailySet` 在途去重（真跑）；`r563-fix-quit-sheet` / `r553-fix-loading-reviewed` 精确源锁随行调整。

## 本地门

H5 `vitest 198 文件 1553` / `npm run lint` 0 error（20 warn 为存量页面）/ `build:h5` OK（`index-eO1hqVT6.js`）；`git diff --check` 空；0 后端、小程序不动。

## 发版 / 生产复验 / 清理

### 发版（0 后端 → 只发 Pages 静态层，`~/r580/pages_deploy.sh`）

`index-BYl-YCS-.js → index-eO1hqVT6.js`，preview `https://a08115cb.kaogong-h5-zalize.pages.dev`；线上 bundle 与本机构建 SHA 一致；health 前后均 `ec8206e5`。

### 生产复验（`~/r580/walk580b.py <uid前缀> <宽> <场次>`，连既有 Chrome CDP，每场独立新 uid + `about:blank` 冷加载，`X-Kg-Probe: 1`）

每场：首页 CTA 进每日一练 → 全部反选答错 10 题停在第 10 题反馈态（断言 `10/10`、选项禁用、未进完成页、`pendingSession` 已清 [每答一题即写，第 10 题答完 `saveSession` 见全答完不再写]、离页前 `practice_result`/`daily_set/submit` 0 次）→ 按场次离开 → 断言。

| 场 | 离开方式 | 375 | 1440 |
|---|---|---|---|
| A | 顶栏返回 | fin10 **14/14**、fin11 **14/14** | 见 fin13 |
| B | 页内退出图标（`quitSummary` 全答完 → `null` → 不弹层） | fin11 宿主级 FAIL（见下）→ fin12 **全 PASS** | 见 fin13 |
| E | 浏览器 Back（`history.back`，direction=back） | fin11 宿主级 FAIL → fin12 **全 PASS** | 见 fin13 |
| C | 中途 1/10 页内退出 → R563 三选项层仍弹 → 保留进度落首页、无 `practice_result` → 续练卡 1/10 → 续练答完 → 末题有「完成」→ 自然完成进完成页 → `practice_result` 恰 1 次 → 完成页顶栏返回不重复上报 | fin11 **8/8** | — |
| D | 往期补练（`补练往期 › 2026-09-09`，快照 `daily.past=true`）10 题全答停末题 → 顶栏返回（栈 1 页 → `reLaunch('/')`）→ `practice_result` 恰 1 次 200、**`daily_set/submit` 0 次发出**、首页 hero 仍未完成态、无 `dailyDone/pendingDaily`、`pendingSession` 已清 | fin9 **9/9** | — |

A/B/E 逐条断言（fin10/fin12）：离页无退出层落首页；`POST /api/practice_result` 恰 1 次 200；`POST /api/daily_set/submit` 恰 1 次 200；`answer_log` 补报无 4xx/5xx；本 uid `answer_log` 累计恰 10 条 items（`leave`/`submitResult` 两处 `logAttempts` 不重复）；**不刷新**首页 hero 已切「今日全站同题 · 答对 0/10 · 第 1 名」；冷 reload 后同；本机 `pendingSession` 已清、`dailyDone` 已写(total 10)、`dailyPendingSubmit` 已结清、`practiceHistory +1`。API 非 2xx 0、`requestfailed` 0、console error / pageerror 0（fin10 70 API、fin12 143 API）。

#### fin11 B/E FAIL 的定性（宿主级，非应用路径）

- 客户端 `sent` 记录：B `daily_set/submit` + `practice_result` 于 `t=…918.1` 发出（页内退出后 0.1s 内）、E 于 `…016.6`（Back 后）——**`finalizeIfAnswered` 三条出口都触发了**。
- 之后 ≈57s 无任何回包；E 同窗口收到 `track/progress/answer_log/mistakes` 4×503（宿主 `load 20 / mem_avail 94–241MB`）；harness 第 4 步 `pg.reload()` 把在途请求全部 `net::ERR_ABORTED`（含两条目标 POST）。
- 服务端只读对账（`q580l.sh`）：B `answer_log 10/10、daily_set_entries 1（reload 后 `dailyPendingSubmit` 重投落地）、practice_results 0`；E `answer_log 10、daily_set_entries 1、practice_results 1`（服务端已处理、客户端才 abort）；两者 `practice_progress` 均已清。
- 结论：应用路径正确；B 的成绩丢在「宿主 60s 不回 + 硬 reload」上，且暴露**既有设计**：`practice_result` 无本地 pending 重投（每日一练有 `dailyPendingSubmit`），登记 R580-1。harness 改 `wait_posts secs 25→75`，换 uid 重跑 fin12 B/E 全 PASS。

### 清理（`~/r580/clean580.py ro → clean → ro`，三次独立 SSH）

前一批（研究 + fin…fin10）：ro1 20 uid / 7 表 428 行（`mistakes 174 / answer_log 176 / growth_events 56 / practice_results 9 / daily_set_entries 6 / practice_progress 6 / review_log 1`）→ clean 回执逐表相等 → ro2 `hits {}`、前缀 `test-r580-%` 0、共享 `test-r562-modal-%` 42、10 张保护表计数/digest 不变。

后一批（fin11 / fin12 / fin13，`~/r580/clean_ro3.out → clean_clean2.out → clean_ro4.out`）：ro 9 uid（`fin11-a/b/c/e`、`fin12-b/e`、`fin13-a/b/e`）/ 5 表 218 行（`mistakes 88 / answer_log 90 / growth_events 24 / practice_results 8 / daily_set_entries 8`——`practice_results` 8 = 9 uid 减 fin11-b 服务端未落那一条；`daily_set_entries` 8 = 减 fin11-c 普通场）→ clean 回执逐表相等 → ro `hits {}` / `uids []`、前缀 0、共享 42、10 张保护表（`users 16 / questions 156792 / answer_log 1406 / question_favs 8 / mistakes 342 / growth_events 992 / explain_cache 83 / paper_exports 38 / daily_set_entries 2 / practice_results 297`）计数与 digest 前后一致。

> 教训：脚本要**经 SSH stdin 在宿主上跑**（`ssh … 'sudo -n python3 -u - ro' < clean580.py`），本机直跑 `unable to open database file`（库在宿主 Docker volume）不是「已清理」。

## 登记

- **R579-2** → 论证**不改**：顶栏返回/浏览器 Back（默认保留进度）与页内退出（三选项层）语义可并存，全答完场景由本轮 `finalizeIfAnswered` 统一兜住。
- **R580-1（P3，既有设计）** `POST /api/practice_result` 发后即忘，无本地 pending 重投；宿主慢 + 用户随即刷新/关页会丢成绩（完成页路径同样）。补重投需服务端幂等键（fin11 E 证明「客户端 abort、服务端已处理」真实发生，裸重投会重复计成绩）→ 下一轮先设计。
- **R580-2（观察，未究因）** `practice_results` 非探针 288 行 287 行 `uid` 空（列后加），无法按 uid 对账自然发生率；最近一条 `2026-09-07 20:00:28 uid=NULL ziliao 10/6` 与同秒 `umsacie728f4ghcv8 ziliao 10/6` 疑似同一提交双写，只登记。
- UNTESTED：小程序端全答完离页语义（`practice.ts` 未改，R536-1 真机累计）、1440 C/D、真实跨设备、模考/背题/时政排除分支（仅源锁）、真实 SW/offline、其它浏览器；宿主级 503 窗口内的重试行为。
