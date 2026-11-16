# R542（2026-09-08，实现轮·小程序端 主循环「练习 → 作答 → 复习推进」段）：练习页消费 `/api/answer_log` `reviewed` + 上送 `mid`

> SOP-04。0 服务端改动、0 H5 改动、**无 VPS 发版**（生产仍 `74a5d62a`）；小程序源码改动经本地全绿 + 本地 `:8525` 真接口一手，**未上真机 / 未在微信开发者工具跑**（R536-1 上传通道缺口仍在，Linux 会话无通道）。

## 1. 差距（一手）

R541 收口了「复习页第 6 次答对」的掌握反馈。同一主循环还有一条推进 SRS 的路径：**任意场次**答对曾错题时 `/api/answer_log` 服务端统一推进（R371）。对照两端练习页：

| 项 | H5 `pages/practice/practice.vue` | 小程序 `pages/practice/practice.ts`（改前） |
| --- | --- | --- |
| answer_log 项带 `mid`（mistakes.id） | 有（`api.js` R371 起） | **无**——只有 `qid`，`_sz`/手录题 `qid: null` 后服务端 `mid → qid` 两级查找全落空 |
| 消费回包 `reviewed` | `_reviewed` 累积 → 完成页 | **`postAnswerLog(): Promise<void>`**，回包直接丢 |
| 完成页「错题重练效果」（已纠正 / 仍错 / 达成掌握） | 有 | **无** |
| 完成页普通练习「本组答对 N 道曾错题，复习计划已推进（M 道达成掌握）」 | 有 | **无** |
| `Question.mistake_id` / `AnswerLogResp` 类型 | JS 无类型 | **未声明**（页面层不可能用到） |

一手（本地 `:8525`，`DB_PATH=/home/ubuntu/r525/app.db`，隔离 uid，`~/r542/local_flow2.out`）：

- 服务端契约（`db.py` `_log_answers` → `_advance_review`）：answer_log 项 `correct:true` 且能定位到该 uid 的未掌握 `mistakes` 行（**先 `mid`，再 `qid`**）→ 回 `reviewed:[{mistake_id, streak, mastered}]`；第 6 次 `mastered:true` 并剔出 `due_reviews()`。
- `qid:null` 无 `mid` → `{"saved":1,"reviewed":[]}`，`review_streak` 不动（= 改前小程序时政/手录错题重练答对**不推进复习**，且用户无任何反馈）。
- 同项加 `mid:110` 连打 6 次 → `streak 1..6`，第 6 次 `mastered:true`，`GET /api/review?uid=` `total 0`。
- 把 6 次回包喂给新 `utils/review-advance.ts`：`masteredCount 1`；redo 报告 `{fixed:1, still:0, mastered:1}`；fix 文案「本组答对 1 道曾错题，复习计划已推进（1 道达成掌握）」；第 1 次回包不带括号。临时行已 `DELETE`。

结论：P1（对标粉笔错题本「重做后即时反馈掌握进度」；H5 已有、小程序缺），最小修 = 小程序客户端补上送 `mid` + 消费已有回包，**不改 SRS、不在客户端复算阈值**。

## 2. 实修（7 文件）

- `api/types.ts`：`Question.mistake_id?`、`AnswerLogItem.mid?`、`AnswerLogReviewed{mistake_id,streak,mastered}`、`AnswerLogResp{saved, reviewed?}`（老后端无 `reviewed` 键合法）。
- `api/index.ts`：`postAnswerLog(): Promise<AnswerLogResp>`。
- `utils/review-advance.ts`（新，纯函数，与 H5 `review-advance.js` 同口径）：`reviewedMasteredCount`（`mastered === true` 严判，`1/'true'/null/缺键` 不算）/ `redoReportOf(items, reviewed)`（只数带 `mistake_id` 且已作答的题；无则 `null`）/ `fixReportOf` / `fixReportText`（逐字同 H5）/ `redoReportTip`（沿用 R523「已回到今日待复习」）。
- `pages/practice/practice.ts`：
  - `logAttempts()` 项加 `mid: q.mistake_id || undefined`（`qid` 仍 `q.id || null`，`toPQ()` 对 `_sz` 置 `id:null` 的 R521 守卫不动）；`postAnswerLog` 的 promise 进 `_logPending`，回包 `Array.isArray(r.reviewed) && r.reviewed.length` 才并入 `_reviewed`；失败仍 `enqueueAnswers`（离线队列项含 `mid`，补传时服务端同样推进）。
  - 新 `syncRedoReviews(items)`：等在途 `_logPending` 全结束（reject 吞掉）→ `mode ∈ {redo, redoset}` 出 `redoReport`，否则 `fixReport`；`redoReport` 为 `null`（如收藏/成绩报告来的 `redoset`，题无 `mistake_id`）时回落 `fixReport`（H5 此处直接 `return` 不显示；小程序多显一行，不算口径冲突）。`finish()` 非背题模式 `await logAttempts → await syncRedoReviews → loadDueReview`。`start()` 重置 `_reviewed/_logPending`。
- `practice.wxml`：完成页 `percentile` 行之后 `wx:if redoReport`「错题重练效果」三格 + tip + `kg-button variant=text` 「回错题本查看」（既有 `onGoReview`）；`wx:elif fixReport` 一行可点（`l-icon circle-check` + `chevron-right tone=muted`）。
- `practice.wxss`：`.rr/.rr-row/.rr-it/.rr-v(.ok/.bad/.brand)/.rr-l/.rr-tip/.fr/.fr-t`，全部走既有 token（`--bg/--r-md/--card-pad/--ok-strong/--bad-strong/--brand-text/--ink/--ink-3`；仓库无 `--bg-2`，`l-icon` 无 `ink-3` tone）。
- `frontend-uni/tests/miniapp-r542-practice-review-advance.test.js`（+7）：esbuild 转译真跑 `review-advance.ts`（严判 / redo 报告只数 `mistake_id` 行 / tip / fix 文案与 H5 逐字）+ 源锁（`mid` 上送、`reviewed` 严格并入、`finish → syncRedoReviews`、WXML 绑定、`_sz` id 置空守卫、类型声明）。

`mistake_id` 全链路核（源码）：`/api/mistakes/redo` 每项带 `mistake_id`（R521）→ `book.ts` `redoSet = d.items` 原样入 storage → `practice.ts` `toPQ()` 展开保留 → `logAttempts` 读 `q.mistake_id`。`mode=redo` 直取接口结果同理。`onRedoWrong()`（本组错题重练）展开保留原字段。

## 3. 门（全绿）

- backend：pytest **599 passed** / ruff / pyright 0（未改服务端，回归确认）。
- frontend-uni：vitest **145 files / 985 tests**（+1 文件 +7）/ eslint 0 / build:h5 成功（H5 产物无业务变化，不发版）。
- miniapp：`tsc --noEmit` 0 / `ESLINT_USE_FLAT_CONFIG=false eslint` 0（`~/r542/gate_mp.out`）；`git diff --check` 空。

## 4. 生产

- **未发版**：改动全在小程序源码，服务端 `/api/answer_log` 契约生产早已具备（R371 起）；VPS 生产仍 `74a5d62a`。
- 小程序上真机需 macOS/Windows 微信开发者工具上传（R536-1）；本轮改动加入待上传清单（R536 / R539 / R541 / R542）。

## 4b. (c) 到期项（13:14Z 只读，`~/r542/c.out`）

- rev `74a5d62a`，容器 healthy 0 重启，R541 后容器 5xx/Traceback 0，源站 12:45Z 后 1124 请求 5xx 0。
- 抓取簇 09:34Z 段仍在跑（12h 1294 行/363 IP，13h 前 14 min 547 行/239 IP），09-09 日界未到；非探针非 GET 仅 1 条 `POST /api/track`（`Cf-Connecting-Ip 140.232.64.4`，本机 6b Lighthouse）→ 真人 0。
- redo 自然样本 0、answer_log 自然 POST 0；Caddy `zalize.com` 续期行 reload 后 ~2 h 仍 0（6 h 窗 17:17Z 满）。
- DB `1324/360/37/38/82`、`explain_cache.qid` 非空 0、null qid 28、`max(review_streak)=2`、WAL 同字节 → 0 写入。

## 5. 如实

- 小程序只有 **Node 打桩 + tsc 真码 + 本地真接口** 一手，**无真机 / 无 DevTools 运行时**，WXML/WXSS 渲染未肉眼验证。
- `redoset` 来源多样（错题本 / 收藏 / 成绩报告 / 练习历史 / 本组错题重练），只有错题本来源带 `mistake_id`；其它来源答对曾错题时服务端按 `qid` 回落仍能推进，完成页出 `fixReport` 一行。
- 离线队列补传的 `reviewed` 不展示（H5 同）。
- 无 testing agent 录屏（未另行授权）；生产 0 写入 0 LLM。

## 6. 登记

- R542-1（P3）：小程序 `redoset` 非错题本来源（收藏/报告）的 `redoReport` 与 H5 行为差（H5 不显示、小程序显 `fixReport`）——等真机可跑后统一或保留。
- R536-1 上传通道缺口不变。
