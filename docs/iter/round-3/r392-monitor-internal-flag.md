# R392：中心监控 kaogong 上报补 `internal` 标记——7 天 94 条 js 错误全为内部走查、全部计入告警

日期：2026-09-05 · 分支 `devin/*-r392-monitor-internal-flag`（base=main）

## 1. 取证（一手）

R391 留下的未验证项「zalize-monitor 中心侧是否入库」——本轮先补这一手证据，顺带审计 kaogong 在中心的
7 天全貌（在生产 VPS 上读 `.env` 的 `MONITOR_URL/MONITOR_KEY`，`GET /api/summary?since_hours=168` 与
`GET /api/errors?site=kaogong&limit=200`，key 不落盘不回显）：

| 项 | 结果 |
| --- | --- |
| 中心入库 | **已验证**：kaogong `js` 94 条 / 7 天；最新 8 条即 R391 走查的 `vue:chunk-load`（`pages-book-book*` 404 探针）、`vue:chunk-timeout: Async component timed out after 20000ms.`（`#/pkgA/exam/list`，01:39Z，1440 未拦截的真实 h3 停滞）、`unhandledrejection: setTabBarBadge:fail not TabBar page`（R391b 修复前最后一条，02:22Z） |
| `internal` 列 | **118 条 kaogong 行 `internal` 全为 0** |
| js 内容分布 | `unhandledrejection: [object Object]` 08-30～09-05 共 **81 条**（08-31 21 / 09-01 13 / 09-02 21 / 09-03 9 / 09-04 14 / 09-05 2）；R391 后首次出现真实文本 `setTabBarBadge:fail not TabBar page` 1 条；`vue:chunk-load` 8 / `vue:chunk-timeout` 3（全为 R391 走查） |
| js 来源 UA | 89 条 `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36…`（Devin 桌面 Chrome）、3 条 iPhone 模拟 UA、2 条 Macintosh Chrome/126（R374 前 Playwright 走查）、23 条空 UA（5xx 路径不带 ua） |
| 5xx 内容 | `ValueError: invalid literal for int() with base 10: 'abc'` 13 条（09-02 18:06Z、09-03 16:27Z–19:46Z）；`ImportError: cannot import name 'check_admin'` 3 条（08-30，R215 已修）；`HTTP 503 POST /api/auth/wxlogin` 3 条（`WX_MINIAPP_SECRET` 未配）；`HTTP 502 /api/explain`、`/api/mistakes/analysis` 3 条（LLM 上游）；`duplicate column name: probe` 1 条（R374 部署竞态，#586 已修） |
| 500 请求源 | 源站 Caddy 全量日志按 `status=500` 过滤：**全部来自 `140.232.64.2/.3/.4`（Devin 出口网段）**，UA `curl/7.81.0` / `Mozilla/5.0 Chrome/120` / Linux X11 Chrome —— 是 R348-B1（09-03，`as_int` 畸形数字 400）的取证与复验流量，之后 `ValueError` 0 条 |

结论：

1. **中心链路是通的**（R391 未验证项闭合），R391 新增的三类 `vue:*` 与真实文本 rejection 已在中心可查。
2. 中心 `checkAndAlert` 只统计 `internal = 0` 的行（15 min 窗口、按站点 1 h 节流、Resend 发 `ALERT_EMAIL`），而 kaogong
   的 `monitor.report()` 从未传 `internal` → **7 天 94 条 js + 24 条 5xx 全是内部走查/探针触发，却全部按真实用户错误进入告警口径**。
   与 R374/R386 已在入库侧建好的探针三路判定（`X-Kg-Probe` / 出口网段 / 自动化 UA）脱节：`answer_log`/`growth_events` 等六处入库点都会打 `probe`，
   唯独监控转发没有。
3. `[object Object]` 81 条全部为 Linux 桌面 Chrome（探针 UA 与真人无异，只能按 IP 区分）；R391b 后该文本不再出现，但历史 81 条无法回溯到具体 reason。
4. 5xx 侧 `ValueError 'abc'` 不是待修缺陷（R348-B1 已修，随后 0 条），但它说明**内部安全走查的故意畸形请求也会触发告警邮件**——正是 `internal` 标记的用途。

## 2. 方案（零功能、只改后端 2 个文件 + 1 个测试文件）

- `backend/app/monitor.py`
  - `report(..., internal: bool = False)`；载荷抽为 `build_payload()`（便于单测断言，行为不变），新增字段 `"internal": bool(internal)`。
  - 中心 `/ingest` 已支持 `body.internal === true || 1 → internal=1`（`infra/zalize-monitor/src/index.ts`），无需改中心。
- `backend/app/main.py`
  - `report_5xx` 中间件两条路径（未捕获异常 / 5xx 响应）传 `internal=auth.probe_request(request)`。
  - `/api/monitor/report`：`ua` 改用 `auth.client_ua(request)`（边缘透传 `X-Kg-Ua` 优先，Workers 回源会改写 UA），并传 `internal=auth.probe_request(request)`。
  - 复用 R386 的三路判定：sendBeacon 不带 `X-Kg-Probe`，靠出口网段主路（`KG_PROBE_CIDRS=140.232.64.0/24` 已配）；脚本类靠 UA 签名；显式头兜底。
- `backend/tests/test_monitor_internal.py`（+4）：载荷字段/截断；`/api/monitor/report` 真人（公网 IP + iPhone UA）→ `internal=False`、网段/显式头/自动化 UA 三路 → `True`、`ua` 取 `X-Kg-Ua`；坏 JSON 400 且不上报；未捕获异常 5xx 路径网段内 `True` / 网段外 `False`（临时路由需插到 router 最前，应用尾部有兜底路由）。

不做：

- 不删中心里历史 118 条（中心无删除接口；历史行按「口径生效前」理解，与 R386 看板「探针口径自 2026/9/4 起生效」同思路）。
- 不给 sendBeacon 加 `X-Kg-Probe`（beacon 不能带自定义头）；不改 `PROBE_UA_MARKERS`（桌面 Linux Chrome 真人也可能有）。
- 不动中心告警阈值/节流；不为验证 `internal=0` 路径向生产制造一条真实告警行。

## 3. 本地验证

- `pytest` 378（+4）/ `ruff` 0 / `npx pyright app` 0 errors。
- 观察到 1 次 `-x` 全量首跑 `test_int_params_400.py::test_save_mistake_question_id_normalized_to_integer` 失败，单跑 ×2 与全量 ×2 均通过，与本轮改动无交集（本轮不触 `mistakes`），记为 flake 观察。

## 4. 生产验证（见 PR 评论）

- 部署后从 Devin 出口（网段内）与 VPS（网段外 + `X-Kg-Probe: 1` / `python-requests` UA）各发一条带 `r392` 标记的 `/api/monitor/report`，中心 `/api/errors` 应见 `internal=1`；
- `internal=0` 路径仅由单测背书（不向生产制造真实告警行）。
