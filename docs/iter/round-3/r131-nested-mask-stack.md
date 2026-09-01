# R131：嵌套弹层层叠序与焦点管理收口

## 背景

R126 上线全站 `.mask` 弹层键盘支持（Esc 关闭 / Tab 圈定 / 焦点移入与归还），当时明确记录「多层嵌套弹层焦点归还」为未验证边界。本轮对该边界做专项生产取证。

## 取证（生产 1440，2026-08-29，uid=ur131kbdtest 种子 3 条错题后已清理）

真实嵌套场景：错题本页打开「筛选与排序」sheet 后按 `?`（页面级快捷键，任何时刻可触发键盘速查弹层）。实测（r131probe3/4.py + 截图）：

1. **后开层被盖住**：kbdHelp 与 filter 两个 `.mask` 同为 `z-index:99`，层叠序由 DOM 顺序决定；filter 在模板中靠后，`?` 打开的 kbdHelp 完全被 filter sheet 盖住，用户视觉上「按 ? 没反应」。`elementFromPoint(720,450)` 实测命中 filter mask。
2. **Esc 关错层**：`topMask()` 取「DOM 靠后的可见 mask」，与打开顺序无关。Esc 实测先关掉了 filter（先开的层），露出底下的 kbdHelp——层序颠倒。
3. **焦点不进入新开层**：kbdHelp 为纯信息弹层，无任何 `[tabindex]` 元素，`sync()` 找不到落点便不移焦；焦点留在被盖住的 filter sheet 内，Tab 在 `maskFocusables` 为空时直接 return（未 preventDefault），焦点可逃逸到背景页面。

## 方案（仅改 frontend-uni/src/a11y-focus.js，零模板/零后端改动）

以「打开顺序栈」取代「DOM 顺序」作为弹层层级的唯一事实：

1. MutationObserver 的 `sync()` 改为维护 `stack`（可见 mask 的打开顺序栈）：新出现的 mask push 入栈并记录各自的 `lastFocus`；消失的 mask 出栈并把焦点归还给它自己记录的 lastFocus。
2. 新 mask 入栈时提升内联 `z-index = 基准 + 栈深`（基准取现值 99），保证后开的层视觉在最上——同时修复 elementFromPoint/点击穿透语义。
3. `topMask()` 改为返回栈顶，Esc/Tab 均作用于最后打开的层。
4. 焦点移入：无 `[tabindex]` 可聚焦元素时，给 mask 内层 sheet（或 mask 自身）补 `tabindex="-1"` 并 focus，保证 Esc 可用、Tab 不逃逸（空列表时也 preventDefault 圈定）。

不改动各页面模板与业务逻辑；单层弹层行为（R126 已验证路径）保持不变。

## 验证

- 本地：eslint / vitest / build:h5 全绿；
- 生产 1440/375：复跑取证脚本——`?` 后 kbdHelp 视觉在最上且获得焦点、Esc1 关 kbdHelp 焦点归还 filter sheet、Esc2 关 filter 焦点归还触发按钮 `.filterbtn`、Tab 在空焦点弹层内不逃逸；单层弹层回归（首页选题 sheet Esc/Tab/焦点归还）；溢出 0、console 0 error；测试 uid 数据清理。
