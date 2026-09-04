# R372 生产运行时：进程被整体换出 → 请求 25s 超时 → 假死重启循环（内存驻留加固）

## 生产证据（2026-09-04，VPS 实查：/proc、cgroup v2、Caddy 源站日志、容器生命周期日志）
- **真实用户在吃 5xx**：源站 /api 请求（已剔除 bot/probe/headless/测试 uid）9-03 6292 条中 5xx 648（10%），9-04 至 14:40 UTC 3940 条中 5xx 948（24%）；5xx 落在 `um*` 真实 uid 上（9-01 3 个、9-03 3 个、9-04 1 个），并非只有我们的测试流量。
- **5xx 形态**：Caddy `lb_try_duration 25s` 耗尽后回 503，请求耗时 25.2–26.0s；绝大多数 5xx **不在**容器重启窗口 ±4 min 内——上游进程活着，只是每个请求都要 25s+。
- **根因：kaogong 进程被整体换出到 swap**：容器内 `/proc/1/status` VmRSS 16 MB / **VmSwap 238 MB** / VmHWM 560 MB；cgroup `memory.stat` anon=13M、`memory.swap.current`=233M，`memory.swap.max=max`（允许无限换出）。宿主 1.9 GiB RAM，MemAvailable 286 MB，swap 已用 2.6 GiB；RAM 被 recruit-postgres 共享缓冲（271 MB file）+ 10 个 postgres 后端（各 60–200 MB RSS）+ dockerd（213 MB）占满，全部业务容器（recruit-app 545 MB、kaogong 233 MB、softcopyright 163 MB…）都在 swap 里。
- **每次请求 = 从 swap 回页**：VPS 磁盘 IO 下把 200+ MB 工作集换回需要数十秒；健康检查（`python -c urllib`，自身要新起 20 MB 解释器）同样 >25s → 5 次失败 → autoheal SIGKILL（exit 137、OOMKilled=false，与生命周期日志一致）→ 冷启动再次把全部页拉回 → 循环。9-01 起 `removing unhealthy` 事件 4/4/6/8 次/天，9-03 17:19–17:59 40 分钟内 8 次即重启循环。
- **kaogong 自身放大项（本地用生产库副本 data-2026-09-04.db 实测，smaps_rollup）**：
  - 启动即并发起 3 个后台线程：`_prime_admin_caches`（governance_scan 对 156k 题 `fetchall()`，anon 峰值 +100 MB、驻留 +35 MB）、`refresh_question_stats`、`fts_backfill`——冷启动瞬间 RSS 由 239 MB 冲到 642 MB（HWM 703 MB），正是宿主最缺内存、最容易再次触发换出/重启的时刻。
  - 每个线程本地 SQLite 连接 `cache_size=-32768`（32 MB 堆页缓存），uvicorn 线程池最多 40 个工作线程 → 理论上限 1.3 GB 匿名堆；生产 78 个 data.db fd（≈26 条连接）。而 `mmap_size=256 MB` < 库 419 MB，超出部分全部走堆缓存。
- 已三轮建议「给共宿 recruit 限资源」无反馈；本轮只做 kaogong 自己能做的部分。

## 方案（零功能变化、零新表/端点）
1. **compose：禁止 kaogong 被换出 + 硬上限**（`deploy/docker-compose.yml`）
   - `mem_limit: 768m` + `memswap_limit: 768m` → cgroup `memory.swap.max=0`，进程页固定在 RAM；`mem_reservation: 384m` → `memory.low`，宿主回收时优先保住 kaogong 工作集。
   - 若匿名内存真超 768 MB 会被 OOM kill（OOMKilled=true，生命周期日志可见）并由 `restart: unless-stopped` 秒级拉起，替代现在 5 分钟假死判定 + SIGKILL；上限按下文降后的峰值（≈300 MB）留 2.5 倍余量。
   - 代价：宿主压力转移到其余容器（它们本就在 swap）。在 SOP-04 中如实汇报。
2. **SQLite 连接内存收敛**（`backend/app/db.py` `get_conn`）：`cache_size` -32768 → -8192（每连接 8 MB），`mmap_size` 256 MB → 1 GiB（覆盖整库 419 MB + 增长，读全部走共享 file-backed 页，可回收、不可换出、跨连接共享）。
3. **冷启动去尖峰**（`backend/app/main.py`）：`_prime_admin_caches` 与 `refresh_question_stats/refresh_material_hash` 推迟到启动 `KG_BOOT_QUIET_S`（默认 600s）之后再跑；重启循环期间（间隔 <10 min）永不触发。抽题 id 池/每日一练/热表预热保持即时（<1 MB）。
4. **governance_scan 流式扫描**：`fetchall()` 156k 行改为游标迭代（已有 `len(broken)>=100` 提前 break），峰值 +100 MB → 近 0。

## 不做
- 不改健康检查阈值/探针（python -S socket 只省 9 MB/40 ms，非主因）；不改 Caddy `lb_try_duration`（宿主配置，非仓库管理）。
- 不给 kaogong 加 `oom_score_adj`（宿主级 OOM 时不与兄弟产品争先）。

## 验证
- backend：pytest 全量 + 新增 `test_runtime_memory.py`（get_conn pragma 值、boot-quiet 判定）；ruff；pyright 基线不新增。
- frontend：本轮零改动，仍跑 vitest/eslint/build:h5 作为回归门。
- 生产：部署后 `docker inspect` 看 `HostConfig.Memory/MemorySwap/MemoryReservation`，cgroup `memory.swap.max==0`、`memory.swap.current==0`、`memory.low`；`/proc/1/status` VmSwap=0；观察 ≥30 min 源站日志 5xx/耗时 >5s 比例与生命周期日志重启次数对比上文基线；1440/375 双视口首页/错题本/按卷练习冒烟。
