# R489：6 个问答入口的非探针漏斗只读盘点——5 个已埋点入口自 09-03 上线 0 真人点击；全产品自然 `explain/stream` 提交 2 uid / 3 次全是「刚做完题 → 深链讲解」形态

日期：2026-09-07（UTC）。生产仍 `896007c`（本轮 0 代码、不发版；只登记）。

> **R490 勘误**：§0.3 / §3「`umsacie7` 09-05 那次带 qid 深链按排除法走的是练习页」**不成立**。Caddy 逐请求：17:05:56Z 同一秒 `GET /api/attempts|notes|comments/count?…question_id=234494`（`/api/attempts` 全 `book.vue` 只在列表 `toggleCard(m)` 调用）→ 17:05:57Z 问答页 onShow，中间 0 条 `/api/track` → 入口是错题本**列表**展开卡「AI 详解」`redo(m)`，它是 R487/R489「6 入口」漏数的第 7 个、也无埋点。排除法的前提「无埋点的入口只有练习页」本身错了。R490 已补 `book_ask_click`；见 `r490-sop10-book-list-ask-deeplink-only-natural-qid-entry-untracked.md` §3。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量**（§1）：R487 容器（09:51:52Z 起）截至 10:14Z 仍 108 请求（与 R488 同，最后一条 10:04:20Z）、全本机/探针/bot；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3tuisd7lgzaka` 0 回访；`practice_ask_click` 仍只有 R487 探针 2 行；`explain_cache qid` 0/82；时政 qid 非空 0/0；`error_reason` 7 / ≥09-11 0；WAL 同字节；healthy 0 重启。Lighthouse「运行失败」本轮无部署、无新样本。
2. **5 个已埋点问答入口（R326–R339，09-03 合入）在 `growth_events` 全表**（§2）：`search/review/report/fav/history_ask_click` **probe=0 合计 0 行**、probe=NULL 0 行；全表只有 1 行 `search_ask_click`（probe=1，09-06 10:16Z，探针）。`ask_view_question`（问答页「查看原题」）全表 0 行。7 个事件名在生产当前 bundle 各自分包里**都在**（§2.2），不是没发上去。
3. **非探针问答页触达 → 提交 漏斗（Caddy 5 文件 08-31 起 + DB）**（§3）：
   - H5 `umsagboriz4qyurnd`（09-06，分享进站的 VivoBrowser）：问答页 `GET /api/ask/cur+sessions` 6 对（两段各 3 对、间隔 6–17 s = 来回切 Tab）→ `explain/stream` **0**、`ask_cur` 无行。6 个入口埋点 0 行 → 是**从 TabBar 直接进的问答页**、没带题。
   - H5 `umsacie728f4ghcv8`（09-05 17:07:18Z）：`explain/stream` ×1（R477/R486 已核 body 带 `qid=234494`，早于 R421）；同 uid 16:42–16:43Z 的 3 个埋点是 `comeback_view/boot/heatmap_view`，之后到 17:07 **无任何 `*_ask_click`** → 按排除法这次带 qid 深链走的是当时唯一无埋点的入口 = 练习页「用花生十三方法详解」（推断：前提是 5 个埋点 09-05 前已上线且 `trackEvent` 未静默失败；该 uid 08-01 有 60 条 probe=NULL 作答、09-05 回访，两段各用不同出口 IP，身份不确定）。
   - W7 小程序 `umst3tuisd7lgzaka`（09-06 21:40Z）：`explain/stream` ×2 + `POST /api/ask/cur` ×1（R487 已核：刚答错 `questions.296322` 后深链讲解；W7 无埋点、不发 qid）。
   - **合计**：自然 `explain/stream` 提交 2 uid / 3 次，**全部**是「刚做完题 → 深链讲解」形态（H5 练习页 1 次为排除法推断、W7 2 次）；来自 search/review/report/fav/history 5 个入口 0；问答页自由输入提交 0。`ask_cur` 另 3 行 `umtp*`（09-06 10:26–11:46Z）全是 probe=1 uid（R421/R422 走查）。
4. **判定**：不立项、不改码。样本量（4 天、非探针 H5 3 uid / 小程序 1 uid）不足以判 5 个入口「没人用 = 有缺陷」，且 R479 已核问答页 375 无字号/热区命中、R333–R339 各入口有源锁；能说的只有「R326–R339 五个入口的收益至今在真实流量上 0 验证」。登记项与 R486「R421 直通收益未验证」、R487「practice_ask_click 真人首条」合并观察，观察指标 = 任一 `*_ask_click` probe=0 首行 / `explain_cache.qid` 首次非空。

## 1. (c) 补量 / 到期项（生产只读，09-07 10:14Z，`~/r489_post.out`）

```
container deploy-kaogong-1 healthy restarts=0 started=2026-09-07T09:51:52Z
disk avail 3.6G (93%)   load 0.26 0.56 1.34   WAL 4,124,152 B（同字节）
caddy since start: total 108（last 10:04:20Z） 5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  trackPOST 5（同 R488）
probe=0 answer_log 33/1   growth probe=0 20/4   practice_ask_click [(probe=1, 2)]
explain_cache qid nonnull 0/82   时政且 qid 非空 answer_log 0 / mistakes 0   error_reason 7 / ≥09-11 0
```

`umst3tuisd7lgzaka`：容器起后 0 请求。

## 2. 5 个已埋点入口的 `growth_events` 全表口径

### 2.1 事件名 → 上线 commit（`git log -S`，均 2026-09-03）

| 事件 | 页面 | commit |
|---|---|---|
| `search_ask_click` | `pkgA/search/search.vue:202` | `b65ac08` R333 |
| `review_ask_click` | `pages/book/book.vue:1436` | `80dce10` R326 |
| `report_ask_click` | `pkgA/exam/report.vue:489` | `80dce10` R326 |
| `fav_ask_click` | `pkgA/social/favorites.vue:307` | `2bb985c` R334 |
| `history_ask_click` | `pkgA/stats/practice-history.vue:143` | `c7a6dd9` R335 |
| `ask_view_question` | `pages/ask/ask.vue:332` | `0323231` R339 |
| `practice_ask_click` | `pages/practice/practice.vue:2318` | `896007c` R487 |

`growth_events` 按 `event like '%ask%'` 分 probe 聚合（全表）：

```
practice_ask_click  probe=1  2   09-07 09:58:27Z（R487 探针）
search_ask_click    probe=1  1   09-06 10:16:02Z（探针）
task_card_click     probe=NULL 11 08-09..08-18（与问答无关，只是名字含 ask）
```

其余 5 个事件名 **0 行**（含 probe=0 / NULL / 1）。probe=0 全表 20 行 / 4 uid 逐行见 `~/r489_db.out`：boot / comeback_view / heatmap_view / reminder_optin / share_copy / share_open / review_entry_click / review_similar_auto，**无一条 `*_ask_click`**。

### 2.2 生产 bundle 一手（`index-Dm-hobV2.js` 引用的分包，`X-Kg-Probe: 1` 拉取）

```
search_ask_click   → pkgA-search-search.Dy_0W2_D.js
review_ask_click   → pages-book-book.DDk2E27m.js
report_ask_click   → pkgA-exam-report.BdTi9TED.js
fav_ask_click      → pkgA-social-favorites.CUdTvoJu.js
history_ask_click  → pkgA-stats-practice-history.DK9mesA6.js
practice_ask_click → pages-practice-practice.Ll3wF6Ra.js
ask_view_question  → pages-ask-ask.Bzht-pKO.js
```

7/7 在线上分包里。后端 `team.py:568-569` 白名单同名 7 项（R487 有同步锁单测）。

## 3. 非探针问答漏斗（Caddy `kaogong-origin.zalize.com-access*` 5 文件，最早 08-31 07:50Z；`~/r489_caddy.out`）

非探针（剔探针网段 / `X-Kg-Probe` / bot UA）的 `POST /api/track` 与 `/api/explain*` 全量 30 行，按 uid 归并：

| uid | 端 | 埋点（growth probe=0） | 问答页 GET cur+sessions | `explain/stream` | `ask_cur` 落库 | 入口判定 |
|---|---|---|---|---|---|---|
| `umsacie728f4ghcv8` | H5 Win | 09-05 16:42:49 comeback_view / 16:42:56 boot / 16:43:03 heatmap_view | （日志内未见 09-05 ask GET，见注） | 09-05 17:07:18Z ×1（qid 234494） | 17:07:22Z 1 行 | 16:43→17:07 无 `*_ask_click` → 练习页深链（排除法推断） |
| `umsagboriz4qyurnd` | H5 Vivo | 09-06 share_open ×2 / boot / comeback_view / heatmap_view ×2 | 08:59:13 / 08:59:19 / 10:43:27 / 10:43:35 / 10:43:40 / 10:43:44 共 6 对 | 0 | 无 | TabBar 直进、未带题、未提交 |
| `umst3tuisd7lgzaka` | W7 小程序 | 09-06 21:37:55 heatmap_view / 21:41:43 share_copy | 21:39:58 1 对 | 21:40:44 / 21:40:50 ×2 | 21:41:02 1 行 | W7 深链讲解（R487 已核） |

注：`umsacie7` 09-05 的问答页 GET 不在本次 `/api/ask` 过滤结果里——R477 当时按 body 核的是 `explain/stream`，本轮未再展开该 uid 09-05 整段（不影响结论：`explain/stream` 200 一手在）。

另：`150.109.230.174`（09-04 20:33Z / 09-05 03:48Z，iPhone 与 X11 UA 交替、无 Referer）4 条 `POST /api/track` 不在 growth probe=0 里 → 已按 UA/头判 probe=1，不计入真人。

## 4. 取证自纠

- Caddy 轮转文件名是 `kaogong-origin.zalize.com-access-<date>.log.gz`，glob 写 `…-access.log*` 会**只匹配当前文件**（首版漏掉 09-05 18:44Z 前全部，`umsacie7` 那条 `explain/stream` 就在轮转文件里）；要用 `…-access*`。仍然不要用 `/var/log/caddy/*.log*`（R485 兄弟站点污染）。
- `error_reason` 列在 `mistakes` 不在 `answer_log`；到期项 SQL 从 `~/r487_db3.sh` 复制而不是重写。
- 容器起点 epoch 要用 `docker inspect StartedAt` 换算（R484 教训再犯一次：首版把 09:51:52Z 手算错 4 天，Caddy 窗口计出 0 条）。

## 5. 如实说明

- 「练习页深链」对 `umsacie7` 09-05 那次是排除法推断，未看到 `practice_ask_click`（当时还没有该埋点）；若 5 个埋点里任一 `trackEvent` 在其浏览器上静默失败，推断不成立。
- 5 个入口 0 点击不能判「入口不可见 / 不可用」：R479 375 一手已核问答页热区，各入口页面（search/favorites/history/report/book）非探针 4 天里到访本身就极少（R482 分享链路 n=1）。
- 无 testing agent 录屏（未另行授权）；本轮 0 库写入（只 GET 分包 + 只读 SQL + 只读日志）。
- 仍无可确认外部真人完成「练习→作答→错题→复习→掌握」完整闭环。
