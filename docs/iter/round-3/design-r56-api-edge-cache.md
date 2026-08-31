# R56：uid 无关公开 API 的边缘缓存（复用 R45 CF functions 基建）

## 背景与取证（2026-08-29）

- R55 已收敛 /api/exam/papers 冷路径，但生产实测记录了机器级通用长尾：origin 长闲置后
  任意端点仍可能 6–14s（/api/stats 13.9s、/tiku/ 6.2s；2GB 共享宿主 load 9–14、free ~90–106MB）。
- 首页首屏依赖多个 uid 无关公开 GET：/api/announcement、/api/submodules、/api/real_filters、
  /api/papers；讨论广场依赖 /api/comments/plaza。这些请求目前全部每次穿透 origin，
  遇到宿主抖动即拖慢首屏。
- 生产实测（2026-08-29）：五个端点均返回 200、响应逐字节确定（连续两次 GET cmp 一致）、
  无 Set-Cookie、无 Cache-Control，纯公开数据不随登录态变化。

## 方案

在 deploy/cf-pages/functions/[[path]].js（R45 已建 caches.default 通道）为**显式允许清单**
的 uid 无关公开 GET API 增加边缘缓存：

- 允许清单（精确路径，不含 uid/token 语义）：
  `/api/announcement`、`/api/submodules`、`/api/real_filters`、`/api/papers`、`/api/comments/plaza`
- TTL 60s（API_EDGE_CACHE_TTL，短于 /tiku 的 300s：公告/热议需要更快生效）。
- 双保险守卫：请求带 `Authorization` 头或 query 含 `uid=` 一律绕过缓存（当前清单端点本就无 uid，防未来误配）。
- 缓存键含完整 query（caches.default 以 URL 为键），/api/submodules?module=X 各模块独立缓存。
- 仅缓存 200 且 content-type 为 application/json 的响应；X-Edge-Cache: HIT/MISS 头保持可观测。

## 明确不缓存

- /api/questions*（随机组题，缓存会破坏随机性）；
- /api/exam/papers（前端恒带 uid，R55 已在 origin 层缓存 uid 无关部分）;
- /api/stats、/api/profile、/api/daily_plan 等 uid 相关端点；
- 一切 POST/mutation。

## 验收

1. 清单端点：首击 MISS→再击 HIT，HIT 响应体与 origin 直出逐字节一致；
2. uid 端点（/api/stats?uid=…）与 POST 无 X-Edge-Cache 头（不进缓存路径）;
3. /tiku 既有缓存与安全头零回归；
4. 首页/讨论广场生产走查 console 0 error。

## 验收结果（2026-08-29 生产实测）

- 5 个清单端点均 MISS→HIT，`cache-control: public, max-age=60`，HIT 响应体与 origin 直出逐字节一致（cmp）；
- /api/stats?uid=… 无 X-Edge-Cache/Cache-Control（绕过缓存路径）；POST /api/comments/plaza 405 不进缓存；
- /api/questions 不在清单：无缓存头、连续两次响应随机不同（随机组题不受影响）；
- /tiku 既有缓存（HIT）与安全头（HSTS 等）零回归；
- 首页/讨论广场 1440+375 生产走查：console 0 error、无水平溢出。

边界：登录态请求若带 Authorization 头会绕过缓存（设计使然，游客与爬虫仍被屏蔽）；
公告等内容更新最长 60s 边缘延迟。
