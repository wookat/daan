# R180 边缘 Last-Modified 内容感知稳定化

## 背景与取证（生产一手）

R178 给公开页族补齐条件请求 304：origin 发内容指纹强 ETag，边缘按 If-None-Match / If-Modified-Since 评估。生产实证发现 zone 开启 Email Obfuscation 时 Cloudflare 前端会剥离 HTML 的 ETag（robots/sitemap 等 xml/plain 不受影响），故 HTML 的对客验证器只剩边缘 `decorate` 补的 `Last-Modified = 本次回源时刻`。

问题：副本每次 TTL 过期后 SWR 后台刷新都会把 Last-Modified 推到刷新时刻——即使内容逐字节未变。生产实测（/tiku/?r180=probe）：TTL 内 LM 稳定；跨 TTL 刷新后 LM 跳变而 body md5 不变。后果：回访客户端/爬虫带 If-Modified-Since 复验时，凡跨过一次副本刷新就拿 200 全量（~21KB HTML），条件请求对 HTML 页族的节流效果被 300s TTL 周期性清零。粉笔公开页的验证器跨访问稳定（内容不变即持续 304）。

## 方案

边缘副本刷新时做内容感知的验证器延续：origin→边缘的直连不经 CF 前端，副本内保留 origin ETag（内容指纹）。刷新入库前比对新旧副本 ETag：

- 指纹相同 → 新副本沿用旧副本的 Last-Modified（验证器稳定，跨刷新 IMS 仍 304）；
- 指纹变化/任一无 ETag → Last-Modified = 本次回源时刻（现状语义）。

纯函数 `carryLastModified(prevEtag, prevLm, newEtag, now)` 入 edge-policy.js（vitest 覆盖），[[path]].js 在 MISS 入库与 SWR revalidate 两条写副本路径上应用（revalidate 需把旧副本传入）。origin/API 契约零变化，失败路径（非 200/ctOk）不动副本语义不变。

## 验证

- vitest：指纹同→沿用旧 LM；指纹变→now；缺 ETag→now。
- 生产：跨 TTL 刷新后 LM 不再跳变（内容未变时），IMS 仍 304；改动内容（部署新 rev）后 LM 前进。
- 1440/375 双视口回归 + console 0 error。
