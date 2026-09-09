# R557：每日一练中途退出后首页两个「继续」同落点（pendingSession 落 `daily:{date,past}`）+ 错因自评标「（选填）」——研究 / 实修 / 生产复验

日期：2026-09-09。代码 PR #723（分支 `devin/1788927006-r557-daily-resume`，自 main `36106d5b`＝老板侧 W17 #722），已合入 main `6c36f9d0`。生产 `36106d5b → 0e42420f`（`index-CAuE5uRO.js`）。后端 0 改动。

## 1. 研究（先调查再发言）

### 1.1 R556 候选①：自然 `via='answer'` / `due_mid` 样本回看（生产只读 `~/r545/q557.py`）

- 近期非测试/非探针 `answer_log` 20 行 / 2 uid（2026-09-07，`source` 全 NULL）；非测试/非探针 `review_log.via='answer'` 仍 0 行。
- 结论不变：**无自然 `due_mid` 触达样本**，「今日回流 n 道」汇总不立项，继续观察。这是证据不足，不是产品失败。

### 1.2 R556-1：深链 `count=` 读参口径（源码一手核实）

- `practice.vue onLoad(query)` 只按 `qid/tag3/year+module/daily/module` 五路分派，**不读 `query.count`**；`start()` 的 `count` 只来自 storage 启动路径 `practiceLaunch.kind='start'` 的 `launch.count`。
- 全仓写入方：`rg "practice\?.*count=|&count="`（排除 `/api/questions` 的 limit 参数）**0 处**——没有任何页面/分享/SSR 链接向练习页 URL 写 `count=`；首页 `startPreset` / 「再练 10 题」/ 强化 5 道 / 学习计划剩余题量全部走 `practiceLaunch.count`（`home.vue` 716/1177/1181）。
- R556 复验里「`?count=5` 实际 10 题」是 testing agent 手拼的深链，不是真实入口。
- 决策：**保持未支持、不接入也不删**——没有写入方就没有用户可感知收益；接入会引入一条无调用方的 URL 口径，删则无物可删。登记为「URL 不支持 `count`，题量走 `practiceLaunch`」的口径事实，SKILL 已写入，避免下轮再当 bug 报。

### 1.3 生产游客 UX 走查（独立 testing agent，`e720e8cc`，报告 `~/kaogong-reports/r557-guest-ux.md`，证据 `~/r557-verify/`）

- 口径：375×812 主视口（1440 只看零作答首屏），冷 context（清 storage/SW/cache，仅写 `anonUid`），隔离 uid `test-r557-guest-a9516f6c`，从首页最突出入口「免注册立即开练」进入——一手核实它进的是**每日一练（今日全站同题 10 题）**，不是随机专项。
- 一手观察：首题答错 → 反馈 banner「正确答案 D · 已自动存入错题本」+ 错因自评 + 解析；「下一题」固定首屏可见，**未选错因也能继续**；第二题答对约 1186ms 自动进第三题；退出「保留进度」→ 首页同时出现 hero「今日已练 2/20 题 · 今日全站同题 10 题 · **继续目标**」与续练卡「**上次练习** · 已做 2/10 题 · **去继续**」。
- 286 个真实请求全 200；console/runtime/rejection/资源错误/付费 AI-OCR-explain 0；uid 精确清 7 行、保护表不变。
- 边界：有经验观察者、单 uid、单题组，不是真实新用户受试；不能据此证明流失因果。6 条摩擦候选 3×P2 + 3×P3，P1 无。

### 1.4 每日一练自然样本（`~/r545/q557e.py`/`q557f.py`，生产只读）

- 60 天非测试/非探针 `answer_log` 1054 行，命中当日每日题组 11 行 / 2 个 uid-日期（一个只答 1 题、一个答满 10 题）；非测试 `daily_set_entries` **0 行**——答满 10 题的那个 uid-日期**没有提交记录**；无同题重复作答、无组内 >10 分钟间隔；`growth_events` 60 天 `daily_open` 8、`practice_quit_end` 2。
- 结论：样本不足以量化「中途退出后回来重开被覆盖」发生率，也不足以支撑「今日回流」汇总；但 1.3 的双入口不同落点是**源码可复现的确定性缺陷**（不是概率问题），且「做满 10 题却 0 提交」与「从快照恢复后 `_daily=false` → 做完不打卡不提交」机制相符（**相符 ≠ 因果**，该样本也可能是别的原因，未求证）。

### 1.5 源码一手核实（`practice.vue` / `home.vue` / `practice-progress.js`）

- hero「继续目标」→ `heroPrimary()` → 今日未完成时 `startDaily()`：`trackEvent('daily_open')` → `GET /api/daily_set` → 重建 `items` 从第 1 题；每日题组按日固定 → 与本机 `pendingSession` 是同一组，但会**从第 1 题覆盖**已答进度。
- 续练卡「去继续」→ `resumeNow()` → `adoptLocalPending()` 接着第 k 题。
- `saveSession()` 快照无 `_daily/_dailyDate/_dailyPast` → 续练卡只能显「上次练习」（`pendingTitle` 卷名 > 重练 > ''）；恢复后 `_daily=false`，做完走普通完成页，**不打卡、不 `POST /api/daily_set/submit`**。
- 每日一练启动成功后不 `saveSession()`（R548 只给普通/重练启动补了即时落快照）→ 未作答刷新恢复不到每日一练。
- 错因自评标题「错因自评」，chips 可不选直接下一题（源码与走查一致），但界面没说可跳过。
- 小程序：每日一练在独立页 `pkgGrow/daily`（`fetchDailySet`），无 pendingSession/续练机制 → 不存在双入口问题；练习页 `practice.wxml` 错因标题同文案。

决策：选 1.3 的 P2-3（双「继续」不同落点 + 续练卡语义丢失）与 P3-2（错因选填未告知）作本轮最小可感知改动；P2-1（错答反馈信息层级）/P2-2（自动推进无预告）需 UX 设计论证，登记候选不在本轮混做。

## 2. 实修（#723，8 文件 +198/-13，0 后端 / 0 协议）

- `practice-progress.js`：`parsePendingPractice(saved, now)` 新增稳定字段 `daily`；`dailyFromPending(saved, now)`（`{date:'YYYY-MM-DD', past}`，**非当日一律 `past=true`**——昨晚开的组跨日后接着做按往期补练处理，不打今日卡、不提交全站成绩）；`dailyPendingFor(saved, day, now)`（同日、未做完、24h 内）；`dailyPendingTitle(d)`；`cnDayOf(now)` 东八区日期（与 `startDaily` 原口径同式）；`pendingTitle(saved, now)` 优先级 卷名 > 错题重练 > 每日一练 > ''。
- `practice.vue`：`startDaily()` 首行守卫（在 `_starting` 互斥与 `showLoading` **之前**，命中不留未配对 loading）→ `adoptLocalPending(pend)`；拉题成功后 `_source='daily'`、清 `_ptitle/_redoItems/_reviewed`、`saveSession()`；`saveSession()` 快照加 `daily`；`adoptLocalPending()` 还原 `_daily/_dailyDate/_dailyPast` + toast「继续今日一练 · 第 k/N 题」；模板「错因自评（选填）」。
- `home.vue`：`heroPrimaryText`（`todayDone ? 再练 10 题 : dailyPendingToday ? 继续今日一练 · 第 k/N 题 : 继续目标`，落点不变仍 `startDaily` → 守卫接着做）；`prLabel` 卷名 > 重练 > 每日一练 > 模块名。
- 小程序：仅 `practice.wxml` 文案。
- 测试：新 `tests/r557-daily-pending-resume.test.js` 12 用例（解析/跨日归 past/标题优先级/`dailyPendingFor` 边界/两页源锁）；`practice-progress` / R548 / R553-fix 三处既有源锁按新字段扩展。
- 本地门：H5 vitest 172 文件 1273 全绿 / eslint+tokens 0 error / build:h5 DONE；小程序 tsc / eslint 0 / vitest 56；`git diff --check` 空。
- 副产品：每日一练 `answer_log.source` 从 NULL 变 `daily`，此后可分辨每日一练样本（1.1/1.4 里「source 全 NULL」的口径从 0e42420f 起变化，后续查询注意分段）。

## 3. 生产复验（独立 testing agent，`0e42420f` / `index-CAuE5uRO.js`）

报告 `~/kaogong-reports/r557-daily-0e42420f-prod-verify.md`、证据 `~/r557v-0e42420f/`（`runtime-evidence.json`/`events.jsonl`/`network-audit.json`/`daily-db.json`/`final-db.json`/`clean.json`/`readonly-after-clean.json`/`drift-readonly.json`），录像 `~/screencasts/r557v-0e42420f-production/`。PR #723 评论附截图。口径：375×812 主视口、1440×900 抽检 A/B 首页文案；冷 context；隔离 uid `test-r557v-*`；全部从首页自然入口进入。

| 项 | 结果 | 要点 |
|---|---|---|
| A 首页每日入口 → 首错 → 答对 → 退出 | PASS 375/1440 | 首错反馈区标题「错因自评（选填）」；退出后 hero「继续今日一练 · 第 3/10 题」、续练卡「每日一练 · 今日全站同题 · 已做 2/10」，两宽一致 |
| B 两入口同落点 | PASS 375/1440 | hero 点击窗口内新增 `/api/daily_set` GET 0（首页重入的预取另计）、直接 Q3、toast「继续今日一练 · 第 3/10 题」、10 qid 序 / A、D 两答 / `daily`/`source` 不变；续练卡「去继续」同 Q3 |
| C 0 答物理 F5 | PASS 375 | 启动即落快照；新 Document 恢复同 10 题、Q1、0 答、`daily.date=今日/past=false/source=daily` |
| D 恢复后做完 | PASS 375 | 完成页显全站参与/排行榜（无字面「全站成绩」，控件为「今日全站同题」「今日排行榜」）；`POST /api/daily_set/submit` 200、date=今日、total=10；首页 hero「再练 10 题」、续练卡消失、`pendingSession` 空、`dailyPlan.days[今日]=true`。附带：已完成后点 hero 开普通新 10 题（`source=home_hero`、`daily=null`），既有设计 |
| E DB | PASS | 该 uid 今日 `answer_log` 10 行全 `source='daily'`（往期 1 行 daily、普通 2 行 NULL、redo 1 行分组清楚）；`daily_set_entries` 今日一行 |
| F 回归 | PASS 375 | 普通练习续练卡「常识判断 · 已做 2/10」、R548 重练卡「错题重练 · 已做 1/2」、hero 均「继续目标」（打卡前测） |
| G 往期补练 | PASS 375 | hero「补练往期」→ 09-08 答 1 题退出 → 续练卡「往期每日一练 · 2026-09-08」、hero 不显「继续今日一练」；再进同一期 sheet / 续练卡均恢复 Q2、`past=true` |
| 审计 | PASS | 591 请求 / 591 响应全 200（187 API，probe 缺头 0）；阻断/取消/资源失败/console error+warning/runtime/rejection/loading 配对 warning/付费 AI-OCR-explain 全 0；容器 healthy、restarts 0 |
| 清理 | PASS（全局 hash 项 FAIL 已归属） | 停录 → 关 context → 终审计 → 41 表按完整 uid 精确删 39 行；独立 exact + `test-r557v-%` 0 残留。五类全局 hash：`answer_log` 1396→1406，新增 10 行全为同机并发会话 `test-w17-h5-a/probe=1`，基线前 1396 行 hash 与基线一致、未删其他前缀；其余四类不变 |

harness 偏差（如实）：两次等待选择器写错（不存在的 `.hero`、完成页字面「全站成绩」）→ 改用真实可见按钮 / 参与-排行榜控件核证，应用 runtime 0；部分即时截图拍到 toast/sheet 淡出残影，关键首页证据已重拍稳定态。

UNTESTED：小程序（R536-1 累计，仅 tsc/eslint）；跨设备远程快照恢复（服务端不带 `daily` 位，改前改后同为普通语义）；24h 过期 / 真实跨午夜 `past` 归一（仅单测）；往期补练做完分支；1440 除 A/B 外流程；W17 其余改动。

## 4. 下一步（R558 候选）

- 1.3 P2-1 错答反馈信息层级（解析/来源/社交/第二解析/AI/纠错 ≈565px 纵向）与 P2-2 答对自动推进无预告（≈1.2s）：需 UX 设计论证（对标粉笔「答对即翻页」有无可配置/可撤销），不拍脑袋改。
- 自然 `via='answer'` / 每日一练 `source='daily'` 样本 ≥1 天后回看（本轮起可分辨）。
- 服务端 `/api/practice/progress` 快照是否带 `daily` 位（跨设备恢复每日语义）——先看远程恢复的自然使用量再定。
- R555-1 计时分支 P4 / 小程序真机（R536-1 累计）/ probe 真人口径。
