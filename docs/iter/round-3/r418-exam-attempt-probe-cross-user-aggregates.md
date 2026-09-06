# R418：模考场次探针打标——同卷人数/均分、排行榜/击败比例、比赛分数池只算真人

## 起点

R417 收口时对 `most_wrong` 的说明是「由后台按 probe=0 聚合，探针流量不刷新」。顺着「跨用户聚合还有哪些没接探针口径」
读码 + 生产只读，发现模考侧一整条链路没有 probe 概念。

## 一手取证（生产 `/data/data.db`，rev `e2a241d` 容器内直查，只读）

### 表结构
`exam_attempts` 列：`id, uid, paper_id, started_at, submitted_at, answers, score, per_module, secs, marks` —— **没有 `probe` 列**
（R374 只给 `answer_log`/`growth_events` 加了列；第一次查询脚本误读 `exam_attempts.probe` 报 `no such column: probe`，
即此事实的反证，未写库）。

### 跨用户聚合读取路径（全部无 probe 过滤）
| 用户可见位置 | 代码 | 口径 |
|---|---|---|
| 卷库卷卡「X 人考过 · 均分」 | `db._list_exam_papers_base` takers 子查询 | 全体已交卷 uid 取最高分 |
| 同卷社会证明 `exam_paper_social` | `db.exam_paper_social` | 同上 |
| 模考报告排行榜/击败 X%/分布/模块均值 | `insights.api_exam_rank` rows / pm_rows | 同上 |
| 比赛分数池（小样本参照） | `mock_event._score_pool` | 同上 |

### 生产数据里的内部走查 uid
`test-*` 是团队走查 uid 命名约定（`.agents/skills/testing-kaogong-assistant`），历史留存 7 个：
`test-r375-oimf, test-w1-mp, test-w1-mp2, test-w1-vis-data, test-w2-mp, test-w4-mp, test-w5-audit-h5`。

| 表 | `test-%` 行数 / uid 数 | probe 分布 |
|---|---|---|
| answer_log | 67 / 6 | NULL 39（09-03，R374 打标前）· 1 → 28 |
| growth_events | 67 / 8 | NULL 27 · 1 → 40 |
| exam_attempts | 19 / 4（已交卷 7） | 无列 |
| exam_progress | 4 / 1 | — |
| mistakes | 8 / 3 | — |
| practice_progress | 1 / 1 | — |

`test-w5-audit-h5` 8 条未交卷 attempt 建于 09-06（当日），属另一会话仍在进行的审计走查 → **本轮不删任何 `test-*` 行**，
只补 probe 标记让聚合自然剔除。

### 真人可见的污染（不是理论问题）
- 已交卷按 paper/uid：paper 5 = `test-w4-mp` ×2（最高 1.3）+ `u6`（1.3，**登录用户**）→ `u6` 的模考报告排行榜 2 人、
  击败 0%、卷卡「2 人考过」；paper 197/203/204/219/227 卷卡「1 人考过」全是走查 uid。
- `/api/exam/papers` 部署前实测 takers：`5→2, 197/203/204/219/227→1`。
- answer_log：`test-%` probe NULL 39 行 touch 65 题，其中 **39 题的「真人计」作答里走查行占半数以上** → 题目正确率/人次/易错项
  （`refresh_question_stats` 按 `COALESCE(probe,0)=0`）在这些题上被走查数据主导。

## 决策

1. **加列 + 写入侧打标**（前瞻）：`exam_attempts.probe INTEGER`（`add_column_if_missing` 幂等）；`/api/exam/start` 用
   `auth.probe_request(request)`（显式头 / 网段 / UA 三路任一）写 `probe`。
2. **读取侧四处接 `REAL_TRAFFIC`**：卷卡 takers、`exam_paper_social`、`_score_pool` 直接过滤；`api_exam_rank` 用
   `(COALESCE(probe,0)=0 OR uid=?)`——**本人始终在池内**（探针自己看报告不至于 n=0），真人视角完全不含探针。
3. **历史 `test-*` 行回填 probe=1，不删行**：R374「历史行不造假」针对的是无法归因的匿名 uid；`test-*` 只有内部走查会造，
   标探针是补齐事实。脚本 `scripts/r418_probe_backfill_test_uids.py`：dry-run 默认、`--apply` 前把 (table, id) 落 JSON、
   `--restore FILE` 可还原（只还原当前仍为 1 的行）。回填后 `refresh_question_stats` 让 39 题的正确率/人次/易错项回到真人口径。
4. 不做：不删 `test-*` 行（活跃会话在用）；不把 `probe=NULL` 的普通匿名 uid 归为真人或探针；`mock_event_entries` 比赛名次
   不改（报名参赛是显式行为，走查 uid 未见入表）。

## 本地 gate
pytest 438（+2：`test_r418_exam_probe.py` 端到端探针头 → attempt probe=1 → rank/takers/social/pool 口径；脚本 dry-run 零写入 /
apply / 幂等 / restore）/ ruff / pyright 0。前端无改动，bundle 不变。

## 生产执行与复验
见 handoff R418 节与 PR #619 评论。
