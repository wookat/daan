# R420：SOP-10 四维审计（R410 后第 10 轮，对标粉笔错题本）+ 比赛窗口/往期日期固定东八区 + contest/contest-report 字号 24rpx 下限 + 榜单 ✕ 40px 热区

- 生产 rev：`3c1cf71` → **`2573df1`**（bundle 变：`pkgA-exam-contest.D2I6eQsP.js` + 新 chunk `contest-time.BB53Q9vA.js` + `contest-BF7yxXRA.css`；后端不动）
- PR：#619（R400–R420 同分支）
- 一手取证：代码（`mock_event.py` / `contest.vue` / `weekly-report.vue`）、生产只读 API / DB / caddy 源站日志、testing agent 真实 UI（375/1440，CDP `setTimezoneOverride` 三时区）

## 0. 审计口径（与 R398/R410 同）

- 粉笔错题本次级屏仍需账号登录，**本轮无一手截图，零竞品陈述、不据二手加功能**。
- 只审我方「模考大赛」功能簇（首页卡 → contest → 榜单弹层 → contest-report → 周报「下一场」）的一手几何 / 时区 / 数据 / 真人触达；R398 审错题本弹层、R410 审错题本次级屏，本轮换到此前两轮 SOP-10 都没覆盖的簇。

## 1. 四维审计表

| 维度 | 一手证据 | 结论 / 差距 |
|---|---|---|
| 实体操作台 | `backend/app/admin/` 全目录 grep `mock/events|模考大赛|admin/mock` 0 命中；后端只有 `POST/DELETE /api/admin/mock/events` 两条无 UI 的管理接口 | 差距 P2：管理台**没有比赛场次/报名/交卷任何可见面**，运营只能 SQL。本轮不做（报名 1 行、交卷 0，先无治理需求） |
| 核心功能（时区） | 后端 `_saturday_window` 以 `TZ = 8*3600` 固定东八区排窗口；`contest.vue` `fmtWindow`/`fmtDay` 用本地时区 getter；`weekly-report.vue` 自己另写了一份 `getTimezoneOffset()+8*60` 平移。生产 event 8 `open_at=1789174800 close_at=1789228800`：UTC 设备显示「01:00 - 16:00」（R419 复验实录）；**东八区设备（真实用户）往期日期 `fmtDay(close_at)`：close_at=周日 00:00 → 显示 2026-09-06 / 08-16 / 08-09**，比周六场次晚一天（算术可证：1788624000 = 2026-09-05T16:00Z = 09-06 00:00 CST） | **命中（本轮修）**：P1——真实（东八区）用户可见的往期日期错一天；非东八区访客窗口与赛制说明「09:00-24:00（东八区）」不一致 |
| 核心功能（几何） | contest.vue 7 处 21–23rpx（`.hero-series` 21、`.hero-phase` 22、`.hm` 23、`.prow-s` 21、`.prow-none` 23、`.rules-arrow` 22、`.brow-me` 22）→ 375 下 10.5–11.5px，低于 R411–R414 已统一的 24rpx（12px）下限；contest-report.vue 8 处 18–23rpx（`.dist-l` 18 = 9px）；榜单弹层 `.sheet-x` ✕ 30rpx 字 + 8/16rpx padding ≈ 31×23px < 40 | **命中（本轮修）**：P2 字号 / P2 热区 |
| 核心功能（真人触达） | caddy 源站 08-31 起全部 `/api/mock/events` 请求 127 条**全为探针**（网段 / X-Kg-Probe / HeadlessChrome），非探针 0；`mock_event_entries` 全表 1 行（u15 只报名）、交卷 0 | 比赛功能自上线**无可证明真人使用**；contest-report 正文（分数分布 / 模块表现 / 历届曲线）生产从未渲染过。只修不加 |
| 落地页/首页 UI | 首页「更多练习 → 模考大赛」卡入口存在（home.vue L297）；本轮未新增 SEO 证据 | 无变化，不动 |
| 系统架构 | `2573df1` 容器 healthy / 0 重启；30 min 日志 5xx·Traceback·locked 0；`mock_events` 仍 4 行（R419 唯一索引生效） | 无新 P0 |

## 2. 本轮改动

1. `frontend-uni/src/contest-time.js`（新）：`cstParts(sec)` 用 `new Date((sec+28800)*1000).getUTC*()` 读东八区字段——**不经设备时区、不受夏令时影响**（旧 weekly-report 的 `new Date().getTimezoneOffset()` 取的是「今天」的偏移，跨 DST 边界会差 1 h）。导出 `fmtWindow` / `fmtDay` / `fmtDayHour`。
2. `contest.vue`：`fmtWindow` → helper；往期 `fmtDay(p.close_at - 1)`（API `past` 只给 close_at=次日 0 点，减 1 秒取比赛当天）；7 处字号 → 24rpx、`.prow-t` 25→26；`.sheet-x` `min-width/min-height: 40px` + `inline-flex` 居中 + 负 margin（视觉位置不变）。
3. `contest-report.vue`：8 处字号 → 24rpx、`.hero-title/.wrow-t` 25→26。
4. `weekly-report.vue`：`fmtDay` 改用 `fmtDayHour`，文案格式不变。
5. `tests/contest-r420-cst-time.test.js`（8 tests）：三时区（`TZ=UTC / Asia/Shanghai / America/Los_Angeles` 各跑一遍）窗口「9月5日 09:00 - 24:00」、`fmtDay(CLOSE-1)`=09-05 / `fmtDay(CLOSE)`=09-06、非整点截止、helper 源锁（无本地 getter）、两页源锁、两页字号 <24rpx 为空、`.sheet-x` 40px。

本地：vitest **591**（+8，三 TZ 各 8/8）/ eslint / build:h5 绿。

## 3. 部署与生产复验

- 部署前宿主 91%/4.6 G、free 70 MB、load 0.48；全量 build 后 92%/3.9 G；`poll: rev=2573df1`，回归全 200、性能预算全过；healthy 0 重启、20 min 日志 5xx/Traceback/locked 0。
- 只读 API：event 8「第4期」upcoming 0/0；past 6/3/1 close_at 1788624000 / 1786809600 / 1786204800。
- testing agent（`test-r420-ui`，375×812 主 / 1440×900 补，CDP 长连接持有 `Emulation.setTimezoneOverride`，每 TZ 真实 F5 并核新 chunk）：
  - 时区：Asia/Shanghai（设备 `getHours`=9）/ UTC（1）/ America/Los_Angeles（18）三态 `.hm[0]` 均「**9月12日 09:00 - 24:00**」、`.prow-s` 均 **2026-09-05 / 2026-08-15 / 2026-08-08**；1440 SH/UTC 同。
  - 字号：contest 页 / 榜单弹层态 / contest-report 空态，全页 computed <12px 元素列表 **[]**（375/1440）。
  - 榜单 ✕：375 rect 40×40 (329,650) `elementFromPoint` 命中自身，`.sheet` bottom 812==innerHeight 贴底；1440 rect 40×40、`.sheet` 中心 816.5 == `.mask` 中心（App.vue ≥1366 壳体规则 `.mask` 288..1345，以内容区为基准居中，非本轮改动）；原生点 ✕ 关闭。
  - contest-report：`?event_id=6` → API 404 → 「暂无大赛报告 / 去模考大赛」→ 回 contest；无 event_id → 「链接缺少赛事参数」0 次 API。
  - 报名回归（R419）：原生「预约报名」→ toast →「已报名，开赛后可进入 · 1 人报名」→ F5 保持 → API `registered 1, my_state 已报名`。
  - 诊断 10 段：`/api` non-2xx 仅预期 404 ×1；console/pageerror/rejection 0；容器 healthy 0 重启；`mock_events` 4 不变；清理 `test-r420-%` 1 行 → LEFTOVER 0（u15 保留）。
  - untested：周报「下一场」链接（`/api/report/weekly` `status: empty` 不渲染，不造数据；页内 import 生产 chunk 直调 `fmtDayHour(1789174800)`=「9月12日 09:00」）；报告正文（无人交卷、event 8 未开赛不可进，不造交卷）。

## 4. 未做 / 需注意

- 管理台无比赛面（P2）：登记，等有真实报名/交卷再做。
- 报告正文与周报「下一场」链接运行时未量（数据前置条件不满足），仅源锁 + helper 直调。
- 「往期日期取 close_at-1」是本人判断（API 不回 open_at，比赛都在当天结束）；若未来出现跨日专场，应让 API 回 open_at 再改。
- 比赛功能无可证明真人使用；本轮不加任何功能。
