# R221 设计：/api/admin/batches 6–8s 慢查询收口（import_batch 覆盖索引）

## 取证（verified）

- origin 24h 慢请求（>3s）中 `/api/admin/batches` 8 次（6.0–7.6s，均 200）；来源为管理台批次页真实加载（R220 移动端复验期间触发，管理员日常也会命中）。
- 生产只读 DB 实测：`GROUP BY import_batch` 全表扫 156k 行耗时 2.8s；`questions` 现有 15 个索引无一覆盖 `import_batch`；`admin_batches_v3()` 额外对最多 50 个批次逐个跑 `batch_answer_dist`（单次 0.11s，50 次 ≈ 5.5s），合计与线上 6–8s 吻合。
- distinct import_batch = 1000。
- `/api/admin/governance` 同窗口 4–7s 为冷缓存路径（`_cached 600s` + Python 全表逐行体检），非索引可收口，本轮不动。

## 方案

`db.py` ensure-indexes 处追加一个覆盖索引：

```sql
CREATE INDEX IF NOT EXISTS idx_q_batch ON questions(import_batch, disabled, is_real, answer)
```

- 聚合查询（batch/n/pending/real_n）与 `batch_answer_dist`（answer 分布）都可整索引覆盖，不回表。
- 零查询改写、零接口契约变化；索引随启动 ensure 自动创建。

## 明确不做

- 不改 governance_scan（缓存已兜底，重写体检 SQL 化为独立候选）。
- 不合并 50 次 answer_dist 为单条 SQL（索引后已亚秒，改写收益低）。

## 验收

- 备份副本实测建索引后 group-by + 50×answer_dist 总耗时亚秒级；本地全绿门禁；生产部署后 `/api/admin/batches` 实测 <1s。
