# R317：未交卷模考「标记」跨设备同步——exam_progress 补 marks（收口 R316 观察项）

## 取证（SOP-10 / SOP-02）

- R316 已把「标记」贯穿到交卷后的成绩报告，但明确挂了观察项：R298 服务端续考协议（POST /api/exam/progress + GET /api/exam/resume）只同步 picks/idx，不含标记。
- 一手代码证据：`exam.vue pushProgress()` 只收集 `picks[q.id]`；`save_exam_progress(attempt_id, uid, picks, idx)` 无 marks 参数；`adoptServerExamProgress` 恢复 items 时硬编码 `_marked: false`。
- 用户行为断点：考中标记的题 = 「不确定、回头再看」的题。换设备续考（R298 的核心场景）后标记全丢，用户回头检查时无法定位；且交卷后报告的「只看标记」（R316）也随之缺失这些题——跨设备场景下 R316 的价值被截断。
- 本机续考（同设备刷新）不受影响：examProgress 快照整体保存 items（含 _marked），仍本机优先。

## 方案（零新 endpoint/表/URL 状态，镜像 R298 picks 口径）

后端：
- `_ensure_exam_progress` 幂等补列 `exam_progress.marks TEXT`（JSON 数组 [question_id]，与 picks 同用 q.id 口径；与交卷 marks 的 1-based 题号口径不同，互不混用）。
- `save_exam_progress(..., marks=None)`：非空存 JSON，无标记存 NULL。
- `latest_exam_progress`：marks 解析回 list（旧行/NULL → []）。
- `POST /api/exam/progress`：body 可选 `marks`，缺省/None → []；提供时必须是 list（≤300），逐项必须 int（拒 bool），否则 400（与本端点 picks 的严格 400 语义一致，区别于 submit 的静默跳过）。
- `GET /api/exam/resume`：应答纯增量补 `marks` 数组。

前端：
- `exam.vue pushProgress()`：补收集 `q._marked` 的 `q.id` 数组进 payload。
- `adoptServerExamProgress`：`_marked` 由 `server.marks` 集合命中恢复（非数组/非法项 fail-closed false，Number 归一兼容字符串 id）。

不做：本机快照协议变化（examProgress 已含 _marked）、报告端改动（R316 已收口）、marks 进边缘缓存（uid 相关，与 R298 同口径不缓存）。

## 验证

- 后端 pytest：progress 带 marks → resume 回读；旧进度行 marks=[]；非 list/含 bool/非 int 400；submit 后进度删除不回归。
- 前端 vitest：adoptServerExamProgress marks 恢复矩阵（命中/缺省/非法/字符串 id/本机优先不覆盖）。
- 本地全绿（ruff/pytest/pyright/lint/vitest/build）→ PR → 部署 → 生产临时 uid 双 context 实测（设备 A 标记→设备 B resume 恢复标记）→ 清理 leftover 0 + 保护 uid 快照一致。
