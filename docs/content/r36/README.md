# 轮36：轮35 四项 P0 复刻到小程序/Flutter + 新埋点首批复盘 + 健康快扫

## 1. 四项 P0 三端复刻

### 原生小程序（miniapp-native）
- **今日任务聚合卡**（pages/home）：刷题目标 / 到期复习 / 每日打卡三行，完成数 N/3，含连签状态、下一枚徽章倒计时与里程碑进度条；三行均可点，埋点 `task_card_click`（source=practice/review/checkin），有到期复习时自动进入复习并埋 `review_entry_click(task_card)`。
- **连签里程碑卡**（pages/profile）：接 `/api/checkin/badges`，保留 3/7/14/30/60/100 徽章墙，新增当前/最佳连签、下一枚徽章进度条与倒计时文案（全解锁显示完成态）。
- **12周热力图**（pages/stats）：接 `/api/checkin/summary` 的 `days`（按 uid 隔离），12列×7行（周一—周日）五级色，显示近12周总题数；服务端失败降级本地统计；进入统计页一次性埋 `heatmap_view(stats)`。
- **复习清零庆祝态**（pages/book）：动态复习队列（含答错重排）真正清空时弹庆祝卡+动效，埋 `review_done_celebrate(book)`。
- 校验：`npm run typecheck`、`npm run lint` 均通过（exit 0）。

### Flutter（app-flutter）
- **今日任务聚合卡**（home_page）：同三行结构+里程碑进度，`task_card_click`（practice/review/checkin），复习行带 `review_entry_click(task_card)`。
- **连签里程碑卡**（calendar_page）：`Api.checkinBadges()`，当前/最佳连签、下一枚徽章进度条+倒计时、徽章墙保留。
- **12周热力图**（stats_page）：`Api.checkinSummary().days`，12×7 五级色+近12周总题数，成功加载一次性埋 `heatmap_view(stats)`。
- **复习清零庆祝态**（practice_page 复习模式）：完成页先查 `reviewDue()`，服务端队列为 0 才展示庆祝卡（答错题重新排期则不庆祝），埋 `review_done_celebrate(practice)`。
- 校验：`flutter analyze` No issues found（exit 0）。

H5 版本已于轮35上线，本轮零后端改动（轮35已修复 track 白名单与 summary.days）。

## 2. 新埋点首批数据复盘（只读，2026-08-09）

| 事件 | 总数 | 独立uid |
|---|---|---|
| task_card_click | 0 | 0 |
| heatmap_view | 0 | 0 |
| review_done_celebrate | 0 | 0 |
| review_entry_click | 0 | 0 |

四个新事件自然样本均为 0（H5 上线仅约1天，轮35 QA 测试数据已按 uid 守卫清理，属样本期不足而非埋点故障——轮35 QA 中三事件均实测 200 入库）。近7天自然活跃事件仍以分享链路为主（share_open 4 / share_answer 2 等）。转化链路（task_card_click→练习完成、heatmap_view 占访问比）暂无分母，建议轮38 复盘。

## 3. 全站健康快扫（2026-08-09）

- API：`/api/stats` 200；五模块 `/api/questions?module=*` 均 200。
- active 在架：**112,971**（与预期一致）。
- hs 结论字母 vs answer 不一致：**0**。
- options 非 JSON：**0**；`(cid:` 乱码：**0**。
- 四模块 hs 空缺仅剩 **2** 条存疑台账题：changshi 655861、panduan 334296（与轮29保留集一致）。

## 4. 遗留

- 新埋点自然样本为 0，待积累后复盘转化。
- 小程序/Flutter 改动为客户端代码，随下次发版生效（H5 生产已具备同能力）。
