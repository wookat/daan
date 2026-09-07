# R419：比赛场次并发重复建赛（生产 8 行「第5期」）+ R418 遗留两问取证

## 起点

R418 收口留下两问：① `mock_event_entries` 比赛名次是否需同 probe 口径（先查有无走查 uid 入表）；
② `mistakes` 表 `test-*` 8 行是否进任何跨用户聚合。按调研先行，先生产只读，再定改不改。

## 一手取证（生产 `/data/data.db`，rev `4c58e07` 容器内直查，只读）

### ① `mock_event_entries`
- 列：`event_id, uid, registered_at, attempt_id, score, rank, nickname`，无 `probe` 列。
- 全表 **1 行**：`event_id=3, uid=u15, score=NULL, rank=NULL, attempt_id=0`（只报名未交卷）。
- `test-*` 入表 0；R418 复验期间日志里 `/api/mock/events?uid=test-w5-audit-h5` 多次（140.232.64.2）全是 GET 读取，无 register/enter 写入。
- 跨用户读取路径（`_counts` 报名/交卷人数、`_freeze_ranks` 名次、`api_event_rank` 榜单、`api_event_report`/`report.py` 的
  total/below）全部只读 `mock_event_entries`；比赛分数池 `_score_pool` 已在 R418 接 `REAL_TRAFFIC`。
- **结论：无污染证据，报名是显式行为，不为「口径统一」加列**。若将来走查 uid 报名交卷，`entries.attempt_id → exam_attempts.probe`
  可作为过滤依据，届时再议。

### ② `mistakes` 的 `test-*` 8 行
`test-r375-oimf 2 / test-w2-mp 1 / test-w4-mp 5`，全表 231 行 / 63 uid。检索全部 `FROM mistakes` 读取：`stats(uid)`、
`_due_by_tag3(conn, uid)`、推荐/强化候选、`mistake_analysis_stats(uid)`、`report.reasons` 错因分布、review log 连接——
**全部带 uid 条件**，无一处跨用户聚合返回给普通用户。**结论：不改、不删。**

### ③ 顺带取证到的真问题：`mock_events` 重复场次
```
id  title              paper  open_at(UTC)         created_at(UTC)
1   第1期               81     08-08 01:00          08-06 13:22
3   第2期               98     08-15 01:00          08-10 00:55
6   第3期               96     09-05 01:00          08-30 04:16
7   第4期              100     09-05 01:00 (同 6)   08-30 09:24
8~15 第5期 ×8  95/83/112/88/122/99/81/79   09-12 01:00 (同窗口)   09-06 00:19:47.99–48.28
```
- 8–15：caddy 源站日志 00:19:47.99–48.28 UTC 有 **8 次 `/api/mock/events` 并发请求**（同一走查会话多标签/多视口），
  与 8 行 created_at 逐个对应 → **`ensure_weekly_event` 存在性检查与 INSERT 不在同一写锁事务**：连接
  `isolation_level="IMMEDIATE"` 只在 DML 前自动 BEGIN，纯 SELECT 走无锁快照，8 个线程全部通过检查后各插一行；
  `mock_events` 无唯一约束兜底。「第5期」编号本身也是错的（只有 3 个不同窗口的前序场次）。
- 6/7：同窗口两行相隔 5 h，08-30 源站日志已轮转不可得，成因**未归因**（非同一并发形态），唯一索引同样能兜住。
- 用户可见：`/api/mock/events` `next` 只取一条（id 8「第5期」paper 95），另 7 行不出现在 UI；`past` 列表会同时列出
  「第3期」「第4期」两个同一天的场次。`mock_event_entries` 对 7、9–15 均 0 行。

## 方案与门禁

代码（`backend/app/mock_event.py`、`db.py`）：
- `ensure_weekly_event`：先无锁快检 → `_pick_paper_id`（可能建 mock 卷并 commit，放锁外）→ `BEGIN IMMEDIATE` → 锁内二次检查 →
  INSERT → commit；`IntegrityError` 回滚吞掉（他线程已插）。
- `init_mock_event_db` 新增 `ensure_window_index`：`CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_events_window ON
  mock_events(series, open_at, close_at)`；库里有重复时建不起来返回 False（先跑去重脚本）。
- 管理端 `POST /api/admin/mock/events` 撞窗口 → 409（此前会静默双建）。
- `_ensure_exam_tables` 的 `secs/marks` ALTER 改 `add_column_if_missing`（本轮并发单测在空库上暴露同类 duplicate column，
  R374 只修了新列；生产库已有列不受影响）。

脚本 `scripts/r419_dedupe_mock_events.py`：同 (series, open_at, close_at) 多行 → 组内优先留有登记的行、否则留最小 id；
≥2 行有登记的组跳过不自动处理；被删行须 0 登记（apply 前再核一次）。默认 dry-run；`--apply --record` 落被删行全字段 +
改名原值；`--renumber` 才按系列内 open_at 顺序重排「第 N 期」；`--restore` 按原 id 重插 + 标题还原 + 删唯一索引。

单测 `backend/tests/test_r419_mock_event_dedupe.py`（5 条）：8 线程 Barrier 同过快检后并发 `ensure_weekly_event` → 只 1 行 +
索引存在（旧代码同用例 8 行 FAIL 已实证）；管理端撞窗口 409；脚本保留有登记行 + 重排 + 幂等 + restore 逐字段回原；
两行有登记的组跳过；默认不重排。本地 pytest 443（+5）/ ruff / pyright 0。

## 生产执行（rev `4c58e07` 容器，先改库再部署）

1. 磁盘 94%/2.9 G、free 65 MB、load 2.1。
2. dry-run：`重复组 2，删 8 行（7；9–15），跳过 0`；`--renumber` 预览：8「第5期」→「第4期」。
3. 备份：`/data/r419-mock-events-before.json`（`mock_events` 12 行 + `mock_event_entries` 1 行全字段；本轮只动这两张小表，
   不做 449 MB 全库副本——记录文件本身就是 restore 输入）。
4. apply：`deleted 8, retitled 1, index idx_mock_events_window 已建`，记录 `/data/r419-mock-events-dedupe.json`。
5. 复核：re-dry-run 0；表剩 1/3/6/8 → 「第1/2/3/4期」，`PRAGMA index_list` 含唯一索引，`mock_event_entries` 仍 1 行 u15，
   `quick_check` ok。不重启即 `/api/mock/events` → `next` 「第4期」（id 8，paper 95）、`past` 第3/2/1 期各一条。
6. 重排取舍：「第5期」自 09-06 00:19 起对外展示约 10 h、0 报名；真实前序场次只有 3 个，「第5期」是错号，改「第4期」
   是纠错不是改口径，记录可还原。

部署 rev `3c1cf71`（`--skip-build`）见 handoff R419 节。
