# R310：真题卷库刷卷进度外显——「已刷 X/N 卷」进度条 + 状态 chips 真实计数

## 取证（生产实查 2026-08-29）
- 生产 /api/exam/papers?kind=zhenti 共 120 张真题卷；R309 已上「全部/没考过/考过的」状态筛选，但三个 chips 无计数——用户切换前不知道自己还剩多少卷没考；页面顶部也没有任何「刷卷总进度」锚点（要自己数卡片）。
- 数据已在客户端：items[].best_score 由服务端按 uid 合并返回（R284/R285），进度纯本地可算，零新增请求。
- 竞品：粉笔卷库外显「已做 N 套」总进度；刷卷用户的核心自驱锚点是「还剩多少没刷」。

## 方案（纯前端零后端）
- 新增纯函数 src/exam-list-progress.js：`paperProgress(items)`——
  - items 非数组 → { done: 0, total: 0, pct: 0 }（fail-closed 不渲染）；
  - done = best_score != null 的卷数（与 R309 filterPapersByStatus 口径一致，0 分算考过）；
  - pct = total>0 ? Math.round(done/total*100) : 0；输入不可变。
- list.vue：
  - filters 区上方进度卡（total>0 才渲染）：「已刷 {done}/{total} 卷」+ 细进度条（宽 pct%，role=progressbar + aria-valuenow/min/max）；done===total 时文案改「全部刷完 🎉」；
  - 状态 chips 带真实计数：「没考过 {total-done}」「考过的 {done}」（「全部」不带数，避免三数并列噪音）；
  - 进度与计数均基于当前 items（year/region 服务端筛选后的范围）——筛选态下即「当前筛选范围内进度」，语义如实不另造全量口径。

## 验证计划
- vitest：paperProgress 边界（非数组/空数组/全没考/全考过/混合/0 分算考过/不可变）。
- 本地门禁：lint / vitest / build:h5 / git diff --check。
- 生产：临时 uid 交卷 1 张后进度卡「已刷 1/120 卷」且条宽≈1%、chips「没考过 119」「考过的 1」、切 year 筛选后计数随范围收窄、1440/375 双视口、console、溢出；测试数据清理 leftover 0。

## 边界与未验证分支
- 「全部刷完」文案生产不构造（120 张不可行），vitest 覆盖判定逻辑、UI 分支仅代码走查。
- 快照即显（snapPeek）铺屏时进度用快照数据先显、真实响应到达后覆盖，与列表同生命周期，无额外竞态。
