# 轮78 报告：例行发现线 —— r77 两项线上复验 + 健康快扫 + 分享/落地流量观测

分支：devin/1786319548-r73（PR#117）。本轮零代码/零生产内容变更（仅创建并清理 1 条 QA 测试分享）。

## 1. r77 两项线上复验（全过，P0/P1 无）

### 1.1 分享落地页 /s/{sid} OG 爬虫模拟

生产创建测试分享（question_id=110，复验后已删清），四种爬虫/客户端 UA 模拟抓取全 200 且 OG 输出一致正确：

| UA 模拟 | 状态 |
|---|---|
| MicroMessenger/8.0.42（微信内置） | 200 |
| QQBrowser | 200 |
| Baiduspider/2.0 | 200 |
| Twitterbot/1.0 | 200 |

抓到的动态 meta（微信 UA 实抓）：

- `og:title`＝「r78测试分享了一道判断推理题，敢来挑战吗？」（昵称+模块动态注入）
- `og:description`＝题干摘要（空白归一+截断，转义正常）
- `og:url`＝`https://kaogong.zalize.com/s/{sid}`，`robots`＝`noindex`
- **答案/解析泄露检查：0 命中**（页面不含「答案/解析」字样与 hs 内容）

### 1.2 秒跳与 query 透传 / 无效 sid

- Playwright 真浏览器打开 `/s/{sid}?v=b&src=qa` → 落到 `/#/pkgA/share/share-q?sid={sid}&v=b&src=qa`，**query 全量透传**（A/B 的 v 参数归因不丢），分享页渲染正常，JS 错误 0；
- `/s/nosuchsid99` → 302 首页；多段路径的扫描器请求（`/s/xxx/_/;/META-INF/...`）路由不匹配正确 404，无异常。

### 1.3 试卷页三态渲染

`/tiku/papers/1` 在 375px 浅色 / 375px 深色 / 桌面 1280px 三态：模块分布卡、按模块刷{年份}真题卡、同年卷互链全部在位，无横向溢出，JS 错误 0。备注：SEO 静态页无深色样式表（浅色白底呈现），与全站 SEO 页现状一致，非本轮回归项。

## 2. 健康快扫（官方口径，全绿）

```
active 112962 / full 156792
lt50 0  badjson 0  cid 0  hs_mismatch 0
empty_hs 2 ['panduan:334296', 'changshi:655861']（台账题，不动）
last7d 39 次 / 14 uid   seo14d 0
```

## 3. 分享埋点与 /s/ 落地流量观测（照实报）

- growth 埋点与基线持平：share_open 5、team_join_open 5、heatmap_view 4、share_answer 3、comeback_view 1 等（QA 测试事件已清理，无残留）；
- live access log（跨 8/9-8/10 未轮转段，2,681 行）：`/s/` 12 次全部为本轮/上轮 QA 自测+1 次漏洞扫描器 404，**尚无真实用户经 /s/ 落地**（功能上线约 1 天，符合预期）；`/tiku/papers` 19 次含 QA 自测；
- 爬虫：YandexBot 82 + bingbot 1，/tiku/y 76 次——Yandex 年份页持续到访；8/10 归档暂 129 行爬虫 0；Baiduspider 计数 1 系本轮 UA 模拟，非真实百度到访；Bing site: 收录仍未破零（站长平台验证仍 P0 外部依赖）。

## 4. 结论与建议

- r77 两项功能线上行为全部符合设计，P0/P1 无；
- /s/ 落地与试卷页增强的真实流量效果需 1-2 周观测窗口，建议下一轮例行带上「/s/ 真实落地数、试卷页爬虫抓取数」两个指标；
- 未提交任何密钥/生产 .env/数据库文件。
