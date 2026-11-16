# R385：`tag3+module` 拉题抽题池按 tag3 逐行回宽行表 147 MB（预热 3.8–5.6 s 连续 3 轮）——`idx_q_tag3_pick` 补 `module` 成覆盖索引

## 1. 取证（一手生产证据）

- 现象：R382/R383/R384 三轮部署预热 `GET /api/questions?limit=10&tag3=CS-LS-01&module=changshi` 均进 `[slow-req]`（4.0 s / 5.6 s / 3.8 s），R383 时按「已走 `idx_q_disabled_tag3_upd`」归为宿主 IO 尖峰，未核实读了多少页。
- 源站归档 08-09 → 09-04 `/api/questions` 带 `tag3` 的请求（`kaogong-origin` access log，剔除 `mode=`/`adaptive=`）：`limit+module+tag3` 形态 **430 次**（探针网段/bot UA 397，非探针 33 全部来自 54.201.200.193 一台 AWS 机器，无候选真人），p50 0.41–0.51 s、**p90 2.1–10.1 s、max 22.3 s**、>2 s 58 次。结论：该路径目前**没有真人流量**，但它是 R378/R379 SEO 题目页 CTA（`practice?tag3=X&module=Y&qid=`）和薄弱考点强化的落地路径——搜索访客点 CTA 后的第一条 API，就是这一条冷 miss。
- 生产库副本（`r383_work.db`，含 R383/R384 索引）drop_caches 冷读剖析（`/home/ubuntu/r385_tag3_profile.py`、`r385_pick_cmp.py`）：

  | 步骤 | 冷耗时 | 磁盘读 |
  |---|---|---|
  | `_pick_pools(module=changshi, tag3=CS-LS-01)` 冷 miss | 0.096 s | **147.5 MB** |
  | `random_questions(...)` 池命中后抽 10 题 | 0.002 s | 1.5 MB |
  | `random_questions(module=changshi)`（无 tag3） | 0.039 s | 12.5 MB |
  | `question_counts()` | 0.008 s | 4.3 MB |

  本机 NVMe 0.1 s 的 147 MB 随机 4 KB 页读，在共宿 iowait 45–76% 的生产盘上就是 3.8–5.6 s。`_pick_pools` 每个 `(module, submodule, tag3, year, region)` 键各缓存 600 s，任一 tag3 首访/过期都重扫。
- 根因：`_pick_scan` 带 tag3 时 `INDEXED BY idx_q_tag3_pick`，索引列 `(tag3, disabled, is_real, has_hs, id)` **不含 `module`**，而前端总是同时带 `module`。EXPLAIN：`SEARCH questions USING INDEX idx_q_tag3_pick (tag3=? AND disabled=?)`（非 COVERING）→ tag3 命中的 9,038 行逐行回宽行表读 `module` 校验（`hs_explanation`/`explanation` 在行内，`questions` 表 204 MB / 156,792 行 ≈ 1.3 KB/行，命中行按 id 分散在全表，每行一次随机页读 + mmap 预读放大，147 MB / 9,038 行 ≈ 16 KB/行）。只带 tag3 时同索引是 COVERING、0 MB。
- 生产 tag3 分布：157 个活跃 tag3，最大 `CS-LS-01` 9,038 行、`PD-DY-01` 6,258、`SL-JS-01` 4,629、`PD-LB-04` 4,385——预热撞的正是最大的一个，其它大 tag3 首访同量级（按行数线性）。
- `governance_scan` 同批剖析：冷 1.185 s / **308.8 MB**（全表内容校验，`broken`/`clones`/`answer_dist`/`missing_explanation` 四段），warm 0.76 s 纯 CPU。只在治理页触发 + 600 s TTL + 预热，本轮不动（见 §3）。

## 2. 方案（最小改动）

- `idx_q_tag3_pick` 改为 `(tag3, disabled, module, is_real, has_hs, id)`：`(tag3, disabled)` 前缀不变，只带 tag3 的查询计划不变；带 module 时变 COVERING。副本实测（drop_caches 冷）：

  | 查询 | 旧索引 | 新索引 |
  |---|---|---|
  | `_pick_scan(changshi, CS-LS-01)` | SEARCH USING INDEX（回表）147.5 MB / 0.096 s | **COVERING 1.0 MB / 0.008 s** |
  | `_pick_scan(tag3 only)` | COVERING 0.0 MB | COVERING 0.0 MB |
  | `random_questions` uid 补足路径（`INDEXED BY idx_q_tag3_pick ... ORDER BY has_hs DESC, RANDOM()`） | — | COVERING + TEMP B-TREE，0.0 MB |

  四层池 `{(1,1):224,(1,0):0,(0,1):8813,(0,0):1}` 新旧一致。
- 迁移：`init_db` 读 `sqlite_master` 中该索引 SQL，不含 `module` 则 `DROP` 后按新定义 `CREATE`（生产库副本 156,792 行重建 0.54 s，索引 3.7 MB → 约 5 MB）；已是新定义时 `IF NOT EXISTS` 直接跳过（0.01 s）。不改 SQL、不改 `_pick_pools` 缓存策略、不加 `INDEXED BY` 回退分支（`idx_q_tag3_pick` 名字不变，三处 `INDEXED BY` 原样有效）。
- `idx_q_tag3_disabled(tag3, disabled)` 是本索引前缀、纯冗余，本轮不删（写入放大很小，避免一轮改两个索引把归因搅混；留 R386+）。
- 单测：`test_tag3_pick_index_covers_module_filter`（索引定义 + 带/不带 module 两条 EXPLAIN 均 COVERING + `_pick_scan` 行数 = COUNT）；`test_tag3_pick_index_old_definition_rebuilt`（临时库先建旧定义，`init_db` 后变新定义；`get_conn` 按线程缓存连接，测试在新线程里跑 `init_db`）。

## 3. 未做 / 留档

- `governance_scan` 308 MB 全表内容校验：不是索引问题（要读题干/选项/解析文本），下一档是把校验结果物化到表按 `updated_at` 增量重算，属改架构，需单独一轮设计；治理页真人访问频次极低（只有管理员），优先级低于用户路径。
- `random_questions(module only)` 冷 12.5 MB 是 `idx_q_pick` 7 MB 覆盖扫 + mmap 预读，已是 COVERING，不动。
- 访问日志里 `limit+mode+module+submodule` 形态 1 次 60.02 s（Caddy 超时）与 `adaptive` 形态 14.87 s 各 1–2 次，样本太少且发生在 R372 前（进程换出期），不单独立项；R385 上线后继续盯 `slow-req`。
- 不 ANALYZE 生产库（会改所有查询计划，需单独评估）。

## 4. 验证计划

- 本地：pytest / ruff / pyright 全绿；副本 `init_db` 迁移 + EXPLAIN + `_pick_scan` 冷读对比（§2）。
- 生产：容器内核实索引新定义、EXPLAIN COVERING、`_pick_scan(changshi, CS-LS-01)` 直测冷读；部署预热 `tag3=CS-LS-01` 是否仍进 `slow-req`；testing agent 1440/375 走 SEO 题目页 → CTA → 练习页（`tag3+module` 深链，领跑题即所读题）→ 作答 → 退出保留 → 首页续练，`/api/questions?tag3=` 状态码/耗时、console、容器重启、清理、questions 总数。
