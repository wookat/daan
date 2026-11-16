# R82 设计：slow_load 服务端头指纹——归因「无 UA 上报族群」

## 取证（2026-08-31 生产）

- R75 服务端补 UA 上线后：近 7 天 48 条真实 slow_load 全部无 `;ua:` 落库；同期 90s 整点聚簇仍在（22h 前连续 5 条 nav:90125–90630 不同 uid）。
- 三组对照探针（同一 kaogong.zalize.com 边缘链路 → CF Pages function → kaogong-origin → 容器）：
  - curl 带 UA → 落库含 `;ua:R82Probe/1.0`；
  - 真实 Chrome `fetch()` → 落库含 `;ua:Mozilla/5.0 ...`；
  - 真实 Chrome `navigator.sendBeacon()` → 落库含 `;ua:Mozilla/5.0 ...`；
  - curl 显式去 UA → 落库无 `;ua:`（`if ua:` 分支）。
- 服务端 slow_load 仅 api_track 一条 insert 路径；Caddy 直连 kaogong.zalize.com 的 /api/track 访问计数 0（全量走 CF）。
- 结论（事实）：真实 slow_load 上报到达 origin 时 User-Agent 头为空；追加逻辑本身经全链路实证有效。
- 推断（待证）：该族群为剥离 UA 的非常规客户端/中间层（脚本、监测、省流代理、预取代理等）。但保护 uid（老板真实设备）也有 1 条无 UA 记录，不能武断全归为 bot——需要更多头指纹分辨。

## 方案

api_track 中 slow_load 入库侧增强（其他事件零变化、不动前端、不加列）：

- `;ua:` 由「有才追加」改为恒追加，空值写 `;ua:-`（消除「旧格式 vs 空 UA」歧义）；
- 追加 `;hs:<flags>` 头指纹：`f`=sec-fetch-mode、`c`=sec-ch-ua、`o`=origin、`r`=referer、`l`=accept-language，各头存在即置位，全无写 `-`。
  - 判别力：现代 Chromium 系浏览器 fetch/beacon 必带 sec-fetch-*（浏览器强制、代理无法伪造缺失）；脚本/老旧 webview/部分代理通常缺失。
- ref 总长上限 300 不变。

## 非目标

- 不记 IP/不加 PII；不动 slow_load 判定阈值与前端上报；不改其他事件。

## 验收

- 探针三组对照：浏览器 fetch → `;ua:Mozilla...;hs:` 含 f/c/o/l；curl 去 UA → `;ua:-;hs:` 仅 l 或 `-`；其他事件（如 heatmap_view）ref 零变化。
- ruff 通过、部署回归 200、测试事件清理、保护 uid 零 mutation。
- 观察项：下一批真实 slow_load 的 `;hs:` 分布 → 区分「真浏览器但 UA 被剥」vs「非浏览器客户端」。
