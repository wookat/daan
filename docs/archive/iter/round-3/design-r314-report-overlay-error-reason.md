# R314 设计：成绩报告解析浮层错题「错因自评」

## SOP-10 取证（先调查再发言）

四维复审计聚焦「核心功能深度」维度，生产代码/线上行为实证：

1. 错题本复习模式早有完整错因链路：`REASONS = ['粗心大意','概念不清','方法不会','纯蒙的']` chips 自评 →
   `PATCH /api/mistakes/{mid} {uid, error_reason}`（uid 隔离）→ 错题本「按错因」排序/搜索/聚合
   （`byReason` recap 卡：「高频错因是提分洼地」）→ 学习教练消费错因分布生成备考建议
   （`stats.vue`：「基于你的正确率、错因分布和打卡情况」）。
2. 模考交卷时答错题已自动 `save_mistake(source='exam')` 入错题本（`exam_api.py` submit 路径），
   但成绩报告解析浮层——经 R290 连看/R291 收藏/R292 社交条/R301 统计锚点/R312 纠错/R313 练同类题
   已成复盘工作台——复盘错题时**零错因标注出口**。用户在「刚做完、记忆最新鲜、最清楚自己是粗心还是不会」
   的时刻无法标错因，只能事后去错题本翻找同一道题再标，断点明显。
3. 竞品：粉笔错题本以错因归类为核心复盘动作（错因标签驱动分组复习）；本产品错因数据的下游消费
   （排序/聚合/教练）都已建成，唯独模考复盘这个错因产生率最高的场景没有录入口。

## 方案（复用既有契约，零新 API）

1. 后端 `db.py` 新增只读查询 `mistakes_by_qids(uid, qids)`：
   `SELECT id, question_id, error_reason FROM mistakes WHERE uid=? AND question_id IN (...)`，
   返回 `{question_id: {"id":…, "error_reason":…}}`。
2. `api_exam_report`：请求带 uid（本就必带，报告仅本人可读）时，对答错 items 纯增量补
   `mistake_id` / `error_reason` 两字段（未错/未答/无对应错题记录 → null）。旧客户端可忽略，契约向后兼容。
3. 前端 `report.vue` 解析浮层：仅当 `!detail.correct && detail.picked && detail.mistake_id` 渲染
   「错因自评」chips 行（与 book.vue 同一 REASONS 列表、同 PATCH 端点），置于答案行之后、解析之前
   （对齐 book 复习模式 verdict→reasons→讲解 的顺序）。点击乐观更新 detail 与 report.items 内存态，
   PATCH 失败 toast 并回滚。连看切题各题独立。fail-closed：缺 mistake_id 不渲染不伪造。
4. 不新增表/URL 态/持久化模型；错因白名单沿用 update_mistake 既有行为（错题本侧同一自由文本协议）。

## 验证

- 后端 pytest：report 答错题返回 mistake_id/error_reason；答对与未答题为 null；PATCH 后重取报告错因回读。
- 本地全绿：ruff/pytest/pyright/lint/vitest/build。
- 生产：临时 uid 真实模考交卷 → 报告浮层错题显示错因 chips → 点选 → PATCH 200 → 库内 mistakes.error_reason
  实查 → 刷新报告回显选中态 → 错题本同一记录错因一致（跨场景同源）→ 答对题浮层无 chips →
  1440/375 双视口溢出 0、console 0 error → 回归 R290/R291/R292/R312/R313 → 测试数据全库清理 leftover=0。
