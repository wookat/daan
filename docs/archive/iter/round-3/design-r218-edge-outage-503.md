# R218 设计：边缘无副本 5xx 直漏收口为品牌 503 + Retry-After

## 取证（verified）
- origin 访问日志 24h 窗口（剔除共享 NAT）：`/tiku/panduan/?page=254` 与 `?page=201` 各 1 次 502
  直漏（UA 为爬虫/curl，经 CF 边缘），发生在容器重启窗口（deploy-history.log 可对应部署时刻）。
- R205 已为无副本 MISS 路径加单次 1200ms 退避重试，但容器重启窗口实测 15–25s，
  单次重试无法覆盖全窗口：重试失败后 origin Caddy 的原始 502（text/plain）原样透传。
- 对爬虫，长期 5xx 是负面信号；正确语义是 503 + Retry-After（临时不可用，稍后重试），
  对用户则应给品牌页 + 自动重试出路，而非 Caddy 裸错误页。

## 方案（最小改动）
1. edge-policy.js 新增纯函数 `shouldServeOutage(method, pathname, status, hasStale)`：
   仅 GET/HEAD、非 /api、无陈旧副本、status 0（fetch 异常）或 502–504 时为 true。
   /api 保持 JSON 契约透传（前端已有重试/快照兜底），有副本路径已被 stale-if-error 覆盖。
2. [[path]].js 重试耗尽后（fetch 异常 throw 路径与最终 5xx 透传路径）改为返回自包含品牌
   503 HTML：`Retry-After: 30`、`Cache-Control: no-store`、meta refresh 30s 自动重试 + 返回首页链接。

## 明确不做
- 不扩大重试次数/时长（重启窗口 15–25s，多次重试徒增边缘挂起且仍难覆盖）。
- 不动 /api 5xx 语义（客户端契约依赖 status 分流）。
- 不做 origin 零停机部署（2GB 共享机内存高压，双容器窗口风险更大，挂候选）。

## 验证
- vitest：shouldServeOutage 全分支 + onRequest 集成（重试耗尽 502→503 品牌页、
  fetch 异常→503、/api 502 仍透传、有副本仍 STALE）。
- 生产：部署后受控 `docker restart` 窗口实测无副本深页返回 503 品牌页（含 Retry-After），
  窗口结束后恢复 200；正常路径无回归；R196 性能预算全过。
