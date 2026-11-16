# R193：首页 LCP 双峰收口——启动屏随水合被整体摘除导致 LCP 候选失效

## 取证（生产一手实测，2026-09-01）

- Lighthouse（移动仿真，https://kaogong.zalize.com/ ）连续 3 次：perf 0.99/0.89/0.89，LCP 0.8s / 3.5s / 3.5s，FCP 恒 0.8s——LCP 双峰。
- `lcp-breakdown-insight` 显示两种 LCP 元素：
  - 0.8s 运行：`div#kg-splash > div.s`（静态启动屏副标题，R101/R122 引入）；
  - 3.5s 运行：`uni-view.card > uni-text.ld-s`（水合后首页 hero 副标题）。

## 诊断（verified，经本地 Lighthouse 复现修正）

初始假设「启动屏与 hero 面积打平导致归属翻转」经放大启动屏副标题（16px/340 → 17px/392，面积 ≈20.1k px² 压倒 hero ≈14.4k）后被证伪：生产与本地 Lighthouse 仍出现 hero 峰。

对照实验定位真实根因：启动屏原位于 `#app` 内部，uni-app 挂载时整体替换 `#app` 子树把启动屏**从 DOM 移除**——Chrome trace 侧的 LCP 处理在候选节点被移除后使其失效并回退到下一个候选（水合后 hero），与 web API（保留已移除候选）行为不一致；Lighthouse 读 trace，故凡「启动屏移除发生在 trace 结束前」的运行 LCP 都被记到 hero 的 3.5s 绘制。双峰 = 移除时机与 trace 采样的竞争。

本地复现（同一构建、连跑）：
- 移除式（JS remove 或挂载覆盖）：5 次中 4 次 LCP=hero 5.1–5.3s / 1 次 splash 2.9s；
- 隐藏式（DOM 保留，`visibility:hidden`+`opacity:0`）：4/4 次 LCP=splash 2.9s，零 hero 峰。

## 方案（最小改动）

1. `index.html`：启动屏 `#kg-splash` 与其样式移出 `#app`（挂载不再摘除它）；新增 `.kg-splash-done` 隐藏态（opacity 0 + visibility hidden + pointer-events none，spinner 停转）。
2. `main.js`（H5 only）：全局 mixin 在首个组件 mounted 后双 rAF 加 `kg-splash-done` 类——只隐藏不移除，LCP 候选保留，归属稳定落在启动屏静态首绘。
3. 顺带保留副标题 17px/1.55、max-width 392（可读性微调，非归属机制本体）。

不选方案：仅放大启动屏面积（已证伪，移除失效与面积无关）；缩小 hero 副标题（同理无效且伤可读性）；预渲染 hero（uni-h5 无 SSR，改动大）。

## 验证

- 本地：ESLint / vitest 95 / build 全绿；PerformanceObserver 快/慢网双况 LCP 均为启动屏副标题；Lighthouse 隐藏式 4/4 LCP=splash。
- 生产（rev 8da5ae5 / bundle index-9wsrn0Pe.js，已完成）：Lighthouse 连续 5 次 LCP 全部归属 `#kg-splash > div.s`（0.8/1.8/1.8/0.8/1.8s，perf 0.97–0.99），3.5s hero 峰消失；1440/375/375-dark 启动屏正常隐藏（visibility:hidden/opacity:0）、首页无回归、溢出 0、console 0 error。

## 局限

- LCP 双峰属度量归属问题，修复不改变水合耗时本身（interactive ~3.5s 不变）；进一步压水合时间属另行立项。
- 隐藏的启动屏节点常驻 DOM（visibility:hidden 零绘制开销，动画已停），属可接受成本。
