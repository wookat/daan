# R456：容器重启时 SQLite 连接不走关闭路径——WAL 不在停机时 checkpoint（本地复现 + 生产旁证）+ 探针出口 /24 复核（只取证登记，不改码不部署）

- 生产应用仍 `460120f`；取证 2026-09-06 20:55–21:05Z。
- 结论一句话：R455 的推断成立——uvicorn 收到 SIGTERM 走的是**正常优雅关闭**（`Shutting down → Finished server process`），但应用的 SQLite 连接是线程本地、从不显式 `close()`，解释器退出时其它线程的连接不被析构 → 没有 checkpoint-on-close，`-wal`/`-shm` 原样留给下一进程接续。SQLite 正常恢复路径、`synchronous` 默认 FULL 已提交帧都已落盘，**无数据风险**；唯一影响是 WAL 高水位跨重启保留。登记 P4 不动手。

## 1. 生产旁证（只读）

| 项 | 值 |
|---|---|
| 容器 `deploy-kaogong-1` | Created/Started 2026-09-06 19:41:40Z（= R450 部署 `compose up` 重建），RestartCount 0，healthy |
| PID 1 | `python3.12 /usr/local/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 130`（exec 形式 CMD，信号直达 uvicorn） |
| 容器内进程数 | 4（uvicorn + 探针 exec） |
| 主库 mtime | 15:05Z（早于容器启动 4.6 h）；`-wal` 768 帧 `ckpt_seq 0`（R455） |
| 前一容器日志 | `app_log_snapshot.sh` 在**停容器之前**归档，因此归档里看不到 `Shutting down` 行——停机形态无法从生产日志直接证，转本地复现 |
| `docker events --since 36h` | 对 kaogong 容器返回空（daemon 事件缓冲不覆盖，未深究） |

## 2. 本地复现（同源码、同 uvicorn 启动方式）

```
DB_PATH=/tmp/r456/t.db KG_BOOT_QUIET_S=0 python3 -m uvicorn app.main:app --port 8456
→ 30 次 POST /api/track 写入 → 记录 -wal → kill -TERM → wait
```

| 时点 | `t.db` | `t.db-wal` | `t.db-shm` |
|---|---|---|---|
| SIGTERM 前 | 19,296,256 B 21:01:39 | 16,492,392 B（4003 帧，`ckpt_seq 1`）21:01:39 | 32,768 B |
| SIGTERM 后（进程已退出） | **同字节同 mtime** | **同字节同 mtime，未删除** | 未删除 |

uvicorn 日志尾：`Shutting down / Waiting for application shutdown / Application shutdown complete / Finished server process [pid]`；shell 记 exit=143。
→ 优雅关闭发生了，但没有任何 checkpoint（主库 mtime 不变、WAL 不删）。

机理（源码一手 + Python/SQLite 已知行为）：
- `backend/app/db.py` `get_conn()` 把连接挂在 `threading.local()`，`main.py`/`db.py` 里的 `conn.close()` 全是脚本式一次性连接（初始化、预热、导入），请求线程与 3 个 daemon 线程（`_warmup`/`_stats_refresher`/`_fts_backfiller`）的线程本地连接从未 close。
- 应用无 lifespan/shutdown 钩子、无 `atexit`；Python 解释器终结时不会析构其它线程 TLS 里的对象，`sqlite3_close` 不被调用 → SQLite 的 checkpoint-on-last-close 不触发。
- 下一进程首次打开时按 WAL 头/帧 salt 恢复（R455 已见 768/768 有效帧、最后 commit 帧 = 768），继续追加。

## 3. 要不要修

- 收益：仅「重启后 WAL 回到 0/被截回」；线上 WAL 3.16 MB、上限 64 MiB，备份走 `.backup` API 读穿 WAL（R435），日常无任何可见影响。
- 成本/风险：加 FastAPI shutdown 钩子做 `wal_checkpoint(TRUNCATE)` 需要在停机 10 s（compose 默认 stop timeout）窗口内完成，且有读者在跑会 busy；多一条停机路径 = 多一个部署期故障点，无问题不动。
- 决定：**登记 P4 不动手**；handoff/SKILL 记「WAL 跨重启保留是既定形态，不是异常」。

## 4. R452 探针出口 /24 复核（origin 24 h）

- `140.232.64.0/24` 内出口：`.2` 469 / `.3` 1172 / `.4` 7473 / `.5` 2030 请求（`.3` 即 R451 兄弟会话出口，`.5` 新增出口仍在网段内）。
- 网段外、UA 含 HeadlessChrome/Playwright/Devin 且无 `X-Kg-Probe` 头：`40.77.179.146` ×2、`199.30.25.247` ×1（Windows Chrome 描述符，均为微软/Bing 网段的渲染抓取，属引擎侧，`BOT`/引擎口径已覆盖）、`34.44.11.77` ×1（R454 pages.dev 扫描器）。
- → **Devin 出口未离开 /24，无 probe=0 污染风险变化**。

## 5. 到期项

沿用 R455 20:55Z 快照（probe=0 22/1、error_reason 6、push_subs 0、weekly_reports 1、growth probe=0 18/4、healthy 0 重启），本轮无变化；无前端发版 (c) 无新窗口。

## 6. 如实说明

- 本地复现用的是仓库 HEAD 源码 + 本机 Python 3.12/uvicorn，与生产镜像版本可能有小差异；机制（线程本地连接不 close）与版本无关。
- 「Python 解释器不析构其它线程 TLS 对象」引用 CPython 已知行为，未翻源码；复现结果（WAL 原样保留）是直接观测。
- `40.77.*`/`199.30.*` 归微软/Bing 是按公开网段常识，本轮未查 ASN。
- 生产停机窗口是否触发 10 s SIGKILL 未验（前一容器日志已随重建删除、events 为空）；本地 SIGTERM 到退出 < 1 s。
