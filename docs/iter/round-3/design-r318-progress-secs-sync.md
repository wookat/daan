# R318 设计：未交卷模考「逐题用时」跨设备同步（exam_progress 补 secs）

## 取证（SOP-10 / SOP-02，一手证据）

- R315（PR #510）已让成绩报告逐题外显「本题用时」，数据源为交卷 payload 的 `secs`（1-based 题号→秒），由做卷页 `q._secs` 累计。
- R281 模块配速分析同样消费逐题 secs。
- 本机续考不丢用时：`exam.vue saveProgress()` 将整份 `items`（含 `_secs`）序列化进 `examProgress` 本机快照，本机恢复时用时完整。
- 服务端续考丢用时（代码实证）：
  - `pushProgress()` 只发 `{uid, attempt_id, picks, idx, marks}`，无 secs；
  - `exam_progress` 表无 secs 列，`/api/exam/resume` 应答无 secs；
  - `exam-progress-sync.js adoptServerExamProgress()` 恢复 items 时硬编码 `_secs: 0`。
- 用户可感知后果：设备 A 做了半场（每题都有真实用时），设备 B 续考交卷后，报告里设备 A 部分题目「本题用时」缺失或为 0、全卷平均与模块配速失真——R315/R281 的复盘价值在跨设备场景被截断。与 R317（marks 同步）完全同构，是该协议最后一块未同步的做题过程资产。

## 方案（最小增量，零新 endpoint/表/URL 状态）

口径：progress 协议内 secs 以 question_id 为 key（与本协议 picks/marks 一致）；交卷 payload 的 secs 仍是 1-based 题号口径，两者互不混用（同 R317 marks 的口径区分先例）。

### 后端
- `db._ensure_exam_progress`：幂等补列 `secs TEXT`（PRAGMA 探测 + ALTER，兼容旧行）。
- `db.save_exam_progress(..., secs: dict | None = None)`：非空存 JSON，空/None 存 NULL；UPSERT 整体覆盖。
- `db.latest_exam_progress()`：回读解析为 dict（旧行/NULL → `{}`）。
- `POST /api/exam/progress`：可选 `secs`；缺省 → `{}`；提供时必须 dict 且 ≤300 项，key 必须 int 化成功、value 必须 int（拒 bool）且 >0（≤0 项直接 400，不静默丢弃——与本端点 picks/marks 严格语义一致），否则 400。
- `GET /api/exam/resume`：应答补 `"secs": {question_id: 秒}`。

### 前端
- `exam.vue pushProgress()`：flush 当前题 qsecs 后收集 `q._secs > 0` 的 `{q.id: q._secs}` 进 payload。
- `exam-progress-sync.js adoptServerExamProgress()`：`server.secs` 为对象时按 `Number(key)` 命中 `q.id` 恢复 `_secs`（value 非有限正数则 0）；缺省/非对象 fail-closed 全 0；本机快照优先逻辑不变。

### 不做
- 不改交卷 secs 清洗（`_clean_int_map` 契约不变）；不新增计时逻辑；不改本机快照结构；不动 R315/R281 消费端。

## 验证计划
- 本地：ruff / pytest（新增 progress secs roundtrip+校验矩阵）/ pyright / ESLint / vitest（adopt 恢复 _secs 三态）/ H5 build。
- 生产 API：临时 uid 上传 secs → resume 回读一致；缺省覆盖 `{}`；非法（非 dict / bool value / 字符串 value / 0 / 负数 / 非 int key）逐项 400。
- 生产 UI：设备 A 答 2 题各停留数秒 → 设备 B 全新隔离 context 续考交卷 → 报告「本题用时」含设备 A 的秒数（非 0/缺失）；本机快照优先与 R317 marks 回归。
- 测试数据全库清理 leftover=0 + 保护 uid 快照逐表一致。
