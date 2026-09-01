# R200：/tiku 尾斜杠规范化扫尾（search 带斜杠 404 + y/t 无斜杠 301→404 链）

## 一手取证（2026-08-29，生产 kaogong.zalize.com，rev f149cb0）

R199 收口 papers 详情/daily 归档两个缺口后，对 seo.py 全部 22 条路由的斜杠变体做穷举复测，剩余三处不一致：

```
/tiku/search?q=比重      -> 302 /#/pkgA/search/search?q=比重   （既有语义，正常）
/tiku/search/            -> 404                                 （缺口 1：落 /{module}/ catch-all）
/tiku/search/?q=比重     -> 404                                 （同上，query 一并丢失）

/tiku/y/2025/xingce      -> 301 /tiku/y/2025/xingce/ -> 404     （缺口 2：无效 module 先 301 再 404）
/tiku/t/nonexistent      -> 301 /tiku/t/nonexistent/ -> 404     （缺口 3：无效 topic 先 301 再 404）
```

对照既有约定：`/{module}` 无斜杠 catch-all 先验证 `_module_name()` 再 301，无效直接 404（见
`tiku_module_noslash`）；而 `/y/{year}/{module}` 与 `/t/{code}` 的无斜杠路由无条件 301，
无效输入产生 301→404 两跳链（对爬虫是浪费抓取配额的软信号，与站内其余家族语义不一致）。

有效页面复测无回归风险基线：
```
/tiku/t/CS-FL-01/   -> 200
/tiku/y/2025/yanyu/ -> 200
/tiku/y/2024/ziliao/ -> 200
```

## 方案（只动 3 条路由，规范 URL/sitemap/canonical/JSON-LD 零变化）

1. 新增 `@router.get("/search/")`：301 → `/tiku/search`（保留 q 参数），与列表页族斜杠归一化一致。
2. `tiku_year_noslash`：先验证 `_module_name(module)` 且 `year_module_counts()` 有量，通过才 301，否则 `_not_found`。
3. `tiku_topic_noslash`：先验证 `taxonomy.topic_index()` 含 code 且 `tag3_counts()` 有量，通过才 301，否则 `_not_found`。

不做：内容路由、渲染、缓存、sitemap 任何改动；不改 `/search` 302 进 SPA 的既有产品语义。

## 验证

- pytest 新增 4 例：search/ 301 保 q、无效 year/topic 无斜杠直接 404、有效 year/topic 无斜杠仍 301。
- 生产部署后全表复测上述 URL + R199 回归集；1440/375 双视口抽查 topic/year 页。
