# R361：按卷练习「已练完」完成态闭环——完成外显 + 重练确认 + 会话来源归卷

## SOP-10 四维审计（2026-08-29 窗口，取证摘要）

- 操作台：卷库经 R357–R360 已具模考/练习双模式、进度外显、只练剩余续练；**选题命中**——完成态是该链路最后一个缺口（见下）。
- 功能深度：按卷练习会话在 answer_log 的 source 归属存在既有缺陷（见取证 C），随本轮一并收口。
- 落地页首页 UI：R360 部署复验 Lighthouse 首页 0.98/1.00/0.96/1.00、/tiku/ 全 1.00，无新 P0。
- 架构/移动 IA：无新 P0；共宿 recruit postgres 负载尖峰为运维项（需老板 VPS 决策，非代码）。

## 取证事实（verified）

### A. 卷卡无「已练完」完成态（操作台）

- `pkgA/exam/list.vue:65`：`v-if="p.psource && p.practiced"` 恒显绿色「已练 {{p.practiced}}/{{p.n}} 题」——practiced==n（全练完）与部分完成同样式、同文案，用户无法一眼识别本卷已练完。
- 粉笔试卷列表对做完的卷外显「已完成」态；我方模考侧有 best_score 完成态，练习侧没有。

### B. 全练完点击「按卷练习」静默从头重开（操作台/交互意图）

- `practice.vue startPaper()`（R360）：`plan.doneN > 0 && plan.remaining.length > 0` 才弹窗；全练完（remaining==0）**不弹窗、直接全量从头开始**——用户可能只是想看看本卷状态，误触即进入 75 题会话，且无任何「你已练完本卷」的成就确认。

### C. 按卷练习会话 source 泄漏/缺失（功能深度 · 数据正确性）

- `practice.vue` 中 `this._source` 仅在 `start()`（:1526）与 `startReinforce()`（:1359）赋值；`startPaper()` 不赋值。
- `logAttempts()`（:2300）逐题落 `source: this._source || null`。
- 后果：先做过专项/加练（_source='reinforce' 等）再进按卷练习，旧 source **泄漏**进按卷会话的 answer_log 行；首次直进则为 NULL——按卷会话无法归卷，练习历史无从标注「真题卷」。
- 后端 `save_answer_log` 对 source 无白名单（自由文本截断 32 字符），R359 practiced / R360 done 均按 DISTINCT question_id 计算、与 source 无关——写入卷 source 零副作用。

## 方案（纯前端，零后端/零契约/零新埋点）

1. `paper-continue.js` 新增 fail-closed 纯函数 `paperPracticedState(practiced, n)`：
   - 非正整数输入或 practiced<=0 → `{show:false, done:false, text:''}`；
   - practiced>=n → `{show:true, done:true, text:'已练完全部 n 题 ✓'}`；
   - 其余 → `{show:true, done:false, text:'已练 practiced/n 题'}`。
2. `list.vue` 卷卡改用该函数渲染（psource 前置条件不变），done 态加 `.done` 样式（brand 色加粗）区分进行中绿字。
3. `practice.vue startPaper()` untimed 分支：`doneN>0 && remaining.length===0` 时弹确认「本卷 X 题已全部练过，重新练一遍？」确认→全量从头（现行为），取消→不进入会话（return）；部分完成/零完成行为零变化。
4. `startPaper()` 起始处补 `this._source = untimed ? (p.source || null) : null`——修 C 项泄漏并让按卷会话归卷（timed 旧分支同步止漏）。

## 测试计划

- vitest：`paperPracticedState` 非法输入 fail-closed/零练过隐藏/部分完成文案/全练完 done 态；既有 `paperContinuePlan` 回归。
- 本地全绿门禁：官方 lint + vitest + H5 build（后端零改动，ruff/pytest/pyright 照跑防回归）。
- 生产 UI 走查（隔离测试 uid）：全练完卷卡完成态、点按卷练习弹重练确认、取消不进入、确认从头练、部分完成 R360 回归、answer_log source 归卷抓包、375/1440、console、0 /api/explain；测试数据验后清理。
