# R490（SOP-10 四维审计）：生产唯一一次非探针带 qid 问答深链走的是错题本**列表**「AI 详解」（`redo(m)`）——7 个带 qid 入口里唯一无埋点，R487/R489「6 入口」漏数 → 最小修 `book_ask_click`；生产 `896007c` → `a8ceca8`

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/book/book.vue` +1 行、`backend/app/team.py` 白名单 +1、源锁 `tests/book-r490-ask-click.test.js`（2 用例）、`backend/tests/test_track.py` +1。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量**（§1）：R487 容器（09:51:52Z 起）到 10:31Z 共 108 请求（与 R488/R489 同一批，无新增），全本机/探针/bot；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3tuisd7lgzaka` 0 回访；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` 7 / ≥09-11 0；probe=0 `answer_log` 33/1、`growth_events` 20/4；WAL 4,124,152 B 同字节；healthy 0 重启。
2. **选簇（按「非探针真会走到 + R410 后未整页过审」）**：三候选里只有「问答页会话/历史 sheet」有非探针真人**写入**证据（`umsacie728f4ghcv8` 09-05 `POST /api/explain/stream` + `POST /api/ask/cur`，`ask_cur` 落 qid 234494）；错题本 AI 分析（非探针 `mistakes/analysis` 全历史 0）与每日一练完成态（`daily_set_entries` 全表 1 行且 probe=1，非探针 0；R430 已审）都只有读没有写 → 选问答簇，先把这唯一一次真人到达**逐请求复盘到入口**。
3. **命中（verified，Caddy 全历史 + DB 只读 + 源码）**：该次到达的入口是**错题本列表展开卡的「AI 详解」（`book.vue redo(m)`）**，不是 R489 排除法推断的练习页深链：
   - 17:05:52Z `GET /api/mistakes`（错题本列表）→ 17:05:56Z 同一秒 `GET /api/attempts?…&question_id=234494` + `GET /api/notes?…&question_id=234494` + `GET /api/comments/count?question_id=234494`——`/api/attempts` 全 `book.vue` 只有 `toggleCard(m)`（列表展开卡）一处调用，`notes`/`comments/count` 是展开卡里 `<q-social-bar>` 发的；复习模式（`cur`）没有 `/api/attempts` 调用 → 这是**列表模式展开卡 234494**，不是复习模式。
   - 17:05:57Z `GET /api/ask/cur` + `GET /api/ask/sessions`（问答页 onShow）——展开后 1 s 进问答页；17:05:56→17:05:57 之间 **0 条 `POST /api/track`** → 走的不是 `askFromReview()`（它会打 `review_ask_click`），只能是同一张卡上没有埋点的 `redo(m)`。
   - 17:07:18Z `POST /api/explain/stream`（R477/R486 已核 body 带 `qid=234494`）→ 17:07:22Z `POST /api/ask/cur`；DB `ask_cur` 该 uid 唯一 rec `qid=234494 module=yanyu`，`mistakes.id=274`（08-01 14:56Z 答 B 正确 D，`review_count=0`）与之对上。
   - 所以：**生产至今唯一一次非探针带 qid 问答深链 = 错题本列表「AI 详解」**；它是全产品 7 个写 `redoQid` 的入口（practice / book 复习模式 / book 列表 / report / favorites / practice-history / search）里**唯一没有 `*_ask_click` 埋点**的。R487 §1.1 / R489 §2.1 的「6 个入口」把 `book.vue` 只算了复习模式 `askFromReview`（`review_ask_click`），漏了列表 `redo(m)`；R489 结论 3「按排除法走练习页深链」**不成立**（勘误已加到两份文档）。与 R487 同类：`switchTab` 不改 Referer、埋点是唯一可观测手段，而真人实际走的恰是没埋点的那一个。
4. **修法（最小）**：`redo(m)` 在 `switchTab` 前 `trackEvent('book_ask_click', m.module || '', String(qid || ''))`（时政错题 qid 已被 R483 置空 → ref `''`，与 `practice_ask_click` 的 `'sz'` 口径不同但不再需要区分：源头已 NULL）；`/api/track` 白名单 +`book_ask_click`。源锁两条：`redo(m)` 块必须带该 `trackEvent`；**所有**写 `redoQid` 的方法体都必须有 `*_ask_click`（防再漏）。改前跑源锁 2/2 红、改后绿。
5. **顺带核过不命中**：`redo(m)` 首行 `if (!text) return;`（题干空则点了没反应）——生产 `mistakes` `question_text` 空 **0 行**，不立项。

## 1. (c) 补量 / 到期项（`~/r490_post.sh` → `~/r490_post.out`，10:31Z）

```
container healthy restarts=0 started=2026-09-07T09:51:52Z（R487）
disk 3.5G  load 0.78 0.83 0.97  mem_avail 81MB(+352 cache)  sibling builds 0  WAL 4,124,152 B
caddy since start 108  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  trackPOST 5 [200×4,400]
practice_ask_click: 2 行 probe=1（R487 探针）   probe=0 answer_log 33/1   growth probe=0 20/4
explain_cache qid 0/82   时政且 qid 非空 0/0   error_reason ≥09-11 0
```

`~/r490_db3.sh` → `~/r490_db3.out`：`*_ask_click` 全表 3 行全 probe=1（`search` ×1 / `practice` ×2）；`umsacie7` `answer_log` 61 行全为 08-01 probe=NULL 历史、09-05 回访当天 **0 作答**（probe=0 的 33 行是 `umst3` 一人的）；`mistakes` 27 行同 08-01；`ask_sessions` 该 uid 0 行、`ask_cur` 1 行。

## 2. 选簇一手（三候选对照）

| 候选 | 非探针到达证据 | 非探针写入证据 | R410 后整页过审 |
|---|---|---|---|
| 问答页会话/历史 sheet | `umsacie7` 09-05、`umsagboriz` 09-06（GET cur+sessions） | **有**：`explain/stream` + `ask/cur` 落库 | R479 只审字号/热区 |
| 错题本 AI 分析结果态 | `umsacie7` 09-05 `GET /api/mistakes`（列表） | 无：`mistakes/analysis` 非探针全历史 0（R476–R489 连续照查） | R398 审过弹层，结果态未过 |
| 每日一练完成态 | `GET /api/daily_set` 各 uid 都有（首页 bundle 顺带） | 无：`daily_set_entries` 1 行 probe=1、非探针 0 | R430 已审 |

只有第一簇既到达又写入，且这次写入是**全产品唯一一次非探针带 qid 讲解**——先把它复盘到入口，比整页盲扫 sheet 状态更值。

## 3. 逐请求复盘（Caddy `kaogong-origin.zalize.com-access*` 全历史，`~/r490_caddy1.py` → `~/r490_caddy1.out`；客户端 IP 取 `Cf-Connecting-Ip`）

| UTC | 请求 | 归属页面/动作（源码） |
|---|---|---|
| 16:42:49–16:43:16 | 首页/复习/错题/成长等 GET ×~50 + `POST /api/track` ×3（`comeback_view`/`boot`/`heatmap_view`，DB 核） | 回访首页 + TabBar 来回（出口 `64.120.95.120`） |
| 17:05:48–17:05:53 | 首页 bundle + `GET /api/review/cur` + `GET /api/review` + `GET /api/mistakes` + `GET /api/mastery/map` | 重新进站（出口换 `173.234.15.218`）→ 错题本 Tab（列表 + 复习态并行读） |
| **17:05:56** | `GET /api/attempts?…&question_id=234494` / `GET /api/notes?…&question_id=234494` / `GET /api/comments/count?question_id=234494` | **列表展开卡 234494**：`toggleCard(m)` 唯一调用 `/api/attempts`；`<q-social-bar>` 发 notes / comments-count |
| **17:05:57** | `GET /api/ask/cur` + `GET /api/ask/sessions` + `GET /api/review` | **问答页 onShow**；中间 **0 条 `/api/track`** → 入口 = `redo(m)`（`askFromReview` 会打 `review_ask_click`） |
| 17:05:59 | `GET /api/access_info` | 问答页 |
| 17:07:18 | `POST /api/explain/stream` 200 | 提交讲解（80 s 后；body qid=234494，R477 核） |
| 17:07:22 | `POST /api/ask/cur` 200 | 会话留存（`ask_cur` items qid 234494 / module yanyu / ts 17:06:00Z；`explanation` 为完整讲解：答案 D + 花生十三细节判断步骤 + 针对其所选 B 的「错因分析」；`saved:false` 未存入错题本、`fu:[]` 无追问）|
| 之后 | 0 请求 | — |

`book.vue` 两条问答入口对照（源码 `896007c`）：

| 入口 | 方法 | 埋点 | 写 `redoQid` |
|---|---|---|---|
| 复习模式「AI 详解」 | `askFromReview()` L1433 | `review_ask_click` | 是 |
| 列表展开卡「AI 详解」 | `redo(m)` L1561 | **无** | 是 |

## 4. 门 / 发版 / 改后一手

- 本地：pytest **510**（+1）/ ruff 0 / pyright 0；vitest **726**（+2）/ eslint rc=0 / `build:h5` 绿。源锁在改前源码上 2/2 红（`git stash` 实跑）。
- 发版 `~/r490_deploy.log`：4-pre 探到兄弟 `compose build/up` 1 个，让行 150 s（盘 5.0→4.9 G、load 2.5–2.75）后它自行结束，`compose` 10:36:33Z 起、容器 **10:37:53Z** `rev=a8ceca8` `compose_rc=0`；4a rev 一致、5 bundle `index-DR7w8z1H.js` 线上=本机、5b 变体 OK、7/7 200；6b `/` perf 0.93 / a11y 1.00 / LCP 2725、`/tiku/` 1.00 / 950。
- 改后一手：生产 `pages-book-book.QtYBmytf.js` 线上与本机 **逐字节相同**（`cmp`），含 `trackEvent("book_ask_click",e.module||"",String(s||""))` 后紧跟 `switchTab`；`X-Kg-Probe: 1` `POST /api/track` `book_ask_click` → 200 落库 `probe=1`（`uprobe_r490_bac yanyu 234494 10:39:17Z`）、`book_ask_click_bad` → 400「无效事件」（源站直连不带边缘头 403 ×2 是 R388 口径，换公网域名重发）。新容器 healthy 0 重启、Traceback 0、起后 34 请求 5xx/404/monitor/mpUA 0、非探针 0、WAL 同字节。

## 5. 判定与登记

- **命中类型**：可观测性缺口（与 R487 同类），不是功能缺陷——真人这次深链 → 提交 → 留存全程 200，功能是通的。修的价值：下次真人再走这条（生产唯一被证实走过的）入口时，`growth_events.ref ↔ explain_cache.qid` 三段对账（R487 §3）才能成立。
- **勘误**：R487 §1.1「6 个入口」应为 7（漏 `book.vue redo(m)`）；R489 §0.3 / §3「`umsacie7` 走练习页深链（排除法）」不成立，实为错题本列表 `redo(m)`。两份文档已加勘误块。
- **未命中不立项**：问答页会话/历史 sheet 的空态/切换/失败态本轮**未整页过审**（时间用在复盘入口）；`umsacie7` 这次没有再打开 sheet（`ask/sessions` 只在 onShow 读一次、`ask_sessions` 0 行）→ 该 sheet 至今非探针 0 次实际打开，留到有到达证据再审。错题本 AI 分析结果态 / 每日一练完成态同理（写入 0）。

## 6. 如实说明

- `umsacie728f4ghcv8` 08-01 的 60+ 行作答是 probe=NULL 历史（打标前），09-05 两段出口 IP 不同（`64.120.95.120` / `173.234.15.218`，均非本机网段）——「非探针」按 IP/头/UA 三路口径成立，**是否外部真人仍不确定**（R489 同）。
- 入口归属是**源码调用点唯一性 + 无 track POST** 两条推出的（`/api/attempts` 只此一处；`askFromReview` 必打点）；若当时浏览器把 `review_ask_click` 的 `trackEvent` 静默丢了（`trackRetryable` 之外的错误不入队），归属会反过来——但那需要同一秒 notes/attempts/comments 三请求也来自复习模式，而复习模式不调 `/api/attempts`，所以不成立。
- 埋点在真人流量上仍 0 样本（只证探针 200 落库）；未提交 `explain/stream`（不造 LLM 流量）；无 testing agent 录屏（未另行授权）。
- 仍无可确认外部真人完成「练习→作答→错题→复习→掌握」完整闭环。
