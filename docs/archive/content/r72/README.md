# 轮72：SRS 完整梯子出队 + 连签双源口径统一（消化 r71 两个 P2）

日期：2026-08-09（UTC）。分支 devin/1786315936-r67（PR#116）。

## 1. SRS：mastered 改为完成完整梯子后才出队

r71 发现：`record_review` 的 `mastered = streak >= 2` 使连对两次即永久出队，7/15/30 天档不可达。

改动（仅后端 `backend/app/db.py::record_review`，一行）：

```
mastered = 1 if streak > len(REVIEW_INTERVALS_DAYS) else 0   # REVIEW_INTERVALS_DAYS = [1,3,7,15,30]
```

语义：第 N 次连对通过的是第 N-1 次安排的间隔档。streak=5 通过 15 天档并安排 30 天后回访；streak=6（第 6 次连对）才是通过 30 天档，此时出队。即 1/3/7/15/30 各档全部通过后才 mastered。

- 答错行为不变：streak 清零、1 天后再复习、mastered=0（保守，不引入降档/SM-2/FSRS）。
- 三端口径：复习判定完全在后端（H5/小程序/Flutter 均只调 `POST /api/review/{mid}` 并展示返回的 `next_review_days/mastered`），三端零改动即一致。
- 存量兼容：只影响此后新的复习判定；存量 `mastered=1` 行不回溯重置（历史已按旧口径毕业，避免老用户复习队列突然膨胀），存量未毕业行自然按新梯子继续走。到期查询（`mastered=0 AND next_review<=now`）与手动“标为已掌握”路径均未改。

线上复验（生产 API + 容器内时间旅行把 next_review 拨到过去，测试 uid，已清理）：

```
连对#1: streak=1 next_days=1  mastered=False
连对#2: streak=2 next_days=3  mastered=False
连对#3: streak=3 next_days=7  mastered=False
连对#4: streak=4 next_days=15 mastered=False
连对#5: streak=5 next_days=30 mastered=False
连对#6: streak=6 next_days=30 mastered=True   ← 通过 30 天档后出队
答错复验：连对2次后答错 → streak=0 next_days=1 mastered=False（重置正常）
```

r71 P2①（7/15/30 档不可达）消失。

## 2. 连签双源口径统一：服务端 answer_log + Asia/Shanghai 日界

r71 发现：首页 hero 用本地 pstats、打卡页用服务端 answer_log，换设备/离线会矛盾展示（复现过「首页6天/打卡页0天」）；且本地用 UTC 日期、服务端用容器 localtime，日界不一致。

### 后端（backend/app/social.py）

- `/api/checkin/badges`、`/api/checkin/summary` 的日期聚合统一固定北京时间日界：`DATE(created_at + 28800, 'unixepoch')`（Asia/Shanghai 无夏令时，等价固定 UTC+8），Python 侧“今天”用 `datetime.now(timezone(timedelta(hours=8)))`，不再依赖容器 localtime 设置。

### H5（frontend-uni）

在线服务端优先、本地 pstats 仅离线降级：

- 首页 hero 连签 → `badges.streak`（`streakShown`，服务端未返回才回退本地）；
- 首页「今日已练 N/M」「今日任务」「打卡提醒横幅」 → `summary.today_n` 服务端优先（`svTodayN`）；
- 统计页连续打卡 → `summary.streak`（`svStreak`）；
- 打卡日历月视图/本月打卡 → `summary.days`（`svDays`）；
- 本地降级路径的日期键统一 `checkin.js dayKey()`（设备本地时区，国内用户即北京时间），替换原 `toISOString()` UTC 日期（practice.vue / exam.vue / home.vue / stats.vue / calendar.vue）。

### 小程序 / Flutter

- 小程序：`utils/stats.ts` 本地日期键同样从 UTC 改为设备本地 `dayKey()`；连签展示此前已是服务端 badges 优先，零口径改动。
- Flutter：首页/日历/徽章已是服务端 `Api.checkinBadges()` 优先，本地日期键本就用 `DateTime.now()`（设备本地时区），零改动。

### 线上复验（种子数据，测试 uid，已清理）

服务端种 6 连签（含北京时间今天 00:30 的清晨界点样本），本地故意写入矛盾 pstats（仅 2020-01-01 一天）：

- `/api/checkin/badges` → streak=6；
- 首页 hero「连续打卡 6 天」+「今日已练 3/20」+ 每日打卡 ✓「连续 6 天」，无“今天还没打卡”横幅；
- 打卡页「当前连续打卡 6 天」「本月打卡 6 天」，日历高亮为服务端 6 天；
- 统计页连续打卡 6；JS 错误 0。

首页/打卡页/统计页同源同数，r71 P2②（双源矛盾）消失；清晨 00:30（UTC 前一天 16:30）样本按北京时间计入今天，日界口径验证通过。

## 3. 构建与部署

- H5 `npm run build:h5` ✅；小程序 `tsc`+`eslint` ✅；Flutter 无改动（analyze 上轮 0 issue 基线未动）。
- `./deploy/deploy_h5.sh` 两次（后端+H5 首版、首页 today_n 补丁）：bundle hash 一致、接口回归 7 项全 200。

## 4. 健康快扫（官方口径）与例行

- active 112,962 / 全表 156,792；quality_score<50 = 0；options 非 JSON 0；`(cid:` 0；hs 一致性 mismatch 0；
- 空 hs 仅 2 条台账题：panduan:334296、changshi:655861（保持不动）；
- 近7天作答 39 / 14 uid（测试数据清理后回归基线）；近14天 source=seo 0；
- growth 基线不变：share_open 5 / team_join_open 5 / heatmap_view 4 / share_answer 3 / share_copy 1 / share_team_join 1 / comeback_view 1 / task_card_click 1 / team_report_copy 1；
- 爬虫（access-20260809.jsonl）：总请求 1,664，爬虫 60（YandexBot 59 + bingbot 1），57 次命中 /tiku/y 年份页。

测试数据清理：mistakes 2、review_log 9、answer_log 36、growth_events 6（uid LIKE 'r72-%'）全部删除，复查 0 残留。

## 5. 遗留 / caveat

- 存量 `mastered=1`（按旧门槛毕业）不回溯：老错题若实际未巩固，用户可从错题本手动重练；如需批量“重新入队”需产品决策后另行迁移。
- H5 本地降级路径（离线）仍按设备本地时区日界；仅时区非 UTC+8 的海外设备离线时可能与服务端差一天，在线场景无影响。
- Bing 收录 / seo 归因仍 0，站长平台验证仍是 P0（需老板资源）。
