# Round 2 · P0 功能设计稿索引

供开发线直接实施。来源：`docs/iter/round-1/competitor-report.md` P0 清单 + `docs/iter/round-2/competitor-report.md` 深化调研。

| 编号 | 设计稿 | 一句话 | 依赖 |
|---|---|---|---|
| 01 | [定期模考大赛](./01-mock-contest.md) | 每周固定场次同场模考：报名→提醒→窗口内交卷计排名→冻结定榜→赛后报告 | 无（可并行） |
| 02 | [考点掌握度地图](./02-mastery-map.md) | 模块→题型→tag3 三级掌握度树，色阶可视化，点击直达定向练习 | 无（先落，提供公共 `mastery()` 口径） |
| 03 | [错题同考点强化](./03-mistake-reinforce.md) | 复习流结束后自动衔接「同考点强化 5 题」，今日计划任务化 | 02 的掌握度口径 |
| 04 | [周学习报告](./04-weekly-report.md) | 每周一生成上周报告：环比、掌握度变化、错因分布、下周任务深链、分享图 | 02 的掌握度口径 |

## 公共约定

- **实施顺序**：02 → 03 →（01 ∥ 04）。
- **时区**：一切「日/周」口径统一东八区，复用 `insights._week_start()`（周一 0 点）。
- **uid**：与现有接口一致，query/body 传 `uid`（≤64 字符），登录用户由前端带 token 时后端按现行 auth 合并口径处理。
- **新表**：全部按 `db.py` 现行惯例用 `CREATE TABLE IF NOT EXISTS` + `_ensure_*()` 惰性建表，不引入迁移框架。
- **新路由**：01/04 各建独立 router 文件（`mock_event.py`、`report.py`），`main.py` 仅 include_router（与 `insights.py` 同模式）；02/03 的接口量小，并入 `insights.py` 或 `db.py` 现有聚合函数。
- **三端**：先做 H5（`frontend-uni/`），小程序为同源条件编译自动覆盖；Flutter 端在 H5 验收后按 `docs/parity-matrix.md` 惯例补齐（各 spec 的验收标准均以 H5 为准）。
- **红线**：所有功能免费开放，不加任何付费闸门。
