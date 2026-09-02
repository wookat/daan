# R250 设计：申论按年份真题页（/tiku/y/{year}/shenlun/）

## 取证（verified）

- 生产只读库实测（2026-08-29，data.db）：shenlun_questions 未下架 208 题分布 12 个年份
  （2026:26、2025:51、2024:18、2023:24、2022:18、2021:14、2020:12、2019:5、2018:10、2017:10、2016:10、2015:10），
  地区 15 个（国考 103 居首），题型 5 类。
- 行测五模块自 R201 起均有 `/tiku/y/{year}/{module}/` 按年份真题页（模块 hub 年份内链 + sitemap-years 收录）。
- 申论 hub（R236）「覆盖年份」仅渲染 `<span>` 纯文本 chips（seo.py `_tiku_shenlun` year_chips），
  不可点、无对应页面；sitemap-years 仅覆盖 questions 表行测模块。
- R236 设计明确将过滤子页「挂候选（防 thin pages）」；现每年 ≥5 题、多数 ≥10 题，非 thin。

## 方案

1. db 新增 `shenlun_year_counts() -> list[tuple[int, int]]`：disabled 守卫 + exam_year 非空，
   按年份倒序返回 (year, n)。
2. seo.py `/y/{year}/{module}` 与 `/y/{year}/{module}/` 路由对 `module == "shenlun"` 分流：
   计数为 0 → 品牌 404；有语料 → `_render_shenlun_year(year, page)`（复用既有
   `db.shenlun_questions(year=...)`），列表项格式与 hub 一致（含逐题去作答深链），
   分页 `_pager`、其他年份内链、面包屑 题库→申论→{year}年真题、CollectionPage JSON-LD、
   App 申论专区 CTA。页面路径复用 `_year_path(year, "shenlun")`，与行测同一 URL 家族。
3. hub `_tiku_shenlun`「覆盖年份」chips 升级为年份页链接（带真实计数）；地区 chips 不动。
4. `sitemap-years.xml` 追加申论年份页（语料清空自动消失，不产生死链）。

## 守卫与不变量

- 年份无题 → 404；语料清空 → hub 年份卡不渲染、sitemap 无条目。
- 不新增地区/题型子页（本轮只做年份维度，与行测对齐）。
- hub 分页、canonical、素材板块（R248/R249）语义零变化。

## 验证

- pytest 回归：年份页 200 + 计数 + 深链、无语料年份 404、hub 年份链接、sitemap-years 收录。
- 本地 ruff/pytest/pyright 全绿；生产部署后 1440/375 双视口、溢出/console/性能预算复验。
