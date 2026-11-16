# R99：每日一练完成页「开启离线推送」引导

## 取证（2026-08-31）

- R98 上线的 Web Push 开关唯一入口在「我的 → 学习提醒」设置页（`profile.vue` → `/pkgA/settings/reminders`），埋在二级页，日常路径零曝光。
- 完成每日一练是推送价值主张最强的时刻（「明天同一时间提醒你打卡，别断了连续 N 天」），竞品（粉笔）在打卡完成态直接给提醒开启引导。
- 现状完成页已有 dailyStats（击败百分比、streak）与排行榜卡，无任何推送引导。

## 方案

完成页 dailyStats 渲染后（当日一练、非往期补练），H5-only 追加一张轻量引导卡：

- 渲染条件（全部满足）：`PushManager` 可用、`Notification.permission !== 'denied'`、`/api/push/pubkey` 非空、当前无订阅、未被用户 ✕ 永久关闭（localStorage `pushNudgeOff`）。
- 文案：streak≥2 时「别断了连续 N 天 · 明早 8 点提醒你」；否则「明早 8 点提醒你做每日一练」。
- 「开启」按钮：复用 R98 订阅链路（授权 → subscribe → POST /api/push/subscribe）；成功后卡片变为「已开启 ✓」。
- ✕：写 `pushNudgeOff=1` 永久不再显示。
- 埋点：`push_nudge_show` / `push_nudge_ok`（入 team.py track 白名单）。

## 边界

- 微信内/不支持 PushManager 的环境不渲染（与 R98 同判定）。
- 权限被拒（denied）不渲染，不做无意义打扰。
- 往期补练完成页不渲染（无「明日提醒」语义）。

## 验收

- 本地 build 通过；生产真实作答当日一练 → 完成页出现引导卡 → 点开启 → 订阅落库 → 卡片变已开启；✕ 后刷新重做不再出现；已订阅用户不渲染。375/1440 无溢出、console 0 error。测试订阅/事件清理，保护 uid 零 mutation。
