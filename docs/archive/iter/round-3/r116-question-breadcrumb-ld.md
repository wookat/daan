# R116：题目页 BreadcrumbList 结构化数据补齐

## 取证（verified facts，2026-08-31 生产实查）

- /tiku 页族结构化数据现状：/tiku、模块、子题型、daily、discuss、papers 等列表页均输出 CollectionPage + 内嵌 breadcrumb（BreadcrumbList），而**题目页（/tiku/q/{id}，约 15.8 万页、sitemap 12 个分片的主体）只输出 QAPage，无 BreadcrumbList**（curl 实测 /tiku/q/3 仅 1 个 ld+json，@type=QAPage）。
- 题目页 HTML 已有可见面包屑导航（题库 › 模块 › 子题型 › 题目 #id），结构化数据与可见导航不一致。
- Google 面包屑富媒体结果要求页面提供 BreadcrumbList 结构化数据；题目页是全站 SEO 收录主体，缺失即整个页族主体不具备面包屑富结果资格。

## 方案

1. 新增 `_breadcrumb_ld(crumbs)` 复用题目页现有 crumbs 列表生成独立 BreadcrumbList 对象（末项无链接时省略 `item`，符合规范）。
2. `_page()` 的 jsonld 参数放宽为 dict | list（`json.dumps` 天然支持数组，Google 接受同一 script 内 JSON-LD 数组）；题目页传 `[QAPage, BreadcrumbList]`。
3. 列表页保持现状不动（已有内嵌 breadcrumb）。

## 验证

- backend 回归测试补 1 例：/tiku/q/{id} 响应包含 BreadcrumbList 且 itemListElement 与 crumbs 层级一致。
- ruff + pytest 全绿；生产部署后 curl 实测 /tiku/q/3 输出两个 @type（QAPage + BreadcrumbList），列表页 ld 不变。
