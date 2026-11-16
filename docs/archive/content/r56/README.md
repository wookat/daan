# 轮56：SEO 差距清单实施（年份×模块聚合页 + sitemap lastmod + 内链）

日期：2026-08-09 · 分支 devin/1786308692-r55（PR#114）

## 0. 概要

按 r55 竞品调研差距清单落地三项：① 年份×模块真题聚合页 `/tiku/y/{year}/{module}/`（102 页，JSON-LD+新 sitemap 分片+IndexNow 已提交）；② sitemap-topics 分片补 lastmod；③ 内链密度适度提升（/tiku/ 首页年份入口、年份页跨年互链、考点页同组考点互链）。deploy_h5.sh 部署上线，回归全 200，三态抽查全过，健康快扫全绿。

## 1. 年份×模块真题聚合页

数据摸底（生产）：在架真题 15,727 题，`exam_year` 覆盖 100%（NULL 0），年份 2000–2026，共 102 个有效（年份, 模块）组合。示例分布：2024 年 changshi 246 / panduan 292 / shuliang 129 / yanyu 307 / ziliao 24。

实现（backend/app/seo.py + db.py）：

- 新路由 `/tiku/y/{year}/{module}/`（无斜杠 301），仅对有效组合生成页面，未知年份/模块或空组合 404，页码越界 404；
- 数据入口 `db.year_module_counts()`：`GROUP BY exam_year, module`（is_real=1 AND disabled=0），带 `MAX(updated_at)`，进程内 5 分钟缓存；页面 `lru_cache(maxsize=512)`，列表查询 `module=? AND is_real=1 AND exam_year=? AND disabled=0 ORDER BY id DESC` 走 idx_q_pick 模块前缀；线上实测冷渲染 0.5–0.6s、命中缓存 <0.1s；
- 页面含：标题/描述/canonical、面包屑、每页 50 题分页（复用 _pager 首/末页）、CollectionPage+BreadcrumbList JSON-LD、「在线刷{year}年{模块}真题」CTA、跨年份互链块；
- CTA 直链 `/#/pages/practice/practice?module=…&real=1&year=…&source=seo`，H5 practice.vue onLoad 新增 year 直链解析（start() 增加可选 year 参数，real=1&year 组合拉题），线上实测抽到的 10 题全部 exam_year=2024 且 is_real=1。

线上验证：

```
/tiku/y/2024/changshi/          200 0.6s（列表50题+分页+互链）
/tiku/y/2024/changshi/?page=5   200
/tiku/y/2024/changshi/?page=99  404
/tiku/y/1999/changshi/          404（无数据年份）
/tiku/y/2024/nonexist/          404
/tiku/y/2024/changshi → 301 → /tiku/y/2024/changshi/
JSON-LD：CollectionPage + 3 级面包屑，url 与 canonical 一致，json 解析有效
/tiku/y/2024/xingce/            404（xingce 非模块 key，按现有模块体系正确 404）
```

## 2. sitemap

- 新分片 `/sitemap-years.xml`：102 条 URL，XML 解析有效，已入 sitemap index；lastmod 仅 1 条（多数真题自 updated_at 列上线后未再变更，按「有值才输出」原则如实输出，不伪造日期）；
- `/sitemap-topics.xml` 补 lastmod：新增 `db.tag3_lastmod()`（各 tag3 在架题 MAX(updated_at)，5 分钟缓存），156 条 URL 中 51 条带 lastmod（如 2026-08-09）；
- 部署后发现并当轮修复 P1：库中 1,322 条 updated_at 为 ISO8601 文本（历史写入格式不一），`_lastmod()` 只按时间戳处理导致 /sitemap-topics.xml 500；已兼容文本日期（取 YYYY-MM-DD 部分），修复后 200、XML 有效。topics 分片首次冷生成 4.4s（GROUP BY 全表聚合），5 分钟进程缓存内命中 <1s，可接受。

## 3. 内链密度（适度）

- /tiku/ 首页每个模块区块新增「按年份刷真题」标签行（该模块全部有效年份）；
- 年份页底部「其他年份{模块}真题」互链块；
- 考点聚合页底部新增「同类考点（同 group）」互链块（如 CS-LS-01 页 9 条同组链接）——部署后发现 taxonomy.topic_index() 值不含 code 键致 KeyError（页面无该块），已改为 items() 遍历修复并复验；
- 未做站群式堆链：题目详情页已有同考点相似题+返回考点列表链，不再叠加。

## 4. IndexNow

新 102 条年份页 URL 已通过 api.indexnow.org 批量提交，HTTP 200（key 从生产 .env 读取，未打印/未入库）。提交≠收录，收录情况后续轮次复盘。

## 5. 部署与回归

deploy_h5.sh 两次部署（功能上线+两处 P1 修复），线上 bundle 与本机一致（index-BGFOtlL1.js），7 项回归全 200。

三态抽查（Playwright，/tiku/y/2024/changshi/）：

```
[desktop-1280] h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.2s jserr=[]
[375-light]    h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.3s jserr=[]
[375-dark]     h1=True list50=True pager=True 年份互链=True cta开练=True 用时=2.2s jserr=[]
```

## 6. 健康快扫（在架口径）

```
active 112,962；hs 答案字母一致性（最后匹配、多选 [A-D]+）0；options 非JSON 0；(cid: 乱码 0
空缺仅 2 条已知存疑台账题：panduan:334296、changshi:655861
```

## 7. 数据例行（照实报）

- 近 7 天作答 0 次 / 0 uid（前期活跃已出窗，获客仍是最大瓶颈）；14 天 source 归因无记录；
- 当日访问归档：534 请求，/tiku/ 48 次，搜索引擎爬虫 0，其余为自测（headless/curl/python）与疑似真人 159；
- Bing 收录与自然爬虫流量仍为 0；IndexNow 提交仅为接受回执。

## 8. 遗留与下一批建议

- P2：sitemap-years lastmod 覆盖率低（数据如实）；topics 分片冷生成 4.4s（缓存内正常，可选预热）；
- 站长平台验证（Bing WMT 等）仍是收录破零的 P0，需老板资源；
- 年份页收录效果与 source=seo 归因下轮起复盘。
