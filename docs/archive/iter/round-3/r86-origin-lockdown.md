# R86：origin 域收口——仅接受 CF 函数代理流量，拒绝直连爬虫

## 取证（2026-08-31，基于 R85 新落盘的 origin 访问日志）

- 日志启用后 ~1 小时内 145 条请求，其中 **~95 条（66%）无 X-Kg-* 头**——即未经 CF Pages functions 代理、直连 `kaogong-origin.zalize.com`。
- 直连来源全为爬虫：AwarioBot 73 条、SemrushBot 19 条，全部打 `/tiku/q/*` SSR 页（每条命中 SQLite），已实测单条最高 4.7s；`/tiku/` 直连冷请求 6.0s。
- 该宿主为 2GB 共享机（R64/R81/R83 三次假死记录），爬虫直连 origin 完全绕过 R45/R56/R68 边缘缓存，是无谓的 IO/CPU 挤占来源；origin 域虽有 `X-Robots-Tag: noindex` 但不能阻止已发现域名的第三方爬虫持续抓取。

## 方案（零新依赖、两层小改）

1. **函数侧**：`[[path]].js` 回源请求附加共享密钥头 `X-Kg-Edge: <secret>`，值从 Pages 项目环境变量 `KG_EDGE_KEY` 读取（`wrangler pages secret put`，不入仓库）。
2. **Caddy 侧**（宿主 Caddyfile，非仓库文件）：`kaogong-origin` 块增加 matcher——`X-Kg-Edge` 不等于密钥值的请求直接 `respond 403`，不落到 uvicorn/SQLite。
3. **上线顺序防自伤**：先部署函数并在 origin 日志确认 X-Kg-Edge 到达 → 再启用 Caddy 403。

## 边界/非目标
- 容器 healthcheck 走容器内 localhost:8000，不经 Caddy，不受影响。
- deploy 脚本预热/校验全走 `kaogong.zalize.com`（经函数代理），不受影响。
- DNS 回滚方案（主域 A 记录直连）不走 origin 块，不受影响。
- 不做 UA 黑名单（可伪造、维护成本高）；不动 robots.txt（主域收录不变）。

## 验收
- 直连 `kaogong-origin.zalize.com/tiku/`（无头）→ 403，不出现在 uvicorn 侧；
- `kaogong.zalize.com` 全路径回归正常（/、/tiku/、/api/stats、/api/track）；
- origin 访问日志中后续直连爬虫请求均 403。
