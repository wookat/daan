# R446 · 只取证登记：`growth_events` probe=0 首次逐 uid 归因 + `stale_fallback` 口径 + R445 发版后 (c) 补量

- 日期：2026-09-06 17:46–18:05 UTC · 生产 `3dc59fa` 未动 · 不改码不部署 · 全部只读（`mode=ro` + caddy 源站日志）
- 起点：R445 testing agent 发现 `api.js` 快照兜底会上报 `stale_fallback` → 核它是否计入看板；顺带 R445 发版后自然旧壳 404 (c) 补量；到期项复查。

## 1. `stale_fallback` / `growth_events` 读侧口径
- 写侧：`api.js` `request()` 最后一跳（仅超时/网络错误、且路径在快照白名单）回退快照并 `trackEvent('stale_fallback','h5',path)` → `POST /api/track` → `growth_events`（`probe` 由 `probe_request()` 三路判定，入库即 0/1）。
- 读侧：grep 全仓库，`growth_events` **没有任何产品/管理台读路径**（`admin_dashboard` 全部 KPI 只读 `answer_log`；`_HOT_UID_TABLES` 只是清理枚举）；唯一读者是手工脚本 `scripts/health_scan.py` 的 `growth` 台账行。→ **`stale_fallback` 不计入任何看板**，也不会误算成告警。
- 生产 20 行全 probe=1、2 个 uid：09-05 00:19 同秒 7 行（首页全部接口）+ 09-06 04:56 同秒 13 行（个人页/统计页全部接口）= 两次 testing agent 断网/拦截走查的形态；真人 0 行。→ 登记不改。

## 2. 顺带命中：`growth_events` probe=0 是看板看不到的「访客级」信号（首次逐 uid 归因）
`answer_log` probe=0 仍只有 vivo 小程序 `umst3tuisd7lgzaka` 22 行；但 `growth_events` probe=0 近 7 天 18 行 / **4 个 uid**，caddy 按 `?uid=` 归因：

| uid | 设备 / 出口 | 窗口 | 事件 | 归因 |
|---|---|---|---|---|
| `umst3tuisd7lgzaka` | Android 16 V2405A **wv**（vivo 小程序 WebView）39.158.40.85 | 09-02→09-06 210 req | heatmap/review_entry/similar_auto/share_copy/boot | 已知 vivo 设备（R425） |
| `umsagboriz4qyurnd` | Android 16 **同款 V2405A** Chrome/131，141.11.46.193 | 09-06 08:55–10:43 72 req | `share_open`×2（分享码 `fqpexz7g` 的 `from_uid` = 上面 vivo uid）、comeback_view、reminder_optin | 老 uid（08-04 首答 4 题/3 错题）；同型号手机在浏览器里打开自己小程序分享的题 → **推断为同一持有者的第二入口，非外部真人** |
| `umsacie728f4ghcv8` | Windows Chrome，64.120.95.120 / 173.234.15.218（会话内换 IP，形态像代理出口） | 09-05 16:42–17:05 62 req | comeback_view、heatmap_view、boot | 老 uid（08-01 首答 60 题）；出口非探针网段、无显式头、UA 非自动化 → 三路都不命中；**身份不可考**（内部人员经代理 / 外部老用户回访 二者都解释得通） |
| `umtnitervssy9b344` | iPhone iOS 18.3 Safari，59.83.208.103 | 09-04 22:23 5 req（1 次首页 boot） | boot | 新 uid、单页跳出、0 作答 → 唯一像外部真人的样本，单次 |

- 两个「老 uid 回访」的 `answer_log` 60/4 行全在 08-01/08-04（probe=NULL 是 R374 前的历史行，**R374 之后 `answer_log` probe=NULL 新增 0 行**，写侧三处 `1 if probe else 0` 无遗漏）。
- 结论：看板 KPI 以「作答」为口径，看不到「来了没做题」的访客；caddy 日报 `humans.ips`（09-05 3 / 09-06 8）已从流量侧覆盖这些 IP，`growth_events` probe=0 只是多一层 uid 级行为（回访/分享打开）。两个信号都指向同一事实：**仍无可确认的外部真人作答者**，候选只有 1 次 iPhone 跳出。→ 不为此加看板字段（与 caddy 日报重复、样本 1），登记 SKILL：以后「到期项复查」把 `growth_events probe=0 by uid` 纳入固定查询。

## 3. R445 发版后 (c) 自然旧壳 404 补量
- 09-06 17:25Z（`3dc59fa` 上线）→ 18:05Z：源站 148 请求（200×141 / 3xx×6 / 4xx×1）；`/assets/*` 404 **0**；`/api/monitor/report` **0**；非 2xx 仅 `GET /robots.txt` 403 ×1（无边缘头直连扫描，既定拒绝）。→ (c) 仍无样本，继续挂。

## 4. 到期项（只读）
- `answer_log` probe=0：22 行 / 1 uid，最新 09-06 08:57（无新行）；`error_reason` 6 行与 probe=0 关联 0；`push_subs` 0 / `weekly_reports` 0；29/29 `next_review` 在 CST 00:00；WAL 560 KB（64 MiB 阈值未触发）；`growth_events` 703 行仅 1 个索引 `idx_ge_event(event, created_at)`，本轮按 uid 的查询走全表（703 行可忽略）。
- 容器 healthy 19 min 0 重启（R445 部署后）。

## 5. 事实 / 推断 / 未验证
- 事实：§1 读侧无消费者；§2 表内四行 uid/IP/UA/时间/事件/分享码归属；§3 计数；§4 计数。
- 推断：`umsagboriz4qyurnd` 与 vivo uid 为同一持有者（同型号 + 打开对方分享码 + 时间相邻，无账号关联证据）；`umsacie728f4ghcv8` 双 IP 为代理出口。
- 未验证：三个出口 IP 的地理/ASN 未查（`Cf-Ipcountry` 头源站未收到）；iPhone 访客是否为搜索引擎带来（该次无 referer 字段记录）。
- 留存（devin-box）：`/home/ubuntu/r446_due.py`、`/home/ubuntu/r446_caddy.py`。
