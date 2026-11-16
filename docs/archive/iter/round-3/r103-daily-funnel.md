# R103：每日一练开练漏斗埋点 daily_open + 来源归因（2026-08-31）

## 取证

- 生产 `daily_set_entries` 全表 0 行——每日一练上线（R69）至今无一真实用户提交成绩；近 3 天 answer_log 有 18 个 uid 在作答（其中含机器速答：30 题/90s、10 题/9s 的疑似脚本），真实活跃极小。
- growth_events 中不存在任何「开练每日一练」事件——完成漏斗只有终点（entries）没有起点，无法区分「没人点开」vs「点开没做完」vs「做完没提交成功」。
- 明日 08:00 R98 推送首发，R102 刚修复深链落地；若无来源归因，推送转化无法度量。

## 方案

零新接口，复用 track 通道：

- `practice.vue` `startDaily(archiveDate, src)` 入口统一上报 `daily_open`（source=home/link/push/seo/share/app，往期补练 ref=archive:<date>）；
- 深链 `?daily=1&src=…` 透传：push payload 带 `src=push`，SSR CTA 带 `src=seo`，分享文案带 `src=share`，无标记默认 `link`；
- `main.js` 根查询归一化透传 `src`；后端 track 白名单补 `daily_open`。

## 同轮数据治理

- 清理今日验证残留 growth_events（r100t375/r100t1440，16 条）。

## 验收

- 生产实测：首页入口 → daily_open source=home 落库；`/?daily=1&src=push` 深链 → source=push 落库；
- 非 daily 普通练习零 daily_open；console 0 error；测试事件清理、保护 uid 零 mutation。
