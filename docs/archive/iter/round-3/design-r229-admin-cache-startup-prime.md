# R229 设计论证：管理台重查询缓存启动预热

## 取证（生产证据优先）
- verified：近 3h origin 日志共 2705 行，无外部用户 5xx（9 条 502 均为共享 NAT 受控探针 17:03 集束）；17:39–17:44 的 /api/admin/batches 6–7s 样本时间戳在 R221 索引部署之前，当前实测 0.05–0.16s，索引 idx_q_batch 在库且生效——非回退。
- verified：/api/admin/governance 当前实测首次命中 5.1s、随后 0.16s——正是 R222 设计中「冷 miss 仅进程启动后首次同步」的成本；同时 container-events.log 显示当天容器重建 ≥8 次（每次部署都会重建），即每次部署后第一个打开管理台的管理员都要为 dashboard/governance 各承担一次秒级冷查询。
- R94 已有 `_warmup` 常驻预热线程先例（抽题池/daily_set/uid 热表）。

## 方案（最小改动）
`main.py _warmup` 进入循环前一次性预热管理台两个 `_cached` 键：`db.admin_dashboard()` 与 `db.governance_scan()`（try 包裹，失败不影响其余预热）。此后由既有 SWR 语义按需维护。

- 不在每个 300s 周期重复预热：governance 全表体检 ~3–5s CPU，2G 高压宿主上常驻周期化会引入持续后台负载，与 R222「按需 + SWR」的设计意图冲突；仅启动一次即可消除重启窗口冷 miss。
- 零契约/接口/缓存语义变化。

## 回归测试
新增 pytest：调用 `main._prime_admin_caches()`（抽出的预热函数）后，`db._ADMIN_CACHE` 含 `dashboard` 与 `governance` 键，且随后 `admin_dashboard()`/`governance_scan()` 直接命中缓存（不再触发同步构建）。

## 验收
- 生产部署重启后，首个 /api/admin/governance、/api/admin/stats（dashboard）请求亚秒；
- 本地门禁全绿；1440/375 生产复验无回归。
