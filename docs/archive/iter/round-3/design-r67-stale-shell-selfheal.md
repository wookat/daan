# R67 设计：陈旧壳自愈 + RUM 版本戳——让存量慢客户端吃到新包、让归因数据可用

## 生产取证（2026-08-31，只读查询 growth_events）

- R61（PR #237，已上线多日）为 slow_load RUM 增加了 `ttfb/dom/load/sw/tx` 阶段字段，但生产 `ref like '%ttfb%'` 计数 = **0**。
- 近 40 条 slow_load 全部为旧格式（`nav:90354`、`nav:148;history:8732`），时间跨度到取证当刻 ~1h 前，说明**上报客户端全部在跑旧 bundle**。
- 生产最新 bundle（index-CCgK5PO2.js）与上一版（index-B0M4V3Zf.js）均含 `ttfb` 字段（curl 实证），排除「新代码未上线」。
- 首页 HTML `cache-control: public, max-age=0, must-revalidate`（curl 实证），排除 HTTP 缓存导致陈旧。
- 结论（事实）：陈旧壳唯一供给通道是 sw.js 导航兜底——网络优先 8s 超时后回退 Cache Storage 里的旧 `/` 壳。慢网络/慢链路用户（恰好是产生 60/90s slow_load 的人群）每次都触发兜底、持续跑旧壳，形成「最需要新包修复与新 RUM 归因的用户，恰好永远拿不到新包」的死循环。
- 假设（未证实）：60s/90s 整点级聚簇来自某固定超时层（CF/浏览器/代理），待新 RUM 阶段数据落库后归因。

## 方案

### 1. RUM ref 增加版本戳（归因基础设施）
`main.js` rumCheck 的 ref 追加 `;v:<bundleHash>`，hash 取当前运行 `document.querySelector('script[src*="/assets/index-"]')` 的文件名 hash 段（运行时自取，零构建改动）。此后任何 slow_load 一眼可判新旧包，验证/推翻上面的陈旧壳假设。

### 2. 陈旧壳自愈（stale-shell self-heal）
- 时机：`load` 后延迟 15s（避让首屏带宽），且页面可见。
- 检测：`fetch('/', {cache:'no-store'})` 取最新 HTML，正则提取 `assets/index-<hash>.js`；与当前运行 hash 比对。
- 不一致 → `location.reload()`，sessionStorage 记 `kg_sh_reload=1` 防循环（一个会话最多自愈一次）；一致或检测失败 → 静默不动。
- SW 兜底路径本身不改（Promise.race 中 fetch 完成后仍会 cache.put 更新壳，自愈 reload 时命中新壳）。

### 交互规格
- 自愈 reload 发生在进入页面 15s+ 后，用户无感（SPA 未输入状态时）；有 hash 路由/查询参数原样保留（reload 不改 URL）。
- 失败静默：断网/fetch 失败/解析失败一律不 reload。

## 验证方式
- 本地/生产：正常客户端（新壳）15s 后无 reload、无多余错误。
- 人工制造陈旧壳：CDP 拦截 `/` 返回旧 HTML（引用旧 bundle）→ 加载后 15s 内自动 reload 到新 bundle，且 sessionStorage 防重入生效（二次不 reload）。
- RUM：拦截制造慢导航，确认 ref 末尾带 `;v:<hash>`。
- 1440/375 回归四主页 console 0 error。
