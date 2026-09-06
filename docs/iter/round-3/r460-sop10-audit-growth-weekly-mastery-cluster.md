# R460 SOP-10 四维审计：「成长页 / 周报 / 知识点趋势」簇（R430 次级屏审计后首次整体复审）→ 成长趋势「本周比上周」按真实周键判定 + 热力图合计窗口对齐格子 + 周标签/百分比不折行 + 两处模块 tab 热区 ≥40px

生产 `460120f` → `1177fb1`（R460）→ `fe57df3`（R460b）；后端不动、无 DB 写入；vitest +5 源锁（`tests/stats-r460-growth-week.test.js`）。改动 4 文件 +93/−7：`frontend-uni/src/checkin.js`（+`cnWeekKey`）、`src/pages/stats/stats.vue`、`src/pkgA/stats/mastery-map.vue`、新测试。

## 0. 竞品维度（如实）

粉笔的成长/周报/知识点次级屏仍需登录账号，本轮**无一手竞品截图、零竞品陈述、不据二手加功能**；命中项全部依据本仓既定契约（R411 正文字号 ≥24rpx、R440 可点目标纵向 ≥40px）+ 服务端口径与前端文案的一致性，用源码 + 生产量测证明。

## 1. 审计范围与一手手段

| 维度 | 手段 | 结果 |
|---|---|---|
| ① 运营/管理实体 | 生产 `/data/data.db` 只读（`docker exec -i deploy-kaogong-1 python3 -`，`file:/data/data.db?mode=ro`）：`answer_log` / `growth_events` / `weekly_reports` / `mistakes.error_reason` / `push_subs`；origin caddy 日志按 uid / IP / UA 反查 | 见 §2 |
| ② 核心用户功能 | 源码全读：`backend/app/db.py::growth_stats`、`report.py`（周报聚合/冻结/pending/empty/12 周保留）、`social.py`（打卡按 CST 日）、`insights.py`（`/api/mastery/map`、`/api/mastery/topic`、`/api/predict`）、`db.mastery_snapshot`；前端 `pages/stats/stats.vue`、`pages/stats/calendar.vue`、`pkgA/stats/weekly-report.vue`、`pkgA/stats/mastery-map.vue`、`checkin.js` | 见 §3 |
| ③ 落地/分发面 | 该簇无公开分发页（全部 uid 私有数据），只核 `/api/growth`、`/api/report/weekly`、`/api/mastery/map` 生产回包结构 | 与源码一致 |
| ④ 架构/生产证据 | Playwright CDP 375×812 DPR2 / 1440×900 只读量测生产成长卡与知识点地图（`X-Kg-Probe:1`）；容器 healthy / WAL / 部署窗口 origin 日志 | 见 §4、§6 |

## 2. 维度①：生产数据实况（只读，09-06/07）

- 到期项（严格 `probe=0`）：`answer_log` **22/1 → 33/1**；`growth_events` probe=0 **18/4 → 20/4**；`mistakes.error_reason` 非空 **6 → 7**（关联 probe=0 uid 的 **0 → 1**）；`push_subs` 0；`weekly_reports` **1 → 2**；`quick_check ok`；WAL 4,124,152 B（R455 口径：768 帧 → 已过 1000 帧自动 checkpoint 阈值后停在高水位，非泄漏）。
- **增量归因（origin 日志逐条）**：全部 11 行新 `answer_log` probe=0、`weekly_reports` 第 2 行、`error_reason` 第 7 条，都来自 uid `umst3tuisd7lgzaka` 在 **09-06 21:37–21:45Z（CST 05:37–05:45）** 的一次 H5 会话：`Cf-Connecting-Ip` `223.83.2.220` / `39.158.40.85`（移动网段）、UA `Android 16; V2405A`（vivo）、**无 `X-Kg-Probe` 头、非自动化 UA、不在 `KG_PROBE_CIDRS`** → 三路探针都不命中、probe=0 正确。该 uid 即 R425/R446 已归因的 **vivo 持有者（内部验收设备）**，与 `growth_events` probe=0 其余 3 个 uid 同源；**不构成外部真人样本**。
- 该会话恰好走完本簇：`/api/growth` ×15、`/api/mastery/map` ×7、`/api/stats` ×7、`/api/checkin/summary` ×10、`/api/report/weekly` ×2 + `/read` ×2（`weekly_reports` 行由设备首开惰性生成并标已读，`read_at == created_at`，**不是本轮量测写入**——本轮量测对该 uid 只发 GET，Devin 出口 `140.232.64.4` 全部带 `X-Kg-Probe:1`）。另有 11 次 `/api/answer_log` + `/api/mistakes` POST、`/api/explain/stream` ×2、`/api/ask/cur` ×1。
- `weekly_reports` 第 1 行仍是 R451 归因的同网段兄弟 Devin 会话 uid（`umtppgte7u8emh2vs`，answer_log 全 probe=1）。
- 结论：本簇**仍无可确认的外部真人使用样本**；不加社交证明 / 转化 / 排名类功能。到期项口径提醒：`weekly_reports` / `mistakes` 无 `probe` 列（R451 登记），本轮用 `EXISTS(answer_log a WHERE a.uid=… AND a.probe=0)` 关联。

## 3. 维度②：源码走查 → 3 处口径/表达缺陷 + 2 处热区命中

### 3.1 命中 A（P2，改）：成长趋势文案把「最后两条有数据周」固定叫「本周比上周」

- 服务端 `db.growth_stats(uid)`：近 8 周、`strftime('%Y-%W', created_at, 'unixepoch', '+8 hours')` 按周×模块聚合，**只返回有 `answer_log` 行的周**（中间无作答周不占位）。
- 改前 `stats.vue`：`growthDelta = rows[-1].pct − rows[-2].pct`，模板固定 `本周比上周{{ 提升/下降 }} N 个百分点`。用户隔周再练（如只在第 30、31 周有数据、当前第 36 周）会读到「本周比上周」——生产改前实测一个历史 uid 恰好就是这种形态：轨迹两行 `26年第30周 / 26年第31周`，文案却是「本周比上周提升 0 个百分点」。
- 修：`checkin.js` 新增 `cnWeekKey(d)` 与 SQLite/Python `%Y-%W` 同口径（周一起算、年内首个周一之前为第 00 周）；`stats.vue` 新增 `growthDeltaLabel`：末两行周键 == `cnWeekKey(cnToday)` 与 `cnWeekKey(cnToday−7d)` 时才叫「本周比上周」，否则点名两周（「26年第31周比26年第30周」）。`cnWeekKey` 与 Python `date.strftime('%Y-%W')` **2024-01-01 → 2027-12-31 共 1461 天逐日比对全部一致**（含 `2024-53`、`2025-00`、`2026-00` 边界），单测锁 9 个边界日。

### 3.2 命中 B（P3，改）：热力图「学习 N 次」合计窗口比 12 列格子多 0–6 天

- 格子：`hmCols` 起点 = 本周周一往前 77 天（`today − dow − 77`），12 列 × 7 天；合计 `hmTotal` 起点 = `today − 83`。周一当天两者相等，周日则合计比格子多算 6 天。生产当前 uid 数据稀疏未见数值差，属源码事实（测试 `- 83` 已锁死）。修：`hmTotal` 改用与格子同一起点。

### 3.3 命中 C（P3，改）：成长轨迹周标签 / 百分比列 375 下折行

- 改前 `.gw-wk` 宽 130rpx 无 nowrap、`.gw-pct` 宽 150rpx 无 nowrap：375 实测「26年第30周」/「95%（535题）」各折成两行。修：`.gw-wk` 150rpx、`.gw-pct` 180rpx，均 `flex-shrink:0; white-space:nowrap`；最长形态「26年第52周」「100%（9999题）」12px 下分别约 72 / 88 px < 75 / 90 px 列宽。

### 3.4 命中 D（R440 契约，改）：两处模块 tab 纵向热区 <40px

- `stats.vue .gw-tab`（成长轨迹模块切换）：改前 `padding:4rpx 18rpx` + 24rpx 字 + 1rpx 边框 ≈ 19px；改为 `padding:0 18rpx; min-height:40px; box-sizing:border-box; display:inline-flex; align-items:center`。
- `mastery-map.vue .tab`（知识点地图 375 手机态模块横滑行）：生产改前实测 **h 31.4px**；同法改 `padding:0 26rpx; min-height:40px`（R460b `fe57df3`）。1440 桌面态该行不渲染、改用 `.side-item`（实测 h 40 / w 220）。

### 3.5 未命中（登记不改）

- `report.py`：周一 CST 0 点后展示上一周、首访惰性聚合并冻结快照、无活动 `empty`、未完成周 `pending`、保留 12 周；`weekly-report.vue` loading / 旧快照提示 / empty / pending / error+重试 / 正文态齐全；`/api/report/weekly/read` 幂等。生产两条快照 payload 结构与源码一致。
- `insights.py` `/api/mastery/map` → `db.mastery_snapshot(uid)`：只聚合本 uid `answer_log`（不跨用户，无需 `REAL_TRAFFIC`）；`/api/exam/rank` 跨用户池已带 `REAL_TRAFFIC ∪ 本人`（R375）。生产回包 modules / groups / tiles / coverage / level 与源码一致；`mastery-map.vue` 字号已在 R430 抬到 ≥24rpx（本轮 grep 4 页样式块 `<24rpx` 均为 0）。
- `calendar.vue`：「今天」标记用设备本地 `new Date()`，格子数据用服务端 CST 日键；国内用户本地时区 = CST，R438 已登记为既定口径，不改。
- `stats.vue` 热力图/成长卡对空数据、`growth.weeks.length<2` 时 `growthDelta=null` 不渲染文案，无 NaN 路径。

## 4. 维度④：生产量测（改前 → 改后）

375×812 DPR2（浏览器 `clientWidth` 报 360，见 §7）/ 1440×900（cw 1425）：

| 项 | 改前 375 | 改后 375（`1177fb1`/`fe57df3`） | 改后 1440 |
|---|---|---|---|
| 成长文案（历史 uid，末两周 = 第 30/31 周） | 「本周比上周提升 0 个百分点」 | 「26年第31周比26年第30周提升 0 个百分点」 h16 | 同 h17 |
| 成长文案（vivo uid，末两周 = 第 35/36 周 = 上周/本周） | 「本周比上周下降 16 个百分点」 | 「本周比上周下降 16 个百分点」（口径成立时保留原文案） | — |
| `.gw-wk` / `.gw-pct` | 折两行 | h 16 单行、无溢出 | h 17 单行 |
| `.gw-tab` | ≈19（源码推算） | **40** | **40** |
| `mastery-map .tab` | **31.4** | **40** | 不渲染（`.side-item` 40） |
| `<12px` 叶子文本 | — | 仅 cw 360 环境下 24rpx→11.52px（见 §7） | `[]` |

截图：`/home/ubuntu/r460/mm_375.png`、`mm_1440.png`（知识点地图改后）；成长卡改后 375 截图见 PR 评论。

## 5. 本地验证

- vitest **84 files / 634 tests 全绿**（R460 +4、R460b +1；旧源上 `本周比上周{{`、`- 83)`、`.gw-tab` 无 min-height、`mastery .tab` 无 min-height 均先失败）；eslint（一次 `no-regex-spaces` 修为 `{4}` 后）绿；`npm run build:h5` 绿。后端无改动。

## 6. 部署与复验

- R460 `deploy_h5.sh --skip-build`：rc=0，容器 `started=21:58:38.99Z rev=1177fb1`，宿主 mem_avail 350 MB / load ≈1 / disk 90%；6b 首跑 `/` perf **0.88 一次 WARN** → 独立 `perf-budget.sh` 复跑 12 项全 OK（0.93 / LCP 2750 / CLS 0.06）。
- R460b：rc=0，`started=22:11:59.82Z rev=fe57df3`，compose 重建 21:10:41Z 发出 → 22:12:00Z 完成；6b 12 项一次全 OK（`/` 0.94 / LCP 2294 / CLS 0.06；`/tiku/` 1.00 / 966 / 0）。**部署窗口 22:10:30–22:13:30Z origin 89 请求非 2xx 0**（含部署轮询自身）。
- 两次部署后：health rev 对、bundle 一致（gzip 126 KB ≤160）、容器 running/healthy、`RestartCount 0`（R458 提醒：只证未被 policy 拉起）、`quick_check ok`、app-log 快照 653 行无 5xx/Traceback。

## 7. 未验证 / 限制（如实）

- 量测机 375×812 DPR2 仿真下 `document.documentElement.clientWidth` = **360**（1440 → 1425），24rpx 计算为 11.52px / 12px；源 CSS 全部 ≥24rpx、1440 对照 12px、生产真机未量 → 判定为仿真环境 client width/滚动条差异，**不据此改字号**（R449 SKILL 已登记同现象）。
- `cnWeekKey` 只按 `%Y-%W` 语义对拍 Python 1461 天，未对拍 SQLite `strftime` 本体（同标准，服务端就是 SQLite 算的键；生产两个 uid 的周键都与前端判定一致）。
- 热力图合计差异为源码推导 + 单测锁，生产当前 uid 数据稀疏未见数值差。
- vivo 设备 CST 05:37 会话是**内部验收设备**（R425/R446 归因），非外部真人；其首开周报 = 本簇首个 probe=0 使用样本，但样本数 1、来源已知。
- 没有 testing agent 录屏（本轮用户未另行授权 UI 测试）；所有量测为 Playwright CDP 只读脚本 + 截图。
- CDP 并行复用一次因 `service_worker` target attach 报错断连，改为单视口串行重跑（已入 SKILL）。
