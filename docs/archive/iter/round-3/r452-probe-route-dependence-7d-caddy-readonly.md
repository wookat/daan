# R452 · 探针三路判定的「网段单路依赖」7 天只读量化 + 兄弟自动化首见 + 到期项

> 只取证登记，不改产品代码、不部署。生产 `460120f` 未动。起点 = R451 发现同网段兄弟 Devin 会话不带 `X-Kg-Probe` 头、UA 无自动化签名、只靠 `KG_PROBE_CIDRS` 一路打标。问题：这种「只剩网段一路」的流量有多大占比？有没有网段外的自动化漏成 probe=0？

## 1. 方法

caddy 源站 JSON 日志 7 天（08-30 20:23Z → 09-06 20:23Z），只取 `/api/*` 且 query 带 `uid=` 的请求，按 uid 聚合；逐请求按 `auth.probe_request` 同口径复算三路：显式头 `X-Kg-Probe: 1` / `Cf-Connecting-Ip ∈ 140.232.64.0/24` / UA 含 `PROBE_UA_MARKERS`（脚本 `/home/ubuntu/r452_caddy.py`，输出 `/home/ubuntu/r452_caddy_out.txt`）。POST 体内 uid 不在 caddy 日志中，本量化是 GET 侧下界。

## 2. 直接事实

| 项 | 值 |
|---|---|
| 7 天带 `uid=` 的 uid 数 | 1233 |
| 其中**所有请求都命中探针**且**存在只靠网段一路命中**（无头、无 UA 签名）的 uid | **~864（70%）** |
| 网段单路 uid 的 UA 分布 | `X11 Linux AppleWebKit (KHTML, like Gecko)…` 436、`Android 11 moto g power (2022)` 313、`iPhone OS 17_0` 28、`Chrome/128 X11` 22、`iPhone OS 15_0` 14、其余 ≤8 —— 全是 Playwright/DevTools 设备描述符或 GUI Chrome |
| 自动化 UA 签名、无头、**网段外** | 仅 `150.109.230.174`（= VPS 自身出口，`curl/8.5.0` ×78、`python-requests` ×1、`HeadlessChrome` ×1）→ 均由 UA 一路打 probe=1 |
| **网段外、无头、无签名的自动化（会漏成 probe=0）** | **0 uid** |
| 存在非探针请求的 uid（= 会写 probe=0） | **10** |

10 个非探针 uid 逐个归因（caddy IP/UA + 库内 probe 分布）：

| uid | 请求 | 来源 | 库内 | 归类 |
|---|---|---|---|---|
| umst3tuisd7lgzaka | 210 | 39.158.40.85 vivo V2405A WebView | answer_log probe=0 22 / growth 0 8 | R425 起已知小程序设备 |
| umsagboriz4qyurnd | 72 | 141.11.46.193 V2405A Chrome | answer_log NULL 4 / growth 0 6 | R446 同款手机 Chrome 开分享码 |
| umsacie728f4ghcv8 | 62 | 64.120.95.120 / 173.234.15.218 Windows | answer_log NULL 60 / growth 0 3 | R446 Windows 老 uid 双出口回访 |
| umtlhudp91wgn09ab / umtnitervssy9b344 | 4 / 5 | 59.83.208.103 iPhone iOS 18.3 | growth NULL 1 / 0 1 | R446 iPhone 单页访客（两枚 uid 同 IP） |
| umtpfyhlm8b512db9 | 5 | 171.114.10.99 Windows Chrome | **无任何行** | 09-06 06:39Z 新到访，只读首页 API、0 作答（R446 后新增） |
| umtjcnzc6onyfv6ei | 2 | 149.57.180.14 Mac Chrome | 无任何行 | 09-02 单页 |
| umtgyalle1yy98tka | 2 | 34.44.196.215 GCP `ShapBo` | 无 | 扫描器 |
| umti20sltzkr5tv9x | 2 | 35.232.97.83 GCP `Firefox/5.0 Ice…` | 无 | 扫描器 |
| umtlhu8rzkjt4shgh | 4 | 220.196.160.125 `Palo Alto Networks` | 无 | 扫描器 |

库内 probe=0 总量不变：`answer_log` 22 行 / 1 uid（max 09-06 08:57）、`growth_events` 18 行 / 4 uid —— 与 caddy 归因一一对应，**无未归因的 probe=0 行**。

兄弟自动化 uid `umtppgte7u8emh2vs` 首见 **09-06 11:05:29Z**（R451 按 answer_log 记 11:11 是首次作答），首批请求 `/api/exam/resume` `/api/review/cur` `/api/practice/resume` `/api/home_bundle` = 首页冷启动四连（无 referer 信息可考来源），全程 `140.232.64.3` 同一 IP、同一 iPhone OS 15_0 描述符。

## 3. 推断与登记

- **网段一路承担了 ~70% uid（几乎全部 GUI 走查）的探针识别**，显式头与 UA 签名只覆盖脚本类与遵守 SKILL 的会话。R386 文档已写明「网段是主路、换网段改 .env 重启」，本轮只是把依赖程度量成数字。
- **当下无污染**：7 天内网段外无签名自动化 0 uid，全部 probe=0 行均可归因到 5 个已知设备 + 扫描器/单页访客。
- **风险形态**：Devin 出口 /24 一旦变更，当天所有 GUI 走查会整批写成 probe=0，看板 KPI 跳变。现有观测面：`scripts/access_log_report` 日报 `humans.ips`（09-05 3 / 09-06 8）会立刻放大，`scripts/health_scan.py` 读 growth_events。**不立项加代码**：无发生样本、且现有日报已能一眼看出；把「日报 humans.ips 突增 → 先核 `KG_PROBE_CIDRS` 是否落后于出口」写进 SKILL 到期项。
- 不把 `PROBE_UA_MARKERS` 扩到 `X11; Linux x86_64` / 设备描述符：真人桌面 Linux / DevTools 模拟也会命中（R386 已否决同类扩张）。

## 4. 到期项（20:23Z）

probe=0 22/1、growth probe=0 18/4、error_reason 6/0、push_subs 0、weekly_reports 1（R451 已归因）不变；WAL 3.15 MB（未触发 64 MiB）；(c) 无新窗口（本轮无发版）。候选真人：新增 1 个只读首页 0 作答的 Windows 访客（171.114.10.99），仍**无可确认外部真人作答者**。

## 5. 未验证 / 限制

- 只算 GET query `uid=`，POST 体内 uid（作答/track）不在 caddy 日志 → 占比是下界；库内 probe=0 总量与 caddy 归因吻合可作旁证。
- 「Playwright/DevTools 描述符 = 自动化」是按 UA 字面推断，未与各 Devin 会话 ID 关联。
- 三个扫描器与两名单页访客的地理/ASN 未查。
