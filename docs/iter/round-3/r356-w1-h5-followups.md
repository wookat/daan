# R356：W1 遗留 H5 三处收口——日键口径统一 / 背题模式底部遮挡 / 首页文案口径校正

## 背景与取证（SOP-10 审计窗口 · 复用 W1 交叉复核实证）

W1（R348 交叉复核集成轮）backlog 中挂账三处 H5 一行级缺陷，本轮逐项在当前代码与生产 DB 重新取证确认仍然成立：

### A. pstats.days 读写日键口径不一致（功能深度 · 数据正确性）

- 写入：`checkin.js dayKey()` 用本地日期（`getFullYear/getMonth/getDate`）。
- 读取：三处用 `new Date().toISOString().slice(0, 10)`（UTC 日）：
  - `pages/stats/stats.vue` 7 日趋势（「今天」列）；
  - `reminder.js todayProgress()`（提醒文案的今日进度）；
  - `pkgA/settings/reminders.vue onShow`（提醒设置页今日进度）。
- 影响：北京时间（UTC+8）每天 00:00–08:00，UTC 日仍是「昨天」——统计页「今天」列恒为 0、提醒进度错位一天。目标用户全部在 UTC+8，该窗口是晚间刷题后跨零点的高频时段。
- 收口：三处统一改 `import { dayKey } from checkin.js`，趋势循环内 `dayKey(d)`。

### B. 背题模式底部固定横幅遮挡内容（移动端 IA/UX）

- `practice.vue:2` `:class="{ 'has-banner': picked }"`，但 `:337` 判分横幅 `v-if="cur && !examMode && (picked || beiMode)"`——背题模式未选答案时横幅常驻，wrap 却无 280rpx 底部留白，解析/工具区末尾内容被固定横幅遮挡。
- 收口：`'has-banner': picked || beiMode`（一处表达式，与横幅 v-if 同口径）。

### C. 首页价值主张文案数字口径不实（落地页首页 UI · 实事求是）

- 现文案：「免费刷 11万+ 行测真题」/「11万+ 真题题库」。
- 生产实测（2026-08-29 /data/data.db）：在线题 `coalesce(disabled,0)=0` 共 109371，其中 `is_real=1` 仅 15864——「11万+」四舍五入尚可（10.9万），但「真题」定语不实（真题仅 1.5 万）。
- 收口：hero 改「免费刷 10万+ 行测题」；grid 首格改「10万+ 行测题库」副行「1.5万+ 历年真题 · 三级考点分类」。不夸大、区分题库与真题口径。

## 设计原则

- 三处均为最小 diff、纯前端、零 endpoint/表/协议变化；
- A 项补 vitest：无法直接测 .vue 内联循环，把「读写同键」断言写在 checkin.js dayKey 既有测试旁（本地日语义回归），三处调用点走 lint + 生产走查验收；
- 验收：lint / vitest / build:h5 全绿；生产 375/1440 走查——统计页今天列有值（当日已作答 uid）、背题模式底部留白、首页新文案。

## 边界（如实）

- A 项 00:00–08:00 窗口行为无法在当前时段生产直接复现（当前 UTC 17:5x=北京 01:5x 恰可复现——测试时如实记录实际时段）；
- 文案数字为部署日快照，后续入库增长不自动更新（与既有静态文案同口径）。
