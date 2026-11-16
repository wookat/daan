# R18 设计方案：申论专区桌面化（列表两列 + 作答页双栏工作台）

## 1. 现状取证（2026-08-29，生产 1440×900）

- 页面：`/#/pkgA/shenlun/shenlun`（申论专区），`shenlun.vue` **无任何桌面媒体查询**（全文件 0 个 `@media`）。
- 1440 实测：内容占满壳内容区（卡片宽 ~1046px），真题列表单列堆叠 scrollH=3016（截图 r18_shenlun_1440.png）；素材/记录 tab 同样单列全宽。
- 作答详情页：题目、给定资料（数千字）、作答 textarea、批改结果全部纵向堆叠——桌面上写申论需要在「材料」和「作答框」之间反复滚动，与粉笔申论 Web 端「左侧材料 / 右侧作答」双栏工作台差距明显（P1，操作台维度）。
- 筛选 sheet 在桌面仍是底部抽屉（其他页 ≥768 已居中弹窗）。

## 2. 目标与范围

仅改 `frontend-uni/src/pkgA/shenlun/shenlun.vue`（模板包裹容器 + H5 媒体查询），零后端、零逻辑改动；<768px 零变化。

### 2.1 ≥768px
- `.page` 收敛 `max-width: 1044px` 居中（与 R13/R14 页面级一致，受壳约束实测 ~1046）。
- `.mask`/`.sheet` 居中弹窗（复用既有模式：`align-items:center; justify-content:center; sheet max-width 520px; border-radius 28rpx`）。
- 卡片/chip hover 反馈。

### 2.2 ≥1024px
- 真题列表：`v-for .q-item` 外包 `.qgrid`，两列 `grid-template-columns: repeat(2, minmax(0,1fr))`（复用 R13 exam list 模式；卡片 flex 列让 `.q-foot` 贴底）。
- 素材列表：`.m-item` 外包 `.mgrid` 两列；作答记录 `.rgrid` 两列。
- 作答详情页双栏工作台：`.card`（detail）内容重组为
  - `.d-cols`（`display:flex; gap:32rpx; align-items:flex-start`）
    - `.d-left`（flex:1）：标签行 + 作答要求 + 给定资料（保留折叠开关）
    - `.d-right`（flex:1, `position:sticky; top:24rpx`）：我的作答 textarea + 提交批改 + 批改结果 + 历史作答 + 参考要点
  - <1024px `.d-cols` 退化为纵向（`flex-direction:column`），DOM 顺序与现单列一致，移动端视觉零变化。

## 3. 验收标准

- 1440：真题/素材/记录三 tab 两列网格、无横向溢出；详情页左材料右作答同屏、右栏 sticky 随滚；筛选 sheet 居中弹窗；console 0 error。
- 375：三 tab 单列、详情纵向堆叠、底部抽屉筛选，全部与现状一致（零变化）。
- 既有功能不回归：筛选（题型/年份/地区）、收藏星标、加载更多、草稿自动保存、AI 批改入口（访问码提示）、历史作答折叠、参考要点折叠。
- AI 批改真实调用：受访问码限制，走查以「点击后出现访问码提示」为通过标准（真实批改需访问码，untested 如实标注）。
