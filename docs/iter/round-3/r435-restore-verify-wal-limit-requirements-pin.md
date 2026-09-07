# R435 — RESTORE-VERIFY 覆盖面核查（不改）+ SQLite `-wal` 114 MB 永不回收（改 1 行）+ 生产镜像依赖裸装最新版（钉版）

日期：2026-09-06 23:00–23:15 CST 前后（服务器时间）。范围：只读核每日备份校验链 → 恢复副本与活跃库对账 → 两处一手命中改码 → 两次部署 → 生产复验。
不动活跃库数据、不删任何备份/归档、不动别家产品。

## 1. 起点核查：RESTORE-VERIFY 只查 `quick_check` + `questions` 计数——够不够？

### 1.1 校验链真在跑（ops 日志一手）
```
2026-09-03 03:40:01 RESTORE-VERIFY ok questions=156792
2026-09-04 03:40:01 RESTORE-VERIFY ok questions=156792
2026-09-05 03:40:02 RESTORE-VERIFY ok questions=156792
2026-09-06 03:40:01 RESTORE-VERIFY ok questions=156792
2026-09-06 03:40:01 R2-VERIFY ok md5 match data-2026-09-06.db.gz
2026-09-06 22:36:31 RESTORE-VERIFY ok questions=156792   ← R433 手工整跑
2026-09-06 22:36:31 R2-VERIFY ok md5 match data-2026-09-06.db.gz
```
实现（`deploy/kaogong-ops.sh`）：gunzip 当日备份到 `.verify.db` → `PRAGMA quick_check` + `SELECT count(*) FROM questions` → 非 `ok questions=` 前缀即 `RESTORE-VERIFY FAILED`。R2 侧另有 `rclone cat | md5sum` 与本地 gz md5 对照。

### 1.2 恢复副本 vs 活跃库对账（宿主 gunzip 当日备份到 /tmp，只读 `file:…?mode=ro`）
| 表 | 备份 count / max(rowid) | live count / max(rowid) |
|---|---|---|
| questions | 156792 / 1482630 | 156792 / 1482630 |
| users | 16 / 32 | 16 / 32 |
| mistakes | 273 / 2847 | 273 / 2847 |
| answer_log | 1146 / 7539 | 1146 / 7539 |
| review_log | 34 / 307 | 34 / 307 |
| practice_results | 287 / 292 | — |
| pk_matches | 27 / 35 | — |
| daily_set_entries | 1 / 1 | — |
| interview_sessions | 13 / 28 | — |
| explain_cache | 80 / 117 | — |
| shared_questions | 15 / 29 | — |
| favorites / reminders | **no such table**（本库无此二表；收藏/提醒实为 `question_favs`/`fav_folders`/`reminder_prefs`，本轮未对账） | — |

85 张表，备份（R433 22:36 手工整跑产物）与活跃库在 5 张用户/学习表上逐一相等。
结论：**现行校验能证明「备份文件可打开、结构完好、题库整表在」**；用户表未核只是「没看」不是「有差」：`.backup` 是页级整库复制、不存在「只复制到部分表」的失败形态，`quick_check` 覆盖全部表的 B-tree，再数几张表行数只是重复信号。→ **不扩校验范围、不改脚本**；登记：若日后有「备份能开但业务表缺行」的实证再加。

## 2. 命中 A：`-wal` 114 MB 里只有 3.6 MB 活帧，且永不回收

顺手看恢复源文件时发现（容器内一手）：
```
/data/data.db      449310720 B
/data/data.db-wal  114206432 B      ← 27877 帧 × 4096
-shm 头：mxFrame=876 nBackfill=0     → 活帧 876 × 4096 = 3.6 MB，其余 110 MB 是历史峰值
PRAGMA journal_size_limit → -1（默认，不限）
```
机理（SQLite 文档 + 本地单测复现，非推断）：WAL 文件在 checkpoint 后不截断，只在「下一次写事务发现 WAL 已被全部回填」时**从头复用**；文件长度停在历史上两次 checkpoint 之间最大的一次写入量。本服务线程本地连接不 close、进程退出时也不会走 `wal_checkpoint(TRUNCATE)`，所以 R3b 清洗/R396/R400 隔离等一次性大写入把文件撑到 114 MB 后再没回来。
影响：不是正确性问题（活帧才是数据），是 (a) 每次 `.backup`/恢复演练读 114 MB 而非 3.6 MB；(b) 卷/宿主磁盘（90%+）多占 110 MB；(c) 备份体积口径被 WAL 干扰（R433 卷内盘点把 wal 109 MB 当固定成本）。

修 `backend/app/db.py` 1 行 + 常量：
```python
SQLITE_WAL_LIMIT_BYTES = 64 << 20
conn.execute(f"PRAGMA journal_size_limit={SQLITE_WAL_LIMIT_BYTES}")
```
`journal_size_limit` 只在 WAL 重置时把文件截回上限，不改变 checkpoint 时机、不在请求路径上做任何 I/O（热路径零影响）；64 MiB 远大于日常任何单次写入（题目统计刷新每批 100 行）。
单测 `test_wal_file_truncated_back_to_limit_after_reset`：1 MiB 上限连接一次 8 MB 写入 → PASSIVE checkpoint 后文件仍是峰值 → 下一次写入触发重置 → 文件 ≤1 MiB；不设上限的对照连接文件停在峰值。另断言 `get_conn()` 的连接 `PRAGMA journal_size_limit` == 64 MiB。

部署 `190cf70` 后一次性收回历史峰值（新连接的 PRAGMA 只管以后，旧 114 MB 文件要有一次 TRUNCATE）：
```
PRAGMA wal_checkpoint(TRUNCATE) → (0, 0, 0)     # busy=0，全部回填，文件截 0
/data/data.db-wal → 0 B；rev 3c451c9 重建重启后 16512 B（4 帧）
```

## 3. 命中 B：Dockerfile 裸装最新版，缓存被挤掉时静默换依赖版本

部署 `190cf70` 时对比容器 `pip freeze` 与本机：**生产 `pypdf 6.17.0`，本机 6.16.2**。追 buildkit 日志（`/tmp/kg-compose-<rev>-*.log`，R431 起留存）：
| 部署 | `RUN pip install …`（Dockerfile 第 4 层） | 结果 |
|---|---|---|
| ed9e69e（R431，21:47 CST） | 重跑（缓存 miss） | `Downloading pypdf-6.17.0`（PyPI 09-04 发布，**2 天前**） |
| ce81242（R431b，21:51） | `CACHED` | — |
| 190cf70（R435，23:02） | 重跑（缓存 miss） | 再次 `Downloading pypdf-6.17.0` |
| 3c451c9（R435b，23:10） | 重跑（Dockerfile 改了，预期） | 按 requirements.txt 钉版 |

Dockerfile 原写法 `RUN pip install --no-cache-dir fastapi uvicorn httpx python-multipart reportlab pypdf opencv-python-headless numpy pypinyin "pyjwt[crypto]" pywebpush` 无任何版本约束；同机 recruit/softcopyright 也在 build（`docker builder du` 4.1 GB / 可回收 2.19 GB），kaogong 的 pip 层每隔一两次部署就被挤出缓存并**在部署时刻拿 PyPI 当时最新版**——生产依赖版本由「别家什么时候 build」决定，本地 pytest 跑的和线上跑的可以不是同一套包（本轮 pypdf 6.16.2 vs 6.17.0 就是实例，未出问题只是运气）。

修：
- 新 `backend/requirements.txt`：生产容器（rev 190cf70）`pip freeze` 全量 41 行 `==` 钉版（含传递依赖），文件头注明来源与升级规矩。
- `Dockerfile` / `deploy/Dockerfile.runtime`：`COPY backend/requirements.txt` + `RUN pip install --no-cache-dir -r backend/requirements.txt`，不再裸装。
- 单测 `tests/test_requirements_pinned.py`：每行必须 `name==x.y.z`；12 个运行时直接依赖必在清单；两份 Dockerfile 只允许 `-r backend/requirements.txt` 这一种 `pip install`。
- 本机 `pip install pypdf==6.17.0` 对齐生产后 PDF 相关 27 测试通过，全量 494 passed。

部署 `3c451c9` 后：`docker exec deploy-kaogong-1 pip freeze | sort` 与 `requirements.txt` 非注释行 `diff` **为空**（41/41 一致）。

## 4. 两次部署与复验

| | 190cf70 | 3c451c9 |
|---|---|---|
| compose | `KG_COMPOSE_EXIT rc=0`（宿主 free ~340 MB、别家 1 个 build 在跑等 15 s×2） | rc=0，`/api/health` `{"ok":true,"rev":"3c451c9"}` |
| 容器 | healthy 0 重启 | healthy 0 重启 |
| 日志 | 5xx/Traceback/locked 0 | 12 min 内 0 |
| `/api/stats` / `/api/papers` | 200 / 0.087 s、0.150 s | — |
| 表计数 | users 16 / mistakes 273 / answer_log 1146 / review_log 34 不变 | — |
| 6b Lighthouse | `/` LCP 2745 一次 WARN | `/` performance 0.81 + LCP 2741 WARN（宿主 load 3.67，同机别家 build；bundle `index-junWyPAm.js` 不变，`/tiku/` 1.00） |

后端-only 改动、无 UI/DB 写入，不派 testing agent。本地：pytest **494**（+1 WAL +3 钉版）/ ruff 0 / pyright 0 / `bash -n` 过。

## 5. 复查项
- `probe=0`：仍只有 R425 vivo 小程序 uid 的 09-06 行，无新行；`error_reason` 非空 6 行全 probe=NULL，probe=0 0 行，≥09-11 再看。

## 6. 事实 / 推断 / 未验证
- 事实：校验链每日执行成功；备份与活跃库 5 表逐一相等；WAL 114 MB / 活帧 3.6 MB / limit=-1；TRUNCATE 后 0 B；R431 与 R435 两次部署 pip 层重跑并下载 pypdf 6.17.0；钉版后容器 freeze 与清单 diff 为空。
- 推断：pip 层缓存被挤出的原因是同机多产品 build 共用 buildkit 缓存（`builder du` 可回收 2.19 GB 是佐证，没有 buildkit GC 日志直接证明哪次驱逐）。
- 未验证：`journal_size_limit` 在生产下一次「大写入 → checkpoint → 重置」周期的实际截断（现在 WAL 16 KB，无大写入可观测；单测已复现机理）；pypdf 6.16.2 → 6.17.0 对 PDF 导出的行为差异未逐项比（27 测试过、生产 `/api/export/pdf` 404 于不存在 uid 是预期）。
- 登记：升级依赖走「改 requirements.txt → 本地 pytest → 部署」；`deploy/README.md` 新增节。
