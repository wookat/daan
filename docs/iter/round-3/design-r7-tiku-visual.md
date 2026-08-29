# R7 设计方案：/tiku SEO 页族视觉一致性对齐 design-v3

日期：2026-08-29 ｜ 轮次：round-3 R7 ｜ 前置：R5 审计遗留候选「/tiku 视觉一致性打磨」

## 1. 取证（生产实测 2026-08-29，bundle index-B3-VJ0sA.js）

对 /tiku/、/tiku/papers/、/tiku/yanyu/、/tiku/q/9 做 1440×900 + 375×812 双视口截图（r7/*.png），与主站 H5（frontend-uni App.vue design-v3 tokens）逐项比对：

| 维度 | /tiku 现状 | 主站 design-v3 | 差距 |
|---|---|---|---|
| 头部 | 实心品牌蓝条 + 白字「考公题库」 | 白底壳 + 品牌蓝仅作强调色 | P1：视觉语言不一致，无产品品牌（错题邦）露出，无去刷题入口 |
| 字体栈 | -apple-system 起步，无 Inter | Inter + PingFang SC + HarmonyOS Sans + Noto Sans SC | P2 |
| 颜色 token | bg #f7f8fa / ink #1f2329 / line #e5e8ef / meta #8a919f | bg #f6f7fb / --ink #17181c / --line #e7e9f0 / --ink-3 #6b7280 | P2：色板不同源 |
| 卡片 | radius 10px + 纯阴影 | radius ~14px + 1px var(--line) 细描边 + 轻阴影 + hover 抬升（≥768px，shadcn 风格） | P1 |
| CTA 按钮 | radius 8px 矩形 | 999 胶囊（.guide-btn 等） | P2 |
| 移动端 | 无横向溢出（scrollWidth 360/375） | — | 无差距 |

结论：功能与 SEO 结构无问题，差距集中在视觉语言不同源——SEO 页看起来像「另一个产品」。

## 2. 架构决策

- 仅改 backend/app/seo.py 的 `_CSS` 与 `_page` 头部模板；不改路由、不改 JSON-LD、不改 sitemap、不动 frontend-uni。
- token 值从 design-v3（App.vue）手工对齐为字面量（SEO 页无构建管线，不引入外部 CSS 文件，保持单请求内联 <style> 的性能与 CSP 简单性）。
- 不做暗色模式（SEO 爬虫/落地页场景无需求，保持轻量）。

## 3. 页面结构 / 交互规格

- 头部改为白底壳：左「错题邦 · 考公题库」（品牌蓝 wordmark），右侧胶囊 CTA「去刷题」链接 `/`；底部 1px var(--line) 分隔。
- 卡片：border 1px #e7e9f0 + 轻阴影 + radius 12px；≥768px hover 抬升（与主站一致）。
- .cta / .hdr-cta 改 999 胶囊。
- 色板对齐：bg #f6f7fb、正文 #17181c、次级 #6b7280、线 #e7e9f0；tags 保持 #eef3ff（本就等于 --brand-soft）。
- 字体栈对齐 Inter 起步的主站栈。
- 移动端（≤480px）规则保留。

## 4. 验收标准

- 本地 backend import 通过；`python -m compileall` 无误。
- 部署后 1440/375 双视口：/tiku/、papers、模块页、题目页头部为白底品牌壳 + 胶囊 CTA；卡片细描边；无横向溢出；console 0 error。
- SEO 不回归：title/description/canonical/JSON-LD/面包屑/分页 DOM 不变（仅 CSS 与 header/footer 标记微调）。
- 不改任何用户数据；测试沿用只读走查 + 新建游客 uid 做消灭柱真实作答验证（与 R6 遗留覆盖项合并执行）。
