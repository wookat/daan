# R45 设计方案：/tiku SEO 页族边缘缓存（Cloudflare Pages functions）

## 背景与一手证据（2026-08-29 取证）

1. **R43 遗留的「主 bundle 未使用 JS ~68KiB」候选已关闭**：
   - 用临时 sourcemap 构建 + source-map-explorer 归属主 bundle（index-BZoCJss8.js，总 341,577B 源码映射）：
     - `@dcloudio/uni-h5` 190,075B、`uni-h5-vue` runtime 66,209B、`vue-router` 22,827B —— 前三项 ~82% 全是框架运行时，无法按页拆分；
     - 业务代码仅 `src/api.js` 12.9KB、`main.js` 3.5KB 等；页面代码已按分包 chunk 拆分。
   - 结论：Lighthouse「未使用 JS 59%」主要是框架运行时在首屏未触达的分支，拆分不可行、收益无从谈起。候选关闭，不立项。

2. **本轮真实发现（P1，架构/性能）**：Lighthouse（生产 /tiku/）performance 0.90 但
   `server-response-time: Root document took 9,390 ms`、speed-index 13.7s。
   - curl 复测：/tiku/ 首个请求 0.74s，后续 0.33s；/tiku/changshi/ 首个 2.5s、后续 0.35s——存在**冷路径长尾**。
   - 生产机（2GB 共享）实测：load average 9.95，Mem used 1216/1935MB——长尾根因是同机其他产品容器（recruit 等）资源挤占（与 R20 /api/favs 62s 同源），kaogong 容器本身 CPU 4.3%。
   - 边缘现状：`curl -I /tiku/` → `cf-cache-status: DYNAMIC`，无 Cache-Control——**每个请求（含 Googlebot 抓取）都穿透到高负载 origin**。/tiku 是纯公开 SEO 页族，SSR 长尾直接伤害收录与体验。

## 方案（架构决策）

在 CF Pages 代理函数 `deploy/cf-pages/functions/[[path]].js` 内对 **GET /tiku*** 响应做边缘缓存：

- 命中条件：`request.method === "GET"` 且 `url.pathname.startsWith("/tiku")`；
- 用 Workers `caches.default`，key 为完整 URL（含 query）；
- 命中即回（附 `X-Edge-Cache: HIT`）；未命中回源，仅当 `status===200` 且 `content-type` 为 text/html 时写缓存（`ctx.waitUntil`），写入副本设 `Cache-Control: public, max-age=300`（边缘+浏览器 TTL 5 分钟），并防御性删除 `Set-Cookie`；
- 非 /tiku 路径（/api、/admin 等）行为完全不变。

**取舍**：R35/R37 的评论 SSR 注入是每请求实时的，加 5 分钟 TTL 后新评论在 /tiku 侧最多延迟 5 分钟外显（App 内讨论页不受影响）——SEO 页可接受。为什么不在后端加 Cache-Control 交给 CF 默认缓存：CF 默认不缓存 HTML，需 Cache Rule（面板配置、不可入库）；Pages function 内 caches API 全部逻辑入库可审计。

## 验收标准

- 部署后 `/tiku/`、`/tiku/changshi/`、`/tiku/q/*`、`/tiku/discuss/` 第二次请求 `X-Edge-Cache: HIT` 且 TTFB 显著下降（同 PoP <100ms 量级）；
- 首次 MISS 内容与直连 origin 逐字节语义一致（title/正文/评论区块）；
- /api/*、/admin、App H5 路由不出现任何缓存头变化；
- deploy_h5.sh 步骤 5b/6 回归全 200；
- 1440/375 生产走查 /tiku 页族 console 0 error、无横向溢出。

## 风险

- 缓存投毒面：仅缓存 200+text/html、剥 Set-Cookie、key 含完整 URL，无 Vary 需求（页面不随 UA/登录态变化）；
- 万一需要紧急刷新：重新 Pages deploy 不清 caches.default，但 TTL 仅 5 分钟，自然过期。
