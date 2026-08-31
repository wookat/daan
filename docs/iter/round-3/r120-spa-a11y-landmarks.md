# R120：SPA 全站 landmark/h1 无障碍收口

## 取证（verified facts，2026-08-31 生产 axe 4.x 实测，1440/375 双视口一致）

- 6 个 SPA 页面（home/mistakes/profile/papers/discuss-plaza、/p/og433f 落地后的 pk-result）全部命中
  `page-has-heading-one`（moderate）：整站无任何 h1（uni-app view 编译为 div，页面标题在 uni-page-head 内非 heading）。
- home/mistakes/profile 命中 `region`（moderate，6 nodes）：`uni-page-head`（页头标题）与 5 个
  `.uni-tabbar__label`（tabbar 文字）不在任何 landmark 内。R46 的 markMain 只给 uni-page-body 挂了 role="main"。
- pk-result 命中 `region`（1 node）。
- `scrollable-region-focusable`（serious，body）经键盘实测为误报：PageDown 实际滚动 document
  （scrollTop 0→612），不立项。
- /tiku SSR 页族 R119 复测 0 violations，无需改动。

## 方案（纯前端 H5，App.vue markMain 扩展，零后端）

1. `uni-page-head`（当前页）→ `role="banner"`；历史页移除。
2. `.uni-tabbar` → `role="navigation"` + `aria-label="主导航"`（labels 随之入 landmark）。
3. 当前页 `uni-page-body` 若无 h1：注入 sr-only h1（文本 = uni-page-head 标题或 document.title），
   路由切换时更新文本；sr-only 样式内联（clip 1px 方案），不影响视觉。
4. 复用既有 MutationObserver 触发，无新监听。

## 验证

- 本地 vitest/eslint/build:h5；部署后生产 axe 复测上述 6 页 ×1440/375 目标 0 moderate+ violations；
- 视觉回归：双视口截图无变化、console 0 error。
