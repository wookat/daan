# R255 设计：IndexNow 主动提交覆盖非题目 SSR 页族（变化驱动）

## 取证（verified）

- `_indexnow_cycle`（seo.py）只做两件事：首轮一次性提交 4 个核心页（/、/tiku/、/tiku/daily/、/tiku/discuss/），随后按 `indexnow_last_qid` 游标批量提交 `/tiku/q/{id}`。
- R201 以来新增的全部可收录页族——模块 hub、子题型页、考点页、年份页（含申论）、申论 hub/题型/套卷页、papers 详情、daily 归档——只进 sitemap，从未走 IndexNow 主动提交。
- R89 立项结论不变：零外链新站，IndexNow 主动提交是让联盟引擎（Bing/Yandex 等）发起抓取的唯一可行通道；sitemap 被动等待对新 URL 无触发力。
- 生产 seo_meta 现有 `indexnow_last_qid` 游标机制可复用为 kv 存储。

## 方案（最小收口）

1. 抽出 `_sitemap_page_urls()/_sitemap_topic_urls()/_sitemap_year_urls()` 纯列表构造（sitemap 端点改为调用，行为零变化）。
2. `_indexnow_cycle` 增加「页族集合」提交：拼接三族 URL（当前规模 <300，远小于单批 10000），按排序串 sha256 与 `seo_meta['indexnow_pages_hash']` 比对；集合变化时单批提交并更新 hash。
3. 每 6h 周期自然触发；页族无变化零提交（不刷 API）。

## 非目标

- 不改 sitemap 内容/结构；不改题目游标逻辑；不声称提交即收录（提交 ≠ 抓取 ≠ 收录，效果只能由后续日志/站长平台证据说话）。
