# R194：启动屏加载失败死胡同收口

## 取证（一手实测，2026-08-29）

- 生产环境用 Playwright 拦截 `/assets/index-*.js`（模拟弱网/防火墙/CDN 异常/陈旧 HTML 引用已清理 bundle），首访 25 秒后页面仍停留在启动屏：spinner 持续旋转、无任何失败提示、无重试出路。
- 现有自愈链路（陈旧壳自愈、错误监控、离线兜底）全部位于 main.js 内——bundle 本身加载失败时一行 JS 都不会执行，全部失效。这是自愈体系的结构性盲区。
- 48h 非探针 origin 窗口无 5xx/慢请求，本轮属「不依赖真实流量」的可靠性打磨。

## 方案（最小改动）

index.html 内联 watchdog（与启动屏同生命周期，不依赖 bundle）：

1. `error` 捕获监听（capture=true）：`/assets/` 下 script 元素加载失败即触发失败态。
2. 20s 超时兜底：应用未在时限内挂载（启动屏未被加隐藏类）也触发失败态。
3. 失败态：spinner 隐藏，启动屏内追加「页面加载失败，请检查网络后重试」+「重新加载」按钮（location.reload）。
4. `main.js` 的 `dismissSplash()` 调 `window.__kgSplashOk()` 取消 watchdog；若失败态已渲染而 bundle 晚到成功挂载，隐藏类会连同失败态一起隐藏，无残留。

不选方案：Service Worker 兜底（首访无 SW）；把 watchdog 放 main.js（bundle 失败时不执行，正是盲区本身）。

## 验证

- 本地：ESLint / vitest / build 全绿；构建产物确认内联脚本保留。
- 生产：拦截 bundle 后失败态按预期出现（spinner 停、提示+重试按钮）、点击重新加载放行后正常进入应用；正常加载路径 watchdog 被取消、无失败态闪现；1440/375 双视口、深色模式、溢出 0、console 无非预期 error。

## 局限

- 20s 阈值为经验值（覆盖慢网正常加载 p99 之外），慢于 20s 的极端正常加载会先见失败提示，点击重载即可恢复；失败态不阻断 bundle 晚到后的正常挂载。
