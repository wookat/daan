# R320 设计：未交卷模考「排除干扰项」跨设备同步

## 取证（SOP-10）

- R319 已上线做卷页长按排除干扰项（`_excl`），但仅随 `saveProgress()` 存本机 examProgress 快照；
- 生产代码实查：`pushProgress()` 只上传 picks/idx/marks/secs（exam.vue L344-352），`adoptServerExamProgress()` 恢复的 items 不含 `_excl`（exam-progress-sync.js L24-29）——换设备续考后设备 A 的排除态全丢，用户须重新逐项推理排除；
- R317（marks）/R318（secs）已建立完全同构的续考状态同步模式，`_excl` 是最后一块未同步的做题过程态。

## 范围（零新 endpoint/表/URL 状态）

### 后端
- `_ensure_exam_progress` 幂等补列 `exam_progress.excl TEXT`（JSON `{question_id: [选项字母]}`，question_id 口径与本协议 picks/marks/secs 一致；交卷协议不涉及排除态，无口径冲突）；
- `save_exam_progress(..., excl=None)`：非空存 JSON、空存 NULL（UPSERT 整体覆盖，空即清除）；
- `latest_exam_progress` 回读 dict（旧行 `{}`）；
- `POST /api/exam/progress` 可选 `excl`：缺省 `{}`；提供时必须 dict ≤300、key 可 int 化、value 为 list ≤4 且逐项 ∈{A,B,C,D} 字符串（拒非 list/非法字母/非字符串），否则 400 不静默转换；落库去重保序；
- `GET /api/exam/resume` 应答补 `excl`。

### 前端
- `pushProgress()` 补收集 `Array.isArray(q._excl) && q._excl.length` 的 `{q.id: _excl}`；
- `adoptServerExamProgress()` 按 excl 对象恢复 `_excl`（字符串键 Number 归一；value 非数组/项非 A-D 字符串 fail-closed 过滤，未命中 `[]`），本机快照优先不变；
- 交卷 payload、报告协议零变化。

## 测试
- pytest：excl roundtrip（乱序 key）、缺省覆盖 `{}`、非法（非 dict/value 非 list/["E"]/[1]/超 300）逐项 400、旧行回读 `{}`；
- vitest：adoptServerExamProgress 恢复 `_excl`、非法 value fail-closed、缺失回 `[]`、本机快照优先不变。

## 生产验证计划
- API：POST excl → resume 回读一致；非法逐项 400；
- testing agent：设备 A 1440 排除若干项 → 抓去抖 POST 含 excl → 设备 B 375 全新隔离 context 同 uid 续考 → 排除态完整恢复（弱化+删除线逐项一致）；交卷后 resume={}；双视口溢出 0、console 0 error；
- 测试 uid 全库清理 + 保护 uid 快照一致。

## 明确不做
- 刷题页排除交互（另轮）；已交卷报告外显排除轨迹。
