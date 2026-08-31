# R101：首载静态启动屏——消除慢网络白屏（2026-08-31）

## 取证

- 生产 RUM（R61 阶段化字段）实录真实用户首载：`nav:16051;ttfb:1875;dom:7527;load:16028;sw:0;tx:10628`——主 chunk 传输 10.6s、DOM 就绪 7.5s，期间页面完全空白。
- `index.html` 的 `<div id="app">` 为空，Vue 挂载前（需下载+解析 ~120KB gz 主 chunk + 页面 chunk）浏览器只渲染白屏；R47 内联的是组件 CSS，不含任何可见内容。
- 历史 slow_load 60/90s 聚簇同样意味着这批用户经历了分钟级白屏；白屏是首访跳出的第一因素（无品牌、无进度、无法区分「在加载」和「挂了」）。
- 明日 08:00 起 Web Push 深链 `/?daily=1` 落地页也走同一首载路径，白屏直接损耗推送转化。

## 方案

`index.html` 的 `#app` 内放静态启动屏（纯 HTML+内联样式，零请求零依赖）：

- 品牌 logo（复用 `/static/brand/kaogong.svg`，已是 icon 无额外请求）+「错题邦」+ 副标题 + CSS spinner；
- `prefers-color-scheme: dark` 适配深色背景；
- Vue `mount('#app')` 会整体替换 `#app` 子树，无需任何 JS 清理；
- SSR 注释占位 `<!--app-html-->` 保留在前，不影响构建。

## 边界

- 不改任何 JS/加载顺序；SW 缓存的旧壳不含启动屏，随下一次壳更新自然获得。

## 验收

- 生产 375/1440：节流网络下首载先见启动屏后进首页；正常网速无闪烁异常；console 0 error、无溢出；bundle hash 一致。
