# R12 设计方案：刷题页桌面操作台（常驻答题卡侧栏 + 键盘作答）

日期：2026-08-30 ｜ 依据：生产 1440 实测取证

## 背景与取证
- 生产实测（r12_practice_1440.png）：刷题作答页在 1440 视口仍是 680px 单列手机流（cardW=680, cardX=484），两侧大量空白；答题卡藏在顶部 tag 点击的弹层里，桌面无常驻导航；无任何键盘作答支持。
- 竞品范式：粉笔 Web 题库练习为桌面级布局——题干主区 + 右侧常驻答题卡（题号网格、对错着色、点击跳题）+ 键盘作答，是桌面刷题工作台的标配（round-3 审计 P0-1/P2-1 同族差距，错题本侧已在 R1/R10/R11 补齐，刷题页仍缺）。
- 错题本已验证的资产可直接复用：R1 float 侧栏布局模式（侧浮动+主列 margin，主列勿 float）、R10 键盘守卫链、R11 kbd 徽标视觉。

## 方案（零后端、仅 practice.vue、仅 H5 ≥1024px）
1. 常驻侧栏 `.pside`（H5 条件编译，v-if="session && cur"，DOM 置于主卡之前 float:right）：
   - 「答题卡」卡：复用现有 `acard-grid/acard-n/acardClass/jumpTo`（与弹层同构），底部已答统计；examMode 显示「交卷」按钮（confirmFinishExam）。
   - 「键盘快捷键」卡：A–D 作答、Enter 下一题、←/→ 切题（R11 `.kbd` 徽标视觉）。
2. 布局：≥1024 时 `.wrap` 拓宽为 1080px 居中；主卡加 `.pmain`，margin-right 预留侧栏 344px；≤1023px `.pside{display:none}`、布局零变化。
3. 键盘（onPKeydown，R10 同款守卫：<1024 / 修饰键 / 输入焦点 / 弹层 cardOpen|toolsOpen|reportOpen|paperSheet|customOpen|setupOpen 全部不拦截）：
   - `A–D`：未作答且非背题模式时 pick()（仅当该选项存在）。
   - `Enter`：已作答（或背题模式）且非模考态时 next()。
   - `←`/`→`：jumpTo(idx±1)（与答题卡跳题同语义，模考态可用）。
   - onShow 挂载 window keydown，onHide/onUnload 卸载（practice 无 onUnload 需新增）。

## 交互规格
- 答题卡侧栏点击题号 = 弹层 jumpTo 同函数；对错/当前/跳过着色沿用 acardClass。
- examMode 下 A–D 仍可作答（pick 内部自带模考流转），Enter 不拦截（模考自动跳题）。
- 375/移动端：侧栏不渲染、键盘分支被宽度守卫拦截，行为与视觉零变化。

## 验收标准（生产 1440/375）
- 1440：主卡左移+侧栏常驻答题卡（着色/跳题）与快捷键卡；A–D 作答、Enter 下一题、←/→ 切题；输入框（纠错 textarea）不拦截；弹层打开时不响应。
- 375：无侧栏、无横向溢出、作答流程无回归。
- console 0 error；`npm run build:h5` 通过。
