# R205：边缘无副本 MISS 路径 origin 重启窗口 5xx 直漏收口（单次退避重试）

## 取证（生产一手，2026-09-01/02）

1. 非探针 24h origin 日志：`GET /tiku/panduan/?page=254` 于 09-01 14:00:51 UTC 返回 502，
   duration 0.05s（连接被拒量级，非慢响应），UA 为 ClaudeBot 爬虫。
2. 同窗口 dockerd journal：deploy-kaogong-1 容器在 13:57 / 14:07 / 14:24 / 14:34 被反复重建
   （每次 SIGTERM→10s 强杀→重建 ~15–25s 不可用窗口）；其中 14:24/14:36 两次有 R203
   deploy-history.log 审计对应（本会话 R203/R204 部署），13:57/14:07 无审计记录（旧脚本
   或其他操作者，凭现有证据无法定案，不作归因断言）。
3. 结构性缺口（源码复核 `[[path]].js`）：
   - 有陈旧副本时已有 stale-if-error（fetch 异常/5xx 回退旧副本），R95 已收口；
   - **无副本的 MISS 同步回源路径**：fetch 异常直接 throw、5xx 原样透传——深页（459 页级
     分页、10 万+ 题目页）绝大多数无边缘副本，部署预热只覆盖 16 个入口级 URL，
     重启窗口内任何深页抓取/访问都直漏 502。
4. 爬虫语义影响：Google/Bing 对反复 5xx 的 URL 会降低抓取频率甚至移出索引；
   重启窗口（~15–25s）与抓取撞车属确定性发生（本条 ClaudeBot 502 即实证）。

## 方案（最小改动）

在 `[[path]].js` 无副本同步回源路径上加**单次退避重试**：

- 纯函数 `shouldRetryOrigin(status, hasStale, attempt)`（edge-policy.js，vitest 可测）：
  仅当 `attempt === 0 && !hasStale && (status === 0/*fetch异常*/ || status >= 502)` 时重试；
  有陈旧副本走既有 stale-if-error，不重试（不增加延迟）。
- 重试前 `await sleep(1200)`：容器重建不可用窗口尾部与 Caddy upstream 恢复通常在秒级；
  1.2s 单次重试把「瞬断」与「真宕机」区分开，最坏为用户增加 1.2s 后仍 5xx。
- 500/501 不重试（应用级错误，重试无意义）；POST 等非 GET 不受影响（本就不可缓存，
  但重试同样只读安全？——否：仅对 GET/HEAD 重试，POST 有副作用不重试）。
- 不做多次重试/指数退避：Workers 子请求有 CPU 时间与并发预算，单次即覆盖窗口尾部。

## 验证计划

- vitest：shouldRetryOrigin 全分支（attempt/hasStale/status 组合 + 非 GET）。
- 本地：ESLint + vitest + 前端 build（wrangler functions 无独立 build）。
- 生产：部署后正常路径回归（无额外延迟：X-Edge-Cache MISS 一次回源）；
  重启窗口自然复验挂后台（下次部署 step 4 期间用深页探测重试生效）。
