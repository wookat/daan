# R244 设计：站内搜索覆盖申论素材/范文

## 取证（verified）

- 生产只读库：`shenlun_materials` 实有 166 条（政策理论 73 / 金句 41 / 案例 32 / 范文 20），App「素材/范文」tab 已消费（/api/shenlun/materials）。
- R241 已把申论真题接入 /api/search（`db.search_shenlun`），但素材库完全不可搜：搜「乡村振兴」等主题词时搜索页无任何素材命中，用户只能进专区逐页翻。
- R241 设计明确挂候选：「不搜申论 materials（挂候选）」，本轮收口。
- shenlun.vue onLoad 已支持 `?tab=m` 直达素材 tab（存量能力），素材 tab 有 MTYPES 类型 chips（全部/金句/案例/政策理论/范文）。

## 方案

1. `db.search_shenlun_materials(q, limit=5)`：topic/content/source LIKE + disabled 守卫，≤10 条，返回 id/type/topic/content/source。
2. `insights.py api_search`：`type in ("all","shenlun")` 时附 `out["shenlun_mats"]`（既有键零变化，纯新增）。
3. 搜索页新增「申论素材」区块（申论真题区块之后）：topic + 类型徽标 + 内容 clamp 3 行；点击 → `/pkgA/shenlun/shenlun?tab=m&mtype=<type>` 直达素材 tab 并按该类型过滤。
4. shenlun.vue onLoad 支持 `opts.mtype`（须命中 MTYPES 白名单）先置 `this.mtype` 再 switchMat。

## 明确不做

- 不为素材建 FTS（166 条小表，LIKE 足够，对齐 search_shenlun 判断）。
- 不做素材详情深链/单条素材落地页（无 SSR 素材页，防 thin content）。
- 不新增搜索 tab；SEO/SSR/sitemap 零变化。

## 验证

- pytest：命中 topic/content、disabled 排除、limit 截断、无命中空数组。
- 本地门禁：ruff/pytest/pyright/lint/vitest/build。
- 生产：搜索主题词素材区块渲染、点击直达素材 tab 且类型过滤生效、1440/375 溢出 0、console 0 error、性能预算。
