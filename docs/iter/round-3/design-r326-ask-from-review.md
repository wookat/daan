# R326 设计方案：复盘场景补「AI 详解本题」入口（成绩报告解析浮层 + 错题本复习流）

日期：2026-08-29 ｜ 轮次：round-3 R326 ｜ 状态：实施

## SOP-10 取证（一手证据）

四维复审计（对标粉笔 AI 老师讲题 / 夸克 AI 讲解）后锁定「核心功能深度」维度缺口：

- 刷题页判分后已有「AI 深度讲解」出口：`deepExplain()`（practice.vue L2111–2116）把题干+选项写入
  `redoQuestion` storage 后 `switchTab` 到 AI 问答页，ask.vue onShow 消费并自动填入（ask.vue L293–301）。
- 错题本**列表卡**已有「AI 详解」op（book.vue L427 → `redo(m)` L1261），但只传 `m.question_text`
  **不带选项**，AI 无法分析各选项为何错。
- 错题本**复习流**（reviewing 态，看解析仍不懂的最高频时刻）**零 AI 出口**：answered 态只有
  错因自评 / 解析 / 练同类 / 下一题（book.vue L19–41 实查）。
- 模考成绩报告解析浮层（report.vue detail 弹层，R290–R315 已是复盘工作台：连看/收藏/社交条/纠错/
  练同类/错因/用时）**零 AI 出口**（grep `redoQuestion|deepExplain|ask` 无命中）。
- 竞品：粉笔逐题解析处处有「AI 老师讲题」；夸克刷题解析页有 AI 讲解追问。复盘场景（错题复习、
  模考逐题复盘）正是「看完解析仍不懂」的场景，出口断裂迫使用户手动复制题目去问答页。

用户可感知痛点：错题复习流/模考报告浮层里看不懂解析时，没有一键把本题（含选项）交给 AI 深挖的出口。

## 方案（纯前端零后端/零契约/零 URL 状态）

1. 新共享纯函数 `src/ask-prefill.js`：
   - `askPrefill(stem, options)` → `stem + '\n' + 'A.xx B.yy …'`；
   - stem 非字符串/空白 fail-closed 返回 `''`（调用方不跳转）；options 非法/空只回题干。
2. practice.vue `deepExplain()` 改调共享函数（行为零变化，口径统一）。
3. book.vue：
   - 列表卡 `redo(m)` 改 `askPrefill(m.question_text, m.options)`——修复既有入口不带选项；
   - 复习流 answered 态解析后补「AI 详解本题 ›」行（sim-row 同构），构造 prefill 后 switchTab ask。
4. report.vue detail 浮层：纠错 link 前补「看不懂？AI 详解本题」link（role=button），
   材料题用 `detailMat.stem`（折叠态也取小题干）+ `detail.options`；prefill 空串不跳转。

不做：不新增后端接口/表/URL 契约；不改 ask.vue 消费逻辑；列表扫描态不动。

## 生产走查修正（P0）

`mistakes.question_text` 写入口径本就是题干+选项（practice.vue 与 exam_api `_mistake_text` 同构），错题本侧再传 options 会重复两遍——生产实测证实。修正：错题本两处入口改 `askPrefill(question_text, null)`，只做非法/空守卫不再拼选项；报告浮层（`d.question` 纯题干）与刷题页不受影响。

## 验收

- 生产 1440/375：报告浮层与复习流入口点击后 ask 页题干+选项已填入 toast 提示；
  列表卡 AI 详解带选项；连看切题后入口随题切换；无溢出、console 0 error。
- 测试 uid 验后全库清理 LEFTOVER 0，保护 uid 快照一致。

## 测试

- vitest：askPrefill 正常拼接 / options 缺失只回题干 / 非法 stem 回空串 / options 非对象容错。

## 反伪造边界

仅复用既有 redoQuestion 协议与真实题目数据；不声称任何增长/转化效果。
