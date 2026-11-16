# R125：R121–R125 窗口取证复审计（docs-only）

## Verified facts（2026-08-31 生产实测/实查）

### 真实使用（近 48h，growth_events/answer_log，epoch 过滤）
- 作答：16 个去重 uid、93 条 answer_log；
- boot 45 条/45 uid；heatmap_view 32/14；daily_open 3（source=archive×2）；
- pk_result_open 13/8 uid（R111 短链上线后有真实回流）；
- share_open 16 条但仅 2 uid——延续 R110 归因（多为内部/自流量，不作增长证据）；
- push_subs 仍 = 0（R98/R99/R105 通道在位，等待真实订阅窗口）。

### slow_load（近 24h）
- 仅 1 条新格式真实样本：nav:16s/ttfb:1.9s/tx:10.6s、sw:0、旧 bundle v:B5E0ZuNG、
  wd-icon chunk 13s——纯慢网客户端，与 R101/R122 已收敛的首屏路径一致，
  启动屏已覆盖该场景；未见新缺陷模式，不立项。
- 48h 窗口内 nav:60–90s 无 ua 后缀旧格式行均为 R92 部署前遗留格式，非新增。

### 观测陷阱（写入 handoff，防复发）
- `growth_events.created_at`/`answer_log.created_at` 存的是 epoch float；
  SQL 里 `created_at > datetime('now','-2 day')`（字符串比较）静默返回空集，
  会误判「48h 零事件」。时间过滤必须用 `time.time()-N` 数值参数。

### 竞品复审计
- 粉笔 www.fenbi.com/page/home：curl 200（浏览器直连超时，网络策略），
  首页为课程/教辅营销向 SSR；公开可对标面（题库/模考大赛/每日/错题概念）
  与本产品既有功能无新增可立项差距；
- 夸克公开刷题页本窗口不可直达（quark.sm.cn 400），无新证据，不虚构结论。

## 结论
本窗口无新的 verified 产品缺陷可立项；R121–R124 已分别收口
离线错误态/首页 LCP/键盘可达性/SSR 深色模式。数据观察项（push 订阅、
daily_open 漏斗、pk 短链回流）继续挂后台窗口。
