# R522 取证：时政错题（`_sz`，来自重练）作答闭环一手 + R521 发版后 (c) 补量 + 两条四维候选核

日期 2026-09-08（UTC 03:59–04:12Z）。生产 `2e608c0c`（R521 容器 03:45:59Z 起）**本轮不改码、0 部署、0 写入**。

## 0. 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | R521 发版后 (c) / 到期项 | 5xx / assets 404 / monitor / mpUA / 非探针 POST / Traceback 全 0；WAL `4,173,592` 同字节；probe=0 各表同 R521；`umst3` 四表 32/45/22/1 新增 0 | 生产只读（Caddy + `mode=ro` 库） |
| 2 | 时政题（`_sz`，来自「错题重练」）作答后 `mistakes` 回写 / `answer_log qid null` / 完成页「错题已自动加入错题本」 | **本地全链路一手成立**（§2）：`POST answer_log {qid:null, mid:2}` / `POST mistakes {question_id:null, …}` / 完成页 hero 含「错题已自动加入错题本」 / 库 `mistakes.question_id IS NULL`、`answer_log.question_id IS NULL`、`times 1→2`、未在 `questions` 生成任何行、`questions.id 141`（行测题）与 `shizheng_questions.id 141`（本题）撞号但互不串 | 本地起服务 + 本机 Chrome（合成 uid） |
| 3 | 同一路径的生产 bundle 写入侧 payload | 生产 `umst3` 时政重练首题（`id 118 / mistake_id 2914`）选错 → 客户端发 `POST answer_log {qid:null, mid:2914, module:时政}` + `POST mistakes {question_id:null, module:时政, question_type:单选, question_text 首行=原题干, explanation 尾「【出处】…」}`，**全部 abort**；生产库审前后 `umst3` 四表 / `mistake 2914 (mastered 0, times 1, next_review NULL)` 不变 | 生产只读（abort 抓请求体，不证明落库） |
| 4 | 生产是否已有真人走过这条路 | R521 发版（03:45:59Z）后 `answer_log` / `mistakes` / `review_log` **新增 0 行**（任何 uid）；时政 `answer_log` 42 行全 `question_id NULL`，其中 probe=0 的 10 行全是 `umst3`（09-06） | 生产只读 |
| 5 | 四维候选 A：错题本按错因聚合 | `error_reason` 非空全库 7 行 / 4 uid，候选真人 uid 集内 4 行 / 2 uid（`概念不清 2 / 方法不会 2`），最新 09-06 21:39Z；`≥09-11` 0 → **真人数据仍≈0，不立项** | 生产只读 |
| 6 | 四维候选 B：复习完成态回错题本刷新 | 源码 `nextReview()` 末题 → `exitReview()` → `load()`（重拉 `GET /api/mistakes` + `GET /api/review`）→ 再开 celebrate sheet；本地一手：sheet 打开时其身后页面已是「0 题 今日待复习 / 今日没有到期错题 · 待掌握 1 / 15 天后复习」，关闭后同态；同一 tick 抓到 `GET review` + `GET mistakes` + `POST review/cur snap:null` → **无陈旧态，不立项** | 源码 + 本地一手 |
| 7 | 簇 | 09-07 终值 1445/1443；09-08 至 04:07Z 3792 行 / 3738 IP（15.3 行/分、UA 14、每 IP ≤2）仍在跑；日报 03:23Z `humans.page 09-08 3025` 基本全簇 | Caddy 只读 + 特征推断 |

**登记（不改）**：R522-1 练习完成页「错题重练效果」文案「仍错的已重置复习，**明天**优先再练」（`practice.vue:235`）与服务端 `save_mistake()` 重复命中分支 `next_review=time.time()`（**立即到期**，错题本随即显示「今日待复习 1 · 今天 04:04」）不一致——是文案对 SRS 重置语义的描述偏差（P3，复习照常可做）；候选一行改文案「今天起优先再练」，并入下一次含发版轮次，不为一行文案单独发版。R521-1（手录题「N 题无法重练」提示）、R521-3（小程序 `_sz` 守卫未真机）照旧。

## 1. 环境与边界

- 本地：`backend` `uvicorn app.main:app --port 8522`，`DB_PATH=~/r522/app.db`（从空库 `init_db` 起，`questions` 由种子导入，故 `questions.id 141` 存在），`LLM_BASE_URL=http://localhost:1/v1`（不触 LLM）。种子：`shizheng_questions` 1 行（`R522本地：下列关于某会议的说法正确的是`，`answer C`，`source_note 本地出处`）+ `mistakes` 1 行（`uid r522local`、`question_id NULL`、`module 时政`、`question_text` 首行 = 该题干、`user_answer A`）。
- 本机 Chrome CDP（`connect_over_cdp`）新建独立 context，`localStorage.anonUid` 注入；本地 POST 放行、生产非 GET **全 abort** + `X-Kg-Probe: 1`。
- 生产库：宿主 `sqlite3.connect('file:…?mode=ro', uri=True)`；无 `sqlite3` CLI，全部 Python。
- 合成 uid `r522local` 多次复用：375 选错 1 次、1440 选对 1 次、复习答对 2 次（+ 首版脚本一次），`answer_log` 3 行 / `review_log` 4 行是**本地合成累积**，不是真人。

## 2. 本地一手：重练 → 作答 → 回写 → 完成页

脚本 `~/r522/local_sz_answer.py <W> [pickIdx]`（默认选 A=错；答案 C）。

375（选错）`~/r522/sz_375.out`：
- 错题本 `.entry`「错题重练」→ `GET /api/mistakes/redo?uid=r522local&limit=10` → `[{"id":141,"mistake_id":2,"_sz":true,"answer":"C","module":"时政"}]`
- 练习页「刷题 时政 1/1 … R522本地：… A 甲 B 乙 C 丙 D 丁」，toast「错题重练开始」，`.kg-opt` 4
- 选 A → 「正确答案 C · 已自动存入错题本 / 错因自评 …/ 本地解析 【出处】本地出处 / 时政 单选」，底栏「完成」
- 网络：`POST answer_log` `{"uid":"r522local","items":[{"qid":null,"mid":2,"module":"时政","submodule":null,"correct":false,"secs":2,"picked":"A","source":null}]}` → 200 `{"saved":1,"reviewed":[]}`；`POST mistakes` `{"uid":"r522local","question_id":null,"module":"时政","question_type":"单选","question_text":"R522本地：…\nA.甲 B.乙 C.丙 D.丁","user_answer":"A","correct_answer":"C","explanation":"本地解析\n【出处】本地出处"}` → 200
- 点「完成」→ hero **「答对 0/1 · 最高连对 0 题，错题已自动加入错题本」** + 「错题重练效果 0 已纠正 1 仍错 0 达成掌握 / 答对的已推进复习计划；仍错的已重置复习，明天优先再练」；`errs []`
- 库：`mistakes (id 2, question_id None, 时政, 单选, A, C, mastered 0, times 2, next_review 1788840279≈now)`；`answer_log (uid r522local, question_id None, 时政, correct 0, secs 2, picked A, probe 0)`；`questions where question like 'R522本地%'` 0 行；`questions.id 141` = 「2024年，禾原省发电量…」（行测题）未被触碰。
- 截图 `~/r522/local_sz_q_375.png` / `local_sz_picked_375.png` / `local_sz_done_375.png`。

1440（选对 C）`~/r522/sz_1440_correct.out`：`REDO` 同上；选 C 后末题直接进完成态（无「完成」按钮，脚本 `BTN 0`）→ hero「答对 1/1 · 最高连对 1 题」（无「错题已自动加入错题本」，`autoSaved` 未置位符合预期）；`POST answer_log {qid:null, mid:2, correct:true, picked:C}` → `{"saved":1,"reviewed":[{"mistake_id":2,"streak":2,"mastered":false}]}`（R371 归一推进 SRS）；未发 `POST mistakes`。

## 3. 生产只读对账：同路径 bundle payload（abort）

脚本 `~/r522/prod_sz_answer_abort.py 375`，输出 `~/r522/prod_375.out`，截图 `~/r522/prod_sz_picked_375.png`。
- chip「时政」→「错题重练」→ `GET redo?limit=10&module=时政` 9 条全 `_sz:true`，首题 `{"id":118,"mistake_id":2914,"answer":"C","module":"时政","question_type":"单选"}`
- 练习页「刷题 时政 1/9 … 关于嫦娥七号任务突破的关键技术…」4 选项；选 A（答案 C）→ 「正确答案 C · 已自动存入错题本 / 错因自评 / 解析 + 【出处】中国航天科技集团官网2026年4月消息 / 时政 单选」
- abort 到：`POST answer_log {"uid":"umst3…","items":[{"qid":null,"mid":2914,"module":"时政","submodule":null,"correct":false,"secs":2,"picked":"A","source":null}]}`；`POST mistakes {"uid":"umst3…","question_id":null,"module":"时政","question_type":"单选","question_text":"关于嫦娥七号…\nA.… B.… C.… D.…","user_answer":"A","correct_answer":"C","explanation":"…\n【出处】中国航天科技集团官网2026年4月消息"}`；另 `POST track boot` / `POST practice/progress` abort
- abort 后 UI 仍显示「已自动存入错题本」且请求进入 `localStorage.offlineQueue`（既有离线队列设计，随一次性 context 关闭丢弃，未回放到生产）——**「已自动存入」文案不等于落库**，落库只有 §2 本地证据。
- 审后生产库：`umst3` 32/45/22/1 不变；`mistake 2914 (mastered 0, times 1, next_review NULL, user_answer A)` 不变；R521 发版后任意 uid 新写 0 行；WAL `4,173,592`。

## 4. 复习完成态回错题本刷新（候选 B）本地一手

脚本 `~/r522/local_sz_review.py <W>`（把 `mistakes.id 2` 的 `next_review` 拨到 1 h 前）。375 `~/r522/review_375.out`、1440 `~/r522/review_1440.out`：
- 错题本首屏「1 题 今日待复习 … 开始复习」→ 复习卡「复习 1/1 … A B C D」（时政题 `question_id NULL`，选项由 `question_text` 行解析）→ 选 C → 「答对了！连对 N 次（下次复习：7/15 天后）… 完成复习」
- 点「完成复习」→ 同一 tick：`POST review/2 {correct:true}` → `{"streak":4,"next_review_days":15,"mastered":false}`、`POST review/cur snap:null`、`GET review?uid=` + `GET mistakes?uid=`、`POST track review_done_celebrate`、`GET mastery/map`
- celebrate sheet「今日复习已清零 / 到期 1 道全部复习完成 · 首答对 1 道（100%）」，**其身后列表已刷新**：「0 题 今日待复习 / 今日没有到期错题 · 待掌握 1 · 已掌握 0 / 15 天后复习」；点「太棒了，继续 ›」→ 同态 + `GET reinforce/suggest`（无 picked → toast）
- 库：`mistakes (2, mastered 0, review_streak 4, review_count 4, next_review 1790092800)`；`review_log` +1
- 脚本经验：sheet 按钮文字节点被 `uni-button` 拦截 pointer events，`get_by_text` 点不到，要 `locator('uni-button', has_text=…)`。
- 截图 `~/r522/local_sz_review_q_*.png` / `local_sz_review_done_*.png` / `local_sz_review_after_1440.png`。

## 5. 生产读数表（`~/r522_db.sh` → `~/r522_db.out`；`~/r520_pre.sh` → `~/r522_pre.out`）

| 项 | 值 |
|---|---|
| 容器 | healthy / restarts 0 / started 03:45:59Z（R521） |
| 当前容器窗 03:45:59Z→04:07Z | 385 请求；5xx 0；assets404 0；monitor []；mpUA 0；非探针非 bot 332 = 簇 332；非探针 POST []；401/403 仅探针 `GET /api/health` 403 1 |
| WAL | `4,173,592`（同 R517–R521） |
| Traceback | 0 |
| load / MemAvailable / 兄弟构建 | 2.16 / 333 MB / 0 |
| probe=0 | `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 0、nudge []、`push_subs` 0 |
| 候选真人 uid（非探针 `mistakes` uid） | 57 |
| `error_reason` 非空 | 全库 7 行 / 4 uid；候选集 4 行 / 2 uid（概念不清 2 / 方法不会 2）；最新 1788730784（09-06 21:39Z） |
| 时政 `mistakes` 候选集 | 13 行 / mastered=0 13 / 已到期 1 |
| NULL-qid `mistakes` | 28（候选集 14）；`times>1` 1；有 `review_log` 0 |
| 时政 `answer_log` | 42 行全 `question_id NULL`；probe=0 10 行全 `umst3`（09-06 21:39Z） |
| R521 发版后新写 | `answer_log` 0 / `mistakes` 0 / `review_log` 0 |
| 到期 | 候选集 mastered=0 且 `next_review<=now` 24 行 / 7 uid；候选集 `review_log` 30 行，最后 1788373277（09-02） |
| 社交/表 | `question_notes` 5、`question_comments` 17（ok 0）、`question_reports` 6、`shared_questions` 18、`user_profile` 9（`test-w10-*` 0） |
| `umst3` | 32/45/22/1；`mistake 1953/2784/2914` mastered 0 / next_review NULL；时政 mastered=0 9 行题干首行 9/9 命中 `shizheng_questions` |
| 簇 | 09-07 1445/1443；09-08 至 04:07Z 3792/3738、15.3 行/分、峰 97、UA 14、每 IP ≤2、503 ×72 旧账 |

## 6. 不改码理由

- §2/§3 证明 R521 后时政重练的作答回写、`answer_log qid null`、完成页反馈按源码预期工作，且 id 域隔离在「同号撞号」样本上成立；无用户无法完成动作的断点。
- 候选 A 真人数据≈0（且最近一条 09-06），聚合视图无使用依据；候选 B 已由 `exitReview()→load()` 覆盖，一手无陈旧态。
- R522-1 是文案与 SRS 重置语义的描述偏差，P3，随下次含发版轮次一起上。

## 7. 如实

- 本地与生产 bundle 同源（生产 `index-BhqML2JL.js`，前端自 R520c 未改），但本地 POST 200 与库落值只在本地成立；生产同路径只抓到客户端请求体（abort），**未证明生产落库**，也没有任何真人在 R521 后走过这条路。
- `r522local` 数据为多次合成累积；生产 `umst3` 是历轮走查用的探针 uid，其 09-06 时政 `answer_log` 10 行为何标 `probe=0` 本轮未核（未按 R386 三路口径逐条回查），不作为真人证据。
- 簇归因是请求特征推断、无 IP 情报；小程序未动未跑；本轮向生产 0 账号/写入/LLM；无 testing agent 录屏（未另行授权）。
