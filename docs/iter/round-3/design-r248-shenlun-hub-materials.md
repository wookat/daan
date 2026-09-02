# R248 设计：/tiku/shenlun/ hub 外显申论素材库板块

## 取证（verified）

- 生产 `shenlun_materials` 实有 166 条真实素材（政策理论 73 / 金句 41 / 案例 32 / 范文 20），R244–R247 已打通站内搜索、mtype/mid 深链与复制分享。
- 生产 `/tiku/shenlun/` hub 全页仅底部 CTA 括号内出现一次「素材范文」字样，素材资产在公开页族零外显——搜索引擎与未装 App 用户完全看不到这块内容。
- 附带取证：R246 遗留的 mtype 双重编码边界（search → navigateTo 后地址栏 `%25E6…`）经生产实测无害——in-app 导航与收件端直接打开双重编码 URL，chip 激活/类型过滤/mid 置顶角标均正常，不需要修复。

## 方案

仅改 hub 第 1 页（分页页不重复），在真题列表卡下方新增「申论素材库」card：

- `db.shenlun_material_type_counts()`：`SELECT type, COUNT(*) FROM shenlun_materials WHERE (disabled IS NULL OR disabled=0) GROUP BY type ORDER BY COUNT(*) DESC`。
- 板块内容：总条数 + 各类型 chip（`类型 N 条`），每个类型链至既有 hash 深链 `/#/pkgA/shenlun/shenlun?tab=m&mtype=<enc>`；空语料（0 条）时整个板块不渲染。
- 不新增可收录 URL、不做素材落地页/详情 SSR（thin content 防线不变）；canonical/JSON-LD/sitemap 零变化（hash 深链不进 sitemap）。

## 验证计划

- pytest：hub 页含「申论素材库」与类型深链；类型清空守卫（monkeypatch 空 counts 时板块不出现）。
- 本地 ruff/pytest/pyright 全绿；部署后生产 1440/375 双视口验证板块渲染、深链直达素材 tab 类型过滤、溢出 0、console 0 error、性能预算。
