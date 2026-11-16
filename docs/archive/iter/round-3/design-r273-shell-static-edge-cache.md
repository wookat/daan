# R273 设计：app 壳静态件 /sw.js、/precache.json 纳入边缘缓存

## 取证（生产一手证据）

- origin 11.5h 日志（09-01 17:39 → 09-02 05:06 UTC）：`/sw.js` 541 次 304 + 48 次 200、
  `/precache.json` 若干，全部同步穿透 origin（`_routes.json` 只把 `/`、`/index.html`、
  `/static/*`、`/favicon.ico` 留给 Pages 静态层，其余都经函数回源）。
- 09-02 04:35–04:37 共享宿主争用窗口：`/sw.js` 4 条、`/precache.json` 5 条 25s 503
  （与 /api/search、/api/health 同窗），因不在可缓存集合而无 stale 副本可退——
  R271/R272 已给 search/申论 API 补齐，同窗口内壳静态件是剩余未收口的公开 GET。
- 源码实查：
  - `/sw.js` 由 origin `api_sw_js` 提供（`Cache-Control: no-cache` + ETag 条件 304），
    输出仅取决于构建产物，uid 无关。
  - `/precache.json` 为构建期生成的 hash 资源清单（本次部署 84 条），静态文件直出，
    uid 无关；前端 `precache.js` 在 load+idle 后 fetch，失败静默跳过。

## 方案

edge-policy.js 单文件收口（复用既有 SWR/stale-if-error/重试/404 清除链路，零新编排）：

```diff
+export const SHELL_CACHE_ALLOWLIST = new Set(["/sw.js", "/precache.json"]);
 export function isEdgeCacheable(...) {
   ...
+  if (SHELL_CACHE_ALLOWLIST.has(pathname)) return true;
 }
 export function edgeTtl(pathname) {
-  return pathname.startsWith("/api/") ? API_EDGE_CACHE_TTL : EDGE_CACHE_TTL;
+  return pathname.startsWith("/api/") || SHELL_CACHE_ALLOWLIST.has(pathname)
+    ? API_EDGE_CACHE_TTL   // 60s：限定 sw.js 新版对存量用户的生效延迟
+    : EDGE_CACHE_TTL;
 }
 export function isCacheableContentType(pathname, isApi, ct) {
+  if (pathname === "/sw.js") return ct.includes("javascript");
+  if (pathname === "/precache.json") return ct.includes("json");
 }
```

## SW 更新语义论证（为何 60s 边缘缓存安全）

- 浏览器对 SW 主脚本的更新检查默认绕过 HTTP 缓存（updateViaCache 默认 'imports'，
  Chrome 68+/Firefox 57+），但不绕过 CDN——边缘 60s TTL 意味着新版 sw.js 最多延迟
  60s + 一次 SWR 陈旧回放到达存量用户，与部署脚本的边缘预热节奏兼容。
- origin 的 `Cache-Control: no-cache` 对外会被边缘改写为 `public, max-age=60`：
  对默认 updateViaCache 行为无影响；极端旧实现的浏览器缓存也被 60s 上界约束
  （远小于原先 no-cache 缺失时的启发式 24h 风险）。
- ETag 保留在副本中，边缘条件请求继续 304（现状 541 次/日 304 全在 origin 完成，
  收口后 TTL 内在边缘完成）。
- 争用/重启窗口：stale-if-error 回放旧 sw.js = 浏览器判定「无更新」，无害且优于 503。
- `/precache.json` 内容为 hash 资源 URL 列表，60s 陈旧最多让空闲预取晚一轮，无正确性影响。

## 边界

- 不动 `_routes.json`（改由 Pages 静态层直出 sw.js 需要构建搬移文件位置且丢失
  origin ETag 逻辑，收益不增，另轮评估）。
- 不缓存 `/api/health`（探针语义必须实时）。
- 不改 origin、SSR、SEO、TTL 常量。
