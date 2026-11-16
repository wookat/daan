# R523 取证：练习页「错题重练效果」块口径核 + 时政 NULL-qid 复习入口核 + R522-1 文案实修上线

日期 2026-09-08（UTC 04:12–04:32Z）。生产 `2e608c0c` → `6d568b6c`（04:25:52Z）。代码 PR #659（1 行文案 + 源锁）。生产 0 写入（非 GET 全 abort、库 `mode=ro`）。

## 0. 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | 「错题重练效果」块（已纠正/仍错/达成掌握）是否用 R371 `reviewed` 回包 | 源码 `syncRedoReviews()`：`fixed/still` 按本地 `_picked === answer` 统计（客户端已知正确答案，不依赖回包）；`mastered` = `reviewedMasteredCount(this._reviewed)`，`_reviewed` 由 `/api/answer_log` 回包 `reviewed[]` 累积（`r.mastered === true` 计数）。本地 R522 一手（`sz_1440_correct.out`）：选对 → 回包 `reviewed:[{mistake_id:2,streak:2,mastered:false}]` → 块显示「1 已纠正 0 仍错 0 达成掌握」；选错（`sz_375.out`）→ `reviewed:[]` → 「0 已纠正 1 仍错 0 达成掌握」。**口径正确，不改** | 源码 + 本地一手 |
| 2 | 同块「仍错」提示文案 vs 服务端语义（R522-1） | 文案「仍错的已重置复习，**明天**优先再练」；服务端 `save_mistake()` 重复命中分支 `next_review=time.time()`（立即到期）。本地一手与生产一手**同屏**出现「今日还有 N 题到期待复习」（本地 N=1、生产 `umst3` N=30）→ 自相矛盾。**实修**为「已回到今日待复习」（错题本同口径），+ 源锁锁后端 `time.time()` 绑定与新文案 | 源码 + 本地一手 + 生产一手 |
| 3 | 错题本时政筛选态的到期项 / 「开始复习」是否吃 NULL-qid 行 | R522 本地一手（`review_375.out` / `review_1440.out`）已覆盖：NULL-qid 时政错题到期 → 错题本「今日待复习 1」→「开始复习」→ 复习卡从 `question_text` 解析出 A–D 四项 → 答对 → `POST /api/review {mistake_id, correct}` 200 → `review_log +1`、`next_review` 推后 → 完成 sheet 身后列表已刷新「0 题 今日待复习」。**不依赖 `question_id`，NULL-qid 行可正常复习，不改** | 本地一手（合成数据） |
| 4 | 发版后 (c) / 到期项 | 新容器窗（04:25:52Z→04:29Z，120 请求）5xx / assets 404 / monitor / mpUA / 非探针 POST / Traceback 全 0；重建窗（04:24–04:27Z）源站 5xx 0；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、nudge/push 0；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914 (mastered 0, next_review NULL, streak 0)` 不变；`user_profile` 9 / `shared_questions` 18 不变 | 生产只读 |
| 5 | 簇 | 09-07 终值 1445/1443；09-08 至 04:29Z 4174 行 / 4115 IP（15.5 行/分、峰 97、UA 14、每 IP ≤2、503 ×72 旧账）仍在跑；日报 04:23Z `humans.page 09-08 3957` 基本全簇 | Caddy 只读 + 特征推断 |

## 1. 设计论证（先于改码）

- 语义源：`backend/app/db.py save_mistake()` 命中同题（`question_id` 或题干）时 `UPDATE mistakes SET times+1, mastered=0, review_streak=0, next_review=?` 绑 `time.time()`——即「重置复习并立即到期」。错题本 `GET /api/review` 随即把它算进「今日待复习」（R522 本地一手：作答后错题本显示「今日待复习 1 · 今天 04:04」）。
- 完成页同块下方的「今日还有 N 题到期待复习」来自 `GET /api/review` 计数，两句同屏：一句说「明天」、一句说「今日」——用户可见矛盾。
- 备选：(a) 改服务端 `next_review` 为明天——改 SRS 语义、影响 R371 归一推进与 R438 日界口径，无需求依据，否决；(b) 改文案与错题本口径一致——一行、零行为变化，采纳。措辞用错题本已有标签「今日待复习」，不新造词。
- 源锁：`frontend-uni/tests/practice-r523-redo-still-copy.test.js`（① 后端 `UPDATE mistakes … next_review=?` 与 `(time.time(), rec.get("user_answer")` 绑定同在——若将来改语义此测试先红，提醒文案同步；② 新文案在、「明天优先再练」不在）。

## 2. 改动

- `frontend-uni/src/pages/practice/practice.vue:235`：`；仍错的已重置复习，明天优先再练` → `；仍错的已重置复习，已回到今日待复习`。
- `frontend-uni/tests/practice-r523-redo-still-copy.test.js` 新增 2 例。
- 后端 / 小程序无改动（小程序端无同文案，`grep 明天优先再练` 全仓仅此一处）。

## 3. 改后生产一手（`~/r523/prod_redo_still_copy.py <W> [mid]`）

- 路径：`umst3` 只读 `GET /api/mistakes/redo?limit=25&uid=…&mids=2914`（R520 `mids=` 契约）→ 回 `[{"id":118,"mistake_id":2914,"_sz":true,"answer":"C","module":"时政"}]` → 写 `localStorage.redoSet`（uni H5 storage `{type:'object',data}` 形态）→ `#/pages/practice/practice` → 「刷题 时政 1/1」→ 选 A（答案 C）→「完成」。
- 375（`~/r523/prod_375.out`，`prod_done_375.png`）：hero「答对 0/1 · 最高连对 0 题，错题已自动加入错题本」；块「错题重练效果 0 已纠正 1 仍错 0 达成掌握 / **答对的已推进复习计划；仍错的已重置复习，已回到今日待复习**」；下方「今日还有 30 题到期待复习」；abort：`POST track`、`POST answer_log {qid:null, mid:2914, correct:false, picked:A}`、`POST mistakes {question_id:null, module:时政, …}`；bundle `index-BCpYYxJh.js`（= 本机 dist）；errs []。
- 1440（`~/r523/prod_1440.out`，`prod_done_1440.png`）：同文案、同 abort 集（`track` / `answer_log` / `mistakes`）、bundle 同、errs []。
- 「已自动存入错题本」/「错题已自动加入错题本」在 POST 被 abort 时仍显示（R522 §3 已登记：该文案≠落库）；本轮生产库 `umst3` 四表新增 0 即证明未写入。

## 4. 发版

- 预检：`MemAvailable 318 MB` / disk 5.5 G（89%）/ load 0.55 / `other_builds=0 prunes=0`。
- compose：`poll rev=2e608c0c` ×5 → `rev=6d568b6c started=04:25:52Z compose_rc=0`（~1 min）；`4a` rev 校验过；6b `/` perf 0.93 / LCP 2803 / CLS 0.06、`/tiku/` 1.00 / 938 / 0.00 全 OK；`DEPLOY_RC=0`。`~/r523_deploy.log`。
- 门（改后）：vitest 134 文件 / 916、eslint、lint:tokens、lint-pages 0 error、build:h5；pytest 568 / ruff（后端未改，重跑）；`git diff --check` 空。GitHub Actions 按公司规则保持禁用。

## 5. 读数（`~/r523_pre.out` 发版前 / `~/r523_post.out` 发版后）

| 项 | 前（R521 容器 03:45:59Z→04:20Z） | 后（R523 容器 04:25:52Z→04:29Z） |
|---|---|---|
| 请求 / 5xx / assets404 / monitor / mpUA / 非探针 POST / Traceback | 608 / 0 / 0 / 0 / 0 / 0 / 0 | 120 / 0 / 0 / 0 / 0 / 0 / 0 |
| 非探针非 bot（全簇） | 547 / 547 | 72 / 72 |
| WAL | 4,173,592 | 4,173,592 |
| probe=0 answer_log / growth / explain_cache qid / error_reason ≥09-11 / push_subs | 53,2 / 26,4 / 0,82 / 0 / 0 | 同 |
| umst3 mistakes / answer_log / growth / review_log | 32 / 45 / 22 / 1 | 同 |
| 簇 09-08 | 4007 / 3952 IP | 4174 / 4115 IP |

## 6. 登记 / 如实

- 不改：§0-1、§0-3 两条候选口径均正确。R521-1（手录题「N 题无法重练」提示）仍待 UX 定；R521-3 小程序 `_sz` 守卫未真机。
- 如实：§0-3 复习入口只有**本地合成**一手（`r522local`），生产 `umst3` 复习未提交（非 GET abort）；生产完成页读数来自 abort 后的客户端状态（`redoReport.still` 按本地 `_picked` 算，不依赖回包），与真实落库无关；本机 CDP 采样非真机 RUM；簇归因是特征推断；0 LLM；无 testing agent 录屏（未另行授权）；仍无可确认外部真人走过时政重练作答/复习。
