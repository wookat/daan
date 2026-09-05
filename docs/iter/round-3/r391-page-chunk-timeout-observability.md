# R391：页面分包拉取挂起——uni h5 默认 60 s 才给重试入口，且超时/加载失败线上无痕

## 取证（一手）

### 起点：R390 复验的 375 卷库分包停滞
- testing agent 进入 `#/pkgA/exam/list` 时 `pkgA-exam-list.CzyoVGKF.js` 一次 resource duration ≈ 60 s、transferSize 0，随后页面正常显示（120 卷 == API）；同期 1 条 `console.error`，CDP 采集只存了 `JSON.stringify` 结果 `"{}"`，内容未还原。
- 源站访问归档（09-03/04 全量）：`pkgA-exam-list` 资源请求 **0 条**、所有静态资源 >3 s / 非 200 **0 条**——带 hash 的 `/assets/*` 由边缘缓存直出（immutable），源站看不到；Cloudflare 三枚 token 均无 `zone.analytics.read`（R382 已报），边缘侧也无法取证。→ 停滞发生在「浏览器 ↔ 边缘」或浏览器内部，服务端无可改项。
- 同类历史：`main.js` 早已有两层 RUM（`slow_load` 5 s/65 s 复查最慢资源、`hb-gap` 跨 reload 心跳）专为「偶发 ~40 s 壳/chunk 长尾」取证；近 7 天 `slow_load` 54 条里 R372 后仅剩 API 20 s 超时（`home_bundle:20002` / `review:20001`，内部走查 uid），chunk 级停滞只此一次，**未复现**。

### 机制核对（读 `node_modules/@dcloudio` 与 vue 运行时，非猜测）
- uni h5 把**每个页面**编译为 `defineAsyncComponent(extend({loader}, AsyncComponentOptions))`（`uni-h5-vite/dist/plugins/pagesJson.js`），选项来自 `manifest.h5.async`，默认 `{delay:200, timeout:60000, suspensible:true, loading:'AsyncLoading', error:'AsyncError'}`（`uni-h5-vite/dist/plugins/manifestJson.js`）；本仓库 manifest 未覆盖 → 生产 bundle 内 `timeout:6e4`。uni-h5 不用 `<Suspense>`，故 Vue 的 timeout 分支生效。
- Vue `defineAsyncComponent` 行为（`runtime-core`，已核对压缩产物）：
  - 到 `timeout` 仍未加载 → `handleError(new Error('Async component timed out after 60000ms.'))` + 渲染 `errorComponent`；uni 的 `AsyncError` = 「连接服务器超时，点击屏幕重试」，点击 `location.reload()`。
  - render 函数 `loaded && comp ? comp : error ? errorComp : loading`——**loaded 优先于 error**：超时后若 chunk 仍在后台完成，页面照常渲染。这正好解释 R390 观察到的「60 s 停滞 + 1 条 console.error + 页面最终正常」：60 s 到点报错，chunk 紧接着完成。
  - `handleError` 生产态无 `app.config.errorHandler` 时只 `console.error(err)`——**不触发 `window.onerror` / `unhandledrejection`**，现有 `/api/monitor/report` 上报两条监听都收不到；loader 拒绝（发版后旧 hash 404、`Failed to fetch dynamically imported module`）同样只走此路径。→ 这类事件一直线上无痕，是 R387「近 30 天 slow_load 逐条归因」之外的盲区。
- 没有可用的「重试」钩子：Vue `onError(retry)` 只在 loader **拒绝**时触发，挂起不拒绝；uni 生成的 wrapper 也不透传 `onError`。可控的只有 `timeout` 与 `error` 组件。

### 与现状对比
- API 层（`api.js`）GET 策略：12 s 超时 → 重试一次 20 s 超时 → 快照回退，用户最长等 32 s 且中途有反馈；页面 chunk 层：一个 spinner 60 s，然后才有可点的重试。大陆链路实测（R387 ChinaZ）DNS 0.45–1.5 s + 连接 0.15–0.28 s，分包 ≤ 300 KB，正常加载远低于 20 s。

## 方案（零功能、bundle 内两处）
1. `manifest.h5.async.timeout: 20000`——与 API GET 最终超时对齐；超时只改变等待期间显示（spinner → 可点重试），chunk 迟到仍照常渲染，不会误伤慢链路。
2. `app.config.errorHandler`（`src/monitor-client.js::installVueErrorHandler`）：Vue 捕获的错误分类 `chunk-timeout` / `chunk-load` / `vue` 上报 `/api/monitor/report`（message/stack/url 含 hash 路由），保留 `console.error` 输出、链式调用既有 handler；上报器抽为 `createErrorReporter`（同 message 去重、单页 ≤10 条）与 `window.onerror`/`unhandledrejection` 共用。
3. 单测 `tests/monitor-client.test.js`：去重/上限/异常不冒泡、三类归类、链式 handler、manifest 阈值锁定。

## 非目标
- 不动 SW（静态资源本就不拦截）、不动 R387 预加载、不改 `AsyncError` 文案/样式（App.vue 已有离线态替换）、不做「chunk 挂起自动二次拉取」（Vue/uni 无钩子；另发同 URL 请求是否能绕开挂起未取证，不上盲改）。
- 不把单次停滞归因到服务端/边缘：源站 0 记录、边缘无 analytics 权限，只能说明「不在源站」。

## 验证
- 本地：vitest 555 / eslint / build:h5 全绿；产物 `index-*.js` 含 `timeout:2e4`、`errorHandler`，无 `timeout:6e4`。
- 生产第一版（rev f414804，bundle index-BzIny8xO.js；testing agent 1440/375）：
  - CDP `Fetch` 拦截 `pkgA-exam-list` 分包 hold 25 s：两视口均在 20000–20003 ms 出「连接服务器超时，点击屏幕重试」，`/api/monitor/report` 收到 `vue:chunk-timeout:https://vuejs.org/error-reference/#runtime-13: Async component timed out after 20000ms.`（message 真实、stack 非空）；放行后**不点重试**卷库 120 卷照常渲染；同文档第二次超时被去重不重复上报。`fail404` / `abort` 两路 → `vue:chunk-load: Failed to fetch dynamically imported module …`。
  - 375 正常路径：/api 全 2xx、console 0、page error 0、监控上报 0。
  - **1440 正常路径严格口径 FAIL、业务 PASS**：未拦截的情况下本机 Chrome ↔ Cloudflare h3 连接真实出现两次停滞——卷库分包 `performance` duration ≈60 s 后 200（产品按设计 20 s 出超时 UI + 1 条 `vue:chunk-timeout`，随后自行渲染 120 卷）；错题本分包 ≈121 s 后失败（`vue:chunk-load: Unable to preload CSS for /assets/book-*.css`，重载后恢复）。这正是本轮要让其可见的事件，不是测试假象；源站日志同期 5xx / slow-req / traceback 0，仍不能归因服务端。
  - 附带发现：同期 1 条 `unhandledrejection: [object Object]`，真实 reason 为 `{"errMsg":"setTabBarBadge:fail not TabBar page"}`——错题本分包超时后页面停在 AsyncError 态（非 tabBar 页），`uni.setTabBarBadge` 不传回调时返回 Promise，同步 `try/catch` 接不住。
  - 服务侧：`/api/health` rev f414804、容器 healthy / 0 重启 / OOMKilled=false、部署后 5xx 0 / slow-req 0；清理 LEFTOVER 0、questions 156792。
- 第二次提交（同 PR）：`describeRejection` 把对象 reason 取 `errMsg`/`message`/`JSON.stringify`；三处 tabBar 角标改走 `tabbar-badge.js::setBookBadge`（显式 `fail` 回调，uni 不再返回 Promise）。
- 未验证：真实用户是否再出现 chunk 挂起（本轮只让它从此可见）；20 s 阈值是否需随真人 RUM 再调；h3 停滞是否本机/Devin 出口特有（`--disable-quic` 对照未做）。
