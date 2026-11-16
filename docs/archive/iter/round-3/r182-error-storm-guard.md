# R182：origin 错误风暴防护（服务端兜底限流）

## 取证（一手证据）

R181 修复了做卷自动交卷失败的客户端无限重试风暴，但服务端在整场风暴中毫无自保能力：

- origin 访问日志（09-01 08:11–09:54，单客户端）：`POST /api/exam/submit` 404 × 10029、
  report 探测 404 × ~9900，~3.3 req/s 持续 1.7h；
- 同窗口 origin 返回 **502 × 490**，且波及无辜端点（`/api/health`、`/api/track` 各出现 502）；
- 慢请求：风暴期间 404 响应耗时最高 64.5s（正常应为毫秒级）——2 vCPU 共享宿主
  被单客户端错误流量打到请求排队分钟级；
- 存量旧 bundle 客户端（陈旧壳）在 R181 发版后不会立即更新，同类风暴仍可复现；
  恶意/故障客户端更不受前端修复约束。

对照正常流量基线（同日志窗口，status<400 的 /api 请求按 IP×10s 分桶）：
单 IP 每 10s 最多 12 个请求，p95=11——正常客户端不可能在 60s 内产出 30 个 /api 错误响应。

## 方案

新增 `backend/app/storm_guard.py`：按客户端 IP 滑动窗口统计 /api 错误响应（status≥400），
超阈值后拒绝该 IP 的后续 /api 请求：

```python
class ErrorStormGuard:                      # 纯内存，pytest 可直测
    def blocked(ip, now) -> bool            # 窗口内错误数 >= threshold
    def record(ip, status, now)             # 仅记录 status>=400
# 默认 threshold=30 / window=60s / max_ips=1024（LRU 淘汰防内存膨胀）
```

`main.py` 挂 `error_storm_middleware`：

- 只作用于 `/api/*`；IP 取 `X-Kg-Ip`（R85 边缘透传的真实客户端 IP），回退 socket 对端；
- 命中封禁：立即返回 `429 {"detail": "请求过于频繁，请稍后重试"}` + `Retry-After: 60`，
  **不落 uvicorn 线程池/SQLite**，其他用户不受排队殃及；
- `/api/health` 豁免封禁（容器 healthcheck/watchdog 不受影响）；429 响应本身不计入错误窗，
  封禁随窗口自然滑出解除——被封客户端至多退化为 ~30 错误/分钟（风暴实测 ~200/分钟）。

前端同步（防止 429 被误判为确定性错误）：

- `api-policy.js` `trackRetryable` 与 `exam-policy.js` 可重试判定补 `HTTP 429` 与
  「请求过于频繁」文案——429 是瞬时限流，语义上等同 5xx 可重试，不应触发 R181 terminal
  分支（清进度返回卷库）或丢埋点。

## 为什么不是……

- **Caddy rate_limit**：非内置模块需 xcaddy 重编译，且宿主 Caddyfile 不入仓库、不可测试；
- **Cloudflare WAF rate rule**：免费计划仅 1 条规则且粒度粗，API token 无 ruleset 权限（R178 已证）；
- **全量请求限流**：正常首屏并发（首页 bundle+预取）单 IP 短时可达 12 req/10s，
  按总量限流有误伤面；按「错误响应」计数则与正常行为零重叠（p95 基线相差 15 倍以上）。

## 验证

- pytest：guard 纯逻辑（阈值/窗口滑出/LRU 淘汰）+ TestClient 中间件集成（429/豁免/恢复）；
- vitest：429 可重试判定（track 队列 + submitFailPlan retry 分支）；
- 生产：脚本以 >30/60s 速率打 /api 确定性 404 → 观察 429 生效与 60s 后自动恢复；
  正常浏览回归（首页/刷题/做卷）不触发。

影响面：零 API 契约变化（新增 429 语义）、零依赖新增。
