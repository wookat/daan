# R80 设计：时政每日一练往期补练（首页时政卡「往期」入口）

## 取证（2026-08-31 生产）

- `/api/shizheng/daily` 服务端本就接受任意 `?date=YYYY-MM-DD`（日期作随机种子确定性抽题，qbank_api.py），但前端 `startShizheng()` 从未传参，用户错过当天即永远做不到那期时政题。
- 行测每日一练 R78/R79 已补齐往期链路（API/SSR/App 入口）；时政侧不对称——首页时政卡只有「去练习/回顾」两态。
- 本地完成记录 `szDaily.days[dayKey()]` 按日 keyed，`markShizhengDone()` 固定写今天。

## 方案（纯前端，零后端改动）

- home.vue 时政卡副标行尾追加「往期 ›」（click.stop），actionsheet 列近 7 天日期（昨天/前天标注），选中 → `launch({ kind: 'shizheng', date })`；埋点复用 `daily_archive_open`（ref `sz:<date>`）。
- practice.vue：`startShizheng(archiveDate)` 透传 `?date=`；`archiveDate !== dayKey()` 时置 `_szPast`，`markShizhengDone()` 往期分支不写 `szDaily.days[今天]`（不影响今日完成态/回顾），toast「往期时政补练完成」。

## 非目标

- 不做时政 SSR 归档页（时政题库含答案不宜全量外显，且无 SEO 页族先例）；不做往期完成状态标注；不改服务端。

## 验收

- 首页时政卡「往期 ›」→ 7 日期 sheet → 选昨天实测发 `/api/shizheng/daily?date=<昨日>` 且题组与 API 一致；完成后今日 szcard 仍显示「今日更新/去练习」（不被误标已完成）。
- 今日流程回归：时政卡主点击今日照常、完成后「已完成/回顾」。
- 1440/375 无溢出、console 0 error；测试事件清理、保护 uid 零 mutation。
