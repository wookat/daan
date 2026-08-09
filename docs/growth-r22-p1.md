# 轮22 增长线：P1 裂变玩法实现（承接 growth-r21.md P1 清单）

## 1. 打卡里程碑徽章（3/7/14/30/60/100 天）

- 后端 `GET /api/checkin/badges?uid=`（social.py）：按 answer_log 做题日期计算当前连击 `streak` 与历史最长连击 `best_streak`，`badges` 按 `best_streak >= 里程碑` 判定解锁，无新表。
- 我的页（profile.vue）新增「打卡徽章」徽章墙：6 枚徽章 🏅/🔒，头部显示当前连续/历史最长；点已解锁徽章直达徽章海报，点未解锁提示解锁条件。
- 达成弹窗：练习页每次作答落统计后本地检测连击是否恰好到达里程碑（localStorage `badgeSeenMax` 防重复），经后端确认后弹窗「🏅 解锁新徽章」，确认直达海报页。
- 海报：复用打卡海报管线（poster.vue），`?badge=N` 渲染徽章版（标题「🏅 连续打卡 N 天徽章」+ 徽章语录），保留二维码 + kaogong.zalize.com。

## 2. PK 结果分享落地页

- 后端 `GET /api/pk/result/{code}`（pk.py）：仅已结束对局，公开返回双方昵称/比分/答对数/用时/胜者，匿名可看，不含 uid 与题目明细。
- PK 结束页新增「晒战绩，喊人来战」：复制文案 `【答题PK战绩】甲 X : Y 乙，不服来战：…/#/pkgA/share/pk-result?rid=CODE`。
- 新页 `pkgA/share/pk-result?rid=`：双方比分卡（胜者 👑 金圈）+「不服来战」直达 PK 大厅 + 登录/注册引导；`regSource=pk_share`。

## 3. 埋点（/api/track 白名单新增）

| 事件 | source | 触发点 |
|---|---|---|
| pk_result_open | pk_share | 落地页打开 |
| pk_result_copy | pk_share | 结束页复制战绩链接 |
| pk_result_challenge | pk_share | 落地页点「发起我的 PK 对局」 |
| badge_unlock | badge | 里程碑弹窗触发（ref=天数） |

## 视觉

与 design-v3 tokens 对齐：沿用 `--brand/--brand-soft/--card/--ink*/--fill` 变量与既有 hero 渐变、圆角、阴影规范；文案无夸大宣传。
