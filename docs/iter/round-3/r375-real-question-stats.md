# R375：用户可见的全站聚合口径接入 R374 探针标记（全站正确率/人次/易错项 + 分享「击败 X%」）

日期：2026-09-04　类型：核心功能数据口径 / 系统架构（四维之「核心功能」「系统架构」）　前端零改动

## 1. 取证（一手生产证据，只读）

延续 R374 口径复查生产（`/data/data.db` + origin access log 09-01 08:00Z – 09-04 09:00Z）：

| 指标 | 数值 | 说明 |
|---|---|---|
| /api 请求（3 天，去 health） | 102,655 条，其中 102,541 来自 `140.232.64.0/24` | 真人 API 请求 56 条（200=53 / 404=2 / 403=1） |
| 真人 API 路径分布 | checkin/badges 7、mistakes 7、review 6、questions 4、profile 4、reminders 3、track 3、answer_log 2、share/create 2 | 3 个 uid；`umst3tuisd7lgzaka` 33 条 |
| `umst3tuisd7lgzaka` 完整链路（09-02 18:40Z，UA `MicroMessenger ... miniProgram`） | 打开 → 资料分析作答 2 题（3s/4s，均错）→ 分享题目（share_copy ×2）→ 反复浏览错题本/复习/收藏 | **原生小程序真机预览调用生产 API 的首条一手证据**（handoff 一直记为「真机验证未做」）；30 条全 200 |
| answer_log 总量 | 1,040 行 / 61 uid；app 格式 uid 52 个 858 行，其余为 `u26`/`test-w1-*` 等测试 uid | 探针每轮清理自己的测试行，所以库内存量 ≠ 访问日志比例；legacy NULL 行不可回填 |
| `questions.attempt_count>=5`（练习页外显「全站正确率/易错项」阈值） | 33 题；`>=1` 2,095 题 | `correct_ratio` 同时是自适应取题（`|全站正确率-目标|` 排序）与「同考点强化」选题的难度信号 |
| 非 API 页面日志「疑似真人」 | 08-31 6 / 09-01 7 / 09-02 29 / 09-03 2 / 09-04 240，但仅 1 条 200 | 全是 `/wp/`、`/wordpress/`、`/.env`、`/.git/config`、`wp-json/batch/v1` 等扫描，**不是用户访问**，从行为分析中剔除 |
| Cloudflare 边缘 Analytics | 未取得 | 现有 token 缺 `zone.analytics.read`；不以权限缺口代替数据，不阻塞 |

## 2. 结论（事实 vs 推断 vs 限制）

- 事实：R374 只把 `probe` 口径接进了运营看板；**用户可见**的三处跨用户聚合仍全量计入探针行——`refresh_question_stats`（练习页/错题本/模考报告的「全站正确率/作答人次/易错项」）、`team._question_stats`（分享页「你击败了 X%」）、以及依赖 `correct_ratio` 的自适应取题与同考点强化选题。
- 事实：探针行按 R374 设计**保留不删**（供冒烟对账），因此这三处会随每轮自动化测试持续被随机作答污染；「真实数据不造假」要求用户看到的全站数字只由真人构成。
- 推断：当前 33 题外显数字中探针占比无法逐条区分（legacy NULL），影响面小但方向性错误；修正后影响的是**未来**的数字，历史行按 R374 决策保留为「视为真人」。
- 限制：本轮不改复习/SRS 算法（真人样本 3 uid / 56 请求仍不足）；不回填历史；不动前端。
- 限制：小程序真机链路只有 1 个会话的 30 条请求，只能证明「可用」，不能证明「无缺陷」；小程序功能落后 H5 R366–R374 的按卷/错题闭环，列入 SOP-10 审计（~R376）。

## 3. 方案（零功能、零前端）

`REAL_TRAFFIC = "COALESCE(probe,0)=0"` 上移到 `_ensure_answer_log` 之前作为 db 层公共口径，并接入：

```
refresh_question_stats:  ... FROM answer_log WHERE question_id IS NOT NULL AND {REAL_TRAFFIC} GROUP BY question_id
                         ... WHERE question_id IS NOT NULL AND correct=0 AND picked IS NOT NULL AND {REAL_TRAFFIC}   # most_wrong
team._question_stats:    ... FROM answer_log WHERE question_id=? AND {db.REAL_TRAFFIC}
```

uid 维度的查询（本人历史/掌握度/周报/推荐）不受影响——探针 uid 自己看自己的数据仍完整，测试对账不变。

## 4. 验证

- 单测 `test_question_stats_and_beat_pct_exclude_probe_rows`：1 条 legacy NULL（错，选 C）+ 6 条探针（错，选 B）+ 1 条真人（对，选 A）→ `attempt_count=2 / correct_ratio=50 / most_wrong="C"`，`_question_stats={"total":2,"acc":50,"beat_pct":50}`；若探针计入会得 8 / 25 / "B"。
- 本地：pytest 301 passed / ruff / pyright 0 全绿；前端无改动（bundle 不变）。
- 生产：部署后触发一次 `POST /api/admin/refresh_qstats`，抽样题目 `attempt_count` 与 `SELECT COUNT(*) ... WHERE probe IS NULL OR probe=0` 对账。
