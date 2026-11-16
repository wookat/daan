# R143：/tiku SSR 页族打印样式（@media print）

## 取证（一手证据，2026-09-01）

- 源码 grep：全仓（backend/app/seo.py、frontend-uni/src、deploy/cf-pages）`@media print` 0 处。
- /tiku/q/{id} 题目页是「打印真题练习」的天然载体（考公用户线下刷题/整理错题是真实场景，粉笔错题本以「错题导出打印」为招牌功能；本产品 App 内已有错题卷 PDF 导出，但公开 SEO 页族无任何打印适配）。
- 现状打印输出（浏览器默认 print 渲染 _CSS）：
  - 顶栏「去刷题」CTA、题面下方 CTA 胶囊、上一题/下一题 pager、考点 tags、考友讨论区块、页脚全部随题面打印——纯屏幕导流元素成为纸面噪声；
  - `--bg:#f6f7fb` 灰底、卡片阴影、`--ans-bg` 绿色底整页耗墨；
  - `.card` 无 break-inside 约束，题面/解析可能被分页截断。

## 方案

_CSS 末尾追加一段 `@media print`（页族公用，一处收口，零路由改动零 SPA 改动）：

- 隐藏纯导流/导航元素：`.hdr-cta,.cta,.pager,.ftr,.crumb,.tags,#discuss`（讨论区块）；
- 白底黑字去阴影：背景变量压平为白、卡片去边框阴影；
- `.card{break-inside:avoid}` 题面+答案解析不跨页截断；
- `details` 保持 open（现状已 open），答案解析可打印。

非目标：不做 App 内打印入口（已有 PDF 导出）、不改 SPA、不加打印按钮（浏览器 Ctrl+P 即可）。

## 验证

- 后端 pytest：页面 HTML 含 `@media print` 契约断言。
- 生产 Playwright `emulate_media(media='print')`：/tiku/q/{id} 上述元素 computed `display:none`、body 背景白；screen 模式零回归。
- 1440/375 双视口常规回归（console/溢出）。
