# R388：候选真人口径剔除源站直连扫描 + GSC 渲染器 UA 归 Google（Google 首次进入 `/tiku/q/*`）

日期：2026-09-04 · 分支 `devin/*-r388-human-direct-origin`（base=main）· 类型：数据说话权修正，零功能改动

## 1. 一手取证（09-04 22:00–23:20Z，生产源站归档 + 容器内只读 SQLite）

### 1.1 R387 候选①「卷库真实路由 `pkgA/exam/list` 是否高频入口」——无数据，不改白名单
- `growth_events` 近 7 天 `boot` 255 条：**247 条 `probe IS NULL`（09-04 探针口径生效前）、7 条 `probe=1`、仅 1 条 `probe=0`**（09-04 22:37Z，`v:Bctw4Xpu;sw:1`，即当前 bundle、已被 SW 控制的回访设备，单样本）。
- `boot.ref` 只带 `v:<bundle>;sw:<0|1>`，**不含入口路由**；`slow_load` 近期 0 条。没有任何可用的真人入口 hash 分布。
- 结论：白名单保持 R387 四路由不动；**不给 `boot` 加路由字段**——每周 1 条非探针 boot 的量级下加字段也积累不出分布，属无效埋点（与 R387「不加 RUM 字段」同一判断）。

### 1.2 分享/激活链路——无干净外部样本，不动分享产品
容器内只读查询：`shared_questions` 14 行 / 累计打开 27 / `shared_answers` 4 行 / `pk_matches` 26 行 0 完成 / `teams` 0。最近 4 条分享全为 `test-w1~w4-mp` 测试 uid；其余 `from_uid` 为内部走查。**不能据此声称分享渠道有效或改分享流程。**

### 1.3 Google 抓取——首次进入题目页（修正 R377–R387「`/tiku/q/*` 0 次」的现状表述）
`access-20260904.jsonl` 按 `X-Kg-Ua`/`X-Kg-Ip` 归真实端：Google 20 条 = robots 3（200/304/304）+ sitemap 16 + **`/tiku/q/404717` 200（`66.249.65.202`，Googlebot 官方网段）1 条**。
- 准确表述：**Google 已被观察到请求至少 1 张 `/tiku/q/*` 页**；是否「已发现→已编入索引→有排名→有真人点击」四层均**未验证**（需 GSC 覆盖率数据或后续多日抓取样本）。
- 同日另有 2 条 `/tiku/` 请求 UA 为 `Google-InspectionTool/1.0`（一条带 Nexus 5X Chrome 前缀）——这是 GSC「网址检查/请求索引」的渲染器，**不含 `googlebot` 字样**，现有 `BOT_ENGINES` 认不出 → 被算进「候选真人 页面」。

### 1.4 「候选真人」口径被源站直连扫描器灌水（本轮真命中）
09-04 crawler-stats 显示候选真人 `page=33`、`ips=32`。逐条核对：
- 33 条页面请求中 **30 条 status 403**，`remote_ip` 为 AWS `3.238.133.204`、`3.238.133.205` 等，UA 是普通 Windows Chrome/iPhone Safari，**没有 `X-Kg-Ip`/`Cf-Connecting-Ip`/`Cf-Ray` 任何边缘头** → 绕过 Cloudflare 直打 `kaogong-origin.zalize.com`，被 Caddy `@noedge`（`not header X-Kg-Edge …` → `respond 403`）拒绝。用户只能从公网域名进来（必经边缘），直连源站主机名的只有扫描器/资产探测。
- 经边缘的 3 条中 2 条是上面的 Google-InspectionTool；**真正的候选真人页面请求当日只有 1 条**（法兰克福 IPv6 Firefox 访问 `/tiku/`，单样本，不能认定为真人）。
- 归档格式核对：08-14 归档全部无 `headers` 段（旧格式，`_ua()` 取空 UA → 已按 bot 剔除）；08-31 起 7,410 条全带 `X-Kg-Ip`；47 条只带 `Cf-*` 无 `X-Kg-Ip`（非 Functions 路径经 CF 到源站），本轮按「经边缘」计不剔除。

## 2. 方案（只改统计口径与外显，不改业务）
- `scripts/crawler_stats.py`：真人分支新增 `_via_edge(req)`（`X-Kg-Ip` 或 `Cf-Connecting-Ip` 任一非空）；不经边缘的普通 UA 请求不进 `api/page/ips`，单独计 `humans.direct`（对账用，仍不含 IP/UA 原文）。判定顺序：窗口内 → 非引擎 UA → 非通用 bot UA → 路径归类 → 非 test uid → **经边缘** → 非探针网段 → 计数。
- `scripts/access_log_report.py`：`BOT_ENGINES` 增 `"google-inspectiontool": "Google"`（周报与日报共用），GSC 渲染器抓取归 Google 引擎、进 `tiku` 计数。
- `backend/app/ops_status.py`：`humans.direct_7d` 汇总（旧 JSON 无 `direct` 段 → 0）。
- `backend/app/admin/pages/dashboard.js`：行标签「真人」→「候选真人」（与 R382 口径说明一致），`sub` 增「未经边缘的源站直连」，尾缀「· 源站直连扫描 N（已剔除）」（N=0 不显示）。
- 单测 +2：直连剔除/legacy 无 headers 行/通用 bot 不进 direct；InspectionTool 归 Google 不进真人。`parse_crawler_stats` 用例补 `direct_7d`。
- 未做：把 `direct` 拆 IP 榜（含 IP 原文，违背「只聚合」约束）；给 `boot` 加路由字段（1.1）；分享/GSC 侧代码。

## 3. 验证
- 本地：`pytest` 374 全绿（含新增 2 例）、`ruff check backend` 全绿、`pyright backend/app` 0 errors。`scripts/access_log_report.py` 原有 4 条 ruff 提示（I001/SIM115/DTZ005/DTZ006）不在 backend lint 范围、非本轮引入，不动。
- 生产（部署后补记）：`scp` 两个脚本到 VPS `~/kaogong-assistant/scripts/` 并手动跑一次 cron 命令 → `crawler-stats.json.humans.direct` 出现、09-04 `page` 从 33 降到 1、`ips` 从 32 降到 1、Google `tiku` 从 1 升到 3；管理台「候选真人」行外显「源站直连扫描 N（已剔除）」；1440/375 双视口复验。
