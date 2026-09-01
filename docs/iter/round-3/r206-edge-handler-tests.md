# R206：边缘函数 onRequest 集成级回归测试（测试补强，无行为变化）

## 取证

- 本轮生产复审计无新 verified 缺陷：24h 非探针 origin 日志 37 请求（唯一 502 已被
  R205 收口）；SSR 页族（深分页/搜索/题目/每日）light/dark axe 全 clean；RUM slow_load
  的 8–45s API 长尾样本无 v: 版本戳（疑旧 bundle 客户端，无 12s 超时），对应时段
  origin 日志已被探针流量轮转，服务端侧无法归因——挂观察，不立项。
- 真实缺口（流程性）：`deploy/cf-pages/functions/[[path]].js` 是全站唯一入口
  （203 行：HIT/SWR/stale-if-error/无副本重试/边缘 304/tee 入缓存/安全头/爬虫拦截），
  生产关键度最高，但 vitest 只覆盖 edge-policy.js 纯函数——onRequest 本体的
  分支组合（如 R205 重试循环与 stale 路径的交互、304 时 body 是否被消费、
  副本刷新是否剥 Set-Cookie）零回归测试，历史上只能靠部署后生产探测验证。

## 方案

vitest 直接 import onRequest，注入桩环境（不改任何源码）：

- `caches.default`：Map 实现 match/put；
- `fetch`：按脚本队列返回 Response/抛异常；
- `waitUntil`：收集 promise，断言后 await 全部完成（验证后台刷新/入缓存确实发生）。

覆盖分支：

1. 爬虫拦截 403；
2. MISS 200 → 入缓存（副本带 X-Kg-Cached-At、剥 Set-Cookie）+ 对外 Cache-Control=ttl + 安全头；
3. TTL 内二访 HIT 不回源；
4. TTL 过期 SWR：立即回旧副本 + 后台刷新覆盖副本；
5. 后台刷新遇 5xx 不覆盖（stale-if-error 保留旧副本）；
6. 同步回源 fetch 异常 + 有副本 → STALE；
7. 无副本 fetch 异常 → 重试一次成功 200（R205）；连续两次异常 → throw；
8. 无副本 502 → 重试成功；500 不重试原样透传；POST 不重试；
9. If-None-Match 匹配 → HIT 路径 304 空 body；MISS 路径 304（副本仍入缓存）；
10. /api 路由 X-Robots-Tag: noindex。

## 验证

- 本地：ESLint + vitest 全绿（纯测试新增，无源码改动，无需部署/双视口复验）。
