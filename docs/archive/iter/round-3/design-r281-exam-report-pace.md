# R281：模考成绩报告补「模块用时 · 配速分析」

## 取证事实
- SOP-10 四维复审计（生产 1440/375 十路由截图 + 源码核查）：操作台/落地页/移动 IA 三维经 R124–R280 已无明显低垂缺口；核心功能深度维度定位到模考报告。
- 交卷链路（exam_api.py `api_exam_submit`）已按模块聚合 `per_module[k] = {n, answered, correct, secs}` 并随 attempt 落库（`finish_exam_attempt`），报告接口 `api_exam_report` 原样返回 `attempt.per_module`。
- 前端 exam.vue 逐题累计 `_secs`（切题即累计当前题停留秒数）随交卷上报——**用时数据从第一天就在采集并落库，但报告页从未呈现**：report.vue `modules` computed 只用 n/correct，全卷仅有一个总「用时 X 分 X 秒」。
- 竞品：粉笔模考成绩报告的核心维度之一是各模块用时与参考用时对比（行测 120 分钟 135 题，配速失衡是最常见的失分原因；资料分析超时挤压言语是典型模式）。本产品报告有得分维度无时间维度。
- 全站作答统计外显（SSR /tiku/q 补正确率条）候选被否决：生产实查 `attempt_count>=5` 仅 17 题（11 万题库），外显覆盖面不足，非本轮价值最高项。

## 用户痛点与差距
模考的独特价值恰是「限时压力下的配速训练」。用户交卷后只知道每模块对错，不知道时间花在哪、哪个模块超支——无法据此调整做题顺序/放弃策略。数据已有，纯呈现缺口。

## 设计（纯前端，零后端/契约变化）
- 新增纯函数模块 `src/exam-pace.js`：
  - `buildPaceRows(perModule, durationMin, total)` → `[{key, secs, refSecs, status}]`
  - 参考用时按题量比例折算：`refSecs = durationMin*60 * n / total`；
  - status：`over`（used > ref×1.2 超时）、`fast`（used < ref×0.6 偏快）、`ok`；
  - 守卫：`durationMin<=0 || total<=0 || 全模块 secs 合计为 0` 返回 `[]`（历史无 secs 数据的 attempt、异常入参均不渲染，不伪造）。
  - `fmtMin(secs)` → `X分X秒` 短格式。
- report.vue 侧栏「模块得分」卡下新增「模块用时 · 配速」卡：每模块一行，双段说明（实际用时 vs 参考用时）+ 条形宽度按 used/max(used,ref) 比例 + status 着色（over=--bad-strong、fast=--info/中性、ok=--ok-strong）+ 底注「参考用时按题量占比折算自本卷限时」。
- 空态：paceRows 为空整卡不渲染（无历史回退问题）。
- 模块顺序沿用 MOD_ORDER；深浅色走既有 token；无新增交互态（无键盘/URL 影响）；移动端同卡片流式布局无横向溢出风险。

## 不做
- 不做逐题用时（answer_log 有 secs 但 report items 契约不含，扩契约另轮评估）；
- 不做「建议用时」人工配置（无权威数据来源，按题量折算口径如实标注）；
- 不改 contest-report（模考大赛报告数据形态不同，另轮评估）。

## 测试与验收
- vitest：正常折算/超时/偏快判定、durationMin=0、全 secs=0、空 perModule 返回 []。
- 本地门禁 lint/vitest/build 全绿；部署后生产 1440/375 实测：真实交卷一次（临时测试 uid，验后清理）报告出现配速卡、数值与交卷 secs 一致、无 secs 的历史 attempt 不出卡、溢出 0、console 0 error、性能预算全过。
