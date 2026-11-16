# R357：真题卷双入口合并——卷库成为唯一真题卷操作台

## 背景与取证（SOP-10 操作台/移动 IA 维度）

生产与代码一手取证（2026-08-29）：

1. 首页「更多练习」九宫格同时存在两张真题卷入口卡：
   - 「全真模考」→ `/pkgA/exam/list` 卷库（exam_papers 表，生产 190 卷）：计时、成绩报告、
     社会证明（N 人考过 · 平均分）、最好成绩、做题状态筛选、续考、看报告、导出 PDF。
   - 「真题卷练习」→ 首页内嵌 sheet（`/api/papers`，从 questions.source 派生，生产 141 卷）：
     不计时逐题练习，仅有标题+题数，无进度/社会证明/成绩锚点，与卷库列表重复且信息更弱。
2. 两套目录覆盖同一批真题卷（同 source 语料），用户在首页看到两个"真题卷"入口，
   无法判断差别；练习模式用户完全享受不到卷库已建成的操作台能力（R285 社会证明、
   R309 状态筛选、R310 刷卷进度、R311 看报告）。
3. 竞品（粉笔）同一卷列表内提供「模考/练习」双模式，不做两个平级入口。

结论：这是入口级 IA 重复缺口（backlog「两套模考入口合并」），收口方向是把练习模式
搬进卷库操作台，首页只保留一个真题卷入口。

## 方案（最小 diff，fail-closed）

1. 后端 `/api/exam/papers` items 补可选字段 `psource`：
   - `_list_exam_papers_base` 在既有 active 题查询里顺带取 `source`；
   - 每卷统计活跃题中占多数的 source，数量 ≥20（对齐练习流 `startPaper` 最少 20 题
     的既有守卫）才输出，否则 `null`（fail-closed，不新增查询轮次，随卷列表缓存）。
2. 卷库 `exam/list.vue` 卷卡按钮区补「按卷练习」（`v-if="p.psource"`）：
   写既有 `practiceLaunch = { kind: 'paper', source, title }` 协议并 switchTab 刷题页，
   复用 `/api/paper_questions` 不计时练习流，零新协议。
3. 首页「真题卷练习」卡改跳卷库（`goExamList`），副文案改「不计时逐题 · 也可全真模考」；
   删除首页内嵌真题卷 sheet 及其孤立状态/方法（practice 页自身的卷 sheet 不动）。

## 边界与如实声明

- exam_papers 与派生练习卷并非一一对应（190 vs 141）；psource 为 null 的卷只是不显示
  「按卷练习」按钮，模考路径零变化。
- 练习模式本身（判分、计入 pstats、可入错题本）行为零改动，仅入口迁移。
- 首页 sheet 删除后 `/api/papers` 仍被 practice 页使用，端点不动。

## 验证计划

- 后端：ruff/pytest（补 psource 单测）/pyright。
- 前端：lint/vitest/build:h5。
- 生产：部署后核对 /api/exam/papers 带 psource；隔离 UID 走查卷库「按卷练习」直达
  刷题页且题目属于该卷 source；首页卡跳卷库；模考路径回归；测试数据全清理。
