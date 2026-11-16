# R79 设计：App 内往期每日一练入口（首页 hero「补练往期」）

## 取证（2026-08-31 生产）

- R78 已上线近 7 天往期能力：`/api/daily_set?date=`、`/tiku/daily/<date>/` SSR 归档页、深链 `?daily=1&date=`。
- 但 App 内零入口：往期补练目前只能从 SEO 归档页 CTA 进入，站内用户（首页 hero、每日一练完成页）无法发现——R78 设计文档已将「App 内往期列表」列为后续轮候选。
- 竞品：粉笔每日一练在 App 内提供往期日期列表，错过当天可直接补练。

## 方案（纯前端，零后端改动）

- home.vue hero-ds 行尾追加可点「补练往期 ›」（dsMeta 存在即显示，完成态/未完成态均可见）。
- 点击 uni.showActionSheet 列近 7 天日期（昨天/前天标注），选中 → `launch({ kind: 'daily', date })`。
- practice.vue practiceLaunch 分支 `kind === 'daily'` 透传 `startDaily(launch.date)`，复用 R78 往期链路（不提交成绩/不打卡/不计 streak）。

## 非目标

- 不做独立往期列表页；不标注每个往期日期的完成状态（本地无历史完成记录，服务端按 uid 查询留候选）；不改深链/SEO 页。

## 验收

- 首页 hero 显示「补练往期 ›」，点开 7 个日期，选昨天 → 直入昨日题组（题目与 API ?date= 一致），完成走往期分支无 submit。
- 今日流程回归：hero 主按钮/每日一练照常提交。
- 1440/375 无溢出、console 0 error；测试数据清理、保护 uid 零 mutation。
