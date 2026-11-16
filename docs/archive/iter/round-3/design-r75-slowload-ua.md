# R75 设计：slow_load 上报服务端补 UA 归因

## 取证（2026-08-31）

- 生产 7d slow_load 中 `nav:90xxx`（90.1–90.7s 整点聚簇）持续出现，且分布在**多个互不相同的全新匿名 uid**（umtf7x/umtf8t/umtfa2/umtfb7/umtfgf/umtffc/umtfgm/umtfhg/umtfi4…各 1–2 条），全部 source=h5、ref 均为 R61 前旧格式（无 ttfb/dom/load 阶段、无 `;v:` 版本戳）。
- 矛盾点：全新 uid（无本地存量）理应从 CF Pages 拿到最新 bundle（带阶段+版本戳），却上报旧格式——怀疑是特定客户端族群（微信/UC/夸克 webview、代理、爬虫）或某缓存层，现有埋点（uid/event/source/ref）无法区分。
- growth_events 无 UA/额外列；客户端自报 UA 可被旧 bundle 绕过（旧 bundle 不会带新字段），只有**服务端**在入库时补 UA 才对所有新旧客户端一致生效。

## 方案

qbank/team.py `api_track`：签名补 `request: Request`；仅当 `event == 'slow_load'` 时在 ref 末尾追加 `;ua:<User-Agent 压缩串[:80]>`（ref 截断上限 200→300）。其他事件零变化，不动表结构、不动客户端。

## 非目标

- 不加表列、不动前端、不做通用 UA 采集（非 slow_load 事件不碰，控制隐私面）。

## 验收

- curl 带典型 UA 上报 slow_load → 落库 ref 含 `;ua:`；非 slow_load 事件 ref 不含 UA。
- 等真实 nav:90s 事件带 UA 落库后归因（下一轮观察点）。
