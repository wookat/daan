# R150：sitemap lastmod / 真题筛选聚合覆盖索引（R149 同类根因扫尾）

## 取证（一手证据，生产 rev d669fb5）

R149 上线后对 questions 表其余公开热路径聚合逐条跑 `EXPLAIN QUERY PLAN` + 实测：

- `tag3_lastmod`（sitemap 考点分片 lastmod）：走 `idx_q_disabled_tag3 (disabled=? AND tag3>?)` 但 `MAX(updated_at)` 不在索引内→逐行回表，实测 **69.5s**。
- `real_filters` 地区聚合（真题筛选项接口）：走 `idx_q_real (is_real=?)` 非覆盖，实测 **5.2s**。
- `real_filters` 年份聚合：已被 R149 `idx_q_real_year` 覆盖，0.017s，不动。
- 每日一练 `material_hash` 分组：0.18s，不动。

## 方案

`db.init`（沿用幂等迁移模式）：

```sql
DROP INDEX IF EXISTS idx_q_disabled_tag3;  -- 被下者前缀覆盖，冗余
CREATE INDEX IF NOT EXISTS idx_q_disabled_tag3_upd ON questions(disabled, tag3, updated_at);
CREATE INDEX IF NOT EXISTS idx_q_real_region ON questions(is_real, exam_region);
```

- `(disabled, tag3, updated_at)` 同时覆盖 `tag3_counts` 与 `tag3_lastmod`（前缀序即 GROUP BY 序，零回表）。
- 零 SQL/调用方改动；R149 查询计划测试同步改断言新索引名，并新增 lastmod/region 两例。

## 验收

- 本地 ruff/pytest 全绿。
- 生产部署后 EXPLAIN 走新覆盖索引，两条 SQL 实测 <0.1s。
