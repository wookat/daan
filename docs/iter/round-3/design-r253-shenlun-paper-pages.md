# R253 设计：申论按套卷详情页 /tiku/shenlun/p/{paper}/

## 取证（2026-08-29，生产只读库 /data/data.db）

- 208 道启用申论题分布 49 套卷（paper 唯一非空），每套 3–5 题；distinct(material)=49 与 distinct(paper)=49 一一对应——**一套卷一份给定资料**。
- 语料丰厚：material 平均 7134 字（最短 4714）、reference 平均 372 字（最短 88）、question 平均 105 字，无空 material/reference。
- 现状缺口：R236–R252 建成 hub/年份页/题型页三个列表页族，但**给定资料与参考解析在公开页零外显**——列表只出题干 80 字截断；材料+解析是申论内容资产的主体（每套 7k+ 字独有语料），搜索引擎完全不可见。
- 不做逐题详情页的原因：同套 4–5 题共享同一份 7k 字材料，逐题页会产生 4–5 倍重复正文（duplicate content）；按套卷聚合一页呈现材料一次 + 全部小题与解析，页面唯一、内容充实（≥5k 字/页），无 thin/duplicate 风险。

## 方案

1. db 新增：
   - `shenlun_paper_counts()`：`(paper, exam_year, exam_region, n)` 按年份倒序（disabled 守卫，paper 非空）。
   - `shenlun_paper_questions(paper)`：该套卷全部题目（含 material/question/reference/qtype），按 id 序。
2. seo.py 新增路由 `/tiku/shenlun/p/{paper}/`（quote 编码中文卷名，与 R251 题型页同手法；三段路径不与 `/{module}/{submodule}/` 冲突）：
   - 未知/清空套卷品牌 404；无斜杠 301 前置存在性守卫（防 301→404 链，对齐 R251）。
   - 正文：面包屑 + h1「{paper}申论真题（N 题）」+ 给定资料卡（材料一次、段落渲染）+ 逐题卡（题型徽标 + 题干 + 参考解析 + 「去作答」?id 深链）+ 其他套卷内链（同年份优先，≤12）+ 底部 App CTA（?id=首题直达）。
   - CollectionPage JSON-LD + BreadcrumbList，canonical 无分页（单页）。
3. 内链入口：
   - `_shenlun_q_items` 列表项 meta 中的卷名改为套卷页链接（hub/年份页/题型页三处自然获得入口）。
   - hub 第 1 页新增「按套卷刷题」卡（49 chips，卷名+题数；对齐 R201 全量内链先例）。
4. sitemap-pages 收录 49 个套卷 URL（语料清空自动消失）。

## 非目标

- 不做逐题详情页（duplicate content，如上）；不做套卷×题型交叉页。
- 不改 App 端（?id 深链 R241 已有）；不改申论 API 契约。
- 不宣称任何收录/流量效果。

## 验证

- 本地：ruff/pytest（新增套卷页回归：200 含材料与解析、未知 404、无斜杠 301、sitemap 收录、hub 卷名链接）/pyright/lint/vitest/build。
- 生产：部署后套卷页 200、材料/解析/去作答就位、404/301、light/dark×1440/375 溢出 0、console 0、axe serious/critical 0、Lighthouse 预算。
