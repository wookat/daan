# R149：题库聚合统计覆盖索引（/tiku 冷路径 37s 收口）

## 取证（一手证据，生产 rev c8f3333）

- 部署后首个 `/tiku/` 请求实测 **37.5s**（边缘 HIT 后 0.12s）；部署脚本的 `/tiku/` 边缘预热也因此超时返回 000。
- 容器内直跑三条聚合 SQL（156,792 行 questions 表）：
  - `question_counts`（GROUP BY module WHERE disabled=0）：冷 34.2s / 热 15.5s
  - `tag3_counts`（GROUP BY tag3）：冷 49.0s / 热 23.7s
  - `year_module_counts`（GROUP BY exam_year,module WHERE is_real=1）：冷 11.8s / 热 6.7s
- `EXPLAIN QUERY PLAN`：前两条走 `idx_q_sitemap (disabled=?)`、第三条走 `idx_q_real (is_real=?)`——**均非覆盖索引**，GROUP BY 列不在索引内，需回表随机读 15.6 万行，共享宿主慢盘上被放大成几十秒。
- TTL 5min 进程内缓存只能掩盖热路径；每个冷窗口（容器重启/缓存过期+页缓存冷）都会复现。

## 方案

`db.init` 补三个覆盖索引（沿用既有 `CREATE INDEX IF NOT EXISTS` 迁移模式，启动幂等）：

```sql
CREATE INDEX IF NOT EXISTS idx_q_disabled_module ON questions(disabled, module);
CREATE INDEX IF NOT EXISTS idx_q_disabled_tag3   ON questions(disabled, tag3);
CREATE INDEX IF NOT EXISTS idx_q_real_year       ON questions(is_real, disabled, exam_year, module, updated_at);
```

- 三条聚合均可整段走索引（索引序即 GROUP BY 序或覆盖过滤+分组列），零回表。
- 不改任何查询 SQL 与调用方；`submodule_counts` 已走 `idx_q_module` 0.7s 不动。

## 验收

- 本地 pytest/ruff 全绿。
- 生产部署后 EXPLAIN 走新索引 + 三条 SQL 实测（目标 <1s），`/tiku/` 边缘 MISS 直出耗时复测。
