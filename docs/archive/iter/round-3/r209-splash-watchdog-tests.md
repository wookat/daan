# R209：index.html 内联启动屏 watchdog 回归测试补强

## 取证（verified / inference / unknown）

- verified（生产复审计，2026-09-01）：本轮无新缺陷——/tiku 页族畸形参数已品牌 404（R208 部署复验 4 类 URL 全 404、/api 422 不变）；sitemap pages/topics/years 随机 60 URL 全部 200 且 canonical 自指；题目页 canonical 无斜杠与 sitemap 一致、带斜杠 301 单跳；安全头（CSP/HSTS/XCTO/XFO/referrer/permissions）齐全；边缘 304 验证器（Last-Modified/IMS）实测 /tiku/、模块页、题目页均 304；origin ETag 被 CF 前端剥离属 R180 已知已设计（Last-Modified 为对客唯一验证器）。
- verified（数据窗口）：growth_events 7d slow_load 47 条，均为无版本戳旧 bundle 客户端或 ShapBot UA 的 API 长尾/90s 族群样本；同名端点本轮实测全部亚秒（daily_plan 0.44s、questions 0.31s、stats 0.24s），无服务端性能缺陷，维持 R206「挂观察」结论。
- verified（代码）：index.html 内联 watchdog（R194 引入、R195 补 role=alert/焦点直达）是启动链路唯一不依赖 bundle 的自愈路径，但为内联 IIFE，vitest 零覆盖——与 R206（边缘 onRequest）/R207（classic SW）修复前同类流程性盲区：行为只能靠部署后生产受控拦截验证，回归全靠人工。
- inference：该脚本后续任何改动（文案、焦点、超时、匹配正则）都有静默破坏失败态可达性的风险（R195 取证过 axe 对该动态态是盲区）。
- unknown：无证据表明当前生产 watchdog 存在行为缺陷（R194/R195 生产受控拦截已验证）；本轮为测试补强，非缺陷修复。

## 方案

沿用 sw-shell.test.js 的源码沙箱模式（node 环境、零新依赖）：

- 从 `index.html` 正则提取含 `__kgSplashOk` 的内联 `<script>` 块源码（测试对 index.html 的真实内容执行，重构/改写会被测试自然感知）；
- `new Function('window','document','location', src)` 注入桩：假 `document`（getElementById/createElement/appendChild/classList）、假 `window`（addEventListener 捕获 error 监听器）、vi.useFakeTimers 控制 20s 超时；
- 用例：
  1. 20s 超时触发失败态：`.kg-splash-fail` 类 + `role=alert` 提示 + 重试按钮获焦；
  2. `__kgSplashOk()` 后超时不再触发失败态（正常路径零污染）；
  3. `/assets/` script error 事件立即触发失败态（不等 20s）；
  4. 失败态幂等：error + 超时双触发只追加一次提示/按钮；
  5. 启动屏已 `kg-splash-done` 时超时不注入失败态（晚到挂载不被覆盖）。

不改 index.html 生产行为，无需部署。

## 验证计划

- vitest 全量 + ESLint + build 本地全绿；
- 无生产产物变更，不部署、不做双视口复验。
