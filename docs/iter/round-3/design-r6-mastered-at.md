# R6 设计方案：mastered_at 时间戳 + 错题趋势「新增-消灭」双柱

日期：2026-08-29 ｜ 轮次：本会话第 6 轮

## 背景取证（一手）

- R5 上线的错题趋势卡只有「新增」单柱：mistakes 表有 mastered 标志但无掌握时间，无法算每周消灭数（R5 设计文档已如实记录该限制）。
- 粉笔错题本公开形态的核心节奏感是「新增 vs 消灭」对比，让用户看到错题在被消化。
- mastered 写入路径共 3 处（db.py 一手核实）：record_review SRS 通关（streak>5 置 1）、update_mistake 手动标记（allowed 含 mastered）、重复错题回炉（dup 时 mastered=0）。

## 方案（零新接口，单列迁移）

1. 迁移：`ALTER TABLE mistakes ADD COLUMN mastered_at REAL`（沿用 db.py 既有迁移清单机制）。
2. 写入语义（掌握时间 = 首次达成时间，回炉即清空）：
   - record_review：mastered=1 时 `mastered_at=COALESCE(mastered_at, now)`；mastered=0 时置 NULL。
   - update_mistake：当 fields 含 mastered 时同步维护（置 1 补时间、置 0 清空）。
   - 重复错题回炉：mastered=0 同时 mastered_at=NULL。
3. 历史数据：已 mastered 但无 mastered_at 的旧记录不回填（无真实时间，不造假），趋势卡消灭柱只统计有 mastered_at 的。
4. 前端 book.vue weekTrend：每周双柱（新增=created_at、消灭=mastered_at），图例 + 摘要行加「近 7 天消灭 X」。仅 ≥1024 侧栏显示不变。

## 验收

- 后端 import ok；build:h5 通过；生产 bundle 一致
- API 实测：record_review 达成掌握后 mistakes.mastered_at 有值；回炉后清空
- 1440 错题本侧栏趋势卡双柱渲染、图例可读、数字与 API 一致；375 仍无趋势卡；console 0 error
