# R110 取证审计：流量归因校正与增长瓶颈定位（docs-only）

日期：2026-08-31（R109 部署后干净窗口）

## 结论

本轮为纯取证轮，无代码改动。核心结论：**当前站点近乎没有自然真实用户**，此前若干「真实流量」判断需要校正；产品功能面在 109 轮迭代后已无本轮可立项的实证缺陷，硬瓶颈全部在分发/增长侧，且关键通道均需老板资源（已按 SOP-04 申报搁置）。

## 已验证事实（一手证据）

1. **share_open 归因校正**：近 7 天 growth_events 中全部 `share*` 事件（18 条）来自两个 uid——保护 uid `umteojq4sltdhorhm`（老板/内部账号，17 条）与 `umsrgwyi2n1m67dwh`（1 条）；其中多条 ref=None / ref=zzzz 为无效链接测试。此前 SOP-04 汇报中「share_open 17/3 日有真实分享流量」的判断**不成立**，系内部账号自流量。
   - `/s/{sid}` → SPA 跳转经生产实测保留 sid（`url=/#/pkgA/share/share-q?sid=fsb75lki`，200），ref=None 非深链缺陷。
2. **活跃 answer_log uid 归因**：origin 访问日志交叉验证显示，近 3 天高频「用户」中 `umth8vau…`（10 答）UA 为 Linux x86_64 Chrome 137（自动化特征），`umtg6to4…`/`umtg4sot…` 相关请求含 curl UA；结合 nav:90s 旧格式聚簇，多数匿名作答 uid 疑为爬虫/自动化，非自然用户。
3. **搜索引擎到达**：origin 全量日志 bot 统计——Yandex 967、Googlebot 1，bingbot/baiduspider/sogou/360/bytespider/petalbot **全部为 0**。IndexNow 通道仅 Yandex 实际响应；PetalBot 从未到访（R88 屏蔽名单含 PetalBot，但历史 0 次访问，屏蔽与否暂无实际影响）。
4. **ShapBot**：origin 日志仅 7 条请求（1 个 uid，含 1 条 track），量级极小，不值得单独立项拦截。
5. **robots.txt / index.html 缓存**：index.html `max-age=0, must-revalidate`（浏览器每次回源验证，旧 bundle 长滞留应主要来自 SW 旧壳/内嵌 webview 缓存，而非 HTTP 缓存策略）。
6. **后端 warmup 覆盖确认**：`main.py _warmup` 已周期预热全模块抽题池 + 今明两日 daily_set + uid 热表（300s），R92/R100 观测的冷径长尾属宿主资源挤占窗口，非缺预热。
7. **/tiku/q/* 结构化数据**：QAPage JSON-LD、canonical、og 标签实测齐备，SEO 页面质量侧无缺口。
8. **竞品（粉笔官网）差距面**：剩余大项为招考公告/职位库/考试日历等资讯内容运营，需要数据源与运营决策，不属于本会话可自主立项范围。

## 假设 / 未知

- 匿名作答 uid 的完整归因未逐个确认（POST 体不入日志，仅 UA/URI 交叉）；R92 后 slow_load 已带 ;ua:/;hs:，后续样本可自动分辨。
- 明日 08:00 首次 Web Push 定推（push_subs 当前 0）与 R109 分享卡的社交平台抓取效果均需时间窗观察。

## 下一步

- R111 起以「新数据窗口」为输入选题：push 定推窗口、R109 og 卡抓取、（R92 后可信的）boot/slow_load 新样本。
- 老板资源到位即接入：百度/Bing/搜狗/360 站长验证、微信 JS-SDK、独立主机/限 recruit 资源、视觉 LLM key。
- 汇报口径修正已同步（本文件即证据）。
