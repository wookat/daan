# R60：H5 未匹配路由兜底——无效深链白屏重定向首页

## 背景与取证（2026-08-29 生产实测）

375/1440 全路由生产走查（Playwright CDP，bundle index-B3kngKtl.js）中发现：
访问不存在的路由（如历史/手误深链 `#/pages/discuss/plaza`、`#/pages/search/search`）时，
uni-app h5 router 无匹配 → 页面永久空白：

- `document.body.textContent.length = 23`（仅隐藏 tabbar 残留），截图纯白；
- 无任何 console error、无 API 请求、无 404/重定向，用户无任何脱困路径；
- 375 与 1440 一致复现（r60/plaza375.png）。

风险：外部分享链接/收藏夹中的旧路径在页面迁移后（如 plaza 实际在
`/pkgA/social/plaza`）会变成死链白屏，竞品（粉笔/夸克 H5）均回落首页。

运行时可用信号（生产实证）：

- `getCurrentPages` 非 window 全局（bundle 内），不可用；
- `window.__uniRoutes` 为全局路由表（32 项，`{path, alias}`，
  首页 `path:'/', alias:'/pages/home/home'`），
  `__uniRoutes.some(r=>r.path==='/pages/discuss/plaza')` → false，可判无效。

## 方案

main.js H5 块新增未匹配路由兜底：window load 后取 `location.hash` 路径部分，
对照 `__uniRoutes` 的 path/alias，均不匹配则 `location.replace('#/')` 回首页。

- 零依赖、仅 H5、不动路由配置与任何页面；
- 有效路由（含带 query 深链）零影响：先剥 `?` 再比对；
- 兜底自身 try/catch，失败保持原状不影响主链路。

## 验收标准

1. 生产访问 2 个无效深链（375+1440）→ 自动落首页正常渲染；
2. 有效深链抽查（plaza/search/discuss?qid=）不被误重定向；
3. 首页/tabbar 页正常，console 0 error；
4. build:h5 全绿、部署 hash 一致。

## 验收结果（待部署后回填）
