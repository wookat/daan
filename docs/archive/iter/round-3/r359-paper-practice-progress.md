# R359：卷库「按卷练习」逐卷练习进度外显——papers 契约补 practiced + 卷卡「已练 X/N 题」

## 背景与取证（先调查）

R357 把真题卷入口合并进卷库操作台后，命中 psource 的卷卡新增「按卷练习」
（不计时逐题练，答案写 answer_log / 错题本）。生产取证（verified，读码）：

- 模考维度的完成态外显已完整：`best_score`/`attempt_count`/「已刷 X/N 卷」
  进度条（R310/R311，`exam-list-progress.js` 以 best_score 判 done）。
- **练习维度完全无外显**：按卷练习做到一半或做完，卷卡上没有任何痕迹——
  「已练多少题」不可见，用户回到卷库无法分辨哪些卷练过、练到哪，只能凭记忆。
  竞品（粉笔试卷列表）对练习卷外显「已做 X/N」进度。
- 数据已就位（verified）：练习流逐题落 `answer_log(uid, question_id, ...)`
  （含索引 `idx_al_uid(uid, created_at)`）；卷列表基础查询
  `_list_exam_papers_base` 已逐卷解析 `question_ids` 并算活跃题集
  （R357 psource 同一循环），无需新表/新扫描。

## 方案

零新 endpoint/零新表，复用 `GET /api/exam/papers?uid=`（R311 已带 uid 分支）：

### 后端

1. `_list_exam_papers_base`：uid 无关缓存 base 每卷额外保留 `_qids`
   （活跃题 id 列表，已在现有循环中算出，仅存引用不加查询）。
2. `list_exam_papers(uid=...)`：uid 命中时一次
   `SELECT DISTINCT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL`
   得已练题集，逐卷 `practiced = |qset ∩ _qids|`；输出前剥离 `_qids`。
   - 无 uid：`practiced=0`（契约恒有该字段，前端 falsy 即隐藏，fail-closed）。
   - 口径如实：answer_log 含普通刷题/重练等所有作答，「已练」= 该卷题目中
     被该 uid 在任意练习场景做过的题数，不限「按卷练习」入口（文案不宣称）。

### 前端（`pkgA/exam/list.vue`）

3. 卷卡 meta 区追加 `<text v-if="p.psource && p.practiced">已练
   {{ p.practiced }}/{{ p.n }} 题</text>`：
   - 仅 psource 卷显示（无练习入口的卷不显示，避免误导）；
   - `practiced` 缺失/0 → 不渲染（老缓存/降级 fail-closed）。

## 验证计划

- 后端契约测试：无 uid practiced=0；uid 命中 answer_log 交集精确计数；
  disabled 题不计；跨卷不串。
- 本地门禁：ruff/pytest/pyright + 前端 lint/vitest/build。
- 生产：testing agent 真实 UI 按卷练习 N 题 → 返回卷库出「已练 N/…」；
  其他卷不出；无 psource 卷不出；375/1440；0 次 /api/explain；测试 uid 全清。
