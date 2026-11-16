# R167：深色模式 tabbar 图标滤镜适配

## 取证

- tabbar 图标为 pages.json 静态 PNG，深浅主题共用一套（R165/R166 复审计遗留打磨项）；
- 本机像素采样：未选中图标主色 ≈ rgb(138,148,166)（浅灰），选中图标主色 ≈ rgb(48,96,240)（品牌蓝）；
- 深色 tabbar 底 #1d1f28 上选中蓝对比 ≈3.26:1（非文本 3:1 达标线之上，非违例），但视觉偏沉、与 R164 收口后的选中 label #8fa8ff 色感不一致；未选中灰略暗。

## 方案

uni-h5 无 setTabBarStyle、静态 PNG 无法按主题切换资源，沿 R164 的 CSS 定向覆盖思路用滤镜适配（App.vue，零资源新增零后端）：

- `.theme-dark uni-tabbar .uni-tabbar__icon img`：`brightness(1.25)` 提亮未选中灰；
- `img[src*='-on']`（选中态，static 资源名 build 后原样保留）：`saturate(0.6) brightness(1.45)`，计算落点 ≈ rgb(98,139,255)，对深底对比 ≈5.3:1，与选中 label #8fa8ff 色感一致；
- 浅色主题不受影响（仅 .theme-dark 作用域）。

## 验收

- 本地 ESLint / vitest / H5 build 全绿；
- 生产 dark × 1440/375 实测：选中/未选中图标提亮生效、与 label 色感一致，light 主题零变化，axe 0、溢出 0、console 0 error。
