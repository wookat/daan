# R476：R475 发版后补量 + 自然 `mistakes/analysis` 合并命中观测 + 面试页「出题后不点评」非探针漏斗 + 成长页 9 请求扇出实测（只取证登记，0 代码不发版）

日期：2026-09-07 05:32Z（`2bad8bc` 容器起）→ 05:58Z。生产仍 `2bad8bc`。全部只读：宿主 Caddy 全文件 + SQLite `mode=ro` + 源码 + 浏览器侧只读量测（探针头）。

## 0. 结论先行

1. **自然 `mistakes/analysis` 合并命中：无法观测**——R475 容器起后（05:32:03Z，filter = `docker inspect StartedAt` 同秒）非探针 `/api/mistakes/analysis` 请求 **0 条**。single-flight 至此只有 R475 探针一手（4 并发 1 次 LLM），**没有自然流量验证**，不能写成「已在真实用户上生效」。
2. **面试页「出题后不点评」非探针比例 = 2/2，但两条都是「全站一遍过」的浏览形态，不是学习者中途放弃**：两个非探针 uid（`umsagboriz4qyurnd` VivoBrowser 分享链路 / `umst3tuisd7lgzaka` 原生小程序 dev/体验版）都在 4–5 min 内把首页→错题本→复习→AI 问答→面试→成长→周报→个人页每页停 2–8 s；面试页 `categories → question` 后 **3–4 s** 即离开（下一请求已是问答页/历史页），`interview_sessions` 无这两 uid 行。这是「浏览一遍」不是「出题后想答没答成」→ **不改**（不做续答提醒/自动点评）。
3. **成长页 onShow 9 个 uid 请求扇出（H5 与 W7 小程序同构）实测不值一个 `stats_bundle`**：生产 375 视口、CDP 弱网仿真下 9 并发墙钟 4G 276–418 ms（中位 337）/ 3G 374–391 ms（中位 386），同网况单个 `home_bundle` 182 / 306 ms → HTTP/2 复用下 9 并发 ≈ **1 RTT + 80–150 ms**，聚合上限收益 <1 RTT；后端 9 端点 p50 10–30 ms、p99 ≤762 ms、全文件 >1 s 仅 3 条（R62 立项时的 45 s 长尾已不存在）。→ **登记不做**。小程序侧另有一条硬约束（§4.3）随 W7 合并时注意。
4. R475 勘误一处：Referer `servicewechat.com/{appid}/0/` 的版本号 `0` 按微信官方文档 = **开发版、体验版以及审核版本**，不只「开发版」；R474/R475 写「开发版」应读作「非正式版」。
5. 到期项无增量；(c) 新容器后 404/5xx/monitor 0；`error_reason` ≥09-11 仍 0。

## 1. R475 发版后 (c) 补量 + 自然 single-flight 观测

filter：`ts ≥ 1788759123`（= 2026-09-07 05:32:03Z，`docker inspect -f {{.State.StartedAt}}` = `05:32:03.100Z`，同秒）。

| 项 | 值 |
|---|---|
| 非探针（无 `X-Kg-Probe`、非 140.232.64.x 出口）`POST /api/mistakes/analysis` | **0** |
| 探针 `mistakes/analysis` | 5（R475 4 并发 + 1 顺序） |
| `/assets/*` 404 | 0 |
| 5xx | 0 |
| `/api/monitor/report` | 0 |
| 小程序 UA / `servicewechat.com` Referer | 0 |
| 容器 | healthy、RestartCount 0 |

→ 「自然流量合并命中」本轮**不可观测**；下轮继续挂着，出现非探针 analysis 后再核「同 uid 起点重叠 + duration 相近 + gzip size 全同」三条件。

## 2. 面试页非探针漏斗（Caddy 全文件 09-05 18:44Z 起 + `interview_sessions` 只读）

归类：`probe = ip ∈ 140.232.64.x ∨ X-Kg-Probe ∨ 自动化 UA`（与后端 `auth.probe_request` 三路一致）。

| `/api/interview/*`（非探针） | 次数 |
|---|---|
| `categories` | 2 |
| `question` | 2 |
| `answer` / `answer/stream` | **0** |
| `history` | 2（同一 uid） |
| `sessions/{sid}` / `review/stream` | 0 |

（探针侧 interview 请求为历轮走查/回归，不计入漏斗。）

非探针 uid 逐条（UTC）：

**A. `umsagboriz4qyurnd`**（141.11.46.193，VivoBrowser，R475 已归因分享链路 `/s/fqpexz7g`）
```
10:43:18 exam/resume · home_bundle · review/cur · practice/resume  (首页, Referer /s/fqpexz7g)
10:43:25 mistakes · review                    (错题本)
10:43:26 mastery/map                          (知识点地图)
10:43:27 ask/cur · ask/sessions               (AI 问答)
10:43:30 interview/categories
10:43:32 interview/question                   ← 出题
10:43:35 ask/cur · review · ask/sessions      ← 3 s 后已在问答/复习页
10:43:40–44 同上 ×2
10:43:50 stats 9 连（recommend/mastery/profile/growth/shenlun/attempts/stats/summary/predict）+ review + mistakes
```
面试页停留 ≈ 5 s（30→35）；该 uid 自 10:43:18 出现（分享页领 uid）到 10:43:50 共 32 s 走 6 个页面（此前 08:55Z 起的 94 请求见 R475 §4）。

**B. `umst3tuisd7lgzaka`**（原生小程序，Referer `…/wx01f2f29cfe51baba/0/page-frame.html`，R474/R475 的 AI 重复请求同设备）
```
21:38:58 首页 → 21:39:43 练习(favs/status · notes) → 21:39:58 问答 → 21:40:10 成长 9 连
21:40:44/50 explain/stream ×2（41.5/41.7 s）
21:41:00 首页 → 21:41:04 错题本 → 21:41:38 redo → 21:41:42 share/create → 21:41:50 卷库
21:41:58 exam/start → 21:42:02/05/06 exam/progress ×3
21:41:24–21:41:48 起点 mistakes/analysis ×4（结束 21:41:59/42:04/42:07/42:19）
21:42:07 / :16 / :22 / :32 / :43 成长 9 连 ×5（onShow 每次切回都重发）
21:42:17 / :23 周报（weekly · next_event · read）
21:42:44 个人页 5 连（reminders · pk/mine · badges · growth · mistakes）
21:42:46 interview/history
21:42:47 interview/categories
21:42:49 interview/question                   ← 出题
21:42:53 interview/history + 个人页 5 连       ← 4 s 后已回个人页
21:42:54 favs → 21:42:57 team/mine → 21:43:01/07/08 个人页 5 连 ×3
```
面试页停留 ≈ 6 s（47→53），5 min 内 12+ 页面各停 2–8 s。

`interview_sessions` 全表 uid：`u26`（49 行 answer_log、probe 列前历史）、`test-w6-social-mp`（probe=1）、6 个 `ums*/umt*` 探针 uid；**无 A/B 两 uid**。

判定：两条都是「每页点一下看看」的浏览形态（面试题出来 3–4 s 就走，作答/点评需要 ≥1 min 口述或打字），与 R474 attempt 315「开卷答 3 题 8 s 后离开」同一设备同一形态。**「出题后不点评」= 日志未观测到 answer 接口**，不是「想答没答成」；不立项续答提醒/自动点评（无一手竞品、无用户诉求、且会对浏览用户造噪）。

## 3. 到期项（05:45–05:55Z，宿主直读卷 `mode=ro`）

| 项 | 值 | 变化 |
|---|---|---|
| `answer_log` probe=0 / uid | 33 / 1 | 无 |
| `growth_events` probe=0 / uid | 20 / 4 | 无 |
| `error_reason` 总 / ≥09-11 | 7 / **0** | 无 |
| `push_subs` | 0 | 无 |
| `weekly_reports` | 2 | 无 |
| `exam_attempts` probe=0 / total | 1 / 64 | 无 |
| WAL | 4,124,152 B | 同字节（R466 高水位复用） |
| 容器 | healthy、Restart 0 | |
| 宿主 | load 高但容器健康（不归因应用） | |

## 4. 成长页 9 请求扇出：先量再定（结论：登记不做 `stats_bundle`）

### 4.1 现状（源码）
- H5 `frontend-uni/src/pages/stats/stats.vue onShow()`：`loadHeatmap`(checkin/summary) · `predict.load`(predict) · `loadGrowth`(growth) · `loadReco`(recommend) · `loadSlStats`(shenlun/stats) · `loadMastery`(mastery/map) · `loadExamTrend`(exam/attempts + profile) · `load`(stats) = **9 个 uid GET / 每次 onShow**，TabBar 页每次切回都触发（B 设备 3 min 内 6 次 ×9）。
- main 上的原生小程序 `pages/stats/stats.ts` 只发 growth + checkin/summary（2 个）；**W7 分支 `w7-mp-flat-v3` 的 stats.ts 与 H5 同构 9 个**（事发设备跑的就是它）。
- 首页有 R62 `home_bundle`（4–5 → 1）先例，立项理由是当时 origin 45 s 级长尾「每多一个请求多一次抽中长尾」。

### 4.2 一手量测
后端侧（Caddy 全文件，全部流量）：

| 端点 | n | p50 | p90 | p99 | max |
|---|---|---|---|---|---|
| stats | 244 | 10 ms | 42 | 156 | 853 |
| growth | 280 | 14 | 47 | 168 | 531 |
| predict | 127 | 20 | 84 | 343 | 418 |
| recommend | 108 | 30 | 92 | 346 | 426 |
| shenlun/stats | 136 | 24 | 53 | 103 | 123 |
| mastery/map | 316 | 23 | 118 | 515 | 1274 |
| exam/attempts | 359 | 17 | 58 | 520 | 965 |
| profile | 450 | 11 | 52 | 712 | 1705 |
| checkin/summary | 267 | 12 | 67 | 762 | 792 |
| （对照）home_bundle | 569 | 27 | 110 | 1095 | 4045 |

9 端点 >1 s 全文件仅 3 条（mastery/map ×2、profile ×1）。R62 时代的长尾（R372/R373 已修）不复存在；`home_bundle` 自身 p99 反而是九者之最。

客户端侧（生产 `kaogong.zalize.com`，Playwright over CDP 375×812、`X-Kg-Probe: 1`、探针 uid、`Network.emulateNetworkConditions`；每轮首页→成长页触发 onShow，取 9 请求 request→requestfinished 的合并墙钟；同页同网况再 `fetch('/api/home_bundle')` ×3 作「单请求」对照；`/home/ubuntu/r476_fanout.py`）：

| 网况 | 9 并发墙钟（5 轮） | 单个 home_bundle（15 次） | 差 |
|---|---|---|---|
| 4G（RTT 100 ms / 4 Mbps） | 337 中位（276 / 294 / 337 / 418；首轮冷 8881*） | 182 中位（158–304） | ≈ +150 ms |
| 3G（RTT 300 ms / 1.6 Mbps） | 386 中位（374 / 379 / 386 / 391；首轮 1163*） | 306 中位（304–313） | ≈ +80 ms |

\* 首轮离群是首次导航分包下载与 9 请求同时抢带宽（4G 首轮 9 条 per-request 4.2–8.9 s 全慢），是「首访 + 弱网」的普遍现象，与扇出数无关，聚合改不掉。

### 4.3 判定
- 浏览器→边缘 HTTP/2 多路复用下，9 并发 ≈ 1 RTT + 80–150 ms；`stats_bundle` 理论上限收益 <1 RTT，且会把 9 个可独立渐进渲染的卡片绑成「最慢者决定首绘」（mastery/map p99 515 ms 拖全体）。**不立项**，与 R62 结论不矛盾（当时是长尾暴露面问题，现已不存在）。
- 小程序侧硬约束（微信官方文档「网络 › 使用限制」）：`wx.request` **最大并发 10**。W7 stats.ts 一次 onShow 9 个 + TabBar/首页残留请求即到上限；事发 21:42:07 的成长页 9 连发出时还有 2 条 `mistakes/analysis`（20–40 s）在飞 → 11 > 10，第 11 条要排队到某条 analysis 结束。当前只会多等百毫秒级，但**若再叠一条 explain（40 s）就会把成长页某卡片卡到 40 s**。W7 合 main 时值得把成长页收成 ≤8 个（或对 AI 长请求单独计数），此处只登记，不在 #619 动 W7 文件。
- 同文档另一条与 R475 相关：「小程序进入后台运行后，如果 5 s 内网络请求没有结束，会回调错误信息 `fail interrupted`；回到前台前网络请求接口无法调用」——分析/讲解 20–40 s 的请求若用户切后台会失败，端侧 `catch` 只显示「分析失败」；这解释不了 R475 的 4 并发（4 条都 200 完整），但 W8 的 `aiLoading` 守卫在 `fail interrupted` 后会被 `catch` 复位、允许重发，服务端 single-flight 此时正好兜住。

## 5. R475 勘误（指针）
- `servicewechat.com/{appid}/{version}/page-frame.html` 的 `{version}=0` 官方定义 = 开发版、体验版、审核版三者；`devtools` = 开发者工具。R474 §2 / R475 §1 的「开发版」应读作「非正式版（开发/体验/审核）」；结论（未发正式版、`aiLoading` 守卫未上线到正式版）不变。

## 6. 如实说明
- 「自然合并命中」不可观测 = 没有非探针 analysis 请求，不是 single-flight 无效也不是有效。
- 面试漏斗 n=2，「浏览形态」是按页停留时长（3–6 s）+ 全站遍历时序推断，无端侧事件；两台设备是否同一人未核（A 为 VivoBrowser、B 为原生小程序，机型都是 vivo）。
- 扇出量测：375 为 360 仿真、`emulateNetworkConditions` 是 Chrome 侧节流（不含真机基带/DNS）、`home_bundle` 作「单请求」对照其体量（gz 257 B）≈ 9 个之和的一半、非严格等体量；每网况 5 轮 + 15 次；未量真机、未量小程序（本机无微信开发者工具）。
- 后端 p50/p99 含探针流量（探针与真人走同一路径，时延口径不受影响）。
- 0 代码，无新门；沿用 R475 门（pytest 504 / ruff / pyright 0）。

## 7. 后续
- 挂：非探针 `mistakes/analysis` 一出现即核三条件（§1）。
- 挂：W7 合 main 前成长页 ≤8 请求 / AI 长请求与 10 并发上限的关系（§4.3）。
- 挂（老板侧）：宿主盘/守护 prune 参数、`www.zalize.com` 证书 10-04、`WX_MINIAPP_SECRET`、R385 第二冷样本、#619 人工合并。
