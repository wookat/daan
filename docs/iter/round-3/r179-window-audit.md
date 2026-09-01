# R179 数据窗口 + SEO 页族复审计（docs-only）

日期：2026-09-01。R178（条件请求 304）上线后例行复审计，全部为生产一手取证。

## 数据窗口（7d，生产 /data/data.db 实查）

- answer_log：152 条 / 23 uid（与 R175 持平，真实作答稳定小样本）
- growth_events boot：140 条 / 135 uid
- slow_load：47 条，模式与 R175 一致——
  - nav:90.1–90.7s 聚簇（08-30 凌晨 03:58–07:43，逐次新 uid、无分项分解），与既有「无 UA 族群」判断一致，疑似带 JS 爬虫；
  - 一条带完整分解的可归因样本 ua=ShapBot（nav:16s，tx:10.6s，爬虫弱链路，非产品缺陷）；
  - 带 API 分项的真实用户样本（daily_plan:45s、categories:21s、questions:9–13s）均为 uid 端点长尾，页面侧已被 R169–R174 快照即显全覆盖。
- stale_fallback 22 条：R90 兜底在真实长尾中生效中。
- push_subs 0、daily_set_entries 7d 0：仍为参与率/获客问题（R166 已申报立项级），非工程缺陷。

## SEO 页族复审计（生产实测）

- sitemap 索引 15 分片全 200；sitemap-pages 203 URL 含 121 张真题卷（/tiku/papers/N）、每日一练近 7 天归档、discuss/daily 聚合页；过期归档（>7d/非法日期）统一 301 回 /tiku/daily/，无软 404。
- /tiku/q 页 JSON-LD：QAPage(Question/acceptedAnswer) + BreadcrumbList 完整。
- landmark：q/papers/daily/discuss 页 header/nav/main 齐全；/tiku/ 首页无 <nav> 系无面包屑（main 前仅 2 链接），不构成 WCAG 2.4.1 缺口。
- 条件请求（R178 后）：robots/sitemap ETag 304 四形态全通过；HTML 页 Last-Modified 304 生效（HIT 路径实测 size=0）。

## 结论

本轮无新 verified 工程缺陷可立项。遗留观察项不变：nav:90s 爬虫族群、push/每日一练参与率（获客侧）、HTML ETag 被 CF Email Obfuscation 剥离（如需保留需面板加 Configuration Rule，已申报）。
