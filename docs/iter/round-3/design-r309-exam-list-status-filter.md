# R309：真题卷库「没考过 / 考过的」状态筛选 + URL 同步

## 取证（生产实查 2026-08-29）
- 生产 /api/exam/papers?kind=zhenti 共 118 张真题卷；卷卡已外显「我的最好成绩 X 分 · 已考 N 次」/「还没考过，来挑战一下」（best_score/attempt_count 由服务端按 uid 合并返回，R284/R285 链路）。
- 但筛选条只有年份/地区两行 chips（R277），无按做题状态筛选：想找「下一张没考过的卷」只能逐卡辨认 pbest 文案；R308 报告页推荐只给一张，卷库侧无自助筛选。
- 竞品：粉笔卷库有「未做/已做」状态筛选，是刷卷用户高频动作。

## 方案（纯前端零后端）
- exam-list-url.js：
  - buildExamListUrl 增 `st`（白名单 'todo'|'done'，其余不产出）；
  - parseExamListOpts 增 `st` 白名单收敛（非法→''）。
- 新增纯函数 src/exam-list-status.js：`filterPapersByStatus(items, st)`——
  - items 非数组 → []；st 非 'todo'/'done' → 原数组（不复制语义之外零改动，输入不可变）；
  - 'todo'：best_score == null；'done'：best_score != null。
- list.vue：
  - filters 区新增一行状态 chips：全部 / 没考过 / 考过的；
  - 列表渲染与空态改用 `shown`（computed：filterPapersByStatus(items, st)）；空态文案筛选时提示放宽；
  - setSt 与 year/region 同语义：清 pinnedId + syncUrl（本地过滤不重拉列表）；
  - onLoad 入向 ?st= 白名单恢复（本地过滤，无需等 filters 返回，直接采纳）；
  - applyPendingPin 若目标卷被状态筛选隐藏则静默忽略（对齐既有「列表不含静默忽略」语义→ 判断改用 shown）。

## 验证计划
- vitest：URL build/parse st 白名单；filterPapersByStatus 边界（非数组/非法 st/todo/done/不可变）。
- 本地门禁：lint / vitest / build:h5 / git diff --check。
- 生产：临时 uid 交卷 1 张后，「考过的」仅显该卷、「没考过」不含该卷且 URL ?st= 可刷新恢复；1440/375 双视口、console、溢出；测试数据清理 leftover 0。

## 边界与未验证分支
- st 只做本地过滤不进后端查询，与 year/region 组合时先服务端筛年份地区、再本地筛状态。
- 全部卷都考过时「没考过」空态提示放宽（生产不构造，vitest 覆盖）。
