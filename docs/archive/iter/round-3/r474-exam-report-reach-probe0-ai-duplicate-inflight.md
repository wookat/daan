# R474 取证：模考报告用时 / 统计锚点 / 目标分 / AI 出口在 probe=0 真实数据里的触达率（只读）

日期 2026-09-07（UTC）。生产 `6e82179`（R471b），本轮 0 代码、不发版。数据源：生产 SQLite 宿主直读 `file:…/deploy_kaogong-data/_data/data.db?mode=ro`、源站 Caddy access log（当前文件自 09-05 18:44Z 起）、源码 `backend/app/exam_api.py` / `db.py` / `ai_api.py`、`frontend-uni/src/pkgA/exam/{exam,report}.vue` / `exam-resume.js` / `pages/book/book.vue` / `api.js`。无任何写入、无假数据。

## 0. 结论（事实 / 推断 / 未验证分开）

| 能力（上线轮） | 代码存在 | 真实（probe=0）路径触达 | 判定 |
|---|---|---|---|
| 模考开始 / 保存进度 / 跨设备续考（`exam/start`·`progress`·`resume`） | 是 | **有**：attempt 315（uid `umst3tuisd7lgzaka`，paper 5，09-06 21:41:58Z）3 题作答 → 3 次 `progress` 200 → `exam_progress` 行 `picks={376655:B,376656:B,376657:C} idx=3 secs={2,2,1}` | 事实 |
| 交卷 / 最终分 / `per_module` / `secs` 用时 | 是 | **0**：全库 `probe=0` attempt 1 条且 `submitted_at NULL`；Caddy 非探针 IP `exam/submit` 0 次 | 事实 |
| 报告页（`/api/exam/report/{id}`）+ 用时行 / 模块统计 / 历史曲线 / 目标分差距 / rank-card 百分位 / 下一场推荐 | 是 | **0**：非探针 IP `exam/report/*` 0 次、`exam/rank*` 0 次、`exam/attempts?paper_id=…&limit=10`（报告页 `loadHistory`）0 次 | 事实 |
| 目标分（`user_profile.target_score`） | 是 | 设了：该 uid `target_score=70 / exam_date 有 / exam_type=国考`；9/9 profile 都有 target_score 与 exam_date；报告页 `goalGap` 因无交卷从未渲染 | 事实 |
| AI 出口：讲解 `explain/stream` | 是 | **有**：2 次 200（41.5 s / 41.7 s，`Content-Length` 同为 446 = 同一题），`explain_cache` 落 1007 字讲解 | 事实 |
| AI 出口：错题 AI 分析 `mistakes/analysis` | 是 | **有**：4 次 200（19.7–39.8 s） | 事实 |
| 报告页 AI 入口（详情 AI 详解 / 练同类题） | 是 | 0（报告页本身未触达） | 事实 |

- **决策：不改产品代码**。模考报告簇（R281–R310 的用时 / 统计锚点 / 目标分 / rank-card / 下一场推荐）在真实路径里触达率为 0，不是因为报告页有缺陷，而是唯一 probe=0 设备只走了「开卷 → 答 3 题（各 1–2 s）→ 8 s 后离开」，无交卷；没有一手真实报告回包可核，把代码存在当触达是错的。
- **新命中（AI 出口）——登记为 R475 候选，不在本轮拍脑袋改**：同一 uid 同一请求体的 LLM 调用在飞行中重复：`explain/stream` 2 次起点相隔 6 s（两个出口 IP：223.83.2.220 → 39.158.40.85，`cl=446` 同体）、`mistakes/analysis` 4 次起点 21:41:24 / :36 / :47 / :48Z（`cl=27` = `{"uid":"umst3tuisd7lgzaka"}`），每次都独立打满一轮 LLM（合计 ≈ 83 s + 114 s 模型时间），服务端无 single-flight、无成功短缓存（`rl` 限速 10/300 s 不拦重复）。§4 有细节与设计问题。

## 1. 生产数据（只读）

### 1.1 `exam_attempts` 按 probe 分组（64 条）

| probe | 条数 | 未交卷 | 已交卷 | 说明 |
|---|---|---|---|---|
| NULL | 29 | 19 | 10 | 08-04 20:14Z–09-05 18:52Z、21 个 uid；R374（09-06）加列前的历史行，uid 形态 `u6/u8/u16/u26/u32` + `ums…/umt…`，已交卷 10 条 `per_module` 全有、`secs` 只有 09-02 起 2 条（184/185）有；**不能**按 probe=0 计，也无法事后归因真人 |
| 0 | 1 | 1 | 0 | attempt 315，见 1.2 |
| 1 | 34 | 20 | 14 | 全部 `test-*` / 探针 uid；已交卷 14 条 `per_module`/`secs` 全有、`marks` 全空 |

已交卷 24 条里 `secs`（逐题用时，报告页「用时」行来源）非空 16 条、全部在 09-02 之后（R281+ 上线后），`marks` 24 条全空。

### 1.2 唯一 probe=0 attempt（315）

- `exam_attempts`：`uid=umst3tuisd7lgzaka paper_id=5 started_at=2026-09-06 21:41:58Z submitted_at/answers/score/per_module/secs 全 NULL`。
- `exam_progress`：`picks={"376655":"B","376656":"B","376657":"C"} idx=3 secs={"376655":2,"376656":2,"376657":1} marks/excl 空 updated_at=21:42:06Z`。三题都是 paper 5（2025 四川行测，75 题 / 70 min）前三题、`changshi/政治`。
- 时间线（Caddy，ts=响应写出时刻，起点=ts−duration；同一请求体大小 / `Cf-Ray` 单调性交叉核过）：`21:41:50–:52 exam/papers ×2 · exam/attempts ×2 · exam/resume ×2（回 {}）` → `21:41:58 POST exam/start 200 23 KB` → `21:42:02 / :05 / :06 POST exam/progress 200`（前端 1.5 s debounce，与 3 次选答吻合）→ `21:42:06 exam/attempts + exam/papers`（回卷库）→ `21:42:07 stats / predict / growth / mastery/map / profile / checkin / shenlun/stats`（统计页）→ `21:42:15 home_bundle`（首页）→ `21:42:16` 统计页再刷 → `21:42:17 report/weekly + next_event + weekly/read`。窗口内 **无 `exam/submit`**，此后该 uid 无任何模考接口。
- 结果：70 min 后 attempt 超时，`latest_exam_progress` 的 `started_at + duration_min*60 > now` 条件把它排除 → `exam/resume` 回 `{}`、卷库续考横幅消失；`list_exam_attempts` 只列已交卷 → 3 题作答**在产品任何界面都不再可见**，服务端也不会代为判分（`exam.vue` 只有页面开着到点才自动 `submit`）。这是现行设计，不是缺陷；是否要「超时未交卷自动按已答判分/进历史」属产品决策，无一手竞品截图，不加功能，只登记。

### 1.3 该 uid 的其它触达（同窗口 21:37–21:42Z）

- `answer_log` probe=0 共 33 行（全库 probe=0 只有这 1 个 uid）：21:39:05–21:39:21 连答 10 题时政（每题 0–2 s，1/10 正确）+ 21:39:44 一题数量；`mistakes` 28 条 / 26 未掌握。
- `growth_events`：`heatmap_view(stats) 21:37:55`、`share_copy(share_q, ref=5tva43xd) 21:41:43`（与 `POST /api/share/create 200` 对应，分享的是练习题非模考）。
- 周报：`GET /api/report/weekly 200 506 B` + `POST /weekly/read 200`（R460 簇真实触达 1 次）。
- 设备：UA `Android 16; V2405A`（vivo），**Referer `https://servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html`** = 微信小程序（uni MP-WEIXIN 构建）、版本号 `0`（开发/体验版）；出口 IP 39.158.40.85 与 223.83.2.220 在 6 s 内切换（移动网络）。身份未确认（历轮口径不变：仍无可确认外部真人作答者）。

### 1.4 `user_profile` / `questions`

- `user_profile` 9 条：`target_score` 9/9、`exam_date` 9/9（含该 uid `70 / 国考`）。报告页 `loadProfile()` 只在报告页调，`/api/profile` 该 uid 两次调用都来自统计页（同刻伴随 `stats/predict/growth`）。
- `questions` 109371：`attempt_count>=1` 781、`>=5` 1 → 报告页 / 详情页 `qStatLine`「N 人做过 · 正确率」锚点在 99.3% 题上无数据可显（R375 起只算真人口径的必然结果，非缺陷）。

### 1.5 Caddy 全文件（09-05 18:44Z 起）模考 / AI 接口非探针口径（排除 `140.232.64.0/24` 与带 `X-Kg-Probe` 头）

`exam/start 1 · progress 3 · submit 0 · report/* 0 · rank* 0`；`mistakes/analysis 4 · explain/stream 2`（均上述 uid）；另 `141.11.46.193` 有面试页 `interview/sessions ×6 · cur ×6 · categories · question` 共 14 次，本轮未归因（登记，下轮到期项）。

## 2. 源码对齐（报告页依赖 → 数据来源）

`report.vue`：`/api/exam/report/{attempt_id}`（`attempt.per_module` → 模块统计 + 用时行；`paper.duration_min` + `report.total` → `buildPaceRows`）、`loadHistory()` → `/api/exam/attempts?paper_id=&limit=10` → `prevScoreDelta`、`loadProfile()` → `target_score` → `goalGap`、`<rank-card :attempt-id>` → `/api/exam/rank/{id}`、下一场推荐 → `exam/papers?kind=zhenti` + attempts。以上每一项都以 `submitted_at` 非空为前提（`finish_exam_attempt` 才写 `score/per_module/secs`），所以 §0 的 0 触达是同一根因的连锁，不是五个独立问题。

## 3. 到期项（05:09Z，宿主直读）

probe=0 answer_log 33/1、growth probe=0 20/4、`mistakes.error_reason` 7 / ≥09-11 **0**、push_subs 0、weekly_reports 2、exam_attempts probe=0 1/64、容器 healthy 0 重启（04:35:18Z 起）、rev `6e82179`、WAL 4,124,152 B 同字节、宿主 90% / 5.2 G、load 3.7、mem_avail 294 MB，守护 prune 04:45Z（89%→88%）/ 05:00Z（93%→90%）。(c) R471b 容器起后 182 请求（140 带探针头，其余本机 IP），`/assets/*` 404 0、小程序 UA 0、5xx 0、monitor 仍只有 R471 那 1 条。

## 4. AI 出口飞行中重复（R475 候选，需先论证再改）

事实：
- `mistakes/analysis` 4 次：结束 21:41:59 / :42:04 / :42:07 / :42:19Z，duration 22.93 / 39.79 / 19.69 / 31.27 s → 起点 21:41:36 / :24 / :47 / :48Z；`Cf-Ray` 顺序 `a370a33e < a370a385 < a370a3ad(share/create 21:41:42) < a370a3cd < a370a3d2` 与推算起点一致。响应 845–879 B（源站 `encode gzip` 后字节；纯 `stats` 段本机复算 548 B 未压缩，故正文非空，长度不可由此反推）。4 次全部 200。
- `explain/stream` 2 次：起点 21:40:02（IP 223.83.2.220）/ 21:40:08Z（IP 39.158.40.85），请求体同为 446 B，41.5 / 41.7 s，`explain_cache` 21:40:50Z 落 2 行同文（1007 字，key 不同、写入机制本轮未核）。
- 后端：`api_mistake_analysis` 每次都 `llm.chat(max_tokens=900)`，无缓存、无 per-uid single-flight；`rl("ai_mistake_analysis", 10, 300)` 只限量不去重。`explain/stream` 同样无飞行中合并。
- 前端唯一调用点 `book.vue aiAnalysis()` 有 `aiLoading` 守卫（同一页面实例内不可能并发）；`api.js request()` 对 POST 不重试；`manifest.json` 无 `networkTimeout`。
  - **R475 勘误**：这里核的是 H5 `frontend-uni`，但事发客户端是原生小程序开发版（`miniapp-native`，Referer `servicewechat.com`），当时源码 `pages/book/book.ts onAiAnalysis()` 守卫只有 `if (this.data.aiHtml) return`（加载中关弹层再点入口即重发），W8 分支 `8db03a2` 事发后 71 min 才补 `aiLoading`；另「141.11.46.193 面试页 API 14 次」按 `/api/interview` 前缀复数只有 2 条。见 `r475-ai-inflight-duplicate-client-root-cause-server-singleflight.md` §1/§4。

推断（未验证）：4 次并发只可能来自页面实例重建 / 多 webview / 小程序 `wx.request` 自身超时后用户重点（本仓 MP-WEIXIN 路径本机无微信开发者工具，无法复现）；两次 explain 隔 6 s 且 IP 切换，更像网络切换致首次连接在客户端侧失败后重发（服务端仍跑完）。

设计问题（R475 先答再动手）：① 根因在客户端哪一层（小程序页面栈 / 超时 / 重入）——需真机或开发者工具一手；② 服务端是否加 per-(uid, 请求体) 飞行中合并（identical 请求等同一个 future）+ 成功结果短 TTL（如 60 s）——收益是省 LLM 时间与并发槽，风险是流式 explain 的合并语义；③ R398「失败态不缓存可重试」口径必须保留。本轮不写代码。

## 5. 如实说明

- 一切「触达率」只覆盖 Caddy 当前文件（09-05 18:44Z 起）与 DB 全量；09-05 前的日志已轮转压缩未解包。
- probe NULL 的 29 条 attempt 是加列前历史，无法事后区分真人/测试，本轮不计入任何一侧。
- 「ts=响应写出时刻」按 Caddy 实现 + 本轮 `Cf-Ray`/请求体交叉核为高置信推断，未读 Caddy 源码。
- 小程序侧行为（为何 4 并发）未复现；`servicewechat.com/…/0/` 版本号 `0` 按微信 Referer 约定判为开发/体验版，属推断。
- 报告页各卡片本轮未在生产渲染（无真实已交卷 attempt；不造假 attempt），其字段依赖只按源码对齐。
- 0 代码，本轮无新门，沿用 R471b 本地门（vitest 699/699 / eslint / build:h5；后端 pytest / ruff / pyright）。
