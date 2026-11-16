# R231 设计：/llms.txt 站点导览（llmstxt.org）

## 取证（2026-08-29）

- 事实：origin 全量日志（含轮转）中 `/llms.txt` 被请求 66 次，全部 404。
- 事实：请求来源 IP 均为 `140.232.64.5`（共享 Devin NAT 出口），UA 为 Chrome/Linux；按既有归因规则不能归因为外部真实需求（unknown）。
- 事实：llms.txt 是 llmstxt.org 提出、已被主流内容站广泛采用的 LLM 爬虫站点导览标准（Markdown：H1 站名 + blockquote 摘要 + 分节链接清单）；本站作为 15.6 万题的公开内容站，缺失该发现文件属于 SEO/AEO 页族治理缺口，符合用户「SEO 页族内链和 sitemap 治理」授权的不依赖流量的工作项。
- 事实：`/robots.txt` 由 `seo.py` root_router 直出并被边缘缓存（`isEdgeCacheable` + `isCacheableContentType` 白名单）；`/llms.txt` 现回落到边缘 pass 透传 → origin 404。

## 方案（最小改动）

1. `backend/app/seo.py` 新增 `GET /llms.txt`：静态 Markdown（站名 + 摘要 + 题库五模块 hub / papers / daily / discuss / sitemap 链接），`text/markdown; charset=utf-8`，无 DB 查询。
2. `deploy/cf-pages/functions/edge-policy.js`：`isEdgeCacheable` 与 `isCacheableContentType` 把 `/llms.txt` 与 robots/sitemap 同组放行（新增接受 `text/markdown`），复用既有 TTL/SWR/stale-if-error 语义，零新分支。

不做：llms-full.txt 全量内容导出（页面已可被逐页抓取，无证据需要）；不改 robots.txt；不做动态题数统计（避免新增 DB 路径）。

## 验证

- 本地：ruff / pytest（新增 test_llms_txt.py）/ pyright / eslint(src+tests+edge) / vitest（edge-policy 两处断言扩展）/ build。
- 生产：部署后 `curl /llms.txt` 200 + text/markdown + 边缘缓存 HIT；robots/sitemap/tiku 回归不变；性能预算复跑。
