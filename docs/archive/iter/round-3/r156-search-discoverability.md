# R156：站内搜索可发现性——搜索深链 + /tiku 搜索入口 + SearchAction

## 取证（2026-08-29）

- SPA 搜索页无 onLoad 参数处理：带 `?q=` 的深链不会自动搜索（R152 生产探针
  实证：加载带 query 的 hash 路由后结果为 0，必须手动输入）。搜索结果无法
  被分享/收藏/外部链接直达。
- /tiku SSR 页族（seo.py）全文无任何搜索入口：搜索引擎落地用户想搜题只能
  先进 SPA 再找搜索页。
- JSON-LD 无 `WebSite.potentialAction`（SearchAction / sitelinks searchbox），
  站点级搜索能力对搜索引擎不可见。

## 方案

1. `search.vue` 补 `onLoad(options)`：`options.q` 存在即回填关键词并搜索
   （`options.tab` 合法时同步 tab）——深链直达搜索结果。
2. seo.py 新增 `GET /tiku/search?q=`：302 到 `/#/pkgA/search/search?q=...`
   （空 q 302 到搜索页本身），给 SSR 页与 SearchAction 一个可爬取目标。
3. /tiku 首页 JSON-LD 补 `potentialAction: SearchAction`
   （target=`{SITE}/tiku/search?q={search_term_string}`）；
   `_page` 头部在 brand 与 CTA 之间加轻量搜索表单（GET /tiku/search，
   纯 HTML form 无 JS，print 隐藏）。

## 验收

- pytest：/tiku/search 302 目标正确、空 q 兜底、首页 JSON-LD 含 SearchAction。
- 生产：`/tiku/search?q=隧道` 302 → SPA 搜索页自动出结果；1440/375 双视口
  /tiku 头部表单提交直达结果；溢出 0、console 0 error。
