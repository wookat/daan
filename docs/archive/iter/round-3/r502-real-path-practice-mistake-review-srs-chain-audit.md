# R502：真人有量路径「练习 → 错题 → 复习 → 再答对推进 SRS」全链路一手对账（DB + Caddy 只读）

日期：2026-09-08 · 分支 `devin/1788611745-r400-formula-dropped-snapshot`（PR #619）· 只读取证，不改产品代码，不发版。

## 0. 结论

1. **写入侧 1:1 无丢失**：Caddy 全历史非探针写请求 `POST /api/answer_log` 55 / `POST /api/mistakes` 36 / `POST /api/review/1952` 1 / `PATCH /api/mistakes/{2819,2815,2923}` 3，逐条对上 DB：`answer_log` 55 行（`umst3` 45 + `umsacie7` 10）、`mistakes` 36 行（32 + 4）、`review_log` 1 行、`mastered=1` ×2 + `error_reason='纯蒙的'` ×1。全部 200，无 4xx/5xx。
2. **SRS 推进只有 1 个样本、且是答错**：`review_log #307`（`umst3`，mid 1952，`correct=0`，09-06 08:58:03Z）→ `mistakes.review_count 0→1 / review_streak 0 / next_review = 1788710400`（= 09-07 00:00 CST = `cn_day_start()+1 天`），与 `_advance_review()` 答错分支逐字段一致。**答对推进（`streak+1`、`REVIEW_INTERVALS_DAYS[1,3,7,15,30]`、`mastered`）在生产 0 样本**：两条推进入口——`POST /api/review/{mid}` 答对 0 次、`answer_log correct=1` 命中本 uid 已有错题（R371 路径）0 次（`umsacie7` 唯一一次再遇错题 qid 149544 仍答错）。
3. **漏斗断点在「到期 → 开始复习」而不是代码**：两 uid 到期 31 / 30，五段回访会话里进错题本页 `GET /api/review` 68 次、只按了 1 次复习入口（`review_entry_click practice_done` ×2 → 1 条 POST），答错后 `review_similar_auto` 追加 2 题即离开，转去把最近 2 条错题「标为已掌握」再去看统计页。
4. **这 53 行 probe=0 作答不能当学习行为**：作答节奏 1–4 s/题（09-07 12:00 段 10 题 20 s、全是资料分析图表题；09-06 08:55:58–08:56:09 段 8 题 11 s），是巡览点击不是做题；`umst3` 同 uid 在 09-06 22:02 有 5 条 `probe=1` 的 `heatmap_view`（从探针网段进来过），`umsacie7` 09-07 段出口 `141.11.46.189`（与 R475 归内部的 `141.11.46.193` 同 /24，Windows Chrome）。**两 uid 都更像内部设备**，不构成外部真人证据。→ 不据此立任何功能项。
5. **登记 3 项、不改码**（见 §4）：时政错题 `question_id` 为空只能走复习页推进；15 条 R400 前旧快照 `correct_answer` ≠ 现题 `answer`（复习页只用快照，自洽）；复习页答错后自动追加同考点题使一轮变长（设计如此，样本 1 不足以判）。

## 1. (c) 补量 + 到期项（`~/r502_post.sh` → `~/r502_post.out`）

| 项 | 值 |
|---|---|
| 容器 | healthy · restarts 0 · started 09-07 16:01:18Z（R500 发版容器，R501/R502 未发版） |
| 容器期请求 | 69 · 5xx 0 · assets404 0 · monitor 0 · mpUA 0 · 非探针非 bot 0 · 非探针 POST 0 · 401/403 0 |
| WAL | 4,124,152 B（同字节，mtime 09-08 00:20 CST）· Traceback 0 · load 0.76 |
| probe=0 `answer_log` / growth | 53 / 2 uid；26 / 4 uid（事件 10 种同 R500） |
| `explain_cache qid` | 0 / 82；`*_ask_click` 真人 0；nudge dismiss/fail/ok 真人 0 |
| `error_reason ≥09-11` | 0（但 09-06 21:39:49Z 有 1 条真人 `PATCH /api/mistakes/2923` 写入 `'纯蒙的'`，见 §2.4） |
| 时政 qid 非空 | 0 / `push_subs` 0 / harness uid 落库 0 |
| 模考漏斗 | 与 R501 同（np `exam/papers` 11 全在 R500 发版前；发版后 `mods` 非探针触达 0） |

脚本最后一行 `explain_cache` 抽样查询假设了 `id` 列报 `no such column: id`（该表无 `id`），不影响其余输出；未重跑（该行非本轮取证项）。

## 2. 链路对账（`~/r502_srs.sh` → `~/r502_srs.out`；`~/r502_srs2.sh` → `~/r502_srs2.out` / `~/r502_srs3.out`）

### 2.1 Caddy 非探针写请求 ↔ DB 行

| 请求 | Caddy 次数 | DB 对应 | 备注 |
|---|---|---|---|
| `POST /api/answer_log` | 55（全 200） | `answer_log` 55 行（`umst3` 45、`umsacie7` 10） | probe=0 的 53 = `umst3` 43 + `umsacie7` 10；`umst3` 09-02 的 2 行落在 R386 打标前 |
| `POST /api/mistakes` | 36（全 200） | `mistakes` 36 行（32 + 4） | 09-06 21:39 段 10 次 → 9 条时政 + 1 条数量（2923） |
| `POST /api/review/1952` | 1 | `review_log #307 correct=0` | 见 §2.2 |
| `PATCH /api/mistakes/2819` `2815` | 2 | `mastered=1, mastered_at` 08:58:21 / 08:58:25Z | 分别是该段最后两条错题（创建 08:57:54 / 08:57:41），创建后 27–44 s 即标掌握 |
| `PATCH /api/mistakes/2923` | 1 | `error_reason='纯蒙的'`，`mastered=0` | 唯一一次真人使用错因标注 |
| `GET /api/review` / `review/cur` / `mistakes` / `mistakes/redo` | 68 / 43 / 66 / 1 | — | 读侧全 200 |

### 2.2 唯一一次复习事件的字段级对账

```
Caddy  09-06 08:58:00Z growth review_entry_click(practice_done)
       09-06 08:58:03Z POST /api/review/1952 200
       09-06 08:58:03Z growth review_similar_auto(ziliao) + GET /api/questions?limit=2&module=ziliao
DB     review_log {id:307, uid:umst3…, mistake_id:1952, correct:0, created_at:1788685083.227}
       mistakes#1952 {review_count:1, review_streak:0, next_review:1788710400.0, mastered:0}
       1788710400 = 2026-09-07 00:00 CST = cn_day_start(08:58Z=16:58 CST 当日 0 点) + 1*86400   ✓ 答错分支 days=1
       questions#412319 answer D == mistakes.correct_answer D，disabled 0                          ✓ 快照与现题一致
```

入口→作答 3 s（资料分析材料题），与「答错」一致地指向随手点而非计算。

### 2.3 答对推进 0 样本（两条入口均核）

- `POST /api/review/{mid}` `correct=true`：Caddy 非探针全历史 0 次；`review_log` 全表 `correct=1` 的 28 行归属：`u26` 18 / `umtf09…` 3 / `u32` 2 / `umsrgwyi…` 1（这 4 个 uid 在 `answer_log` 无任何行 = 历史内部/测试账号）+ 探针 4。
- R371 路径（`save_answer_log_detail()` 答对且 `_find_open_mistake()` 命中）：两 uid `answer_log correct=1 ∩ 本 uid 错题 question_id` = **0**；唯一再遇（`umsacie7` 08-01 12:50:00Z qid 149544，错题 #243 创建 12:48:03Z）`correct=0`，`mistakes#243 review_count 0`（答错不推进，符合代码）。
- 因此 `review_streak>0` / `mastered` 由 SRS 产生的行：两 uid **0**；`umst3` 的 2 条 `mastered=1` 都是 PATCH 手动标掌握（`review_count=0` 印证）。

### 2.4 五段会话的行为形态（Caddy 时序，非探针出口 `39.158.40.85` / `223.83.2.218/220`）

| 段 | 作答 | 节奏 | 之后 |
|---|---|---|---|
| 09-02 18:40 | 2 题 0 对 | — | `share_copy` ×2 离开 |
| 09-06 00:10 | 1 题 0 对 | — | 统计页 `reminder_optin` ×2 |
| 09-06 08:36–08:58 | 21 题 6 对 | 08:55:58–08:56:09 **8 题 11 s** | `practice_result` → 入口点复习（08:56:14 进错题本又退出）→ 再练 10 题 → 08:58:00 再点入口 → 3 s 答错 1952 → 追加 2 题即退 → 标掌握 ×2 → 统计/成长页 |
| 09-06 21:37–21:43 | 11 题 1 对（`shizheng/daily`） | **11 题 39 s** | `PATCH 2923 '纯蒙的'` → 问答页 2 次 `explain/stream` → `mistakes/redo` 1 题 → `exam/start` 3 题 8 s（R501）→ `mistakes/analysis` ×4 → 周报/面试/团队页巡览 |
| 09-07 11:59–12:01 | 10 题 6 对（`grouped=1&module=ziliao`） | **10 题 20 s** | `practice_result` → 首页 → 常识 1 题未答 → 统计页 → 错题本（`GET review` 到期 30）**不点复习**离开 |

`umsacie7`：08-01 60 题 38 min（probe 归属打标前）；09-07 11:57 **10 题 22 s**（Windows Chrome，出口 `141.11.46.189`）。

### 2.5 到期与排序

- `due_reviews()` 现刻：`umsacie7` 31 / `umst3` 30（`next_review IS NULL` 的 29 条按 `created_at` 升序，1952 已排到 `next_review` 之后）；`review_cur` 表两 uid 0 行（无中断快照）。
- 首项 = `#1953`（09-02 创建的资料分析题）。

## 3. 数据形态两项（不判为缺陷）

### 3.1 时政错题 `question_id=NULL`（`umst3` 9/32 = 28%）

`shizheng/daily` 的题 id 是 `_sz` 前缀，`save_mistake()`/`save_answer_log_detail()` 经 `foreign_module_qid()` 置空（R483/R484 设计，防串表）。后果：这 9 条**只能**通过复习页 `POST /api/review/{mid}` 推进，`answer_log` 答对路径与 `mistakes/redo` 天然覆盖不到；复习页本身走 `mid`，不受影响。全库 `question_id IS NULL` 的错题只有这 9 条（module 全为「时政」）。→ 登记为设计限制；给时政题一个稳定外键（如 `sz_id` 列）需先有时政题被复习/重练的真人需求。

### 3.2 旧快照答案 ≠ 现题答案（15 条，全 `umsacie7` 08-01 创建）

`mistakes.correct_answer` ∈ {A,B} vs `questions.answer` ∈ {C,D}，`questions.updated_at` 为空（题库侧字段未维护）。复习页 `book.vue` 只渲染 `cur.question_text`（内嵌选项）+ `cur.correct_answer`，**不渲染** `due_reviews()` 联出的 `options`（该字段只在收藏/相似题列表用），所以快照自洽、判分不会用到现题答案；R400 前的快照没有 `hs` 回落，解析可能为空。全库 15 条无一在 R400 后产生。→ 登记，不迁移旧快照。

## 4. 登记（不改码）

| # | 项 | 依据 | 处置 |
|---|---|---|---|
| 1 | 时政错题无 `question_id`，答对推进 / 重练覆盖不到 | §3.1 | 设计限制；等真人复习时政题证据 |
| 2 | 15 条 R400 前快照答案与现题不一致 | §3.2 | 复习页只用快照自洽；不迁移 |
| 3 | 复习答错即追加 2 题同考点（`review_similar_auto`），唯一样本追加后立刻退出 | §2.2 | 样本 1、且为巡览点击；不据此改 R440 设计 |
| 4 | 「到期 → 开始复习」转化 68 次进页 / 1 次开始 | §2.4 | 两 uid 均疑为内部设备，无外部真人 → 不加提醒/强化入口 |

**不立项理由**：R502 原设「找断点 → 最小修」，断点找到了但它在**人**（巡览点击、疑内部设备）而非代码——写入 1:1、SRS 答错分支字段级正确、答对分支生产 0 样本但 `backend/tests/test_answer_advance_review.py` / `test_r438_srs_day_aligned.py` 已锁；此时改码是在没有一手需求下改产品。

## 5. 如实说明

- 全部只读（`mode=ro` SQLite + Caddy 日志），0 模考/作答/复习/账号/LLM 请求，未跑 CDP，未发版。
- 「答对推进 SRS」在生产从未发生，本轮**不能**宣称该链路生产 verified，只能说「答错分支 verified、答对分支单测锁定」。
- probe=0 ≠ 真人：两 uid 的内部归属为推断（同 uid 出现 `probe=1` 行 / 出口 /24 与 R475 内部地址同段 / 作答节奏），未独立确认身份。
- `~/r502_post.sh` 末行 `explain_cache` 查询因假设 `id` 列失败未重跑（非本轮取证项）。
- 15 条快照/现题差异的「谁对」未逐题人工核（复习页不依赖现题答案，故不影响判分）。
