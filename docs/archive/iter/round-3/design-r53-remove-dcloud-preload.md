# R53 设计：移除 uni-h5 dcloud CDN 阴影预加载（第三方 cookie / 外部依赖收敛）

## 取证（2026-08-29 生产实测）

- Lighthouse desktop：首页 best-practices **0.77**（book/practice-history 均 1.0），失败项：
  - `third-party-cookies`：1 cookie（`__uni__uid` → `https://cdn.dcloud.net.cn/img/shadow-grey.png`）
  - `inspector-issues`：Cookie issue，同一 URL
  - `cache-insight`：同一 URL
- 根因（产物 CSS 实查）：uni-h5 框架样式注入全局
  ```css
  body:after{position:fixed;content:"";left:-1000px;top:-1000px;animation:shadow-preload .1s;animation-delay:3s}
  @keyframes shadow-preload{0%{background-image:url(https://cdn.dcloud.net.cn/img/shadow-grey.png)}...}
  ```
  即每个页面加载 3s 后都会向 dcloud CDN 发一次图片请求（预加载导航栏阴影图）。
- 本仓实查：`pages.json` / 源码 0 处使用 `uni-page-head-shadow-*`，该预加载 100% 无用。
- 风险面：① 第三方 cookie（隐私/合规）；② 对 dcloud CDN 的运行时外部依赖（挂了虽不致命但产生失败请求）；③ Lighthouse best-practices 扣分。

## 方案

App.vue 全局样式一条覆盖，禁用该预加载动画：

```css
body::after { animation: none !important; }
```

不动 node_modules、不 patch 框架；若未来真的启用 page-head shadow（不会），首次显示时才按需加载，无功能损失。

## 验收

- 构建产物仍含框架规则但被覆盖；生产页面网络面板无 cdn.dcloud.net.cn 请求。
- 首页 Lighthouse best-practices 0.77 → 1.0，perf/a11y 不回退。
- 1440/375 视觉零变化，console 0 error。
