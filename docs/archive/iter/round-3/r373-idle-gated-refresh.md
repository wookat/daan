# R373 冷启动静默期结束瞬间用户写请求集体阻塞 15s——后台重任务改「空闲门控」+ 题目统计刷新不再持写锁翻页

## 生产证据（2026-09-04，rev 9a2c8cd，R372 上线后）

- 部署后 25 min 源站 /api 136 条真实请求 0 个 5xx，但仍有 5 条 >5s（`docker logs -t | grep slow-req`）：

  ```
  07:03:34.026  [slow-req] 11.8s POST /api/practice/progress
  07:03:34.109  [slow-req] 15.6s POST /api/practice/progress
  07:03:34.463  [slow-req]  9.6s POST /api/answer_log
  07:03:34.463  [slow-req]  6.9s POST /api/practice/progress
  07:03:34.862  [slow-req] 15.1s POST /api/answer_log
  ```

  容器 StartedAt 06:53:13Z，`KG_BOOT_QUIET_S` 默认 600s → 静默期结束 **07:03:13Z**。5 条慢请求起止分别为 07:03:18–07:03:27 发起、**07:03:34 同一秒内全部放行**，全部是写请求；同窗口内 131 条其他请求正常。同一秒集体放行 = 排队等同一把锁，不是宿主随机抖动。
- 07:03:13 静默期结束时同时启动两件事（main.py）：`_warmup` 首轮 `_prime_admin_caches()`（admin_stats / admin_dashboard / governance_scan 全表扫描）与 `_stats_refresher` 首轮 `refresh_question_stats()` + `refresh_material_hash()`。
- `refresh_question_stats` 在**一个隐式写事务内**对 943 道题逐条 `UPDATE questions ... WHERE id=?`（Python sqlite3 首个 UPDATE 开事务，循环结束才 commit）。用生产库副本本地实测（`posix_fadvise DONTNEED` 冷页）：冷页 0.17s / 磁盘读 **99 MB**（943 次随机页错误 × mmap readahead ≈ 105 KB/次），热页 0.01s / 0 MB。`admin_stats` 冷页读 252 MB（5 个 questions 全表 COUNT）。
- 宿主同刻 IO pressure full avg60≈65%（共宿 postgres），刚起 10 min 的容器页缓存只有 ~135 MB（库 419 MB），这 99 MB 随机读全部落盘、又与 252 MB 顺序扫描抢同一块盘 → 持写锁的事务被拉长到 ~15s，期间所有 POST 在 `busy_timeout=30000` 上排队，事务 commit 的一刻集体放行——与日志签名完全一致。
- 反证：15:33 页缓存已热时，用探针（/tmp/r373_probe.py：每 0.5s 一读一写，同时触发三个管理台缓存 stale 刷新）在 IO pressure 99% 下复测，写 p50 216ms / max 1.1s，无阻塞 → 问题只在**冷页 + 持锁**叠加时出现，即每次冷启动后第 600s（以及每 6h 一次刷新时页被回收的情况）。
- 未验证：无法在生产上安全制造冷页缓存复现（drop_caches 影响共宿），机制推断基于时序签名 + 本地冷页 IO 量 + 热页反证。

## 方案（零功能变化、零新表/端点）

1. **`refresh_question_stats` 不在写锁内翻冷页**：
   - 先只读一遍 `SELECT id, attempt_count, correct_ratio, most_wrong FROM questions WHERE id IN (...)`（读事务，不阻塞任何写；顺带把这些页读热）；
   - 只对值有变化的题 UPDATE（每 6h 一轮，绝大多数题 3 个字段不变 → 通常 UPDATE 数 ≈ 本期新增作答涉及的题数）；
   - 每 100 条 commit 一次，写锁单次持有毫秒级。返回值仍为处理题数（契约不变，测试 `test_question_stats` 等不受影响）。
2. **后台重任务改空闲门控**（main.py）：新增 `note_request()`（slow-req 中间件内记录最近一次用户请求时间）与 `idle_for(sec)`；`_warmup` 的管理台预热和 `_stats_refresher` 的刷新都要求「静默期已过 **且** 最近 60s 无用户请求」，最多推迟到静默期结束后 2h（`KG_IDLE_GATE_S`/`KG_IDLE_MAX_DEFER_S` 可调）——用户在线时不抢盘，长时间持续有人在线也不至于永不预热。
3. 不动：`_prime_admin_caches` 本身（管理台冷 miss 保护仍在）、SWR 缓存逻辑、`/api/admin/*` 契约、R372 内存参数。

## 验证计划

- 单测：`refresh_question_stats` 只 UPDATE 变化行、分批 commit（拦截 commit 计数）、返回值不变；`idle_for`/门控纯函数在「静默未过 / 静默已过但有请求 / 静默已过且空闲 / 超过最大推迟」四态下的判定。
- 本地全绿：pytest / ruff / pyright / vitest / eslint / build:h5（前端零改动）。
- 生产：部署后用探针从 StartedAt+540s 持续写到 +720s：期望 `slow-req` 0 条、写 max <2s；探针停止 60s 后请求 `/api/admin/stats` 期望 `X-Kg-Cache: hit`（预热已在空闲后完成）；lifecycle 无重启、VmSwap 0。
