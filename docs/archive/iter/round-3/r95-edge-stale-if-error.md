# R95：边缘 stale-if-error——部署/假死窗口可缓存 GET 不再对外 502

日期：2026-08-31 · 状态：已实现（生产演练验收通过）

## 取证（生产一手证据，origin 访问日志 24h）

1. 24h 状态分布：200×1941、**502×85**、403×3、404×5、304×11。
2. 502 按 10 分钟聚簇：07:51–08:22（45 条）与 10:20–10:24（30 条）——与 R92/R93/R94 三次部署的容器重建窗口完全吻合（`docker compose up -d --build` 停旧起新 + 共享宿主慢启动，实测每窗 1–2 分钟）。
3. 受害请求：/tiku/q/*（YandexBot 29 条——正在收录的获客型爬虫吃到 502）、/api/stats、/api/questions、真实浏览器 UA 也在列。
4. 现状边缘缓存（R45/R56）：`caches.default` 副本按 `max-age=60/300` 存储，TTL 一到条目直接不可用——重建窗口内过期条目无法用来兜底；upstream fetch 抛错时函数直接 1101/502 透出。

## 推断

- 每轮部署必然制造 1–2 分钟 5xx 窗口；本项目每天多轮部署，放大为固定的收录/体验损伤面。autoheal 重启（R84）同理。
- uid 专属 API 已有 R90 客户端快照兜底；**可缓存 GET（/tiku 页族、sitemap、robots、公开 API 允许清单）是当前唯一裸奔面**，恰好也是爬虫流量主体。

## 方案（只改 deploy/cf-pages/functions/[[path]].js）

标准 stale-if-error 模式：

1. 写缓存时：副本 `Cache-Control: max-age=86400`（边缘保存 24h），另加自定义头 `X-Kg-Cached-At: <epoch>`，`X-Edge-Cache` 判定不再依赖 max-age。
2. 读缓存时：`age = now - Cached-At`；`age <= TTL`（API 60s / 页面 300s）→ 正常 HIT（语义与现状一致）。
3. `age > TTL` → 照常回源；回源结果 `status >= 500` 或 fetch 抛异常 → 回退陈旧副本，响应头标 `X-Edge-Cache: STALE`；无陈旧副本才透出错误。

不改动：非可缓存路径（uid API、POST）行为、MISS 回源逻辑、安全头、403 爬虫拦截。

## 验收

- 本地：node 语法检查；逻辑走查。
- 生产（已实测）：新函数上线后 HIT 对外 Cache-Control 仍为逻辑 TTL（60/300）；低峰期受控演练 docker stop 容器 → /api/announcement（副本已过 60s TTL）与 /api/question_counts 均返回 200 + X-Edge-Cache:STALE，uid 专属 /api/home_bundle 照旧 502（设计内，R90 客户端快照兜底）；docker start 后容器 healthy、home_bundle 200 恢复。

## 边界

- 只保护「曾被缓存过」的 URL；重建窗口内首次出现的 URL 仍 502（可接受：长尾 URL 概率低）。
- STALE 最长可陈旧 24h（仅在 origin 5xx 时才会被用到）。
