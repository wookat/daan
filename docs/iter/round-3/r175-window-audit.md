# R175：性能回归 + 数据窗口复审计（docs-only）

日期：2026-08-29（生产一手取证）

## Lighthouse 回归（R165 后首次全量复测）

- `/`：performance 0.96 / a11y 1.0 / best-practices 0.96 / SEO 1.0（LCP 0.8s、CLS 0.071、TBT 190ms）
- `/tiku/`：performance 1.0 / a11y 1.0 / best-practices 0.96 / SEO 1.0

两处 best-practices 0.96 均由 `errors-in-console` 单项引起：探测窗口内 `/api/track` 一次 502（POST 不走边缘 stale-if-error，命中 origin 瞬时窗口，疑似与本轮容器重建相邻）。复测三连 POST 全 200，非持续缺陷；埋点为 fire-and-forget、客户端已捕获异常，不影响用户功能。挂观察：若后续窗口再现 502 聚簇，可立项客户端埋点失败缓冲重投（对称 R83 pending 机制）。

## 数据窗口（7d，与 R155/R171 对比）

- `answer_log`：152 条 / 23 uid（真实作答，量级持平）
- `push_subs`：仍 0（获客/运营问题，非工程缺陷，继续挂后台）
- `daily_set_entries`：仍 0（同上，R155 已验证提交链路正常）
- `slow_load`：47 条，仍以 nav:60s/90s 无 UA 族群为主，无新模式；uid 页面侧已被 R169–R174 快照即显全覆盖
- `boot` 版本分布：12/9/8/8/7 跨多 bundle 均匀衰减，陈旧壳自愈（R67/R71）工作正常
- `daily_open`：home 1 / push 2（样本过小不下结论）

## 结论

本轮无新 verified 工程缺陷可立项；快照即显家族（R169–R174）与部署校验（R173）收口后，性能/无障碍/SEO 指标全部维持在 R165 水位或以上。探测残留 uid（r175probe）growth_events 3 行已清理。
