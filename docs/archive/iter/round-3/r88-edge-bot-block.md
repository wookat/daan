# R88：无获客价值爬虫边缘拦截——robots 禁抓 + CF 函数 403

## 取证（2026-08-31，基于 R85 origin 日志全量）

- 经主域（CF 函数代理、带 X-Kg-Ua）到达 origin 的请求：**AwarioBot 496 + SemrushBot 132 = 636 条爬虫 vs 真人仅 44 条**；爬虫全打 /tiku/q/<id> SSR，URL 各不相同，R45 边缘缓存对其无效，每条都穿透 2GB 共享宿主渲染（实测单条 1–5s）。
- Awario（舆情监测）与 Semrush（SEO 工具）均不带来任何用户流量，纯资源挤占；R86 只挡了直连 origin，主域路径未覆盖。
- 同一日志窗口内 Googlebot/Bingbot/Baiduspider 请求为 0——获客型搜索引擎尚未抓取，须确保拦截不误伤它们。

## 方案（两层，均只针对显式 UA 名单）

1. **robots.txt（礼貌层）**：对 AwarioBot/SemrushBot/AhrefsBot/MJ12bot/DotBot/PetalBot 单独 `Disallow: /`（Semrush 等声明遵守 robots）。`User-agent: *` 原规则不变。
2. **CF 函数（强制层）**：`[[path]].js` 对 UA 命中名单的请求直接 403，不回源（robots.txt 本身放行，便于其读到禁抓声明）。

## 非目标
- 不拦 Googlebot/Bingbot/Baiduspider/Sogou 等搜索引擎；不做 UA 之外的行为判定；不动 R86 origin 侧规则。

## 验收
- 模拟 AwarioBot/SemrushBot UA 请求主域 /tiku/q/* → 403 且 origin 日志零到达；robots.txt 对其仍 200 并含禁抓组；
- Googlebot/普通浏览器 UA 全路径回归 200；
- 部署后观察 origin 日志爬虫到达量归零。
