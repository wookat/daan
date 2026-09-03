# R362：按卷练习会话题集对齐卷面——收口卷卡 n 与 src 会话题数不一致

日期：2026-08-29 ｜ 状态：设计 → 实现

## 取证（verified）

R361 生产实测发现的既有观察项，本轮取证确认为结构性口径分裂：

- 卷卡 `n` / `practiced` 口径（R359，`db._list_exam_papers_base`）：`exam_papers.question_ids ∩ 活跃题`（`disabled=0`），即**卷面题集**。例：2015 新疆卷卡 n=38。
- 按卷练习会话题集（R357/R360，`db.paper_questions(source)`）：`questions WHERE source=? AND is_real=1 AND disabled=0 LIMIT 140`，即**同 source 全集**。同一 source 字符串可被多张卷/超出卷面的题共享——2015 新疆同 source 返回 120 题（生产实测会话 1/120）。
- 后果：卷卡「已练 X/38 题」与会话进度 1/120、R360 续练弹窗、R361 全练完弹窗的 N 三方对不上；用户练完卷面 38 题后卷卡显完成态，但点进去仍有 82 题「未练」，反之亦然。

## 方案（最小收口：按卷练习优先走卷面题集）

### 后端（契约向后兼容）

`db.paper_questions(source, limit=140, uid=None, pid=None)` 补可选 `pid`：

- `pid` 命中有效卷（`get_exam_paper` 存在且 `question_ids` 非空）：题集 = `question_ids ∩ 活跃题（disabled=0）`，**保持卷面顺序**（与模考一致）；不再加 `is_real=1` 过滤——与卷卡 n 的口径完全一致。
- `pid` 未命中/非法：回落原 `source` 路径，契约零变化（fail-open 到旧行为，入口仍可用）。
- `uid` 的 `done` 标记语义不变（answer_log DISTINCT）。

`/api/paper_questions` 补可选 `pid: int`，透传；`src` 仍必填（回落路径 + 兼容旧客户端）。

### 前端

- `list.vue` 按卷练习 launch 协议补 `pid: p.id`。
- `paper-continue.js` 新增 fail-closed 纯函数 `paperQuery(p, untimed, uid)`：生成请求 query（`src` 必带；`pid` 仅正整数才带；`uid` 仅 untimed 带）——可 vitest 锁定。
- `practice.vue` paper 分支透传 `pid`，`startPaper()` 改用 `paperQuery()` 拼请求。其余（R360 续练弹窗 / R361 全练完弹窗 / `_source` 归卷）零改动，因题集分母对齐后语义自动一致。
- 旧 `paperSheet`（`/api/papers` 派生，无 pid）与旧客户端：无 `pid` 走 src 路径，行为不变。

### 不做

- 不改 `exam_papers.question_ids` 数据本身（120 题超集是否应入卷面属内容管线问题，另证）。
- 模考 timed 路径零变化（本就走 `/api/exam/start` 卷面题集）。

## 测试计划

- pytest：pid 命中卷面交集+顺序保持；pid 含 disabled 题剔除；pid 无效回落 src；pid+uid done 标记；src-only 契约零变化。
- vitest：`paperQuery` 非法 pid（0/负/非整/缺失）不带 pid；untimed 才带 uid；src 编码。
- 生产复验（testing agent）：2015 新疆卷卡 n=38 → 会话 1/38 且题集=卷面；练完 38 题卷卡完成态与全练完弹窗 N=38 一致；无 pid 旧路径回归；模考回归。
