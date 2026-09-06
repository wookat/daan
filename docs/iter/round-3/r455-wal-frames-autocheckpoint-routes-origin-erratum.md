# R455：WAL「只增不截」的机理一手核（768 帧 < 1000 帧自动 checkpoint 阈值）+ `_routes.json` 排除 `/` 的出处勘误 + 到期项（只取证登记，不改码不部署）

- 生产应用仍 `460120f`；取证 2026-09-06 20:55Z；DB 只读 `file:/data/data.db?mode=ro`，WAL 文件按 SQLite WAL 格式直接解析头/帧（只读打开）。
- 结论一句话：R436 起挂着的「WAL 截断观测」**闭合**——WAL 3.16 MB = 768 个尚未 checkpoint 的 4 KB 帧，低于 `wal_autocheckpoint` 默认 1000 帧，所以还没发生 checkpoint、文件只增；到 1000 帧（≈4 MB）写连接会自动 checkpoint 并从头复用，文件大小停在高水位；只有超过 `journal_size_limit=64 MiB` 才会被截断。历轮 431 KB → 3.16 MB 是帧数 105 → 768 的正常累积，不是泄漏。

## 1. WAL 一手数据

| 项 | 值 | 来源 |
|---|---|---|
| `data.db` | 449,310,720 B（109,695 页 × 4096），mtime 09-06 15:05Z | `ls -l` / `pragma page_count,page_size` |
| `data.db-wal` | 3,164,192 B，mtime 09-06 20:26Z | `ls -l` |
| `data.db-shm` | 32,768 B | |
| WAL 头 | page 4096、`ckpt_seq 0`、salt 固定 | 直接解 32 B 头 |
| 帧 | 容量 768 = (3,164,192 − 32) / (4096 + 24)；**当前 salt 有效帧 768 / 768、最后 commit 帧 = 768** | 逐帧解 24 B 帧头对 salt |
| 最近写入 | `growth_events.max(created_at)` = 20:26:18Z，与 -wal mtime 一致 | 只读查询 |
| 写连接设置 | `journal_mode=WAL`、`journal_size_limit=64<<20`、`wal_autocheckpoint` 未设（默认 1000） | `backend/app/db.py` L47/L60–64；全仓库无显式 `wal_checkpoint` |

机理（SQLite 文档 + 上表）：
- 自动 checkpoint 只在**写事务提交后 WAL ≥ 1000 帧**时由该写连接触发（PASSIVE）；768 < 1000 → 尚未触发，文件只增是预期。
- checkpoint 成功且无读者占用 WAL 尾部时，下次写从帧 0 复用（`ckpt_seq`+1、salt 变），文件大小**不缩**，停在高水位；`journal_size_limit` 只在 checkpoint 后 WAL 文件 > 64 MiB 时截断。
- `ckpt_seq 0` + 主库 mtime 15:05Z 早于容器 19:41Z 启动 → 推断：上次 checkpoint 在 15:05Z；容器重启时进程未走 SQLite 连接关闭路径（线程本地连接不显式 close），WAL 跨重启被新进程直接接续（恢复正常、无损），因此帧从 15:05Z 起累计。R450 部署后写入（17:0xZ boot、20:26Z 最后写）都在这 768 帧内。

处置：到期项里「WAL 截断观测」改为固定口径——**只在 `-wal` > 64 MiB 且持续 > 1 天时立项**（说明有长读事务阻塞 checkpoint 复用）；否则不再逐轮记字节数。不加显式 checkpoint、不改 `wal_autocheckpoint`（无问题不动）。

## 2. 勘误：`_routes.json` 排除 `/`、`/index.html`、`/static/*` 的出处

R454 文档/handoff 把这一排除写成「R271 设计」。`git log -S` 一手：
- `3d28c33`「H5 迁 Cloudflare Pages（静态 CDN 直出 + Functions 同源代理回源）」首次创建 `_routes.json`，exclude = `/`、`/index.html`、`/assets/*`、`/static/*`、`/favicon.ico`；`deploy/README.md` 同提交写明「静态层由 Pages CDN 直出」。
- `eef6113`（#163）把 `/assets/*` 从 exclude 拿掉（收回函数）。
- R271 只是把 `/api/search` 页族纳入边缘缓存，与 `_routes.json` 无关；R273 设计文档明确「不动 `_routes.json`」。

已在 R454 文档与 handoff 改为「Pages 迁移原始设计 `3d28c33`」（`24cd26b`）。对 pages.dev 301 方案的含义不变：首页壳不经函数，函数内按 hostname 跳转覆盖不到 `/`，方案仍优先 CF 账户级 Bulk Redirects。

## 3. 到期项（只读，20:55Z）

| 项 | 值 | 说明 |
|---|---|---|
| `answer_log probe=0` | 22 / 1 uid | 不变 |
| `mistakes.error_reason` | 6 | 不变（≥09-11 再看 probe=0 关联） |
| `push_subs` / `weekly_reports` | 0 / 1 | 不变 |
| `growth_events probe=0` | 18 / 4 | 不变 |
| 容器 | healthy / 0 重启 | |
| `KG_PROBE_CIDRS` 仍配置；VPS 出口 `150.109.230.174` | 1 / 一致 | R452 口径：出口未变 |
| (c) 自然旧壳 404 | 无新前端发版 → 无新窗口 | 继续挂 |

## 4. 如实说明

- 「容器重启时进程未走连接关闭路径」是按 `ckpt_seq 0` + 主库 mtime 早于容器启动的推断，未查前一容器的退出信号；对数据无影响（WAL 恢复是 SQLite 正常路径）。
- 帧解析只核了 salt 一致与 commit 标记，未校验帧校验和（cumulative checksum）；有效帧 = 768/768 与文件大小整除一致，足以支撑「无 checkpoint 发生」。
- WAL 机理引用 SQLite 官方 WAL/PRAGMA 文档的既有知识，未翻 SQLite 源码。
