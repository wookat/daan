# R393：`Devin/1.0` UA 归自动化 + 候选真人剔除显式探针头 / 非正式域名（pages.dev）

日期：2026-09-05 · 分支 `devin/*-r393-devin-ua-offhost`（base=main）· 类型：数据说话权修正，零功能改动

## 1. 一手取证（09-05 03:00–03:40Z，生产 VPS 源站归档 + 中心 zalize-monitor 实查）

### 1.1 R392 起点：中心 kaogong `internal=0` 增量（部署后 2 个 15 min cron 周期）
- `/api/errors?site=kaogong&limit=200`：124 行，容器启动（03:00:27Z）后仍为 R392 复验那 6 行，**6/6 `internal=1`，`internal=0` 增量 0**；此后 0 新行。
- `vue:chunk-*` 共 11 行，全部 `internal=0` 且**全在 R392 部署前**（R391 走查所留，历史行不回填）；部署后没有任何 chunk 行——「真人 chunk 挂起首批数据」仍为 0 样本，不能下任何结论。
- `/api/summary?since_hours=168`：kaogong js 98（internal 4）/ 5xx 25（internal 2），与 R392 汇报一致。

### 1.2 `Devin/1.0` UA 全量画像（09-03～09-05 三日归档）
- `X-Kg-Ua` 含 `Devin/1.0; +devin.ai` 共 **7,806 行**：`140.232.64.4` 7,066 / `.3` 434 / `.5` 305（均为已配置的探针网段）+ **`2001:4860:7:30e::c4` 1 行**（Google `2001:4860::/32`，带 `Purpose: prefetch` / `Sec-Purpose: prefetch;anonymous-client-ip`，即 Google 私有预取代理转发的 Devin 浏览器请求）。
- 7,806/7,806 都有 `X-Kg-Fetch`/`X-Forwarded-Host`/`Cf-Connecting-O2o`（经 Pages Functions 回源），`Sec-Ch-Ua` 为 `"Chromium";v="137"`（非 Chrome 品牌）；路径榜是 `/api/notes`、`/api/comments/count`、`/api/answer_log`、`/api/practice/progress`……——正是 testing agent GUI 走查的接口面。
- 对照：本会话自己的 Chrome（CDP `navigator.userAgent`）与 `curl` 带浏览器 UA 打生产，源站收到的 `X-Kg-Ua` **均不含** `Devin/1.0` → 该后缀不是出口代理加的，而是 Devin 自动化驾驭的浏览器上下文自带（机制推断；事实是三日内所有带此后缀的请求都来自我们的出口或其预取转发）。
- 现状漏洞：`PROBE_UA_MARKERS` / `BOT_GENERIC` 都认不出 `devin/`。走查流量之所以没混进真人，**只靠出口网段这一路**——R386 汇报里「GUI 测试会话 UA 与真人无异」的判断不成立，出口一变（或经 Google 预取代理）就漏。

### 1.3 候选真人 14 天逐条归因（复用 `crawler_stats` 现口径，61 条）
| 归因 | 条数 | 说明 |
|---|---|---|
| `Devin/1.0` UA | 1 | 上述 Google 预取转发行（`/tiku/`） |
| 显式 `X-Kg-Probe: 1` | 2 | R386/R392 在 VPS 上做的网段外探针 |
| `X-Forwarded-Host = kaogong-h5.pages.dev` | 12 | Pages 预览域名走查（用户拿不到这个域名） |
| 其余 | 46 | 43 条 = `39.158.40.85` vivo V2405A 小程序（referer `servicewechat.com`，单设备）；1 条 `/api/fs/read?path=/etc/passwd` 404 扫描器（Fedora Chrome UA）；1 条 `150.109.230.174` iPhone UA `/api/track`（**这是我们自己的生产 VPS 出口**，R392 曾从这里发过带显式头的探针）；1 条 `Schema-Markup-Validator`（R390 我们提交的校验请求） |

结论：剔除后 14 天可疑为外部真人的只有那台 vivo 小程序设备（是否老板/内部人员无法从日志判定）；仍**无可确认的外部真人**。

## 2. 方案（只改归因口径与外显，不改业务）
1. `backend/app/auth.py`：`PROBE_UA_MARKERS` 增 `"devin/"` → `probe_request()` 三路中的 UA 路认出 Devin 浏览器，`growth_events.probe` / `monitor.internal` 不再依赖出口网段；普通 Linux Chrome/iPhone/小程序 UA 不受影响。
2. `scripts/access_log_report.py`：`BOT_GENERIC` 增 `"devin/"`、`"playwright"`、`"validator"`（周报/日报共用），并顺手清掉 4 条既有 ruff 提示（I001/SIM115/DTZ005/DTZ006，R388 挂起项）。
3. `scripts/crawler_stats.py` 真人分支：经边缘之后新增两道——`X-Kg-Probe: 1` 静默剔除（与探针网段同待遇）；`X-Forwarded-Host` 非正式域名（默认 `kaogong.zalize.com`，`--site-host` 可重复指定）→ 单独计 `humans.offhost`。判定顺序：窗口内 → 非引擎 → 非通用 bot（含 devin）→ 路径归类 → 非 test uid → 经边缘 → 非显式探针头 → 正式域名 → 非探针网段 → 计数。
4. `backend/app/ops_status.py`：`humans.offhost_7d`（旧 JSON 无该段 → 0）；`dashboard.js` 尾缀「· 预览域名 N（已剔除）」（N=0 不显示），`sub` 说明补「显式探针头 / Devin 自动化 UA / 预览域名」。
5. 单测：`probe_request` devin UA 打标；`BOT_GENERIC` 覆盖全部 `PROBE_UA_MARKERS`（两份清单不再漂移）；crawler offhost / 显式头 / devin / validator 四类不进真人；`parse_crawler_stats` 补 `offhost_7d`。
6. 运维（非仓库）：VPS 自身出口 `150.109.230.174` 追加到 `~/kaogong-reports/probe-ips.txt`（周报/日报剔除）；**不**加进 `KG_PROBE_CIDRS`——R386/R392 依赖它作「网段外」起点验证显式头/UA 两路。
7. 不做：把 `Devin/1.0` 加进 `BOT_ENGINES`（不是搜索引擎）；给 `offhost` 拆域名榜（保持只聚合）；改 Pages 预览域名回源策略（预览是走查必需）。

## 3. 验证
- 本地：`pytest`、`ruff check app tests`、`npx pyright app` 全绿（数字见 PR）；`ruff check scripts/access_log_report.py scripts/crawler_stats.py` 0。
- 生产（部署后补记）：后端 rev 上线后，VPS 网段外 `curl` 带 `Devin/1.0` UA 打 `/api/track` → `growth_events.probe=1`；`scp` 两脚本 + 手跑 cron 命令 → `crawler-stats.json.humans.offhost` 出现、14 天候选真人 61 → 46 以内；管理台 1440/375 复验。
