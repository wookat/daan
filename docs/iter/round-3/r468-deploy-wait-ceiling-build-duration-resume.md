# R468 · `deploy_h5.sh` 600 s 轮询上限 vs 历次 compose build 时长分布（宿主日志只读）→ 上限可配 + 超时明示 4a–6 未跑 + `DEPLOY_RESUME=1` 续跑 → 本轮部署即在 27.5 min 构建上一手验证两条新路径

R467 两次 `deploy_h5.sh --skip-build` 都撞 600 s 轮询上限被判 FAIL 退出而 compose 仍在后台跑，脚本中止 = 4c Pages / 5 bundle 校验 / 6 回归全没跑，线上出现「后端新、`/` 旧 bundle」半发版 ~4 min（手工补 4c 才切齐）。R467 留题：600 s 该不该改？**先核历次 build 时长分布再定，不拍脑袋改。**
本轮：只读宿主 `/tmp/kg-compose-*.log` 19 次有 `KG_COMPOSE_EXIT` 的构建 + R467 两次 → 定最小修（**默认 600 不动**，只加可配上限 + 超时分支明示后果与续跑口令 + `DEPLOY_RESUME=1` 只跑 4a–6）→ `bash -n` + `DEPLOY_RESUME=1` 负路径实跑（rev 闸拒绝）→ 部署 `a49b52c → aa29e52`（脚本自身改动，后端/前端产品代码 0 行、无 DB 写入）——**本次构建 1650 s 又超了 `DEPLOY_WAIT_SECS=1500`**，超时分支与 `DEPLOY_RESUME=1` 正路径都在真实故障态下走通。同一分支 PR #619（base=main，仍 open 待人工 Merge）。

## 1. 结论先行

1. **600 s 不是拍脑袋值，也不该改默认**：宿主 19 次有完整退出记录的构建（09-06 13:47Z 起，`KG_COMPOSE_EXIT` 行才存在——R431 之后）时长 **min 20 / p50 82 / p90 99 / max 149 s**（§2 表）；两次 20–21 s 是层全命中的重启型构建。R467 的 996 s（rc=1）/ 1017 s（rc=0）与本轮 **1650 s**（rc=0）是**分布外 6.7–11×** 的离群点，三次共同点：**镜像层缓存全失**（`#8 apt-get` 从头 69–178 s、`#10 pip` 205–313 s）+ **宿主 load 10–25、mem_avail <400 MB、盘 92–96%**。600 s 覆盖 19/19 常态且给了 4× 余量；把默认抬到 1500/1800 只会让常态失败（rc≠0 立即 FAIL 的路径不受影响，但 compose 挂死的场景要多等 15–30 min 才报）。→ **默认不动，上限可配 `DEPLOY_WAIT_SECS`**。
2. **真缺口不在上限，在超时后的两件事**（R467 一手 + 本轮复现）：(a) 脚本 FAIL 退出但 compose 在 `setsid` 后台继续跑，旧容器 healthy 对外——脚本原提示只有一行 FAIL，没说「compose 还活着、别重跑」；R467 第 2 次就是在第 1 次还没退出时重跑的（幸而第 1 次 rc=1 先死，否则两个 `compose up --build` 同时跑）。(b) 超时退出 = 4a–6 全没跑，没有任何提示说 Pages 静态层没发、回归没跑；R467 靶向补救靠人记住脚本步骤。→ **超时分支打印四行**：compose 仍在跑/别重跑；`tail -1 $COMPOSE_LOG` 看退出行；收敛后 `DEPLOY_RESUME=1 $0 --skip-build` 续跑 4a–6（否则半发版）；rc≠0 才是真失败。
3. **`DEPLOY_RESUME=1`**：跳过 2b–4（不 rsync、不重建），直接跑 4a–6。4a 的 rev 闸不放松——线上 `/api/health rev` ≠ 本机 HEAD 就 FAIL exit 1，所以「容器还没换过来就续跑」被拒（§3 负路径一手：线上 `a49b52c` vs 本机 `b28b832` → FAIL）。4a2 部署审计行也在续跑里写（R467 手工补 4c 没写 `deploy-history.log`，`a49b52c` 在审计档里**是缺行的**，本轮 `aa29e52` 有）。
4. **本轮部署本身 = 两条新路径的真实验证**（§3）：`DEPLOY_WAIT_SECS=1500 ./deploy/deploy_h5.sh --skip-build` 01:08:58Z 起 compose → 1500 s 到，超时分支按新文案退出（宿主 `mem_avail=366MB disk 3.0G(94%) load=12.19`）→ 按提示 `tail -1` 等到 `KG_COMPOSE_EXIT rc=0 at 01:36:28Z`（**1650 s**）、容器 01:36:26Z healthy、`/api/health rev=aa29e52` → `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` 01:37:18Z 起：4a 通过 → 4a2 审计行 → 4b 预热 → 4c Pages → 5/5b 七种 `Accept-Encoding` 全 `application/javascript` → 6 回归 7/7 200 → 6b perf 一次全 OK（`/` 0.93 / LCP 2744 / CLS 0.06；`/tiku/` 1.00 / LCP 959）→ rc=0。bundle 仍 `index-D6cTFb18.js`（前端未动），所以本次**没有**半发版窗口。
5. **R467 勘误（如实认错）**：R467 两次 FAIL 现场的 `other_builds=2` 不是「另有 2 个 build」——`host_probe.sh` 的 `pgrep -fc '[d]ocker compose .*(build|up)'` 把本次部署自己的 `bash -c 'docker compose up …'` 包装壳 + `docker compose` CLI 两个进程都算进去，且不计 `builder prune`。本轮超时现场同样 `other_builds=2`，残留进程列表就是 707409（bash -c）/ 707411（docker compose）两条自身进程。R467 文档 §1.5 / §2b 已加勘误指针。**登记不改**：4-pre 让行时自身 compose 还没起（读数 0 正确），只是 FAIL 现场读数要减 2 看。
6. **本轮 27.5 min 的构成与归因边界**：`#3 load metadata for python:3.12-slim` **236 s**（注册表元数据、常态 <2 s）、`#5 FROM` 拉基础镜像 62 s（**层缓存又全失**：00:48Z 刚建好的层 01:09Z 就不在）、`#6 load build context` 330 s（48.7 MB 上下文传了 5.5 min）、`#8 apt` 69 s、`#10 pip` 205 s、`#16 exporting` 230 s。宿主同期 load 10–14、`kswapd0` 常驻、recruit celery/postgres 并行 SELECT、`docker system df`/`docker exec` 多次 >120 s 无响应。**层缓存为何再丢未坐实**：00:40–01:10Z `docker events` 无 prune/delete/untag 事件（0 行）、`daemon.json` 无 builder GC 配置、cron 的 `builder prune -af` 在 20:20Z 不在窗口、bash history 无新 prune 行 → BuildKit 默认 GC（keep-storage 触发）或别的会话用非 shell 记录的方式 prune 都只能是推断。**R469 勘误**：本项只核了 cron 每日任务，漏了同一 cron 文件第二行 `*/15` 的 `recruit-disk-guard.sh`（盘 ≥80% 即 `docker builder prune -f --keep-storage 1GB`，09-06 全天 96/96 槽位都跑）；01:15 / 01:30Z 两次各跑 5 m 05 / 3 m 23 落在本轮构建之中，层缓存丢失的机制已坐实（见 `r469-buildkit-cache-loss-recruit-disk-guard-prune-cron.md`）。
7. **到期项**：`answer_log probe=0` 33/1、`growth_events probe=0` 20/4、`error_reason` 7 / **≥09-11 0**（严格 `WHERE probe=0` 口径不变）；容器 healthy restarts=0；WAL 仍 **4,124,152 B**（R466 高水位复用结论维持）；`push_subs / weekly_reports / quick_check` 本轮 **未取到**——dockerd 在 load 14 下两次 `docker exec` 120 s 无响应，不编数（R467 值 0 / 2 / ok）。(c) R467 容器起（00:48:06Z）后 origin **225 请求**：`/assets/*` 404 **0**、`/api/monitor/report` **0**、小程序 UA 0、非 2xx 只有 `/api/health` 403 ×4（本机无边缘头直连、预期）+ `304 /sw.js` ×2 + `403 /` ×1 + `304 /robots.txt` ×1。

## 2. 历次 compose build 时长（宿主 `/tmp/kg-compose-<rev>-<utc>.log`，只读）

`KG_COMPOSE_EXIT rc=… at …` 行减文件名里的起始时刻；无该行的日志（R431 前 / 被覆盖）不计。

| 起始 (UTC) | rev | rc | 时长 s | 备注 |
|---|---|---|---|---|
| 09-06 13:47 | — | 0 | 84 | 首条有退出行 |
| 09-06 | … | 0 | 139 / 78 / 78 / 72 / 71 / 149 / 99 / 82 / 76 / 89 / 85 / 83 / 81 | 全层重建常态 71–149 |
| 09-06 | … | 0 | 21 / 20 | 层全命中（只换 COPY 层） |
| 09-06 | … | 0 | 92 / 92 / 79 | |
| 09-07 00:10:51 | a49b52c | **1** | **996** | R467 第 1 次：pip 层 `exit 4294967295`，同机 `builder prune` 并发、mem_avail 98 MB、load 25 |
| 09-07 00:31:10 | a49b52c | 0 | **1017** | R467 第 2 次：`#10 pip` 313.5 s、`#16` 128.7 s |
| 09-07 01:08:58 | aa29e52 | 0 | **1650** | 本轮：`#3` 236 / `#6` 330 / `#10` 205 / `#16` 230 s，load 10–14 |

19 次常态：n=19，min 20，p50 82，p90 99，max 149，mean 82.6；剔除 2 次层命中后 17 次 p50 83 / max 149。三次离群 996 / 1017 / 1650 = max 的 6.7 / 6.8 / 11.1×。

## 3. 脚本改动与一手验证

改动只在 `deploy/deploy_h5.sh`（`aa29e52`）：
- 头注释加 `DEPLOY_WAIT_SECS=N`（默认 600）与 `DEPLOY_RESUME=1` 两个开关说明。
- `if [[ "${DEPLOY_RESUME:-}" == "1" ]]; then step "2b–4 跳过…"; else <原 2b–4 原样> fi`，4a–6 不在分支内、始终执行。
- `DEADLINE=$((SECONDS + 600))` → `WAIT_SECS="${DEPLOY_WAIT_SECS:-600}"; DEADLINE=$((SECONDS + WAIT_SECS))`。
- 超时 FAIL 分支由 1 行改为 1 + 4 行（compose 仍在跑/别重跑；`tail -1` 看退出；`DEPLOY_RESUME=1` 续跑；rc≠0 才是真失败、可 `DEPLOY_WAIT_SECS=1500` 重跑）。rc≠0 分支、宿主快照/残留进程/内核 OOM 段不动。

验证：
- `bash -n deploy/deploy_h5.sh` 通过；`shellcheck` 本机无、未跑。
- **负路径**：`DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build`（部署前，线上 `a49b52c` / 本机 `b28b832`）→ 1 / 1b / 2 / 「2b–4 跳过」/ 4a `FAIL: 线上后端 rev (a49b52c) != 本机 (b28b832)` exit 1，未碰 4c。
- **超时分支**：`DEPLOY_WAIT_SECS=1500` 正常部署 → 1500 s 到，新四行文案 + 宿主快照 `mem_avail=366MB disk_avail=3.0G(94%) load=12.19 other_builds=2`（自身两进程）+ `kernel: no OOM in last 20 min`，rc=1。此时 compose 已到 `#16 exporting`。
- **正路径**：按文案 `tail -1` → `KG_COMPOSE_EXIT rc=0 at 01:36:28Z`；`DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` rc=0（§1.4）。`deploy-history.log` 尾行 `2026-09-07T01:37:22Z rev=aa29e52 bundle=index-D6cTFb18.js by=devin-box`。
- 切换窗口：01:35:56Z 日志 `Container deploy-kaogong-1 Recreate` → 01:36:26Z 新容器起（R457 同形态 5.5 s 级不可达窗口未逐秒拉，本轮不重复）。

## 4. 登记（不改）

- `host_probe.sh` 的 `other_builds` 在 FAIL 现场含自身 2 进程（§1.5）；改正则要区分 PID 谱系，收益只是读数好看，登记。
- 三次离群构建都伴随层缓存全失 + 宿主高负载；层缓存为何在 00:48→01:09Z 丢失未坐实（§1.6）——**R469 已坐实为同机 15 分钟磁盘守护 cron 的 `--keep-storage 1GB`**。`--skip-build` 只跳过本机 H5 构建，远端镜像仍 `--build`；「远端也跳过镜像重建、只换 COPY 层」不是 Dockerfile 现结构能做的，不动。
- 本机无 `brotli`，1b 每次 WARN 跳过、线上 `.br` 由 Caddy gzip 回退（5b 七种编码校验全过，非本轮新事）。
- `push_subs / weekly_reports / quick_check` 本轮未取到（dockerd 无响应），下轮补。
- 宿主盘 **94% / 3.0 G**（构建瞬时）/ 93% / 3.6 G（构建后），load 10–14、`kswapd0` 常驻——本轮 27.5 min 构建就是在这个水位上完成的；扩盘/迁出 recruit·softcopyright 仍待老板定。`www.zalize.com` 证书 10-04 到期仍待定。

## 5. 如实说明

- 时长表 19 次的 rev 未逐条列（文件名含 rev，脚本只取时长），「层全命中 = 20/21 s」按 step 数与时长推断。
- 「600 s 覆盖常态」以有退出行的 19 次为样本（09-06 13:47Z 后）；更早部署无退出行不可考。
- 1650 s 归因（注册表元数据慢 / 上下文传输慢 / 宿主 IO 压）是构建日志各 step 时长 + 同期 `uptime`/`free`/`ps` 的相关性，不是受控对照。
- 本轮 (c) 样本 225 请求里 49 条带 `X-Kg-Probe` 头（部署脚本自身预热/回归），非外部使用。
- 无 testing agent 录屏（未另行授权）；生产量测为 curl/ssh 只读 + 脚本自身回归。
