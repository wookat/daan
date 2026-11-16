# R249 设计：内容发现渠道口径对齐——首页/llms.txt/hub 元信息补申论素材库

## 取证（verified，2026-09-02）

- 生产 shenlun_materials 未下架素材 166 条（政策理论 73/金句 41/案例 32/范文 20），R248 已在 /tiku/shenlun/ 第 1 页外显素材库板块。
- 但三个内容发现渠道口径未跟上：
  - `/tiku/` 首页申论条目只写「历年申论真题与参考解析」，零素材提及；
  - `/llms.txt` 申论条目同样只写真题（R240 补齐真题入口时素材尚未外显）；
  - `/tiku/shenlun/` 的 meta description 与 CollectionPage JSON-LD 只描述「共 N 题」，页面正文已有素材板块但元信息不一致。
- 对照 R234（口径不实收口）与 R240（llms.txt 与首页/sitemap 口径对齐）先例：渠道描述应与页面真实内容一致。

## 方案

均以真实计数守卫（素材清空时自动回落为纯真题口径，不产生不实文案）：

1. `_tiku_index` 申论 section：素材非空时补一句「另收录申论写作素材 N 条（政策理论、金句、案例、范文等），详见申论真题库页。」（类型名取自真实 counts）。
2. `llms_txt` 申论条目：素材非空时描述追加「；另收录 N 条写作素材（按类型归档）」。
3. `_tiku_shenlun` 第 1 页 description 与 JSON-LD description：素材非空时追加「另有写作素材 N 条。」（分页页 suffix 语义不变）。

## 不做

- 不新增素材 SSR URL/详情页；canonical、sitemap、分页语义零变化。
- 不改 R248 素材板块本身。

## 验证

- pytest：hub 首页 description 含素材计数、素材清空后回落；llms.txt/首页素材文案守卫。
- 本地 ruff/pytest/pyright 全绿；部署后生产 1440/375 双视口复验 + 性能预算。
