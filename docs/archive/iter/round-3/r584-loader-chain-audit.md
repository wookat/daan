# R584 · 研究/设计轮（不立项）：全站 `snapPeek + request` 加载器内部串行链只读枚举 + 375/1440 错题本·复习模式首屏走查 + 自然样本回看 + 测试残留清账

分支 `devin/1789050787-r583-stats-reco-parallel`（R583 分支，本轮只加文档）；**0 代码改动、0 发版、不建新 PR**（文档随 #762 分支提交）。

## 结论（先讲）

1. **R582/R583 之后 H5 已无「互不依赖却串行 `await`」的首屏加载链**：全仓 `pages/**/*.vue` 内含 ≥2 处 `await request(...)` / `await <api.js 网络包装>(...)` 的 async 方法逐个读源码归类（下表），剩余串行全部是真依赖（后一请求要前一请求的结果或副作用）、条件回退（前一空才发后一）、浏览器 API 链（权限/SW/订阅），或只在 `home_bundle` 失败回退分支才进入（R583 已核 7d 48/48 全 200、回退 0 次）。**不做全站重构、不立项。**
2. 唯一的「请求本身不依赖、只是应用时依赖」的后置请求是错题本 `book.load()` 里 `/api/mastery/map`（在 `mistakes`/`review` 回包后才发）：生产 375 慢窗 `mistakes` 5.08s 回 → mastery 5.08s 发 / 5.63s 回；快窗 0.63 → 0.74 / 1.03s。但掌握度百分比只渲染在「按模块查看」侧卡（375 在第 8 张卡之后、1440 在右栏第 4 张卡，两尺寸都不在首屏，文本快照第 82/107 行）→ **非首屏、无用户可感知延迟证据**，登记 **R584-3（P3 候选）** 不改。
3. 375/1440 错题本（待掌握 8 · 今日待复习 8）、复习模式（复习 1/8）、收藏 tab 冷加载走查：API 84 + 20 全 2xx、requestfailed 0、console/pageerror 0；首屏无溢出/遮挡/误导空态、CTA「开始复习」主次层级清楚 → **无 P0/P1**。
4. 自然样本 7 天窗（167.8h，POST 6523 条，剔 `X-Kg-Probe`/harness UA/IP）：`POST /api/practice_result` 自然 **200×4、非 2xx / status 0 = 0**（500×2 / 400×2 / 503×7 / 502×1 全 harness）→ **R580-1 继续登记不实施**。
5. 清账：`review_cur` 只读盘点时发现 **`test-r567-shots-375` 11 行残留**（mistakes 6 / review_log 1 / growth_events 3 / review_cur 1，review_cur 行 `updated_at` ≈20h 前——推断为浏览器持久 localStorage 里旧 `anonUid` 在后续走查中写回，未一手证明）→ 本轮按精确 uid 清 11 行；本轮自身 `test-r584-shots` 26 行清 0；两次 `after {}`、共享 `test-r562-modal-%` 42 行保持、10 张保护表 digest 前后一致。另盘出 **R544 之前旧会话留下的 `test-w*-*` / `test-pr629-*` / `test-r375-oimf` / `test-r381b-3dz2` / `test-r562-d1-ro` / `test-r563-enter-a|b` 共 39 个 uid**（answer_log 283 / growth_events 206 / mistakes 63 / exam_attempts 32 / pk_matches 9 …），非本轮引入、未清（见 R584-1）。

## 研究一手

### 宿主 / health（`~/r584/q584a.sh`，只读）

- `load 18.88 / 17.23 / 15.29`，`MemAvailable 238MB / 1935MB`，`disk 88.6%`；health `{"ok":true,"rev":"ec8206e5"}` **1.756s**。未 kill、未叠 build、未改配置。
- Pages bundle 全程 `index-DEX103Q0`（R583）。

### 自然 POST 样本（Caddy 只读，13 个文件，窗 167.8h）

| 端点 | 自然 | 自然 p50/p90 | harness |
|---|---|---|---|
| `/api/practice_result` | `{200: 4}` | 0.02 / 0.04s | `{200: 221, 503: 7, 500: 2, 400: 2, 502: 1}` |
| `/api/answer_log` | `{200: 53}` | 0.01 / 0.06s | `{200: 3274, 503: 96, 429: 31, 0: 13, 502: 1, 500: 1}` |
| `/api/practice/progress` | `{200: 29}` | 0.01 / 0.03s | `{200: 2633, 503: 41, 502: 2}` |
| `/api/daily_set/submit` / `/api/merge_anon` / `/api/favs` | 0 | — | `{200: 48, 400: 1, 503: 1}` / `{}` / `{200: 59, 400: 3}` |

→ 自然请求全 200 且 p90 ≤ 0.06s；非 2xx 与 status 0 全部来自复验 harness（含 R580 fin11 的 503 窗）。R580-1 触发条件（自然非 2xx / status 0 首例）**未出现**。

### 加载器内部串行链枚举（源码逐读）

扫描：`pages/**/*.vue` 中同一 async 方法内 ≥2 处 `await request(` 或 `await <api.js 导出的网络包装>(`（`fetchFavs / removeFav / fetchCheckinBadges / fetchCheckinSummary / …`；第一版只搜 `await request` 漏掉包装，第二版从 `api.js` 解析导出名再搜）。

| 方法 | 链 | 归类 | 处置 |
|---|---|---|---|
| `profile.loadRemote()` | profile → growth → announcement | 互不依赖 | **R582 已并发** |
| `stats.loadReco()` | recommend → review | 互不依赖 | **R583 已并发** |
| `book.load()` | `Promise.all(mistakes, review)` → mastery/map | 前两者已并发；mastery 请求不依赖、**应用**依赖（把 pct 写进已加载分组），且非首屏 | R584-3 登记不改 |
| `home.loadHome()` 回退 | `loadPlan(); loadBadges(); await loadProfile()` | 已并发起跑；`loadProfile → plan/today` 真依赖；仅 bundle 失败进入（7d 0 次） | R583 已论证不立项 |
| `home.loadBadges()` | badges → summary | 互不依赖，**但只从上面回退分支调用**（全文件唯一调用点 L973） | 不立项（0 次进入） |
| `home.setFocus()` | POST user_state → GET daily_plan | 真依赖（先写焦点再取计划） | 不改 |
| `profile.getCoach()` | GET stats → POST coach(stats) | 真依赖（payload 用前一回包） | 不改 |
| `book.unfavCloud()` | fetchFavs → removeFav(id) | 真依赖（本机条目无云 id 时回查） | 不改 |
| `practice.start()` | questions → 最多 4 级条件回退 | 条件回退（前一空才发） | 不改 |
| `practice.startDaily()` | 缓存命中 or daily_set | 条件分支 | 不改 |
| `practice.pushNudgeGo()` | 通知权限 → SW ready → subscribe → POST | 浏览器 API 链 | 不改 |
| `calendar.onShow()` | `loadBadges(); loadDays()` 各自 async | 已并发 | 不改 |

### 375/1440 错题本 · 复习模式 · 收藏 tab 冷加载（`~/r584/walk584.py`，CDP 复用现有 Chrome，uid `test-r584-shots` 预置 10 答 8 错）

- 路由口径：**生产没有 `/pages/review/review`**（`pages.json` 无此页），复习是 `pages/book/book` 页内模式，入口 = 先写 storage `autoStartReview=1` 再进错题本（首页 CTA 同路径）。脚本第一版走错路由，改正后取证。
- 375 冷加载时序（慢窗）：`favs / review/cur / mistakes / review` **同 tick 0.0 发出**；review 2.56s、review/cur 2.99s、favs 3.07s、mistakes 5.08s 回；mastery/map 5.08s 发 / 5.63s 回。复习模式进入后 2.23s `POST /api/review/cur`（快照 1.5s 防抖）200。快窗 4 请求 0.61–0.63s 回、mastery 1.03s。
- 1440：4 请求同 tick、0.97–1.05s 回、mastery 1.22 → 1.48s。
- 结果：API 375 84 / 1440 20 全 2xx、bad 0、console 0、pageerror 0。截图 `~/r584/shots/{375,1440}-{book,review,book-fav}[-full].png` + 文本快照 `.txt`。
- 首屏观察（375）：三格「8 题今日待复习 / 7 分钟预计 / 8 题累计错题」+ 主 CTA「开始复习」+ 三 tab + 模块 chips + 「错题重练」入口 + 搜索 + 首张卡（题型 chip · 今日待复习 · 时间 · 题干 · 点开看答案与详解）；复习模式「复习 1/8 · 退出复习」+ 题干 + A–D 选项，FAB 在复习中隐藏。1440 右栏 `8 全部错题 / 8 待掌握 / 0 已掌握`、错题趋势、本月复盘、AI 错题分析。**无 P0/P1**。
- 顺带观察（1440 book 截图，测试顺序造成）：复习模式进入后 0 答就离开，`reviewSnap`（本机 2h TTL）+ 服务端 `review_cur` 都会留下 `rIdx=0, answered=false` 的零进度快照，下次进错题本显「上次复习中断在第 1/8 题 · 进度已保留，可原位继续」。生产 `review_cur` 全表只 1 条自然行（`rIdx=0 answered=true n=1`，115.9h 前，本机 TTL 早已过期），零进度自然样本 **0** → 登记 **R584-2（P3 UX，无样本不改）**。

### 清账（`~/r584/clean584.py` 经 SSH stdin 宿主执行，`ro → clean` 内含 before/after）

- `test-r567-shots-375`：before `{mistakes: 6, review_log: 1, growth_events: 3, review_cur: 1}` → deleted 11 → after `{}`。
- `test-r584-shots`：before `{mistakes: 8, practice_results: 1, answer_log: 10, growth_events: 5, daily_set_entries: 1, review_cur: 1}` → deleted 26 → after `{}`。
- 两次：41 张含 uid 表、共享 `test-r562-modal-%` 42 行保持、`users/questions/answer_log/question_favs/mistakes/growth_events/explain_cache/paper_exports/daily_set_entries/practice_results` digest（剔本前缀）前后一致。
- `ro 'test-%'` 全景（未清）：见结论 5；**R584-1**：这些 uid 全部不在 SKILL/handoff/状态.md 任何 fixture 引用里（grep 0 命中），下一轮如无异议按精确 uid 列表分批清（每批 ro→clean→ro、保护表 digest 校验），`test-r562-modal-%` 42 行仍不动。

## 登记

- **R584-1**（清账，P2 数据卫生）：39 个旧会话 `test-%` uid 残留（详见上），下一轮清。
- **R584-2**（P3 UX，无自然样本）：零进度复习快照也显「进度已保留」续卡；候选口径：`answered=false && rIdx=0 && picked=null` 时不写快照/不显续卡（本机 + `review/cur` 同口径）。
- **R584-3**（P3 候选）：`book.load()` 的 `/api/mastery/map` 可与 `mistakes/review` 同 tick 发出、在两者都回包后再应用；非首屏，需先有「侧卡掌握度迟到」的用户可感知证据再动。

## UNTESTED / 口径

- 枚举只覆盖 `frontend-uni/src/pages/**/*.vue` 的 `await request` / `await <api.js 包装>`，未覆盖 `.then` 链与 `components/`、`mixins/`（R572 `snapshotViewMixin` 无网络请求）。
- 375 慢窗与快窗各一次，未做多轮统计；1440 一次。
- 零进度复习快照的跨设备表现（另一设备读 `review_cur`）未实测，仅源码 + 同机 1440 截图。
- 小程序端加载器未枚举（本轮 H5 only 议题）。
