# R24 设计方案：周学习报告 + 面试练习记录桌面化

日期：2026-08-30 ｜ 轮次：round-3 R24 ｜ 范围：仅 `frontend-uni/src/pkgA/stats/weekly-report.vue`、`frontend-uni/src/pkgA/interview/history.vue` + 本文档，零后端、零既有 JS 逻辑改动

## 1. 现状取证（生产 1440×900，bundle index-Di26M4SN.js）

- `/#/pkgA/stats/weekly-report`：`.wrap` 704px 单列（hero 四指标、徽章、本周 vs 上周、掌握变化、错因分布、模考回顾、下周行动、分享按钮纵向堆叠）；分享弹层为移动端贴底抽屉。
- `/#/pkgA/interview/history`：`.wrap` 680px 单列（三统计卡+记录列表）。
- 同轮排除项：mastery-map 复测 scrollWidth==clientWidth==1425（1440−滚动条），无元素越界，**无真实横向溢出**，不立项；login 页窄表单为行业惯例（680px 可接受），不立项。

## 2. 方案（纯 H5 媒体查询 + 模板包裹层）

### weekly-report.vue
- ≥768px：`.wrap` 1044px 居中；分享 `.mask/.sheet` 桌面居中弹窗（560px 圆角）；cta/link/act-row/pbtn/sheet-x hover cursor。
- ≥1024px：`.wr-cols` 双栏——左 `.wr-side`（hero 四指标+徽章+本周 vs 上周，420px sticky）；右 `.wr-main`（考点掌握变化、错因分布、模考回顾、下周行动、生成分享图按钮）。空态/pending/error 卡保持整宽居中（不入双栏）。
- <1024px：单列、贴底分享抽屉零变化。

### history.vue
- ≥768px：`.wrap` 680→1044px 居中（hover 已有）。
- ≥1024px：`.stats-row` 整宽三卡；`.list` 两列 grid（`grid-template-columns: 1fr 1fr; gap`），记录卡等高。
- <1024px：单列零变化。

## 3. 不做

- 不改 /api/report/weekly、interviewHistory 接口与 markRead/分享 canvas 逻辑。
- login 桌面化、mastery-map（无溢出）不立项。

## 4. 验收

- 1440/1280：周报双栏 sticky、分享居中弹窗可生成图；面试记录两列网格；无横向溢出。
- 375：两页单列、分享贴底抽屉不变。
- 干净重载 console 0 error。
