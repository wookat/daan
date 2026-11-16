# R121：离线态路由 chunk 加载失败提示收口

## 取证（verified facts，2026-08-31 生产 CDP 实测，375 视口）

- SW 离线壳有效：断网刷新首页完整渲染（壳 + R90/R108 快照）。
- 断网直入未访问过的路由（/#/pages/practice/practice?module=…、?daily=1）：页面 chunk 加载失败，
  uni-app h5 运行时内置 async-error 视图直出「连接服务器超时，点击屏幕重试」。
  - 文案误导：并非服务器超时而是本机无网络；
  - 点击重试在仍离线时必然再失败，无自动恢复：网络恢复后用户停在死胡同不知道该重试。
- 根因边界：sw.js 有意不拦截静态资源（immutable HTTP 缓存承担；历轮实证 SW Cache Storage
  偶发挂起，respondWith 面越小越稳），不回退该决策。

## 方案（纯前端 H5，App.vue 既有 MutationObserver 内扩展，零后端）

检测 `.uni-async-error` 出现且 `navigator.onLine === false` 时：
1. 文案替换为「当前无网络，页面还未缓存到本机。网络恢复后将自动重试。」；
2. 挂一次性 `online` 监听，网络恢复自动触发该视图的点击重试，用户零操作恢复；
3. 在线时的 chunk 加载失败（真·服务器问题）保持 uni 原生文案与手动重试语义不变。

## 验证

- 本地 eslint/vitest/build:h5；
- 生产 CDP：断网直入 practice → 显示离线文案；set_offline(false) → 自动恢复进入练习页；
- 在线回归：practice/daily 正常直入、1440/375 console 0 error。
