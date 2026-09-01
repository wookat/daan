# R168 边缘缓存 stale-while-revalidate：消除 TTL 过期后用户面回源长尾

## 取证（2026-08-29 生产实测）

- 生产直测 `https://kaogong.zalize.com/tiku/`（边缘副本 TTL 过期后首个请求）：**40.7s** 才返回 200；
  同一时刻 origin 容器日志记录 `[slow-req] 81.2s GET /tiku/`。
- origin 宿主为 2 vCPU / 1.9GB 共享主机，取证时 load average 5.7–7.0（recruit-postgres 等邻居容器抢占），
  近 48h `slow-req` 共 5 条，其中 3 条 80s+（含 `/tiku/`、`/api/exam/report/*`）。
- 复测非争抢窗口：origin 冷渲染 2.9s、热 0.04s——R149/R150 索引治理后 SQL 本身已亚秒，
  长尾根因是共享宿主 CPU 争抢（独立主机资源项已申报，未到位），**属基础设施长尾而非查询缺陷**。
- 现状函数逻辑（`deploy/cf-pages/functions/[[path]].js`）：副本长存 24h，TTL（页面 300s / API 60s）内 HIT；
  过期后**同步回源等待**，仅 5xx/不可达才回退陈旧副本（stale-if-error, R95）。
  即：TTL 过期后的首个用户请求必须全程等待 origin，宿主争抢窗口即产生 40–80s 用户面延迟。

## 方案

TTL 过期且边缘存在陈旧副本时，改为 **stale-while-revalidate**：

1. 立即返回陈旧副本（`X-Edge-Cache: REVALIDATE`）；
2. `waitUntil` 后台回源刷新副本（200 且 content-type 合法才覆盖，失败保留旧副本，天然兼容 stale-if-error）。

新鲜度语义变化：过期副本最多多陈旧「一次访问间隔」（下次访问触发后台刷新）。/tiku SEO 页族与
允许清单 API 均为公开确定性内容，分钟级陈旧可接受；带 uid/Authorization 请求一律绕过（不变）。

- `edge-policy.js` 新增纯函数 `serveMode(hasCopy, freshness)` → `'hit' | 'swr' | 'fetch'`，vitest 覆盖；
- `[[path]].js` 抽出 `decorate()`（安全头 + X-Robots-Tag）与 `storeCopy()`（长存副本头），
  前台 MISS 路径与后台 revalidate 路径共用，保证后台刷新的副本与前台入缓存的副本逐字节同构。

不改 TTL 数值、不改 origin、不改允许清单。

## 验收

- 本地：ESLint / vitest（edge-policy 新增例）全绿；
- 生产：副本 TTL 过期后请求秒回 `X-Edge-Cache: REVALIDATE`，随后 300s 内再请求命中新副本（HIT 且
  X-Kg-Cached-At 已更新）；MISS/HIT/STALE 语义回归不变；1440/375 双视口 /tiku 页族正常、console 0 error。
