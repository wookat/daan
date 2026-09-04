# R374：生产行为数据口径——Devin 探针流量入库侧打标，运营看板/漏斗只算真人

日期：2026-09-04　类型：系统架构 / 可观测性（四维之「系统架构」）　零功能改动

## 1. 取证（一手生产证据，只读）

样本：生产 origin access log（`/var/log/caddy/kaogong-origin.zalize.com-access*.log*`，含边缘穿透的全部 /api 请求）近 3 天窗口（09-01 08:00Z – 09-04 08:00Z）；生产库 `growth_events`/`answer_log`/`mistakes` 近 14 天。

| 指标 | 数值 | 说明 |
|---|---|---|
| /api 请求（3 天，去 /api/health） | 41,202 来自 140.232.64.2–5 vs **~95** 来自其它 IP | 140.232.64.x 为 Devin 基础设施共享 NAT 出口（R202 已证实 .5；本窗口新增 .2/.3/.4） |
| POST /api/track（3 天） | 810 条中 807 条来自 140.232.64.x | 仅 3 条来自 39.158.40.85（一台 Android WebView，疑内部设备） |
| 非 Devin /api 来源 | 39.158.40.85（43 条，Android 16 V2405A wv）/ 150.109.230.174（38 条 curl + 管理台）/ 149.57.180.14（5 条）/ 其余 ≤2 条 | 3 天内独立真实访客 **≤2 台设备**，其中 1 台疑为老板自测 |
| growth_events `boot`（14 天） | 247 条 / 230 uid | 全部 UA 为 `X11; Linux x86_64` 桌面 Chrome/HeadlessChrome，`v:` 为 12 个不同历史 bundle 哈希 → 各测试会话各自开一份新匿名 uid |
| answer_log 活跃 uid（近 7 天） | 21 | 绝大多数落在 Devin 出口窗口；admin 看板「今日活跃用户/新增用户」即该口径 |
| mistakes 222 条 / 0 掌握 / 198 next_review NULL | — | R373 报告列为 R374 候选「复习闭环」；本轮取证后判定其分母几乎全为测试会话数据，**不能据此下产品结论** |

已有对照机制：R185 `scripts/access_log_report.py --exclude-ip-file` 只支持逐条 IP，服务器清单只登记了 140.232.64.5，.2/.3/.4 全部混入周报；库内 `growth_events`/`answer_log` 无任何来源标记，admin 看板与所有「漏斗」查询均无法区分。

## 2. 结论（事实 vs 推断）

- 事实：近 3 天生产 /api 流量 ≥99.7% 来自 Devin 会话；真实用户量级为个位数设备。
- 事实：现有看板 KPI（活跃/新增/作答/正确率/趋势/7 天模块正确率）和 growth 漏斗全部把 Devin 流量算作用户。
- 推断：R371–R373 之前若干轮基于 growth_events/answer_log 的「用户行为」取证（含 R373 报告的 R374 候选）大部分度量的是自动化测试而非用户，结论需要重新审视。
- 推断：产品当前的首要瓶颈不是功能差距而是获客——这不在本会话职责边界（项目负责人/CEO 决策），本轮以 SOP-04 上报。

## 3. 方案（本轮只做证据链，不做功能）

在入库侧给两张行为表打「探针」标记，看板与后续所有行为分析默认剔除：

1. `auth.probe_ip(request)`：`KG_PROBE_CIDRS` 环境变量（逗号分隔 CIDR，默认空=不打标），用 `ipaddress` 匹配 `client_ip()`（X-Kg-Ip 优先，沿用 R186 口径）。
2. `growth_events` / `answer_log` 各加 `probe INTEGER` 列（ALTER，旧行 NULL=未知），`/api/track`、`/api/answer_log` 写入 `1/0`。
3. `admin_dashboard`：今日/昨日 KPI、新增用户、14 天趋势、7 天模块正确率全部 `COALESCE(probe,0)=0`；新增 `probe_excluded`（今日/昨日被剔除作答条数）外显在看板 KPI 下方，做到「剔除了多少」可见可复算。
4. `scripts/access_log_report.py` 清单支持 CIDR（`140.232.64.0/24`），服务器 `probe-ips.txt` 改为网段。
5. 生产 `deploy/.env` 增 `KG_PROBE_CIDRS=140.232.64.0/24`（compose 透传）。

不做：回填历史行（日志里有 IP、库里没有，且历史 answer_log 已按测试 uid 清理过，回填反而制造第二套口径）；不动 `mistakes`/`review_log`（测试 uid 清理制度已覆盖）；不改任何前端 App 行为。

备选被否：① 仅扩 probe-ips 清单——周报能修，库内看板与漏斗仍脏；② 前端在 Devin 浏览器里加标记头——测试 agent 用真实浏览器访问生产，无法可靠注入；③ 直接丢弃探针写入——会破坏测试会话自身的验证（它们要读回自己的作答）。

## 4. 验证

- 单测：CIDR 匹配（命中/未命中/空配置/非法 IP）；`/api/track`、`/api/answer_log` 带 `X-Kg-Ip` 落 `probe=1`，不带落 0；`_admin_dashboard_uncached` 剔除 probe 行且 `probe_excluded` 计数正确；旧库无 `probe` 列时 ALTER 幂等。
- 全量：pytest / ruff / pyright / vitest / eslint / H5 build。
- 生产：部署后从本会话（140.232.64.x）POST 一条 `boot` 与一条 answer_log → 库内 `probe=1`；`curl` 携 `X-Kg-Ip: 1.2.3.4` 经 origin 直连不可行（origin 拒直连），改在容器内 127.0.0.1:8300 验 `probe=0` 路径；看板 `probe_excluded` 出现非 0。测试行清理。

## 5. 局限

- 口径自部署时刻起生效，历史 14 天 boot/answer 数据无法重算（如实标注「未知」）。
- 网段匹配是 fail-open 兜底：Devin 若换出口网段需人工追加 `KG_PROBE_CIDRS`（无需改代码，改 .env 重启）；反向误伤概率极低（140.232.64.0/24 非公众网段）。
- 本轮不解决「没有真实用户」本身。
