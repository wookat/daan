# R19 设计方案：收藏与笔记桌面工作台（左收藏夹侧栏 + 右题目列表；笔记两列）

## 1. 现状取证（2026-08-29，生产 1440×900）

- 页面：`/#/pkgA/social/favorites`（收藏与笔记），`favorites.vue` 无任何桌面媒体查询（全文件 0 个 `@media`）。
- 1440 实测：.wrap 704px、卡片 680px 单列（截图 r19_favorites_1440.png）——收藏夹卡、模块筛选、题目列表全部纵向堆叠，桌面上选夹与浏览题目需反复上下滚动。
- 桌面功能缺口：收藏夹「重命名/删除」仅挂在 `@longpress`（favorites.vue folderOps），桌面鼠标无长按——桌面用户无法管理收藏夹（P1，功能维度）。
- 同轮取证的其他页（contest/weekly/calendar/interview 作答页）内容量小、窄幅可接受，不立项。

## 2. 目标与范围

仅改 `frontend-uni/src/pkgA/social/favorites.vue`（模板包裹容器 + H5 媒体查询 + 桌面夹管理入口），零后端；<768px 视觉零变化。

### 2.1 ≥768px

- `.wrap` 收敛 `max-width: 1044px` 居中。
- folder/chip/qitem hover 反馈。

### 2.2 ≥1024px（收藏题目 tab）

- `.fav-cols`（flex, gap 32rpx, align-items flex-start）：
  - `.fav-left`（width 300px, sticky top 24rpx）：收藏夹卡（含新建收藏夹）。
  - `.fav-right`（flex:1, min-width 0）：模块筛选 chips + 重练按钮 + 题目列表 + 空态。
- <1024px `.fav-cols` 退化纵向，DOM 顺序与现单列一致。

### 2.3 ≥1024px（我的笔记 tab）

- 笔记 `v-for` 外包 `.ngrid` 两列 `repeat(2, minmax(0,1fr))`。

### 2.4 桌面收藏夹管理入口（H5）

- folder 行加 `···` 按钮（`.fops`，仅 H5 显示、非默认夹），`@click.stop="folderOps(f)"` 复用既有 actionSheet；移动端 longpress 保留。

## 3. 验收标准

- 1440/1280：左收藏夹侧栏 sticky + 右题目列表同屏；笔记 tab 两列；`···` 可打开重命名/删除；无横向溢出、console 0 error。
- 375：单列纵向、与现状一致（`···` 在 H5 375 也显示但不破坏布局；小程序端不显示）。
- 既有功能不回归：选夹过滤、模块筛选、新建夹、移动到…、取消收藏、讨论区跳转、重练本夹、展开题目详情、本地时政收藏合并。
