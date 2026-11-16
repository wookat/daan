# R226 设计：边缘回源请求外显 X-Kg-Fetch 模式头（origin 日志可区分「用户可见失败」与「后台刷新失败」）

## 生产取证（verified）

- 2026-09-01T18:19:39Z，bingbot（X-Kg-Ip 40.77.167.2）请求 `/sitemap.xml`，origin Caddy 日志记录 502（duration 0.02s，容器 18:19:38 重建启动窗口，R223 部署）。
- 2026-09-01T14:00:51Z，爬虫（216.73.216.165）请求 `/tiku/panduan/?page=254`，origin 记录 502（0.05s）。
- 两条 502 在 origin 日志中均为单条记录（无 1.2s 内的 R205 重试对）。
- `/sitemap.xml` 在 18:17:40Z 有一次 200（部署预热），副本大概率存在。

## 无法定案的问题（unknown）

origin 日志只能看到「边缘发来的回源请求得到 502」，无法区分该请求是：

1. **swr 后台刷新**（用户已拿到陈旧副本 200，此 502 无用户影响，stale-if-error 按设计丢弃）；
2. **MISS 同步回源**（用户/爬虫真实等待，502 会走 R205 重试 → R218 品牌 503，仍是可见失败）；
3. **R205 重试的第二跳**。

上述 bingbot sitemap 502 与深页 502 到底是否用户可见，事后无法证明——与 R225 同类的持久观测缺口：边缘进程内部视角（serveMode 判定结果）不落任何持久介质。

## 方案

对每个到达 origin 的边缘回源请求附加请求头 `X-Kg-Fetch`，由 Caddy 访问日志（已记录全部请求头，roll_keep 14 天）自然持久化：

- `miss`：可缓存路径无副本的同步回源（用户等待中）；
- `pass`：不可缓存路径的透传回源（用户等待中）；
- `swr`：TTL 过期后的后台刷新（用户已拿到陈旧副本，失败无用户影响）；
- `retry`：R205 单次退避重试的第二跳（用户等待中）。

实现点（全部在 deploy/cf-pages/functions/[[path]].js，边缘策略纯函数零改动）：

```diff
   const req = new Request(ORIGIN + url.pathname + url.search, request);
+  req.headers.set("X-Kg-Fetch", cacheable ? "miss" : "pass");
   ...
   if (mode === "swr") {
+    req.headers.set("X-Kg-Fetch", "swr");
     waitUntil(revalidate(req, ...));
   ...
-      upstream = await fetch(attempt === 0 ? req : req.clone());
+      const r = attempt === 0 ? req : new Request(req);
+      if (attempt > 0) r.headers.set("X-Kg-Fetch", "retry");
+      upstream = await fetch(r);
```

## 明确不做

- 不改缓存/重试/503 语义、TTL、serveMode 判定；
- 不改响应头（对客户端零变化）；
- 不回溯归因历史两条 502（证据已不可得，如实标 unknown）；
- 不在 origin 后端读取该头做任何行为分支（纯日志观测）。

## 验收

本地：lint(src+tests+edge) / vitest（edge-handler 补 4 例断言四种模式头）/ build / ruff / pytest / pyright 全绿。

生产：部署后
1. 对某无副本深页首访 → origin 日志该请求 `X-Kg-Fetch: miss`；
2. TTL 过期页面再访 → 用户拿 REVALIDATE，origin 日志出现 `swr`；
3. `/api/*`（不可缓存）→ `pass`；
4. 受控重启窗口 MISS → 日志出现 `retry` 第二跳；
5. 1440/375 双视口首页 + /tiku/ 溢出 0、console 0 error、性能预算全过。
