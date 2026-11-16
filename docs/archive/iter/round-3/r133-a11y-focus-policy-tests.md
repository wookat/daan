# R133：a11y-focus 弹层栈决策纯函数化 + vitest 回归覆盖

## 背景与取证（2026-08-29）

- R123/R126/R131 三轮把 a11y-focus.js 演进为有状态模块：打开顺序栈、z-index 提升、
  栈顶 Esc/Tab、逐层焦点归还、空弹层 tabindex=-1 落点——全站键盘可达性唯一入口。
- 现状取证：`tests/` 仅 deeplink/md/edge-policy 三套（25 例），a11y-focus 零单测；
  历轮回归全靠生产 Playwright 实测（r126/r131 verify 脚本），成本高且只覆盖抽样页面。
- 同窗口复核：sitemap 页族治理健康（sitemap-pages 203 URL、questions 12 分片、
  canonical/尾斜杠 301 一致、/tiku/y//tiku/t/ 无 hub 属既定设计不立项）；
  Lighthouse/离线/键盘专项 R121–R131 已收口，无新 verified 缺陷。
- jsdom 未安装且 jsdom 无真实 layout（getClientRects 恒空），直接 DOM 级单测
  会让 visible() 全假；按 R118 边缘函数先例，抽纯函数注入可见性判定，零新依赖。

## 方案（行为等价重构，零依赖零后端）

新增 `src/modal-policy.js` 纯函数，a11y-focus.js 改为调用方：

1. `reconcileStack(stack, present)`：给定当前栈与「仍存在且可见」判定，
   返回 `{ removed, kept }`——removed 逆序弹出并各自归还 lastFocus（调用方执行 focus）。
2. `zIndexFor(depth)`：`BASE_Z(99) + depth`，入栈层级唯一来源。
3. `pickFocusTarget(focusables, fallback)`：有可聚焦元素取首个；否则返回
   `{ el: fallback, needsTabindex: true }`（空弹层 tabindex=-1 落点语义）。
4. `nextTabIndex(count, current, shift)`：Tab/Shift+Tab 循环下一焦点下标
   （current=-1 表示 activeElement 不在列表内）。

vitest 新增 `tests/modal-policy.test.js`：栈的入/出序、多层同时消失逆序归还、
z-index 单调、空弹层落点、Tab 前后向循环与边界（-1/首/尾/单元素）等。

## 验收

- 本地：eslint 全绿、vitest 全绿（新增 ≥12 例）、build:h5 成功；
- 生产部署后复跑 r131verify（嵌套弹层全链路 1440/375）确认行为零回归；
- console 0 error、无横向溢出（-15 为 scrollbar-gutter 预留非缺陷）。
