# 轮89：例行发现线——r86-r88 线上回归 + 数据/爬虫周观测 + 健康快扫

日期：2026-08-10（UTC）。本轮零代码、零生产内容变更（仅 QA 测试数据种入后已全量清理）。

## 1. QA 回归：r86-r88 三轮变更线上复验（全部通过）

### 1.1 AI 友好降级（r86）

生产 API 直测（LLM key 仍缺失的运维状态下）：

| 端点 | 请求 | 结果 |
| --- | --- | --- |
| POST /api/followup | 带 query/question_text | 502 `AI 服务连接失败，请稍后再试` |
| POST /api/coach | 带 stats | 502 `AI 服务连接失败，请稍后再试` |
| POST /api/similar | 带 question_text | 502 `AI 服务连接失败，请稍后再试` |
| POST /api/mistakes/analysis（空错题本） | uid 无待掌握错题 | 200 自然空态文案 |
| POST /api/mistakes/analysis（种 1 条错题） | 走到 LLM 调用 | 502 `AI 服务连接失败，请稍后再试` |

无任何裸奔 500 / Internal Server Error。

H5 UI 层（Playwright 375px 真浏览器）：AI 问答页「粘贴文字」输入题目→「用花生十三方法讲解」提交，页面出现红色友好提示「失败：AI 服务连接失败，请稍后再试」，无裸奔报错、无 JS 错误（截图 r89_4_ai.png）。

### 1.2 H5 错题本两处 P1（r87）

受控 QA uid（qa_r89_ui）种 1 条错题+1 条收藏，375px 实测：

- **纠错 sheet 提交按钮**：错题详情→纠错→sheet 弹出，「提交纠错」按钮完整可见、不被底部 tabbar 遮挡，选类型+填说明后提交成功（toast「感谢反馈」+ question_reports 落库确认）；
- **收藏夹「重练」**：点击后正常跳转 `/#/pages/practice/practice`，无 switchTab fail，练习页正常加载。

### 1.3 搜索页 switchTab 修复（r87 顺手修）

搜索「GDP」→ 结果页练习入口点击后跳转 `/#/pages/practice/practice` 成功，无 `switchTab:fail` 错误。

### 1.4 深色模式快查

错题本列表/纠错 sheet/收藏页深色态渲染正常（对比度可读、无浅色残留），JS 错误 0。

全部回归 JS 错误 0；QA 数据（qa_r89_api / qa_r89_ui 共 4 行 + 此前遗留 1 条 qa-probe-1 share_open 事件）已事务清理，残留 0。

## 2. 数据例行观测

### 2.1 错因自评 / 加推 / 复盘卡上线约一周真实使用（照实报）

排除 qa_% / test% / devin% uid 后：

- **错因自评**：真实标注仍为 r76 观测到的 2 条（概念不清 1、粗心大意 1），近 7 天**零新增**；错题总量 151 条 / 24 uid 不变；
- **加推同类 / 复盘卡 / 复习庆祝等埋点**（review_reason_tag / review_similar_auto / review_similar_click / review_done_celebrate / review_entry_click / heatmap_view）：真实 uid **全量 0 条**——上线一周尚无真实用户触发；
- growth 近 7 天与基线持平：team_join_open 5、share_open 4（清 QA 后）、share_answer 3、comeback_view 1 等。

结论：三项功能真实使用样本仍近零，与近 7 天活跃仅 39 次作答 / 14 uid 的体量一致——瓶颈在获客而非功能，无异常触发/死循环迹象。

### 2.2 爬虫 / SEO 周观测

日志归档目前仅覆盖 8/9-8/10 两天（archive cron 8/9 起才有数据，周窗口仍不完整，照实报）：

- 爬虫：YandexBot 84、bingbot 1、Baiduspider 1；r86 观察到的 bingbot 上量（22 次）与 Googlebot 现身未再复现，属日间波动；
- `/tiku/y` 年份页 76 次（Yandex 主抓面持续）；`/tiku/papers` 24 次（试卷页开始被抓取，r77 增强后的新抓取面）；
- `/s/` 分享落地 12 次：11 次为自测 IP（curl/Headless/多 UA 模拟）+1 次漏洞扫描器，**仍无真实用户经 /s/ 落地**；
- Bing `site:kaogong.zalize.com` 实测仍返回 "There are no results"，**收录未破零**；Yandex site: 查询仍被验证码拦截无法程序化确认。站长平台验证仍是收录破零的 P0 外部依赖。

## 3. health_scan.py 快扫（全绿）

```
active 113304 / full 156792
lt50 0 | badjson 0 | cid 0 | fffd 0 | spam_residue 0
hs_mismatch 0 | empty_hs_beyond_ledger 0（仅 2 条 intentional 台账题）
paper_dup 0 | paper_lowcov 仅卷 112（65/112）
last7d (39, 14)
growth 基线不变
```

## 4. 限制与遗留

- 小程序/Flutter 本轮零改动、未真机实测（r88 小程序四项交互仍待微信开发者工具/真机回归）；
- 爬虫周观测窗口实际仅 2 天（归档起步晚），下轮起可有完整 7 天窗口；
- 错因/加推/复盘效果复盘需等真实样本积累，建议随获客改善后再看；
- 站长平台验证（Bing/Yandex）仍待外部资源。
