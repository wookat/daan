# R384：管理台 `/api/admin/dashboard` 首访 11 s 根因（flagged COUNT 走 OR 回表 237 MB）+ 运维状态/LLM 通道行窄屏换行

## 1. 取证（一手生产证据）

- R383 生产复验（PR #602 评论）：管理员首访 `/api/admin/dashboard` **11.529 s**，`X-Kg-Cache: cold`；容器日志同刻 `[slow-req] 11.3s GET /api/admin/dashboard`。`/api/admin/stats` 已由 R383 压到 1.44 s，冷启动瓶颈转移到 dashboard。
- 生产库副本（`r383_work.db`，含 R383 三索引）逐子查询 drop_caches 冷读剖析（`/home/ubuntu/r384_dash_profile.py`）：

  | 子查询 | 冷耗时 | 磁盘读 |
  |---|---|---|
  | `flagged` | 0.209 s | **237.5 MB** |
  | `total` | 0.009 s | 3.1 MB |
  | `by_module` | 0.029 s | 2.5 MB |
  | `tag3_review` | 0.005 s | 2.3 MB |
  | `pending_batches` | 0.005 s | 1.1 MB |
  | 其余 10 条（answer_log/explain_cache/reports） | <0.01 s | <1 MB |
  | 合计 | 0.29 s | 248.6 MB |

  本机 NVMe 0.2 s 的 237 MB，在共宿 iowait 45–76% 的生产盘上正是 11 s 量级；其余子查询合计 11 MB，不构成瓶颈。
- `flagged` 原 SQL：`SELECT COUNT(*) FROM questions WHERE hs_down>0 AND (disabled IS NULL OR disabled=0)`。EXPLAIN：`MULTI-INDEX OR` → `INDEX 1 SEARCH idx_q_sitemap (disabled=?)` + `INDEX 2 SEARCH idx_q_active_src (disabled=?)`——规划器按 `disabled` 等值取全部 ~109k 活跃题 rowid 再**逐行回宽行表**读 `hs_down`（`hs_explanation` 在行内，单行常数 KB），R383 加的 `idx_q_hs_down(id) WHERE hs_down>0` 部分索引（1 页）因 OR 形式未被选中。R383 前 INDEX 2 是被删的 `idx_q_disabled_id`，成本相同，非 R383 引入。
- 数据事实：生产 `disabled IS NULL` 行 0（列 `DEFAULT 0`），`hs_down>0` 行 1。
- 375 视口：R383 复验记录「运维状态」面板未加 `.hbar-wrap` 的行（每日备份上传 R2 / R2 副本周验证 / 宿主内存水位 / LLM 通道）`.lb` 被挤到 43–49 px、日期折 3 行；与 R383 已修的爬虫行同一结构（label + sub + 长 tag）。

## 2. 方案（最小改动）

- `_admin_dashboard_uncached()` 的 `flagged` 改写为 `hs_down>0 AND COALESCE(disabled,0)=0`：语义与 `(disabled IS NULL OR disabled=0)` 完全一致（NULL 与 0 都算活跃），但规划器不再拆 OR，直接 `SCAN questions USING INDEX idx_q_hs_down`。副本实测（drop_caches 冷）：

  | 写法 | 计划 | 冷读 |
  |---|---|---|
  | `(disabled IS NULL OR disabled=0)` | MULTI-INDEX OR + 回表 | 237.5 MB / 0.208 s |
  | `COALESCE(disabled,0)=0` | SCAN USING INDEX idx_q_hs_down | **0.0 MB / 0.002 s** |
  | `INDEXED BY idx_q_hs_down` | 同上 | 0.0 MB |

  选 COALESCE 而非 `INDEXED BY`：不引入索引缺失时的 `OperationalError` 分支，无需回退代码。不加新索引、不改缓存 TTL、不动 `_prime_admin_caches`/空闲门控。
- `dashboard.js`：运维状态 5 类行（最近部署 / 备份 / 恢复验证 / R2 周验证 / 内存水位 / 无记录）与 LLM 通道行改用 R383 的 `.hbar hbar-wrap`（去掉行内 `style="width:auto;flex:1"` 与 `.sub` 行内样式，由 `.hbar-wrap .lb .sub` 统一）。「24h 容器变更」tag 短、`by_module` 行 `.lb` 定宽 + 进度条，不动。
- 单测 `test_dashboard_flagged_count_uses_hs_down_partial_index`：断言计划命中 `idx_q_hs_down` 且无 `MULTI-INDEX OR`；构造「活跃 hs_down=2」+「下线 hs_down=3」各 1 题，断言新旧写法结果一致 = 1，且 `_admin_dashboard_uncached()["health"]["flagged"] == 1`。

## 3. 未做 / 留档

- `governance_scan` 冷 miss 仍是全表内容校验（三遍扫 ~264 MB），只在治理页触发、600 s TTL + 空闲门控预热，本轮不动；若治理页首访也慢，下一档是流式/分页而非索引。
- `llm_health` 3.5 s 是三条外部 LLM 通道探活（网络 RTT），非本地瓶颈；`ops_status` 2.5 s 疑为与 dashboard 冷构建同池排队，随本轮消失应可验证。
- 不做 `ANALYZE`：会改全库查询计划，需单独一轮评估。
- `/api/exam/papers` 不带 `X-Kg-Cache`：只有 admin 三接口带，观察项，暂无需求支撑。

## 4. 验证计划

- 本地：pytest / ruff / pyright 全绿；`node --check dashboard.js`；前端 H5 零改动复用现 bundle（`--skip-build`）。
- 生产（部署后）：容器内 `EXPLAIN` 命中 `idx_q_hs_down`；`_admin_dashboard_uncached()` 直测耗时/read_bytes（对照 R383 前 237 MB）；重启后管理员首访 `/api/admin/dashboard` `X-Kg-Cache: cold` 的耗时对照 11.5 s；375 「运维状态」/「LLM 通道」各行 `.lb` 单行、无横向溢出、1440 不劣化；/api 全 200、console 0、容器 0 重启、清理 LEFTOVER 0、questions 156792。
