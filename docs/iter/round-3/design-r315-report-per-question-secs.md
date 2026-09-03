# R315 设计论证：成绩报告逐题「本题用时」锚点

## SOP-10 取证（生产 + 代码一手证据）

- 做卷页早已逐题计时：exam.vue 每秒累计 `qsecs`，切题时落到 `q._secs`，交卷请求体带
  `secs: {题号: 用时秒}`（exam.vue L258–L369）。
- 后端 submit 收到 secs 后只用于两处：answer_log 逐条落 `secs`（不关联 attempt）、
  per_module 聚合（R281 配速分析）。**逐题 secs 在 exam_attempts 里不持久化**
  （answers 列只存 picks），交卷响应里的 items.secs 一次性丢弃。
- 成绩报告（GET /api/exam/report/{id}）items 无任何用时字段；解析浮层（R290–R314
  已成复盘工作台：连看/收藏/统计锚点/错因自评/练同类题/纠错/社交条）无「本题用时」。
- 竞品对标：粉笔成绩单逐题解析外显每题用时（与平均用时对比），是「会但太慢」类
  问题的核心复盘锚点；本站只有模块级配速（R281），无法定位具体哪题拖慢整卷。

## 差距结论

用户模考后无法回答「我这道题花了多久、是不是太慢」——数据在交卷瞬间就有，
但被丢弃，属于纯数据链路断点，用户可感知且实现成本低。

## 方案（最小收口，纯增量）

1. db：`_ensure_exam_tables` 幂等补列 `exam_attempts.secs TEXT`（JSON {题号: 秒}）；
   `finish_exam_attempt` 增 `secs` 参数落库；`get_exam_attempt` 解析回 dict。
2. exam_api submit：把清洗后的 secs 传入 `finish_exam_attempt`（白名单已有
   `_clean_int_map`，非法值剔除）。
3. report items 纯增量补 `secs`：仅该题记录了 >0 用时才返回整数，否则 null
   （旧 attempt 无 secs 列值 / 未浏览题目 fail-closed null）。
4. 前端纯函数 `exam-time.js`：
   - `fmtSecs(s)`：`45 秒` / `1 分 20 秒`；非正数/非法返回 null。
   - `qTimeLine(secs, avgSecs)`：`本题用时 45 秒 · 全卷平均 38 秒/题`；
     secs 无效返回 null（不渲染不伪造）；avg 无效时只出前半句。
   - 全卷平均由客户端就地算：items 中 secs>0 的均值（≥3 题才给均值，防小样本误导）。
5. report.vue 解析浮层：题目统计行（dstat）后、错因自评前插一行用时锚点；
   连看切题随题切换；旧报告（无 secs）整行不渲染。

不新增：endpoint、独立数据表、URL 状态、第二套计时逻辑（复用交卷已带的 secs）。

## 验证计划

- 本地：pytest 补——带 secs 交卷后 report items 回读逐题 secs；未带 secs 的
  attempt 全 null；非法 secs 被清洗；旧库无列时幂等迁移可读。vitest 补
  exam-time.js 纯函数矩阵（fmt/均值门槛/fail-closed）。ruff/pyright/lint/build 全绿。
- 生产：临时 uid 真实交卷（带逐题用时），报告浮层用时行外显、与提交值一致；
  旧 attempt 报告不显示该行；双视口无溢出、console 0 error；R291/R292/R312/
  R313/R314 浮层能力回归；Lighthouse 预算复验；测试数据全库清理 leftover=0，
  保护 uid 快照一致。
