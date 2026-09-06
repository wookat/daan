# R448 首页「补练往期 ›」右浮动在长文案下被挤到按钮上方——改绝对定位贴右 + 父行留位（注入文案一手实测 → 最小 CSS 修 → 生产复验）+ (c) 补量 + 到期项

生产 `c7347a1` → `98dffdf`（bundle `index-CYevCgSz.js` → `index-C9xXSO1z.js`；后端不动、无 DB 写入）。

## 1. 起点

R447 把 `.hero-ds-arc` 改 `float:right` 后留了一个「待老板定」：375 已完成态若带「· 🔥 连 N 天」推算会折到第二行。本轮按 R447 收尾承诺先核首页其它「回包后追加文案」行，再把 R447 的推算改成一手实测。

## 2. 一手取证

### 2.1 首页其它「回包后追加文案 + 行内文字链」行（源码）

grep `home.vue` 只有两处行内文字链：`.hero-ds-arc`（本行）与 `.sz-arc`「往期 ›」（`.sz-s` 行）。`.sz-s` 前文「每日 10 题 · 近半年国内时政热点 · 全站同题」是静态文案，不随回包变长；`.sz-t` 的「今日更新 / 已完成」`tag` 只切换、不接在文字链之前 → **无同类水平漂移**，不动。

### 2.2 R447 右浮动在长文案下的真实行为（生产 `c7347a1`，Playwright 注入文案，`/home/ubuntu/r448/hero_done_variants.py`）

方法：在真实首页 DOM 里把 `.hero-ds` 中「补练往期 ›」之外的文本节点替换为各态文案（streak≥2 生产无真实数据，只能注入；CSS/字体/布局都是线上真实的），量 `.hero-ds` 高、文字行矩形、`.hero-ds-arc` rect、`.hero-acts`/taskcard y。

| 视口 | 文案 | `.hero-ds` 高 | 文字行 | arc rect | acts y | 结论 |
|---|---|---|---|---|---|---|
| 375 | 已完成 答对 1/10 · 第 1 名 | 17 | 1 行止 262.7 | (280.4, 477.4, 64.6, 41) | 516.4 | 同 R447 实测 |
| 375 | 已完成 答对 10/10 · 第 1 名 | 17 | 1 行止 270.4 | (280.4, 477.4, …) | 516.4 | OK |
| 375 | 已完成 答对 5/10 · 🔥 连 2 天（无名次） | 17 | 1 行止 273.8 | (280.4, 477.4, …) | 516.4 | OK（但名次恒有，此态实际不出现） |
| 375 | **已完成 答对 1/10 · 第 1 名 · 🔥 连 2 天** | **17** | 1 行止 **324.5** | (280.4, **494.4**, 64.6, 41) | 516.4 | **浮动放不下被挤到下一行；行高不变 → 链接文字 y 506–523 压在「继续目标」按钮（516.4 起）顶部，41 px 热区 494–535 覆盖按钮顶部 19 px** |
| 375 | 已完成 答对 10/10 · 第 12 名 · 🔥 连 30 天 | 34 | 2 行 | (280.4, 494.4, …) | 533.4 | 文字自己折 2 行后浮动才落到第 2 行末，但仍压第 2 行文字 |
| 1440 | 以上全部 | 17 | 1 行 ≤ 667.9 | (1217.9, 380.2, …) | 419.2 | 924 px 行全部放得下 |

截图 `/home/ubuntu/r448/hero-375-done_rank1_streak2.png`（链接贴在按钮上沿）。

- 事实修正：R447 推算「会绕浮动折到第二行、不重叠」**是错的**——文字本身 290.5 px 放得进 307 px 行，是**浮动**放不下（剩 16.5 px）被推到下一行，而 `.hero-ds` 不是 BFC、高度不含浮动，浮动就悬在行外压到 `.hero-acts`。
- 触发条件：`dsDone.rank` 恒有（`my_rank = 比我分高的人数 + 1`，参与者 ≥1 必有），`streak≥2` = 同一 uid 连续两天做完每日一练 → **任何真人连做两天即命中，375 主视口**。生产 `daily_set_entries` 只 1 行 probe=1（R447 testing agent 留存），probe=0 0 行 → 尚无真人受害，是 R447 引入的 P2 布局缺陷。

## 3. 设计取舍

- A 回退 `inline-block`：R445 尾项 0.0024 漂移回来；长文案下链接跟着文字折到第 2 行行尾（不重叠）。
- B `.hero-ds{display:flow-root}` 让浮动计入高度：热区靠 -12px 负外边距撑出，flow-root 只含 17 px 的外边距盒，链接文字仍溢到按钮上 2 px、热区仍压按钮 → 不解决。
- C 父级 flex + 文字包一层 `<text>`：需改模板（uni `<text>` 嵌套编译成 span；匿名 flex item 不能设 `flex-shrink:0`，CJK 文本 min-content 为单字会先把文字压成多行）。
- D（采纳，CSS 两条）：`.hero-ds { position:relative; padding-right:124rpx }` + `.hero-ds-arc { position:absolute; right:-8rpx; top:50%; transform:translateY(-50%); padding:12px 8rpx }`。链接脱离文档流恒贴右，文字在预留 62 px（链接文字 56.6 + 间距 ≥4）左侧自然折行，行高随文字增长把 `.hero-acts` 推下去、链接对行垂直居中；短文案下 rect 与 R447 **像素一致**（`top:50%` − 20.5 = −12 px，等于原负外边距）；无 x 漂移；不依赖浮动放不放得下。R440 热区契约（41 px）不变。
- 缩文案（去「已完成」/「🔥N」）作为备选否决：12 px 字下「答对 10/10 · 第 12 名 · 🔥 连 30 天」仍超 246 px，缩文案救不了全部形态；D 之后长文案是折行不是压叠，无需缩。

## 4. 改动（`98dffdf`）

- `frontend-uni/src/pages/home/home.vue` 样式块 2 行（`.hero-ds` / `.hero-ds-arc`）。
- `tests/home-r447-hero-ds-arc-float.test.js` 改为锁 absolute/right/top/translateY/无 float/padding + `.hero-ds` relative 与 `padding-right` 122–140rpx 区间。
- `tests/home-r440-fontfloor.test.js` 热区契约再放宽一档：inline-block / float / absolute 三者之一；负外边距只对非 absolute 盒要求。
- 本地：vitest 623（+1）/ eslint / `build:h5` 绿。

## 5. 复验

- 本地 dist 经 `/home/ubuntu/r442/proxy.py` 代理（`X-Kg-Probe:1`）跑同一注入脚本：短文案 375/1440 rect 与 R447 完全一致；长文案 375 `.hero-ds` 34、2 行、arc (280.4, 485.9)（居中）、acts 533.4（+17）、无重叠；1440 全单行。
- 部署 `deploy_h5.sh` rc=0：线上 rev `98dffdf`、bundle 一致、gzip 125 KB；6b 首跑 `/` performance 0.88 一次 WARN（LCP 2280 / CLS 0.06 OK），单独重跑 `perf-budget.sh` 12 项全 OK（`/` perf 0.93 / LCP 2772 / CLS 0.06；`/tiku/` 1.00 / 955）——LH simulate 双峰见 R443，bundle 只多两条 CSS。
- 生产同脚本复跑：与本地 dist 逐项相同。
- testing agent（`r448-ui-a`，375/1440，录屏 `/home/ubuntu/screencasts/r448-regress/r448-regress-edited.mp4`，报告 `/home/ubuntu/r448_test_report.md`）(a)–(e) 全 PASS：拦 `/api/daily_set` 405/401 帧 + 正常 407/402 帧 arc/acts/taskcard Δ0；点链接弹 7 天 sheet、左侧文字不误触、三枚 hero 按钮顶部 +2.6～4.6 px 点击正常；**原生做完 10 题**已完成态两视口单行右对齐；在已完成 DOM 注入「第 12 名 · 🔥 连 30 天」375 → 2 行、arc 中心 = 行中心、arc 底 205.5 < acts 212（+17）、无重叠，1440 单行；`<12px []`、console 0、`/api` 165 条非 2xx 0、healthy 0 重启、日志 5xx/Traceback/locked 0、清理 5 表 26 行 LEFTOVER 0。
- testing agent 如实登记（非本轮回归）：短文案下 arc 41 px 热区与「今日计划」按钮 top 有 2 px 重叠（375 y 516.4–518.4、只覆盖右侧按钮；R440 起既有，R447/R448 rect 相同），长文案两行态下消失。可把 arc 上下 padding 12→10 消除，本轮不动（R440 热区 ≥40 px 契约）。

## 6. (c) 自然旧壳 404 补量（R447 发版 17:58:51Z 后 24 min，caddy 源站）

246 请求：200 ×239、304 ×7（全是本机 Chrome `/sw.js`）；`/assets/*` 404 **0**、`/api/monitor/report` 0、`sheet-x` 0 → 仍无样本，继续挂。本次 R448 发版后同样待下轮补量。

## 7. 到期项（09-06 18:53Z，只读）

`answer_log` probe=0 22 行/1 uid（max 09-06 08:57，不变）；`error_reason` 6 行、与 probe=0 关联 0；`push_subs` 0 / `weekly_reports` 0；`growth_events` probe=0 18 行/4 uid（同 R446）；29/29 `next_review` 在 CST 00:00；WAL 1.6 MB（测试 agent 写入后，64 MiB 阈值未触发）；容器 healthy 0 重启。

## 8. 事实 / 推断 / 未验证

- 事实：§2.2 表全部为线上真实 CSS 下的 Playwright 量测；短文案 rect 改前后像素一致；长文案态改后无重叠。
- 推断：「任何真人连做两天即命中」是按 `daily_set_submit` 的 `my_rank`/`streak` 计算逻辑推出的条件，生产尚无 probe=0 的 `daily_set_entries`。
- 未验证：量测机无 emoji 字体（🔥 为 □），真机彩色 emoji 宽度可能差几 px，只影响折行点不影响结论；`padding-right:124rpx` 按 1rpx=0.5px（两视口实测 fs 12px / arc 宽 64.6 一致）预留，若将来改 `.hero-ds-arc` 文案或字号需同步。
