# R26 设计方案：学习日历 + 模考大赛赛后报告桌面化

日期：2026-08-30 ｜ 轮次：round-3 R26 ｜ 范围：`frontend-uni/src/pages/stats/calendar.vue`、`frontend-uni/src/pkgA/exam/contest-report.vue` + 本文档

## 1. 取证（生产 1440 实测，2026-08-30）

批量测量剩余候选页（r26_audit）：
- calendar `.wrap` 704px 单列（日历卡+连签里程碑卡+海报按钮纵向堆叠）——立项。
- contest-report `.wrap` 704px 单列（总分 hero+分布+目标差距+模块表现+薄弱考点+历届曲线+按钮 7 段堆叠）——立项。
- home 992 / practice 1044 / mastery-map 1072 / contest 1068：已桌面化，不动。
- book 944（noside 空态属预期）；poster 680 / join 592 / share-q 672：分享落地页/邀请页窄卡属惯例——不立项。

## 2. 方案（纯 H5 媒体查询 + 模板包裹层，零 JS 逻辑改动）

### calendar.vue
- ≥768px：`.wrap` 1044px 居中；`.cal-btn`、`.poster-btn` hover cursor。
- ≥1024px：`.cd-cols` 双栏——左 `.cd-main` 日历卡（flex:1）；右 `.cd-side`（连签里程碑卡+生成海报按钮，420px sticky top 24rpx）。
- <1024px：单列零变化（DOM 顺序不变：日历→里程碑→按钮）。

### contest-report.vue
- ≥768px：`.wrap` 1044px 居中；`.pbtn`、`.wrow` hover cursor。
- ≥1024px：`.cr-cols` 双栏——左 `.cr-side`（总分 hero+小样本提示+分数分布，420px sticky）；右 `.cr-main`（距离目标+模块表现+薄弱考点+历届曲线+行动按钮）。
- <1024px：单列零变化。loading/err `.spin` 不入双栏。

## 3. 不做

- 不改 API/统计口径；不改日历/分布/曲线渲染逻辑；不动 poster/join/share-q。

## 4. 验收

- 1440/1280：两页双栏 sticky、无横向溢出、hover 生效。
- 375：单列零变化。
- 干净重载 console 0 error。
