# R278 设计：真题卷 SSR 页族接入卷库 year/region 深链

## 取证（2026-09-02，生产实查）

- R277 已让 App 卷库页支持入向深链 `/#/pkgA/exam/list?year=…&region=…`（filters 白名单校验、非法忽略）。
- 生产实查 `/tiku/papers/`（nocache）：120 套试卷平铺单列表，无任何年份/地区导航，无 App CTA（唯一 CTA 是「进入主站全真模考」指首页）。爬虫/用户到达后只能逐条翻找。
- 生产实查 `/tiku/papers/1`：CTA 为不带筛选的通用 `/#/pkgA/exam/list`——落地后与本卷年份/地区无关，需重新筛选（与 R252 前申论年份页 CTA 同构缺口）。
- `db.exam_paper_filters()` 已存在（/api/exam/papers 同源白名单：years 11 档、regions 26 地区，真实计数）。

## 方案

纯 SSR 内链补齐，复用 R252 hub 地区 chips 先例（App hash 深链，不新增可收录 URL）：

1. `/tiku/papers/` hub 列表上方补「按年份筛卷」「按地区筛卷」两组 chips：
   `exam_paper_filters()` 真实计数，链接 `/#/pkgA/exam/list?year={y}` / `?region={quote(r)}`；空则整组自动消失。
2. `/tiku/papers/{pid}` 详情 CTA 改带本卷 year/region 查询参数（缺失字段省略，与 R277 buildExamListUrl 语义一致），落地即本卷所在年份/地区的筛选视图。

## 边界

- 零新路由、零 sitemap/canonical 变化（chips 是 hash 深链，不进收录面）；
- 零 App 前端改动（R277 入向白名单已就位）；
- 零边缘缓存变化（papers 页族已有既有缓存语义）。

## 验证

- 后端门禁 ruff/pytest/pyright 全绿，新增 pytest 断言 hub chips 与详情 CTA 查询参数；
- 生产 nocache 实测 hub 两组 chips 就位、详情 CTA 带参数；点击 chips 落地 App 后 chip 激活+列表过滤（R277 链路）；1440/375 溢出 0、console 0 error、性能预算全过。
