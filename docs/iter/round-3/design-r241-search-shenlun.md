# R241 设计：站内搜索覆盖申论真题

## 取证（verified）

- 生产 `/api/search?q=给定资料` 实测返回 `{"topics":[],"papers":[],"questions":{"total":0,...}}`——
  搜索只覆盖行测 `questions` 表（FTS/LIKE）、`exam_papers`、考点索引；
  `shenlun_questions`（生产实有 208 道真题，R236 已恢复公开 SSR hub）完全不可搜。
- 搜索页 placeholder 写「题号 / 题干关键词 / 考点名」，用户搜「给定资料」「概括归纳」等申论
  关键词得到空结果——但站内确有对应内容（App 申论专区 + /tiku/shenlun/）。
- App 申论专区列表页 `pkgA/shenlun/shenlun.vue` 的 `openQ(id)` 已具备按 id 打开题目详情
  （材料+作答+参考解析）的完整能力，但 `onLoad` 不接受 `id` 参数，无法从站外/搜索直达单题。
- 本轮 12h origin 复审计无新 verified 产品缺陷：5xx 全部落在 R235 lb_try 实施（09-01 21:31）
  之前的部署重建窗口；20:41 慢样本簇为部署 rsync/prime 窗口自致（transient，inference 宿主争用）。

## 现状 vs 目标

| 项 | 现状 | 目标 |
|---|---|---|
| /api/search | 只搜行测题/考点/试卷 | `type in (all, shenlun)` 时附 `shenlun` 段（LIKE，≤5 条） |
| 搜索页 | 申论关键词空结果死胡同 | 侧栏新增「申论真题」区块，点击直达 App 申论专区对应题目 |
| 申论专区深链 | 无按题 id 直达 | `/pkgA/shenlun/shenlun?id=N` onLoad 直开该题详情 |

## 方案

1. `db.search_shenlun(q, limit=5)`：`question/paper LIKE '%'||?||'%'` + disabled 守卫，
   按 exam_year DESC；208 行小表 LIKE 即可（无需 FTS，不预优化）。
2. `insights.api_search`：`type in ("all","shenlun")` 时 `out["shenlun"]=db.search_shenlun(q)`；
   既有段零变化（不新增 tab，仅「全部」呈现，防 UI 复杂化）。
3. `search.vue`：res-side 增「申论真题」区块（样式复用 titem），`goShenlun(id)` navigateTo
   申论专区；`hasSide/isEmpty` 计入 shenlun；placeholder/空态文案补「申论」。
4. `shenlun.vue onLoad`：`opts.id` → `openQ(id)`（复用既有详情弹层）。

## 验证方式

- pytest：种子 shenlun 后 `/api/search` 返回 shenlun 命中段；清空（DELETE）后为空列表。
- 本地门禁：ruff/pytest/pyright + 前端 lint/vitest/build。
- 生产：部署后实测 `/api/search?q=给定资料` 返回申论命中、搜索页 1440/375 双视口
  申论区块渲染、点击直达申论专区对应题、axe/性能预算回归。

## 明确不做

- 不为申论建 FTS 索引（208 行无必要）。
- 不新增「申论」搜索 tab、不做申论材料（shenlun_materials）搜索（无用户证据，挂候选）。
- 不改 /tiku 公开页族与 SSR 语义。
