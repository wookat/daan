# 轮35：H5 实施激励留存 P0 四项（连签里程碑 / 12周热力图 / 今日任务卡 / 复习清零庆祝）

分支：`devin/1786283562-r33-parity`（PR#106，已合并），后续报告提交到 `devin/1786287137-r35-cont`。
代码提交：`b9f89b8`（H5 四项）+ `f3cd2cb`（后端两处 P1 修复）。均已部署生产 https://kaogong.zalize.com 。

## 一、实施内容

### 1. 连签里程碑进度条 + 下一枚徽章倒计时
- 打卡日历页（`pages/stats/calendar.vue`）新增「连签里程碑」卡：当前连续天数、历史最长、进度条、「再打卡 N 天解锁『X 天』徽章」倒计时、3/7/14/30/60/100 六枚徽章点亮态。
- 首页今日任务聚合卡「每日打卡」行内嵌同款进度条+倒计时。
- 数据源：`GET /api/checkin/badges?uid=`（后端 answer_log 口径），接口失败降级本地 pstats streak。

### 2. 统计页近12周学习热力图
- `pages/stats/stats.vue` 新增「学习热力图·近12周」卡：GitHub 风格 12 列（周）×7 行（周一~周日），5 级色阶（0/1-4/5-14/15-29/≥30 题），图例少→多，右上角显示近 12 周总题数。
- 数据源：`GET /api/checkin/summary?uid=`（按 uid 隔离的 answer_log 日聚合）；后端本轮补返回 `days` 字段（`backend/app/social.py`）。接口失败降级本地 pstats。
- 埋点：进入统计页成功拉取数据后上报一次 `heatmap_view`（source=stats）。

### 3. 首页今日任务三件套聚合卡
- `pages/home/home.vue` Hero 下方新增「今日任务 N/3」卡：刷题目标（已练 n/goal）、错题复习（到期 N 题 / 已清零）、每日打卡（🔥连续 N 天 + 里程碑进度）。
- 三行可点：练习 / 错题本（有到期自动开始复习，同时补发 review_entry_click source=task_card）/ 打卡日历。
- 埋点：`task_card_click`（source=practice/review/checkin）。
- 原有 Hero、到期复习蓝卡/清零卡、今日计划卡、引导卡全部保留，兼容不变。

### 4. 复习清零庆祝态
- `pages/book/book.vue`：复习动态队列（含答错重排题）全部完成时弹出 🎉「今日复习已清零！」庆祝卡（弹跳+缩放动效、完成题数文案），点「太棒了，继续 ›」或遮罩关闭后照常拉取同考点强化建议。
- 埋点：`review_done_celebrate`（source=book）。

### 后端配套修复（QA 发现的 P1，f3cd2cb）
- `backend/app/team.py` /api/track 事件白名单加入 `task_card_click`、`heatmap_view`、`review_done_celebrate`（此前 400「无效事件」）。
- `backend/app/social.py` /api/checkin/summary 返回体补 `days` 字段（此前 SQL 已聚合但未返回，热力图恒为 0）。

## 二、QA（生产实测，全新匿名用户）

三态验证：375px 移动、桌面宽、深色模式，均无横向溢出、无破版、文案可读（截图+录屏存证）。

| 项 | 结果 |
|---|---|
| 首页任务卡三行渲染/动态态（0/3→2/3）/旧入口兼容 | 通过 |
| 任务卡三行导航（练习/自动复习/日历） | 通过 |
| 日历连签里程碑卡（连续天数/进度条/倒计时/徽章点亮） | 通过 |
| 热力图 12×7 渲染、做题后当日格变色+计数增加（uid 隔离） | 通过（修复后回归） |
| 复习清零庆祝卡弹出+动效+关闭 | 通过 |
| task_card_click / heatmap_view / review_done_celebrate 埋点 200 入库 | 通过（修复后回归） |
| review_entry_click(source=task_card) | 200 通过 |

- 初测发现 2 个 P1（埋点 400、热力图恒 0），均为后端问题，已修复部署并回归通过。
- P2：0。备注：庆祝卡按钮在 375×800 下贴近 tabbar 但完整可点，不计缺陷。
- 口径说明：热力图/打卡计数只统计练习 answer_log，复习作答不计入（与打卡口径一致，待老板确认是否需调整）。

## 三、测试数据清理
- 备份：`/data/bak_r35_qa.db`（清理前 VACUUM INTO）。
- 守卫删除 uid `umslwmv1ocxakphsj`：mistakes 3、answer_log 11、review_log 3、growth_events 6，删除后各表残留 0；另清 curl 冒烟 uid `zzr35chk` 的 growth_events 3 条。
- 清理后 /api/stats 200。

## 四、遗留/下一轮
- 轮36：四项功能复刻到原生小程序与 Flutter；复习完成率与新埋点首批数据复盘。
- 待确认：热力图是否应计入复习作答（当前不计）。
