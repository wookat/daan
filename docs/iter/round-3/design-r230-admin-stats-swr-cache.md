# R230 设计：/api/admin/stats 接入 SWR 缓存并纳入启动预热

## 生产证据（verified）

- origin 近 2h 日志（2026-08-29 18:00–20:00 UTC）中所有 >3s 慢样本除 R229 已收口的 governance 冷 miss 外，全部为 `/api/admin/stats`：18:29 3.07s、18:30 3.43s、18:50 3.17s、18:50 5.10s、18:50 3.07s、19:44 2.34s、19:44 1.97s、19:44 2.03s。
- 该端点每次打开管理台看板都会请求（admin 前端首屏），且同一分钟内重复访问仍出现 2s 级样本——非一次性冷路径，而是持续无缓存重查询。
- 根因（代码实证）：`db.admin_stats()` 直查 156k 行 questions 全表 5 次 COUNT（含 hs_explanation 文本条件扫描）+ explain_cache/mistakes 聚合 + practice_results 14 天分组，无任何缓存；2G 宿主 OS page cache 被换出时即秒级。
- 同窗口 dashboard/governance/batches 均 0.13–0.27s（R221/R222/R229 已收口），/api/admin/stats 是管理台最后一个持续秒级端点。

## 方案（最小改动）

- `db.admin_stats()` 改为 `_cached("stats", 300, _admin_stats_uncached)`，原函数体重命名为 `_admin_stats_uncached`；复用 R222 stale-while-revalidate 语义（过期回旧值+后台单飞重算），TTL 300s 与 dashboard 一致。
- `main._prime_admin_caches()` 预热清单加入 `db.admin_stats`（R229 机制，启动一次性）。
- 零 API 契约变化；聚合计数 300s 陈旧度与看板 dashboard 既有语义一致，`POST /api/admin/refresh_stats` 为题目统计重算（question_stats），与本缓存无关。

## 明确不做

- 不做周期性重复预热（R229 同理由：2G 高压宿主不加常驻负载）。
- 不改查询本身/不加索引（COUNT 全表扫描无索引可覆盖，缓存是正确层级）。

## 验证

- 回归测试：`test_startup_prime_fills_admin_caches` 扩为 stats/dashboard/governance 三键。
- 本地门禁：ruff / pytest / pyright / lint(src+tests+edge) / vitest / build。
- 部署后：重启后首个 /api/admin/stats 亚秒级；连续访问亚秒级；1440/375 复验。
