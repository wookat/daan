# R311：考过的卷卡直达成绩报告——「看报告」入口 + best_attempt_id

## 取证（生产实查 2026-08-29）
- 卷库卡片已外显「我的最好成绩 X 分 · 已考 N 次」（R284/R309/R310 逐步补齐状态/筛选/进度），但考过的卷卡只有「开始模考 / 导出 PDF」两个按钮——想回看某卷成绩报告，只能滚到页面底部「我的模考记录」列表（limit 10，超出 10 次的历史卷无入口）逐条辨认，或重新交一次卷。
- 报告页早已支持 `?attempt_id=` 深链（R286 起多处消费），缺的只是卷卡到最好成绩 attempt 的映射。
- 竞品：粉笔卷库已做卷直接给「查看报告」。

## 方案
### 后端（纯增量）
- `list_exam_papers` uid 合并段改为单查询 `SELECT paper_id, id, score FROM exam_attempts WHERE uid=? AND submitted_at IS NOT NULL`，Python 聚合出每卷 `{best_score, attempt_count, best_attempt_id}`：
  - best_attempt_id = 最高分 attempt；同分取 id 更大（更近一次）；
  - 未考过卷 `best_attempt_id: None`；
  - 契约既有字段值不变（MAX(score)/COUNT(*) 语义等价）。

### 前端
- 卷卡按钮行 `p.best_attempt_id` 存在时追加第三个按钮「看报告」→ `/pkgA/exam/report?attempt_id=<best_attempt_id>`（复用既有深链，零新协议）。
- fail-closed：字段缺失/null 不渲染按钮，行为与现状一致。

## 边界
- 0 分 attempt 也有报告（best_score=0 仍给入口，与 R309/R310「0 分算考过」口径一致）。
- 服务端 year/region 筛选不影响映射（逐卷字段）。
- 不改报告页、不新增 API。

## 验证
- pytest：papers 契约补 best_attempt_id（未考 None / 多次取最高分 / 同分取更近）。
- vitest：list.vue 无纯函数新增，按钮渲染逻辑由生产走查覆盖。
- 生产：临时 uid 同卷交两次不同分，卷卡「看报告」直达最高分报告；未考卷无按钮；1440/375 双视口溢出 0、console 0 error；测试数据清理 leftover=0。
