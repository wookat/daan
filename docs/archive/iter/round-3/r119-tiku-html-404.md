# R119：/tiku 页族品牌 404 页（错误态打磨）

## 取证（verified facts，2026-08-31 生产实测）

- `GET /tiku/q/995` → 404，`content-type: application/json`，body `{"detail":"题目不存在"}`
- `GET /tiku/whatever` → `{"detail":"模块不存在"}`；`/tiku/t/NOPE/` → `{"detail":"考点不存在"}`；
  `/tiku/y/1999/changshi/` → 404 application/json；`/tiku/papers/99999` → `{"detail":"试卷不存在"}`
- 即：面向用户/爬虫的 SSR HTML 页族，全部失效链接错误态直出 FastAPI 裸 JSON 报文，
  无品牌壳、无导航出路（sitemap 只含 enabled 题目，但搜索引擎索引/外链存在滞后，
  题目被 disabled 后旧链接即落此态）。
- 对照排除同轮候选：
  - sitemap lastmod：105,815/113,107 题 `updated_at` 为 NULL（容器内实查），代码已支持有值即输出
    `<lastmod>`；回填伪造日期违反「不造假数据」，不立项。
  - /tiku 页族 axe 双视口（7 页 × 1440/375）0 violations，a11y 无可立项缺陷。
  - 题目页内链充分（23 链，含 9 条相关题目）；daily 归档 >7 天 301 回 hub 为既定设计。
  - 主 chunk gzip 120KB、无大型 vendor 混入，性能预算无低垂果实。

## 方案

- `_page()` 增加 `noindex=False` 参数：为 True 时跳过 canonical/og:url，输出
  `<meta name="robots" content="noindex">`（404 页不应声明规范地址）。
- 新增 `_not_found(msg)`：返回 `HTMLResponse(status_code=404)`，复用品牌壳，
  body 含错误说明 + 出路链接（题库首页 /tiku/、真题卷、每日一练、去刷题 /）。
- HTML 页族 12 处 `raise HTTPException(404, …)` 改为 `return _not_found(…)`；
  sitemap 分片与 indexnow-key 保持 JSON/文本 404（消费者是爬虫/机器）。
- 回归测试：扩 backend/tests 断言失效题目/模块/考点/试卷 404 且 content-type 为 text/html、
  含品牌出路链接；sitemap 越界分片仍为非 HTML 404。

## 验收

- 本地 ruff + pytest 全绿。
- 生产：上述 5 类失效 URL 均 404 + text/html + 品牌壳出路；正常页零回归；
  1440/375 双视口 404 页无溢出、console 0 error。
