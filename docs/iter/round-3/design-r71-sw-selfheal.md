# R71 设计：SW 升级通道自愈——存量陈旧壳客户端强制刷新缓存壳

## 取证（2026-08-31，生产 growth_events 实查）

- slow_load 共 66 条，`;v:` 版本戳（R67，8-30 已上线）**0 条**；最新一条 8-31 03:22 `nav:148;history:8732` 仍为 R61 之前的旧 ref 格式（无 ttfb/dom/load 阶段字段）。
- 结论（观察事实）：所有仍在上报 slow_load 的客户端均运行多天前的旧 bundle；90s 整点聚簇（90125–90657ms）全部来自这批陈旧客户端。
- 根因链（推断，基于代码路径）：sw.js 导航网络优先但 8s 超时回退缓存壳；缓存壳只在**导航成功**时才被 `c.put('/', res)` 刷新 → 链路持续慢的客户端永远拿旧壳跑旧 bundle；R67 页面内自愈代码只存在于新 bundle 中，对这批客户端无效。
- 唯一仍可触达通道：浏览器在每次导航都会独立向服务器检查 sw.js 更新（不走页面缓存壳），字节变更即触发 install/activate——SW 升级是穿透陈旧壳的推送通道。

## 方案

sw.js 三处小改（纯静态文件，不动构建管线）：

1. CACHE 版本 `kg-shell-v3` → `kg-shell-v4`：activate 时既有逻辑自动清掉旧缓存壳。
2. install 时 `cache.add(new Request('/', { cache: 'reload' }))`：绕过 HTTP 缓存强制取最新壳入库（原 addAll 可能命中 HTTP 缓存的旧壳）。
3. activate 末尾对所有受控 window client `postMessage({ type: 'kg-sw-updated' })`；main.js 监听该消息，若当前 bundle hash 与最新壳不一致则复用 R67 的一次性 reload（kg_sh_reload 防重入）。

main.js：把 R67 的「拉 / 比对 hash → reload 一次」提取为函数，15s 定时与 SW 消息两个触发点共用。

## 非目标

- 不改 SW 导航策略（网络优先+8s 回退保持）；不加周期性后台 update 轮询；不动 RUM 阈值。

## 验收

- 本地/生产：sw.js 字节变更后，旧 SW 客户端下次导航触发新 SW install→activate→旧缓存删除→缓存壳为最新 HTML；页面收到 kg-sw-updated 且 hash 不一致时恰好 reload 一次（防重入生效）。
- 正常新客户端：无多余 reload，console 0 error，1440/375 无回归。
- 后续观察：新 slow_load 记录出现 `;v:` 戳（或 90s 聚簇消失）即证明存量客户端被拉回新版。
