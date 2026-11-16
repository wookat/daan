# R275 复审计：R271–R273 部署后窗口取证 + /sw.js 边缘头观察项收口（docs-only）

## 1. R273 遗留观察项收口：/sw.js `x-edge-cache: MISS` 但 age 增长

R273 生产复验时 `/sw.js` 两次探针均显示 `x-edge-cache: MISS` 而 `age` 递增，当时如实标注为未解释观察项。本轮探针（05:2x UTC）取到关键证据：

```
HTTP/2 200
cf-cache-status: REVALIDATED   ← 第 1 跳
x-edge-cache: MISS
---
HTTP/2 200
cf-cache-status: HIT           ← 第 2、3 跳
age: 2 → 4
x-edge-cache: MISS             ← 回放的是入缓存时刻快照头
```

结论：R273 为 `/sw.js` 提供 `Cache-Control: public, max-age=60` 后，Cloudflare 前置 HTTP 缓存（.js 属默认可缓存扩展名，遵循 max-age）在 Pages Functions 之前就近接管了该路径。`cf-cache-status: HIT` 时请求根本不进入 `[[path]].js`，回放副本携带的 `x-edge-cache: MISS` 是入缓存时刻的快照头，并非函数层缓存失效。对照 `/precache.json`（.json 不在 CF 默认缓存扩展名列表）仍逐请求进函数层，`x-edge-cache: REVALIDATE` + SWR 语义正常。

判定：**非缺陷，且防护更强**——`/sw.js` 得到「CF 前置缓存 + 函数层 SWR/stale-if-error」双层副本；观察项关闭。无需代码变化（若未来需要函数层头语义精确，可将 `/sw.js` 加 `CDN-Cache-Control` 区分两层，当前无必要）。

## 2. 09-02 04:34–04:37 争用窗口 31 条 503 归因：全部早于当日边缘部署

窗口内 503（origin 日志一手取证）：`/api/search`×16、`/precache.json`×8、`/sw.js`×5、`/api/health`×2，全部 25s 超时形态、`X-Kg-Fetch: pass/retry`。

时间线对照（git 提交时刻）：R271 边缘允许清单 04:54、R272 05:00、R273 05:12 才提交部署——窗口内这些路径**尚未纳入缓存**，`pass` 属部署前预期形态，非新缺陷、非收口失效。R271–R273 部署后（05:13–05:2x）窗口：origin 无新增用户可见 5xx；`/api/search`、申论 API、shell 静态件生产实测均有边缘副本可退。

## 3. 深分页慢样本归因：本机冷缓存探针，非产品缺陷

02:18 `/tiku/yanyu/?page=191–196` 六条 4.4–11.8s 慢样本：UA 为 `curl/7.81.0` 且无 `X-Kg-Ip/X-Kg-Fetch` 头（VPS 本机直连探针，非经边缘的真实用户）。warm 复测 page=2/100/191/195 全部 0.02–0.17s——OFFSET 深分页无性能缺陷，慢样本是共享宿主冷 page cache + 争用窗口叠加。

## 4. 结论

R271–R275 五轮把 04:3x 争用窗口暴露的全部公开 GET 穿透路径收口完毕；本轮无生产缺陷可修，遗留观察项全部关闭。剩余观察项仅共享宿主内存高压（本轮 free 复测 avail ~306MiB）挂资源等待。
