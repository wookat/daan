# R313 设计论证：成绩报告解析浮层逐题「同考点强化」CTA

## 取证（SOP-10 / SOP-02）

- 报告解析浮层经 R290（连看）/R291（收藏）/R301（全站统计锚点）/R292（社交条）/R312（纠错）已是复盘工作台，但对「这题不会 → 立刻练同类」零出口：
  - 报告级已有 R307 薄弱模块 CTA（模块粒度、仅诊断成立时渲染）与 weak_tags 榜（仅聚合 Top 弱项）；逐题粒度（当前正看的这道题的考点）没有任何直达练习出口。
  - 错题本展开态早有「同考点强化 5 道新题」（reinforceFromMistake → practiceLaunch {kind:'reinforce'}），刷题页 startReinforce 消费该协议（/api/questions?mode=reinforce 仅出未做过的新题）——链路成熟，报告浮层是唯一缺席场景。
  - 粉笔逐题解析有「相似题/同考点练习」入口，复盘"当场补弱"是其核心动线。
- 数据可行性（生产实查 2026-08-29）：questions 表 tag3 覆盖 113063/113264（99.8%，disabled 剔除后），逐题 CTA 几乎恒可渲染；report items 现契约含 module/submodule 但缺 tag3。

## 方案（复用既有协议，后端纯增量一字段）

1. 后端 `exam_api.py` report item 补 `"tag3": q.get("tag3")`（纯增量，旧客户端忽略）。
2. 前端 `report.vue` 解析浮层：解析块（dexp）后、纠错入口（report-link）前挂 CTA 行：
   - 仅 `detail.tag3` 存在时渲染（fail-closed，缺失不渲染不伪造）；
   - 文案「练同类题：{tag3} · 5 道新题 ›」，role=button + aria-label；
   - 点击写 `practiceLaunch {kind:'reinforce', module, submodule, tag3, count:5, source:'exam_report'}` 后 navigateTo 刷题页——与错题本 reinforceFromMistake 完全同构，无新协议；练习页题池为空时既有 toast「该考点暂无新题」兜底。
3. 零新 API、零 storage/URL 新状态；R290 连看切题时 CTA 随 detail 切换。

## 验证矩阵

- 本地：ruff/pytest（report 契约测试补 tag3 字段）/pyright/lint/vitest/build。
- 生产（临时 uid + 双视口 1440/375）：真实模考→报告→浮层 CTA 文案与该题 tag3 一致→点击直达刷题页同考点 5 题（均新题）→连看切题 CTA 随题切换→tag3 缺失题不渲染（如可构造）→R290/R291/R292/R312 回归→溢出 0 / console 0 error / 性能预算。
- 清理：测试 uid 全库清理 leftover=0，保护 uid 完整。
