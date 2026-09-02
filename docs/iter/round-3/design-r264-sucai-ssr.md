# R264：申论素材库公开 SSR 页族 /tiku/shenlun/sucai/{type}/

## 取证（生产 + 代码，2026-08-29/09-02 窗口）

- 生产 DB 实测（容器内只读查询）：shenlun_materials 非下架 166 条——政策理论 73（均长 214 字）、案例 32（250 字）、范文 20（1084 字）、金句 41（78 字）；含 topic 归类与权威 source 出处。
- R244–R248 已打通素材的站内搜索、mid/mtype 深链、复制分享与 hub 板块外显，但素材正文对搜索引擎/未装 App 用户零外显：hub 素材板块四个类型链接是 App hash 深链（`?tab=m&mtype=`），爬虫不可达内容。
- R248 当轮明确「不做逐条素材落地页（防 thin pages）」——逐条页均长 78–250 字确属 thin；但**按类型聚合**为单页则每页 3.2k–21k 字真实语料，非 thin。
- 同窗口 origin 复审计：8h 内全部 502/慢样本与 container-events StartedAt 秒级对时吻合（本会话各轮部署重建窗口的设计形态），无新产品缺陷。

## 方案

1. `db.shenlun_materials_by_type(mtype)`：返回该类型全部非下架素材（id 升序，无分页上限；总量 ≤73 条/类型，单页可承载）。
2. `seo/common.py` 增 `_shenlun_sucai_path(t)` 路径助手（对齐 `_shenlun_paper_path`）。
3. `seo/shenlun.py` 增 `_render_shenlun_sucai(mtype)` + 两条路由：
   - `/tiku/shenlun/sucai/{mtype}`：类型存在→301 加斜杠；未知/清空→品牌 404（不产生 301→404 链，对齐 R251/R253 前置存在性守卫）。
   - `/tiku/shenlun/sucai/{mtype}/`：按 topic 分组呈现全部素材正文 + 出处，逐条 App 深链（`?tab=m&mid&mtype`，走 R246 置顶展开链路）、其他类型内链、App CTA、canonical + CollectionPage JSON-LD。
   - 注册于 shenlun 模块（早于 catchall {module}/{submodule}，R258 顺序契约测试防线覆盖）。
4. hub 素材板块四类型链接从 App hash 深链改为 SSR 页链接（可爬），App 入口由页内 CTA 承接。
5. `sitemap-pages.xml` 在既有 shenlun 语料守卫内追加各类型 sucai URL（类型清空自动消失）；IndexNow 页族提交走 R255 变化驱动通道自动覆盖。

## 明确不做

- 逐条素材详情页（thin pages）；素材 SSR 分页（单类型 ≤73 条一页承载）；llms.txt/首页文案本轮不动（既有「按类型归档」口径与新页族一致）。

## 验收

- 本地：ruff/pytest/pyright 全绿（新增 hub 测试类比 R251/R253 模式：200 正文/未知 404/301/hub 链接/sitemap 收录/清空回落）。
- 生产：4 类型页 200 + 正文与出处外显、未知类型 404、无斜杠 301、hub 链接与 sitemap 就位（容忍边缘 SWR TTL）、1440/375 溢出 0、console 0 error、性能预算通过。
