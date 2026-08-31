# R104：非 SW 客户端可观测性盲区修复（boot/RUM/陈旧壳自愈移出 SW 守卫）

## 取证（2026-08-31 生产）

1. **近 3 天 14 个真实活跃 uid（heatmap_view）中 0 个曾上报过 boot**；boot 全表仅 3 条，
   且来自 3 个互不相同的旧版本 bundle（v:Bm06Xmec / v:CqzaRiae / v:ONVUunI6，均非当前 CpLbaGvl）。
   trackEvent 链路本身对这些 uid 有效（heatmap_view 正常落库），排除埋点通道故障。
2. 代码审计：main.js 中 boot 心跳、slow_load RUM、hb-gap 挂起取证、staleShellHeal 陈旧壳自愈
   **全部包在 `'serviceWorker' in navigator` 守卫内**。不支持 SW 的环境（微信/QQ 等国内
   App 内置 webview、部分 iOS WKWebView）永远不上报 boot/RUM、也永远不触发壳自愈。
3. 交叉证据：本轮清理了本机 Chrome 遗留 28 个标签页造成的自噪声（uid umth5q5ax687m0vfh 18 条
   growth_events，含 9 条 questions:10s slow_load 与 9 条 stale_fallback，已删除）；去噪后
   24h 真实 slow_load 仅 3 条/3 uid——此前 RUM 图景被自流量污染，且非 SW 用户全程不可见。

## 结论

活跃真实用户大概率以国内 App 内置 webview 为主（无 SW），而版本分布（R91）、慢载取证
（R61/R67/R75/R82）与陈旧壳自愈（R67）对他们全部失效：**分母缺失 + 自愈缺失**。

## 方案

main.js 重构（零新接口零后端改动）：

- SW 守卫块只保留：SW 注册、reg.update() 周期校验、`kg-sw-updated` 消息监听。
- runningHash / boot 心跳 / slow_load RUM / hb-gap 取证 / staleShellHeal 移到守卫外的
  统一 `window load` 监听（仍在 H5 条件编译内），`navigator.serviceWorker` 引用全部带
  存在性判断（boot 的 sw: 标志、RUM 的 sw: 阶段字段原本就有判空写法，保持）。
- staleShellHeal 对非 SW 客户端同样有意义：HTTP 缓存壳过期失效同样会跑旧 bundle。

## 验收

1. 本地 build 绿；
2. 生产 Playwright `service_workers='block'` 新 context 实测 boot 落库且 `sw:0`；
3. 常规（SW 开启）context 回归 boot `sw:1`、SW 正常注册；
4. 375/1440 console 0 error；测试事件清理、保护 uid 零改动。
