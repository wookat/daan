# R444 · 到期项只读复查 + 历史 27xx「宿主负载」误归因勘误指针 + 首页 CLS 0.071 恒定值一手归因（只登记，不改产品代码不部署）

- 日期：2026-09-06（UTC 17:12–17:40）· 生产仍 `b265cdc`，本轮无部署、无 DB 写入、不派 testing agent
- 范围：① 到期项只读复查（probe=0 / `error_reason` / WAL / `push_subs` / `weekly_reports` / 自然旧壳 404）② R441/R443 之前历史文档把 LCP 26xx–27xx 记为「宿主负载」的勘误指针 ③ 顺带把 R196 起每次 6b 都出现、从未归因的 `/` CLS 0.07 拆到元素级

## 1. 到期项只读复查（`sqlite3 file:/data/data.db?mode=ro` + caddy 源站日志 6 h 窗口）

| 项 | 一手结果 | 结论 |
|---|---|---|
| `answer_log` by probe | `NULL 1001 行/57 uid`、`probe=0 22 行/1 uid`、`probe=1 123 行/13 uid`；probe=0 仍全是 09-06 那台 vivo 小程序 uid（`umst3…`，最后 08:57Z），09-06 之后无新行 | 仍无可确认外部真人；不改 |
| `mistakes.error_reason` 非空 | 6 行；按 uid 关联 answer_log 有 probe=0 行的 = **0** | ≥09-11 再看；不改 |
| `push_subs` / `weekly_reports` | 0 / 0 行 | 推送、周报正文（`.trend-kn` 4 周样本）仍无可观测对象 |
| SRS 日界（R438） | 29/29 活跃 `next_review` 落 CST 00:00；48 h `review_log` 4 行 | R438 口径持续成立 |
| WAL | `data.db` 449 MB、`-wal` 519 KB、`-shm` 32 KB；只读探针连接 `journal_size_limit=-1` | **`journal_size_limit` 是连接级 pragma**，探针自己的连接读 -1 属预期；应用连接 R436 已读回 64 MiB。WAL 仅 0.5 MB，64 MiB 截断阈值未触发、自然截断仍无样本 |
| 自然旧壳 `/assets/*` 404 (c) | 6 h 源站 2404 请求，**`/assets/*` 404 = 0**；`/api/monitor/report` 12 条全 probe（testing agent UA） | 仍无样本；继续挂 |
| 6 h 非 2xx（排 30x） | 非探针：`sitemap-questions-12.xml` 404 ×2（bingbot 历史分片，R437 已登记）、`/` 403 ×2（无边缘头直连）、`security.txt` 404 ×1、`/.env` 404 ×1（94.154.43.164 Windows Chrome UA 扫描器）；探针侧 404 全是 testing agent 探错路径 | 无未登记产品问题 |
| 非探针 UA | YandexBot 29 / bingbot 10 / Googlebot 8 / ClaudeBot 4 / Palo Alto 2 / Censys 1 / `.env` 扫描 1 | 6 h 内 0 个候选真人 |
| users | 16 总 / 09-01 起新增 2 | 与 probe 分布一致 |

## 2. 历史「27xx = 宿主负载」误归因的勘误处置

- grep 命中把 26xx–27xx LCP 写成「宿主方差 / 单样本波动 / 本机噪音 / 宿主负载 / 一次 WARN」的位置：`docs/handoff-context.md` R128、R315、R324、R334、R343、R388、R389、R424、R427、R431、R435、R437 各节 + `r424-…md` / `r435-…md` 各 1 处 + `docs/content/r95/README.md` 2 处（R95 是 4G 场景 0.207 的另一问题，不属此勘误）。
- 处置：**不改历史行**（当时的原文是当时的判断记录，改写会破坏可追溯）。在 handoff 顶部「已知坑与注意事项」加一条勘误指针，指向 R443 机理文档；R441 节已有纠正原文。
- 机理复述（R443 一手）：LH simulate 下 `/` 的 LCP 是 Lantern 把观测 FCP 前收完的 High/VeryHigh 请求（主包 + R387 head 预加载分包）按 150 ms RTT / 1.6 Mbps 折算的稳定值 ≈ 2.73 s；真节流 0.7 s；低值 0.8/1.2–2.0 才是主包与首绘 ~10 ms 竞态的落点。

## 3. 首页 CLS 0.071 恒定值归因（观测指标，非模拟；一手）

R196 起每次 6b `/` CLS 都是 0.06–0.07（R196 0.061 / R429 0.07 / R430 0.07 / R441–R443 0.071），预算 0.10 内从未归因。本轮用 R443/R442 留存的 8 份 lhr（simulate ×6、devtools ×2）+ 一次 `--save-assets` trace + Playwright `PerformanceObserver('layout-shift')` 对生产 4 次实测，**8+4 次全部 = 0.0608 + 0.0102 两次位移，逐元素一致**：

| # | 时刻 | 分值 | 位移元素（`sources`） | 前 → 后 rect（412×823 视口） | 成因（源码可证） |
|---|---|---|---|---|---|
| 1 | 221–320 ms | **0.0608** | `uni-app.uni-app--showtabbar > uni-page > uni-page-wrapper > ::after` | `[0,44,412,50]` → `[0,0,0,0]` | uni-app H5 为 TabBar 页在 `uni-page-wrapper` 尾部生成 50 px 占位伪元素；页面 body 尚空时它就在 44 px 导航条下方，首个组件挂载、页面内容进入后被推到 2680 px 页尾（离开视口）→ 记一次 50 px×全宽的位移 |
| 2 | 263–380 ms | **0.0102** | `uni-view.hero-acts`（继续目标/今日计划两按钮）+ `uni-view.card.taskcard` | hero-acts `[37,530,338,44]` → `[37,556,…]`（下移 26）；taskcard `[11,593,390,230]` → `[11,619,390,204]`（下移 26、高 −26） | `/api/home_bundle` 回包后 `dsMeta` 由 null 变有值，`<text v-if="dsMeta" class="hero-ds">今日全站同题 10 题 · …</text>`（24rpx 字 + 20rpx 下边距 = 26 px）插入 hero 内，把下方全部推 26 px；同帧 taskcard 内容随 profile/plan 数据重排收 26 px（具体哪一行未逐行核） |

- 与启动屏关系：`dismissSplash()` 在首个组件 `mounted` 加 `kg-splash-done`（0.15 s 淡出）。4 次实测位移 #1 时 splash opacity 1 / 1 / 0.26 / 1，位移 #2 时 0.007 / 1 / 0.15 / 1（回调时刻采样，非位移帧精确值）→ **#1 基本在启动屏遮盖下、#2 落在淡出窗口内**，真人可感知的是 #2 那 26 px 的一次下顶（hero 按钮与今日任务卡）。
- `had_recent_input=true` 是 Chrome 对 LH/Playwright 视口仿真的标记，LH 源码（`cumulative-layout-shift.js`）对视口事件后 500 ms 内的位移无条件计入；真人无输入同样计入 CLS。
- 判定：CLS 0.071 在 Web Vitals「良好」（≤0.10）区间内、预算 0.10 有余量；#1 是框架占位行为且被启动屏盖住；#2 是 R43 之后新增的 `hero-ds` 行（每日一练全站同题）没有沿用 R43「异步卡片预留槽位」的做法。**本轮只登记 P3**：修法是 `dsMeta` 未返回前给 `.hero-ds` 预留一行高度（骨架/占位），需先确认 `dsMeta` 是否天天有值（有则占位无副作用）、并核 taskcard 那 −26 px 的具体行；无真人样本、无设计论证不动手。

## 4. 事实 / 推断 / 未验证

- 事实：§1 全表数字；§3 位移元素、rect、分值（12 次一致）；`.hero-ds` 的 v-if 与 CSS 尺寸；splash 淡出时序源码。
- 推断：「#2 真人可感知」——依据是 opacity 采样落在淡出窗口，未做真人/录屏对照；taskcard −26 px 来自哪一行未核。
- 未验证：`dsMeta` 是否每日必有（决定占位是否有副作用）；小程序端无此壳与 TabBar 占位，不适用。

## 5. 改动

- 仅 `docs/handoff-context.md`（勘误指针 1 行 + R444 节）、本文、SKILL 增补。产品代码 0 行、生产 `b265cdc` 未动。
- 留存（devin-box，非仓库）：`/home/ubuntu/r444/lhr_cls_1.json` + `lhr_cls_1-0.trace.json`、`/home/ubuntu/r444/cls_sources.py`（Playwright layout-shift sources 采样脚本）、`/home/ubuntu/r444_due.py`、`/home/ubuntu/r444_caddy.py`。
