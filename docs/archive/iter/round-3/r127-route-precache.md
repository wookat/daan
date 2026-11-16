# R127：路由 chunk 空闲预取——离线/弱网可直入未访问过的路由

## 取证（verified facts，2026-08-31）

- R121 收口了「断网直入未缓存路由」的错误态文案与自动重试，但根缺口仍在：
  未访问过的路由 chunk 不在本机任何缓存，离线时该路由必然打不开；
- sw.js 设计决策（R71 后固化）：静态资源不经 SW 拦截（SW Cache Storage
  偶发挂起会拖死整站），离线资源可用性只能靠 HTTP 缓存承担；
- 生产实测静态资源响应头 `cache-control: public, max-age=31536000, immutable`
  ——一次普通 fetch 即可长期驻留 HTTP 磁盘缓存，浏览器离线时可直接命中；
- dist assets 总量 1.4MB / 83 个文件（最大单文件 344KB 主 chunk），
  全量预取代价一次 ≤1.4MB，且带 hash 文件名跨版本自然失效。

## 方案（零 SW 改动、零后端改动）

1. 构建期：`scripts/gen-precache-manifest.mjs`（挂 build:h5 末尾）扫描
   `dist/build/h5/assets` 的 js/css 输出 `precache.json`（URL 数组）。
2. 运行期：`src/precache.js` 的 `initRoutePrecache()`（main.js H5 段调用）：
   - window load 后延迟 8s + requestIdleCallback（降级 setTimeout）再开始，
     不与首屏/中场预取抢带宽；
   - 守卫：`navigator.connection.saveData` 或 effectiveType 含 2g 跳过、
     离线跳过；
   - 逐个 `fetch(url, {cache:'default'})` 温 HTTP 缓存，中途断网即停；
   - 完成后按 manifest 签名（末项+条数）记 localStorage，同版本只跑一轮。

## 验证

- 本地 lint + vitest + build:h5（确认 precache.json 生成且 URL 有效）；
- 生产：加载首页等预取完成 → CDP 置离线 → 直入从未访问过的
  pkgA 路由（如 /#/pkgA/exam/exam）实测能离线打开；
- 1440/375 console 0 error、零回归。
