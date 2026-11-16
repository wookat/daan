# R316：模考「标记」贯穿到成绩报告——标记题网格外显 + 连看「只看标记」

## 取证（SOP-10 / SOP-02）

- 做卷页 exam.vue 早有「标记」功能：工具条 tbtn 切换 `cur._marked`，答题卡网格黄点外显（`:class="{ mark: q._marked }"`），本机 examProgress 快照整体保存 items（含 _marked），刷新可恢复。
- 但交卷 payload 只有 `{ picks, secs }`（R315 后），`_marked` 在交卷瞬间丢弃；exam_attempts 无 marks 列；report items 无标记字段。
- 报告「逐题对错」网格只有 对/错/未答 三态；解析浮层连看过滤只有「只看错题/未答」。
- 用户行为断点：考试中标记的题 = 「不确定/蒙的/回头再看」的题，是复盘时最优先要看的题（含**做对了但没把握**的题——这类题不进错题本、不被「只看错题」覆盖，是当前复盘盲区）。粉笔模考复盘保留考中标记并可定位。

## 方案（零新 endpoint/表/URL 状态，复用 R315 同构链路）

后端：
- `_ensure_exam_tables` 幂等补列 `exam_attempts.marks TEXT`（JSON 数组 [题号]）。
- `finish_exam_attempt(..., marks=None)`：清洗后 JSON 落库（无标记存 NULL）。
- `get_exam_attempt`：marks 解析回 list（旧记录/NULL → []）。
- submit：body `marks` 仅接受 list，逐项 int 化、限 1..len(qids) 范围、去重排序，非法项跳过（fail-closed）。
- report items 纯增量补 `marked: bool`（旧数据一律 false）。

前端：
- exam.vue submit payload 补 `marks: [题号...]`（`q._marked` 的 1-based 序号）。
- 纯函数 `exam-marks.js`：
  - `markedNos(items)` → 报告 items 中 marked 的 no 列表（非数组/无标记 → []）。
  - `nextNavMode(mode, hasMarks)` → 连看过滤三态循环 all→wrong→marked→all（无标记题跳过 marked 档，兼容旧报告/未标记卷，行为与现状一致）。
- report.vue：
  - 网格 qn 补 `.mk` 角标样式（右上小黄点，不改变对/错/未答底色语义），legend 补「标记」。
  - 浮层统计行区域补「考试时标记过本题」badge（`detail.marked` fail-closed 不渲染）。
  - dnav-mid 由 wrongOnly 布尔升级为 navMode 三态（'all'/'wrong'/'marked'），stepQ 过滤逻辑同构扩展；aria-label 同步。

不做：URL 状态、R298 服务端续考进度补 marks（本机快照已保留标记，跨设备续考丢标记记为已知观察项，不在本轮伪装收口）、报告页标记增删（复盘只读，与粉笔口径一致）。

## 验证

- 后端 pytest：带 marks 交卷→report items marked 逐题回读；旧 attempt 全 false；越界/非法/重复项过滤；answers/secs 等既有字段兼容。
- 前端 vitest：markedNos/nextNavMode 纯函数矩阵（空/非法/无标记跳档/循环序）。
- 本地全绿（ruff/pytest/pyright/lint/vitest/build）→ PR → 部署 → 生产临时 uid 真实交卷双视口实测 → 清理 leftover 0 + 保护 uid 快照一致。
