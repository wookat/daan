# R51 设计方案：分包页 a11y 全量扫尾（color-contrast + 表单 label）

## 一手证据（2026-08-29 生产 Lighthouse，headless Chrome，accessibility+performance）

R46/R48/R49 已把首页/错题本/刷题页/tiku SSR 收到 a11y 1.0，但分包页族从未扫过。本轮对未审计页面全量跑分：

| 页面 | a11y | 失败项 | 具体节点 |
|---|---|---|---|
| pages/book/book | 1.0 | — | |
| pages/profile/profile | 1.0 | — | |
| pkgA/social/plaza | 1.0 | — | |
| pkgA/interview/interview | 1.0 | — | |
| pkgA/shenlun/shenlun | 1.0 | — | |
| pkgA/social/favorites | **0.91** | color-contrast | `.seg-i` 未选中 tab 文字 #6b7280 on var(--line) = 3.98 |
| pages/stats/calendar | **0.91** | color-contrast | `.ms-dot-d` 徽章天数：`.ms-dot` 整体 opacity .45 → 实效 #b7bac1 = 1.94 |
| pkgA/search/search | **0.82** | color-contrast + label | `.empty` 空态 #6b7280 = 4.35；`.sinput` 内层 input 无 label |
| pkgA/pk/pk | **0.90** | label | `.join-input` 内层 input 无 label |
| pkgA/stats/mastery-map | **0.91** | color-contrast | `.cold-s` 硬编码 #8a90a0 = 3.19 |

对比度换算（本机实测 WCAG 公式）：--ink-2 #5f6575 on #eef1f7 = 5.15、on #fff = 5.83、on --bg #eef3ff = 5.24，均 ≥4.5；深色 --ink-2 #9ba0b0 on #15161c = 6.92。

## 架构决策

1. **color-contrast 四处**：全部收敛到既有 token `var(--ink-2)`（浅深两套已定义），不新增 token，不动 --ink-3 本体（正文大字号场景 4.83 达标）。calendar 徽章锁定态的 45% 淡化改为只作用于图标（🔒 已承载锁定语义），天数文字保持全对比度。
2. **label 两处**：uni-app H5 编译后真实 `<input>` 在 `uni-input` 内层，模板上加 aria-label 只会落在自定义元素外壳上不被 axe 认可。复用 R46 已有的 App.vue MutationObserver（markMain），对无 aria-label 的 `.uni-input-input/.uni-textarea-textarea` 把 placeholder 文本镜像为 aria-label——一次修复覆盖全站所有输入框（search/pk/discuss/team 等），零逐页改动。

## 交互规格

- 视觉变化仅限：favorites tab 未选中文字、calendar 未解锁徽章天数、search 空态文字、mastery-map 冷启动副文案 → 均从浅灰变为中灰（--ink-2），布局零变化。
- aria-label 为纯语义属性，无视觉变化。

## 验收标准

- 上述 5 页生产 Lighthouse a11y 全部 1.0；已达标页（book/profile/plaza/interview/shenlun）不回退。
- 1440/375 双视口视觉走查无布局回归、console 0 error。
- 深色模式四处文字继承 token 正常。
- 游客只读、保护 uid 零 mutation。

## 风险与未覆盖

- MutationObserver 已在 R46 常驻运行，增量 querySelectorAll 开销可忽略（同一回调内）。
- 动态创建且无 placeholder 的输入框不受益（现站内输入框均有 placeholder）。
