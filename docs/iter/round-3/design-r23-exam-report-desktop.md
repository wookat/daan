# R23 设计方案：真题做卷页 + 成绩报告页桌面化（pk/team 之后的下一批）

日期：2026-08-30 ｜ 轮次：round-3 R23 ｜ 范围：仅 `frontend-uni/src/pkgA/exam/exam.vue`、`frontend-uni/src/pkgA/exam/report.vue` + 本文档，零后端改动

## 1. 现状取证（生产 1440×900，bundle index-C-l8IPg_.js）

- `/#/pkgA/exam/exam?mini=1`：`.wrap` 704px 单列，答题卡是移动端贴底浮层（点「答题卡」才出现），底部固定 navrow 横贯全屏——做卷是核心黄金路径，桌面体验落后于已改造的刷题页（R12 有常驻答题卡侧栏+键盘作答）。
- `/#/pkgA/exam/report?attempt_id=…`：`.wrap` 704px 单列（hero 分数、排名卡、模块得分、历次成绩、薄弱考点、逐题对错纵向堆叠），解析浮层贴底。
- 其余候选（同轮取证）：weekly-report 704 / interview-history 712 / discuss 704（生产 0 讨论）/ login 680 / mastery-map 已 1072 达标——价值低于做卷主路径，暂不立项。
- 对标：粉笔桌面做卷为「左题干+右常驻答题卡」双栏，报告页为双栏摘要+明细。

## 2. 方案（H5 媒体查询 + 模板包裹层；exam.vue 另加 H5-only 键盘作答，复刻 R12 practice 模式）

### exam.vue
- ≥768px：`.wrap { max-width: 1044px; margin: 0 auto; }`；opt/tbtn/nbtn/acard-n hover cursor。
- ≥1024px：
  - `.ex-cols` 双栏：左 `.ex-main`（topbar/进度/题卡/翻页按钮行，flex:1 min-width:0）；右 `.ex-side` 常驻答题卡侧栏（320px sticky：剩余时间、已答 x/y、题号 grid 三态（已答/标记/当前）、交卷按钮）——复用既有 jumpTo/confirmSubmit/fmtLeft，纯模板绑定零新方法。
  - 桌面隐藏底部固定 `.navrow` 中的「答题卡」按钮（侧栏常驻），navrow 内容宽度对齐 1044 居中。
  - H5 键盘（仅 ≥1024 且无浮层）：A–D 选择、←/→ 翻题、Enter 下一题/最后一题唤起交卷确认——与 R12 practice 同交互，新增 keydown handler（guard：cardOpen/弹窗/输入框时不拦截）。
- <1024px：包裹层退化纵向，移动端贴底答题卡浮层与手势翻题零变化。

### report.vue
- ≥768px：`.wrap { max-width: 1044px; margin: 0 auto; }`；解析 `.mask/.sheet` 桌面居中弹窗（640px 圆角）；wrow/qn/pbtn/curve-col hover cursor。
- ≥1024px：`.rp2-cols` 双栏——左 `.rp2-side`（hero 分数卡+排名卡+模块得分，420px sticky）；右 `.rp2-main`（历次成绩、薄弱考点、逐题对错、按钮行）。
- <1024px：单列不变，解析浮层回贴底抽屉。

## 3. 不做

- 不改 /api/exam/* 任何接口与判分逻辑；不改进度保存/恢复、交卷容错、比赛 attach 逻辑。
- 小程序/Flutter 零影响（`/* #ifdef H5 */`；键盘代码 H5 条件编译）。

## 4. 验收

- 1440/1280：做卷页双栏+常驻答题卡 sticky、键盘作答可用、无横向溢出；报告页双栏+解析居中弹窗。
- 375：两页旧版单列、贴底浮层不变。
- 真实流程：游客走迷你模考若干题→交卷→报告（允许写入）；干净重载 console 0 error。
