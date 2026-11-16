# R238：管理台重查询端点外显缓存态头 X-Kg-Cache（cold/hit/stale）

## 取证（verified）

- 近 3h origin 日志：/api/admin/governance 出现 8.8s（18:50:41）、5.0s（19:56:26）、8.5s（21:09:48）样本，/api/admin/stats 多条 2–6s——其中 21:09:48 样本距 21:04:31 容器重建已 5 分钟，按 R229/R230 设计（启动预热 + SWR 过期回旧值）该时刻应为亚秒缓存命中。
- 现状 origin 日志只有 duration，无法区分该请求走的是缓存命中、过期回旧值、还是冷 miss 同步重算——「预热是否真正生效」「慢样本是否宿主争用」只能标 unknown。
- 既有先例：R225 X-Kg-Guard、R226 X-Kg-Fetch 均以响应头借 Caddy origin 日志（14 天 resp_headers 实录）建立逐请求持久证据链，成本为零。

## 方案（最小）

- db.`_cached` 拆出 `_cached_state(key, ttl, fn) -> (data, state)`，state ∈ cold（进程启动后首次同步构建/等锁吃缓存）| hit（TTL 内命中）| stale（过期回旧值+后台单飞重算）；`_cached` 语义零变化。
- db 增 `admin_stats_state` / `admin_dashboard_state` / `governance_scan_state` 三个薄封装；admin_api 三端点改用并在响应加 `X-Kg-Cache: <state>`。
- 不改缓存/预热行为，不改响应体契约；仅管理端（check_admin 后）出头，公开端点不加。

## 验证

- pytest：三态转换（清缓存→cold、再请→hit、回拨时间戳→stale）+ 响应头断言。
- 生产部署后 origin 日志 resp_headers 实录 X-Kg-Cache，重启窗口复验预热生效性。
