# R383 卷库 `/api/exam/papers` 覆盖索引 + 管理台 stats 部分索引 + 爬虫面板窄屏换行

## 1. 取证（生产一手）

| 项 | 证据 |
|---|---|
| `/api/exam/papers` 慢 | 源站 Caddy 归档 09-01–09-04：906 次，p50 0.06 s / **p90 2.63 s** / max 53 s / >2 s 98 次 / 5xx 47（含探针窗口，未剔除） |
| 这是 H5 卷库真正打的接口 | R382 复验：卷库页 `GET /api/exam/papers?kind=zhenti&uid=…` items 120 = UI 卡 120；`/api/papers` 无 H5 调用路径（只剩小程序 `fetchPapers()`、部署预热；近 4 天 507 次里 329 次探针、真人 1 次） |
| 慢在哪 | `_list_exam_papers_base()`：最近 200 卷 12,532 个 distinct qid，分批 `SELECT id, source, is_real FROM questions WHERE disabled=0 AND id IN (…)` → `SEARCH … USING INTEGER PRIMARY KEY (rowid=?)`，每题一次宽行回表。生产库副本（424 MB）冷读 `list_exam_papers(kind="zhenti")` 全路径 **85 MB / 0.11 s**（本机 SSD；生产共宿 iowait 45–76% 下即秒级） |
| `/api/admin/stats` 13.7 s | 容器日志 `[slow-req] 13.7s GET /api/admin/stats`（R382 复验管理员首访）。`_admin_stats_uncached` 里 `hs_done`（`hs_explanation IS NOT NULL AND !=''`）与 `hs_down_total`（`hs_down>0`）两个 COUNT 各 `SCAN questions` **264 MB**（hs_explanation 宽行在表内）。`_prime_admin_caches()` 预热同一函数 = R373 记的「预热 252 MB 全表扫」 |
| 375 管理台竖排 | R382 复验截图：「真人」行 `.lb{flex:1}` 被不可压缩的长 tag 挤到 ~30px，说明文字逐字竖排；引擎行「最近 09-04 12:41Z」同样竖排。无横向溢出 |
| `exam_attempts` 聚合 | 38 行，`idx_ea_paper` 存在，不是瓶颈 |
| `tag3=CS-LS-01` 4.0 s | 已走 `idx_q_disabled_tag3_upd`，有效 9,038 题，4 s 那次与宿主 IO 尖峰同刻，不改 SQL |

## 2. 规划器实验（生产库副本，`echo 3 > drop_caches` 冷读，结果集逐行相等断言）

| 变体 | 计划 | 冷读 |
|---|---|---|
| 现状 | `INTEGER PRIMARY KEY (rowid=?)` | 64.2 MB / 0.76 s |
| `(id, is_real, source) WHERE disabled=0` 部分索引 | 仍选 rowid（`ANALYZE` 后亦然） | 64.2 MB |
| 同上 + `INDEXED BY` | `INDEX (id=?)` | 3.0 MB |
| **`(disabled, id, is_real, source)` 全索引，无 hint** | **`COVERING INDEX idx_q_active_src (disabled=? AND id=?)`** | **3.2 MB / 0.04 s** |

结论：等值列 `disabled` 领头的全索引规划器会自动选中，不需要 `INDEXED BY`（R381 `idx_q_material` 那种脆弱写法可免）。索引 1,034 页 ≈ 4 MB；`idx_q_disabled_id(disabled,id)` 是 `idx_q_sitemap(disabled,id,updated_at)` 的前缀、纯冗余，一并 DROP（DB 体积不变）。

管理台两个 COUNT：部分索引 `idx_q_hs_done(id) WHERE hs_explanation IS NOT NULL AND hs_explanation!=''`（362 页）与 `idx_q_hs_down(id) WHERE hs_down>0`（1 页），WHERE 与 SQL 逐字一致 → `SCAN questions USING INDEX idx_q_hs_*`，264 MB → 1.7 MB / 0.1 MB。`has_hs` 列与表达式当前 0 行不一致，但不改 SQL 依赖它（部分索引语义零风险）。

## 3. 改动

- `backend/app/db.py` 索引初始化：`DROP INDEX IF EXISTS idx_q_disabled_id`；新增 `idx_q_active_src`、`idx_q_hs_done`、`idx_q_hs_down`。SQL 一字不改。
- `backend/app/admin/admin.css`：`.hbar-wrap{flex-wrap}`，`.lb{flex:1 1 150px;min-width:0}`，`.tag{flex:none;white-space:normal;max-width:100%}`；`dashboard.js` 爬虫面板两类行加该 class、内联样式收进 CSS。
- 测试：`test_active_src_index_covers_exam_papers_qid_lookup`（计划断言 + 旧索引已删 + sitemap 计划不变）、`test_admin_stats_counts_use_partial_indexes`。

## 4. 本地验证

pytest 365 / ruff / pyright 0；`node --check dashboard.js`。副本全路径：`list_exam_papers` 85 MB → 2.5 MB（0.11 → 0.02 s）；`_admin_stats_uncached` 223 MB → 71 MB（0.33 → 0.07 s）。前端 uni 零改动，复用 bundle index-Bctw4Xpu.js（`--skip-build`）。

## 5. 生产复验计划

- `sqlite_master` 三个新索引存在、`idx_q_disabled_id` 不存在；两条 `EXPLAIN` 命中。
- 重启后冷访 `/api/exam/papers?kind=zhenti`（首个非缓存请求）耗时与 `X-Kg-Cache`；管理员首访 `/api/admin/stats` 不再出 slow-req。
- 1440/375：卷库列表/按卷练习/续练回归；管理台「搜索引擎抓取」面板 375 下「真人」与引擎行标签整行换行、无逐字竖排、无横向溢出。

## 6. 不做

- ANALYZE 生产库（会改全部查询计划，另开一轮评估）。
- 改 `hs_done` 为 `has_hs=1`（语义耦合迁移列，收益已被部分索引覆盖）。
- `/api/exam/papers` 结果缓存 TTL 调整（现 300 s SWR 已合理）。
