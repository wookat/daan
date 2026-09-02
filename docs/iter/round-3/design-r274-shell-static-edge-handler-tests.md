# R274 设计：shell 静态件边缘缓存集成级回归测试（tests-only，不部署）

## 取证

- R273 已将 `/sw.js`、`/precache.json` 纳入边缘缓存（PR #461），策略纯函数已有单测（edge-policy.test.js，150/150）。
- 但单测只覆盖 `isEdgeCacheable`/`edgeTtl`/`isCacheableContentType` 的孤立返回值；`[[path]].js` 的编排交互（守卫在 `caches.default.put` 之前生效、TTL 常量透传到对外 `Cache-Control`、stale-if-error 对 shell 路径同样生效）无集成级防线。
- 风险实证：`/sw.js` 若被 HTML 错误回退（SPA fallback / 品牌 503 页）写入边缘副本并以 200 回放，浏览器 SW 更新检查会拿到 HTML → `SecurityError` 或解析失败，且 60s 内所有新客户端都命中同一投毒副本——这是全站级别的故障放大器。R206 建立的 `edge-handler.test.js` 集成套件（桩 caches/fetch/waitUntil）正是承接这类回归的位置，但从未覆盖 shell 路径。
- 06:00 UTC 窗口 origin 日志复审计：R271–R273 部署后无新增用户可见 5xx/慢样本（04:34–04:37 争用窗口的 `/api/search`、`/sw.js` pass 均发生在当轮边缘部署之前，属已收口历史形态）；本轮无生产缺陷可修，选择测试补强（先例 R258）。

## 方案（仅新增测试，零产品代码变化）

`frontend-uni/tests/edge-handler.test.js` 新增 describe「shell 静态件边缘缓存（R273）」：

1. `/sw.js` MISS 200 javascript → 入缓存、对外 `Cache-Control: public, max-age=60`（60s TTL 透传）；TTL 内二访 HIT 不回源。
2. `/sw.js` origin 回 HTML（content-type 守卫）→ 直出但**不写副本**（store 无 key）。
3. `/precache.json` origin 回 HTML（如品牌 503/SPA fallback 变体）→ 不写副本；回 JSON 200 → 正常入缓存。
4. `/sw.js` 有副本 + TTL 过期 + origin 5xx → SWR 回旧副本且旧副本不被覆盖（stale-if-error 对 shell 生效）。

## 边界

- 不改 `[[path]].js`/`edge-policy.js`/后端/SSR；不部署（tests-only，先例 R258）。
- 不为 `/api/health` 增加缓存路径断言（已有 pass 语义由 R226 测试覆盖）。
