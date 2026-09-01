# R210：dark /tiku/papers/ 列表链接可辨识性（link-in-text-block）收口

## 取证（verified / inference / unknown）

- verified（生产 axe 复扫，light/dark × 7 页：panduan?page=254、daily、papers、search、q/1、discuss、y/2023）：唯一违例为 dark `/tiku/papers/` link-in-text-block serious × 61（=试卷数）；其余 13 组合全部 CLEAN（含 R204 新分页导航）。
- verified（源码）：papers 列表 `li` 内为「短标题链接 + 较长 .meta 文本」结构，axe 判定为 text block，深色 `--link:#7c9aff` 对 .meta 正文仅靠颜色区分；R195 的下划线规则只扩到 `.meta a,.ftr a,h2 a,p a`，`.qlist li>a` 不在覆盖面。
- inference：`_q_items` 题目列表同结构未被 axe 报出，系链接文本（80 字题干）远长于 meta、不构成 text block 判定；但同属「列表内链接仅颜色区分」，统一收口消除边界依赖。
- verified（同轮复审计无其他新缺陷）：origin 24h 非探针错误仅 4×403 /tiku/ 直连 + 2×404 /.env 扫描 + 1×502 /tiku/panduan/（R205 边缘重试路径覆盖窗口内单例）；sitemap-pages 含 daily 归档 7 天滚动收录正常。

## 方案

沿用 R195「非颜色区分」结论（改色被对底 ≥4.5:1 与对正文差 ≥3:1 双约束证伪），最小收口：

- `seo.py` 下划线选择器扩一项：`.meta a,.ftr a,h2 a,p a` → 增加 `.qlist li>a`（papers 列表与题目列表统一，light/dark 一致，与 h2/p 内容链接同约定）；
- 胶囊 CTA/面包屑豁免规则不变；
- +1 pytest 断言 /tiku/papers/ 样式含该规则。

## 验证计划

- ruff/pytest 全绿；
- 部署后 dark /tiku/papers/ axe 清零、其余 13 组合仍 CLEAN；
- 1440/375（light/dark）papers/模块列表页走查溢出 0、console 0 error；R196 性能预算全过。
