# R178：公开页族条件请求 304 支持（ETag + If-None-Match/If-Modified-Since）

## 一手取证（2026-09-01）

- 粉笔公开题库页：响应带强 `ETag`，携 `If-None-Match` 复访 → **304 size=0**
- 本站 `/tiku/`：无 ETag；携 `If-Modified-Since:{其 Last-Modified}` 复访 →
  **200 全量 21462 字节**（Last-Modified 系边缘副本入缓存时间，非内容指纹）
- 全仓后端零 ETag 逻辑；边缘函数 fromCache/MISS 路径均不评估条件请求头

## 影响

- 浏览器 max-age=300 过期后复访、爬虫增量抓取（Googlebot/Bingbot 均带
  If-None-Match）每次都全量重传 SSR HTML（题目页 ~20KB × 10 万级收录页）；
  竞品同场景 304 零 body。
- 边缘副本 SWR 每 300s 刷新一次 Last-Modified，即使内容未变也无法命中
  IMS 匹配 —— 必须有内容指纹级验证器（ETag）。

## 方案

两层配合，验证器由 origin 生成、边缘负责评估：

1. **origin ETag 中间件**（backend/app/main.py）：GET 200 且 content-type ∈
   {text/html, xml, text/plain} 时缓冲 body（SSR/sitemap/robots 均为小文本，
   /api JSON 与静态文件不参与——StaticFiles 自带 ETag/304），
   `ETag = W/"md5(body)"`；请求带匹配 If-None-Match → 直接 304 空 body。
2. **边缘条件评估**（edge-policy.js 纯函数 `notModified` + [[path]].js）：
   HIT/REVALIDATE/STALE 回副本前评估请求的 If-None-Match（对副本 ETag，
   弱比较、支持逗号列表与 `*`）与 If-Modified-Since（对副本 Last-Modified，
   INM 存在时按 RFC 9110 忽略 IMS）；命中 → 304，仅回 ETag/Last-Modified/
   Cache-Control/X-Edge-Cache，空 body。副本刷新后 ETag 不变（内容未变）
   仍可 304，解决 Last-Modified 漂移问题。

## 边界

- POST/写路径、/api JSON、边缘不可缓存路径行为零变化。
- ETag 计算只对小文本响应缓冲，md5 仅作缓存验证器非安全用途。
- R177 HEAD 中间件在内层（先定义），HEAD 改写 GET 后同样获得 ETag。

## 验证

- pytest：GET /tiku/ 两次 ETag 相同；If-None-Match 命中 → 304 空 body；
  不匹配 → 200；/api/stats 无 ETag；HEAD 带 ETag。
- vitest：notModified 纯函数（etag 匹配/列表/`*`/弱比较、IMS 早晚、INM 优先）。
- 生产：curl 首访取 ETag → 携 INM 复访 304（HIT 与 MISS 路径各测）、
  1440/375 双视口回归。
