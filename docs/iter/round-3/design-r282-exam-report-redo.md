# R282 设计方案：模考成绩报告「本卷错题重练」CTA + 逐题解析补图片

## 取证（一手证据）

- 生产报告页（R281 复验截图 + 源码实查 `frontend-uni/src/pkgA/exam/report.vue`）：
  报告已有得分、模块得分、配速（R281）、薄弱考点「去练」、逐题对错网格与逐题解析浮层，
  但**全卷错题没有任何一键重练出口**——用户看完错题后只能「返回卷库」或「再考一次」，
  或者离开报告去错题本手动筛选。
- 粉笔模考成绩报告核心 CTA 即「错题重练/查看错题」（公开产品页可见的报告动作区），
  是模考报告 → 学习闭环的关键链路；本产品该链路断裂。
- 错题重练机制已存在：`book.vue redoAll()` 经 `/api/mistakes/redo` 拉题写入
  `redoSet` storage → `practice.vue` 消费 `redoSet` 直接开练（上限 10 题）。
- 报告 API `/api/exam/report/{id}` items 已含 `question_id/module/submodule/question/options/answer/explanation/hs_explanation`，
  但**不含 `image/image_credit`**：源码实查 `exam_api.py` L385–397。
  后果一：报告逐题解析浮层对带图题（图形推理等）不渲染图片，解析残缺（真实缺陷）。
  后果二：前端无法直接用报告 items 构建带图的重练题组。

## 方案

1. 后端（向后兼容的字段增补，无契约破坏）：
   report items 增加 `"image": q.get("image")`、`"image_credit": q.get("image_credit")`。
2. 前端 `report.vue`：
   - 解析浮层题干下渲染图片（对齐 practice.vue：BASE_URL 相对路径拼接 + 点击预览）。
   - 逐题对错卡下新增「本卷错题重练（N 题）」按钮（有错题才显示）：
     用纯函数把答错 items 映射为 practice 兼容题目对象（id←question_id，含 image），
     上限 10 题（与错题本 redoAll 口径一致），写 `redoSet` → navigateTo practice。
3. 纯函数 `src/exam-redo.js`：`buildExamRedoSet(items, limit=10)`——
   过滤 `picked && !correct`、缺 question/options/answer 的脏数据不进组、字段映射；Vitest 覆盖。

## 边界与不做

- 未答题不算「错题」（与逐题网格 blank 语义一致），不进重练组。
- 不改 practice.vue、不新增 API、不动 contest-report（其数据来自 board，另评估）。
- 不声称任何使用率/增长效果。

## 验收

- 本地：ruff/pytest/pyright + lint/vitest/build 全绿。
- 生产：有错题 attempt 报告出现 CTA，点击进入刷题页且题目与本卷答错题一致（≤10 题）；
  带图题解析浮层图片可见；全对/纯未答 attempt 不显示 CTA；
  1440/375 双视口溢出 0、console 0 error、性能预算通过；临时 uid 验后清理。
