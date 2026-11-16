# R271 设计：/api/search 页族纳入边缘缓存（60s TTL + SWR + stale-if-error）

## 取证（生产一手证据 + 源码）

- 2026-08-29 12:2x–12:4x UTC+8 共享宿主争用窗口实测（vmstat wa 80–88%、load 12.4、
  recruit 侧 pip install（D 态）+ PG 慢查询/并行 worker（D 态）+ zram/swap 满）：
  `/api/search?q=隧道` 经边缘 503（53s）、`/api/health` 53s→13.6s；同窗口 `/`、`/tiku/`
  等边缘有副本页面 0.1–0.2s 正常——用户在争用窗口内站内搜索完全不可用，而允许清单内
  API 靠 SWR/stale-if-error 无感。
- 源码实查 `edge-policy.js`：`API_CACHE_ALLOWLIST` 仅 7 个 pathname 精确匹配端点，
  `/api/search`（带 query）与 `/api/search/question/{qid}`（路径参数）均不在内，全部请求
  同步穿透 origin。
- `insights.py` 实查：两端点均为 uid 无关公开 GET（无 Authorization/uid 依赖，输出仅由
  q/type/limit/offset 或 qid 决定）；边缘缓存 key 为完整 request.url（含 query），按查询
  变体自然分 key。

## 方案

- `edge-policy.js`：`isEdgeCacheable` 对 `/api/search`（精确）与 `/api/search/question/`
  （前缀）在无 Authorization/uid 时放行进入既有 API 边缘缓存链路（60s TTL + SWR +
  stale-if-error + 404/410 副本清除，全部复用现成机制，零新逻辑）。
- vitest 补边缘决策用例：两端点可缓存、带 Authorization/uid 绕过、POST 不缓存。

## 不做

- 不缓存 `/api/shenlun/questions` 等多维筛选端点（key 空间大、命中率低，另轮评估）。
- 不改 origin/后端、不改 TTL 常数、不动 SSR/SEO。
- 语义：搜索结果最长滞后 60s+SWR 刷新，题库导入频率（天级）下无用户可感差异。
