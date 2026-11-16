# R155：数据窗口复审计（docs-only）

一手取证：2026-08-29（UTC）生产容器 `deploy-kaogong-1` `/data/data.db` 直查
（7 天窗口），及一次真实公开 API 探针（测试数据已即时清理）。

## 事实

- 真实活跃：`answer_log` 7d 23 uid / 152 条作答（48h 11 uid / 82 条），
  `exam_attempts` 7d 12 次，`pk_matches` 7d 3 场（1 finished / 2 waiting）。
- `push_subs` 仍为 0：R98/R99 推送通道上线以来无真实订阅，观察项继续挂后台。
- 每日一练漏斗：`daily_open` 7d 仅 3 次（home 1、push 深链 archive 2），
  `daily_set_entries` 全表 0 行。
  - 管道功能验证：真实 POST `/api/daily_set/submit` 返回
    `{"participants":1,...,"streak":1}` 且正确落库（随后删除测试行）——
    提交链路无缺陷，0 行是真实参与率为零 + 历史测试数据已被 R106 清理。
- `slow_load` 7d 47 条：仍以 nav:90s 整点聚簇族群为主（R75/R82 已归因的
  客户端族群），另见 ShapBot 爬虫 UA 一条；无新的可立项性能缺陷模式。
- `boot` 7d 96 次（全部 h5）。

## 结论

本窗口无新的 verified 产品缺陷可立项；每日一练参与为产品运营/获客问题
（流量规模），非工程缺陷。数据观察项（push 订阅、daily 漏斗、pk 回流）
继续挂后台窗口。
