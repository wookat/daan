# R15 设计方案：桌面全局壳拓宽（≥1366px 视口 1140→1280px）

## 背景与取证（2026-08-29 生产实测）

- R13（真题卷库 #186）与 R14（统计页 #187）均声明 `.wrap { max-width: 1044px }`，
  但生产 1440 视口实测 `.wrap` 只有 **932px**。
- 根因：`App.vue` 全局壳 `@media (min-width:1280px) { uni-app { max-width: 1140px } }`，
  减去左侧导航 208px 后内容区恰好 1140−208=932px，页面级 max-width 无法生效。
- 竞品参照：粉笔 Web 主内容区 ~1100–1180px（无侧栏）；我们含 208px 侧栏时
  壳体需 ≥1252px 才能给出 1044px 内容区。

## 决策

在 `App.vue` 追加一档媒体查询：**视口 ≥1366px 时壳体 max-width 提升到 1280px**，
内容区变为 1280−208=**1072px ≥ 1044px**，R13/R14 的页面级 1044px 声明即可真实生效。

- 不改动现有 1280–1365px 档（保持 1140px，避免壳体超出视口）。
- 所有跟随壳体定位的固定元素（tabbar/banner/mask/inputbar/batchbar/navrow/fabmenu）
  的 `calc((100vw−1140px)/2…)` 在新档同步换算为 1280px。
- 仅 H5 条件编译；≤1365px（含 375 移动端）零变化。

## 改动范围

- 仅 `frontend-uni/src/App.vue` 追加一个 `@media (min-width: 1366px)` 块。
- 零后端、零逻辑、零新接口。

## 验收标准

- 1440 视口：`uni-app` 宽 1280px；`/pkgA/exam/list`、`/pages/stats/stats` 的
  `.wrap` 实测 ≥1044px；两列网格/瀑布流卡片变宽无溢出；tabbar 侧栏与壳体左缘对齐；
  错题本 banner/batchbar、刷题 inputbar 等固定元素与内容区对齐（不偏移到视口边缘）。
- 1280 视口：仍为 1140px 壳（本轮无变化）。
- 375 视口：零变化，无横向滚动。
- console 0 error。
