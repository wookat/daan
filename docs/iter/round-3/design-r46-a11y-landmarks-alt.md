# R46 设计方案：无障碍收敛——装饰性图标 alt 缺失 + main landmark

## 一手证据（2026-08-29 生产取证）

Lighthouse mobile（https://kaogong.zalize.com/）：performance 0.87 / best-practices 1.0 / **accessibility 0.79**。
a11y 全部失败项仅两个（axe）：

1. `image-alt`（score 0）：所有 `l-icon` 组件渲染的 `<img>`（base64 SVG 装饰图标）无 alt——首页命中 24+ 处，组件在 21 个页面复用，全站同病。
2. `landmark-one-main`（score 0）：uni-app H5 生成的页面结构（uni-app > uni-page > uni-page-body）无 `<main>` landmark，屏幕阅读器无法跳转主内容。

公司验收硬指标明确包含无障碍可用性（老板 Thomas 技术选型/产品体验原则）。

## 方案（架构决策）

1. **l-icon 装饰图标隐藏于辅助技术**：`components/l-icon/l-icon.vue` 模板加 `aria-hidden="true"`。
   - 该组件是纯装饰图标（语义均由伴随文字承载，如「练习」「收藏」标签），按 WAI-ARIA 装饰图应 aria-hidden，而非逐处补 alt 文案；
   - uni-app H5 会把未识别 attr 透传到根元素 `<uni-image>`，axe 对 `aria-hidden` 祖先内的 img 不再要求 alt；小程序端该属性无害。
2. **main landmark**：App.vue H5 段 onLaunch 后用 MutationObserver 给当前 `uni-page-body` 挂 `role="main"`（uni 结构为运行时生成、路由切换会重建节点，需持续观察 body 子树中 uni-page 变化）。
   - 不改 uni 框架产物、不影响布局，仅语义属性。

## 验收标准

- 生产复验 Lighthouse a11y：首页 ≥0.95（image-alt 与 landmark-one-main 均通过）；
- 抽查另一页面（如刷题页）image-alt 不再报 l-icon；
- 1440/375 视觉零变化、console 0 error；
- 小程序构建不受影响（仅 H5 条件编译段 + 无害属性）。

## 风险

- aria-hidden 透传若在某端失效仅回到现状（不劣化）；
- MutationObserver 仅监听 uni-page 节点增减，开销可忽略。
