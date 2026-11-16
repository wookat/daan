# R431：R430b 首次重建中断取证 + deploy_h5.sh 第 4 步观测/并发加固

日期 2026-09-06（服务器 CST 21:xx）。涉及 `deploy/deploy_h5.sh`、新增 `deploy/host_probe.sh`、`deploy/README.md`。
仅部署脚本与文档，后端/前端不动，bundle 不变。上线 rev `ed9e69e` → `ce81242`（R431b）。

## 1. 起点

R430b 第一次 `deploy_h5.sh` 远端 `docker compose up -d --build` 在 `#15 exporting layers` 阶段进程消失，
600 s 轮询 `StartedAt`/rev 不收敛后 FAIL；当时 free 68 MB、同机 recruit-app / softcopyright 也在重建镜像，
R430 汇报写「疑 OOM 未证实」。本轮把「疑」落实为证据或否定，再看脚本缺什么。

## 2. 一手取证（宿主）

### 2.1 宿主体量与共用形态
- 2 vCPU / 1935 MB RAM / 5487 MB swap；`/` 91–94% 已用、可用 2.9–4.6 G 波动。
- `docker system df`：镜像 10（7.23 GB）、容器 15（活 13）、卷 12.12 GB、build cache 3.43 GB（可回收 174 MB）。
- 同一个 dockerd/buildkit 上跑 recruit-app、softcopyright、kaogong、共用 postgres/redis/autoheal 等。

### 2.2 dockerd 日志（`journalctl -u docker`，09-06 21:00 CST 前后）
```
/moby.buildkit.v1.Control/Solve error="rpc error: code = Canceled desc = context canceled"
failed to compute blob by overlay differ ... failed to write compressed diff ... failed to send write: context canceled
  ... .../cv2/cv2.abi3.so: failed to send write: context canceled
session healthcheck failed fatally: Unavailable: ... only one connection allowed
```
- `Control/Solve ... Canceled` + overlay differ `failed to send write: context canceled` = **buildkit 的 solve 被 client 侧
  取消**（导出层写到 cv2 的 .so 时上下文被撤），不是 buildkit/overlay 自身报错。
- `only one connection allowed` 在成功 build 收尾时同样出现 → 噪音，不能当原因。
- 21:02:20 同机另一产品的 build 也 `context canceled`。

### 2.3 内核 OOM：**否定**
`sudo -n journalctl -k`（本 boot 全周期）与 `dmesg` 均无 `Out of memory` / `oom-kill` / `Killed process`。
→ 「OOM」不成立；「free 很低」只是背景压力，不是杀手。

### 2.4 谁取消了 compose：不可考，但可缩小
- 本地 `r430b_deploy.log`：`compose-started` 之后**没有任何 ssh 报错**（`Timeout, server not responding` /
  `closed by remote host` 都会进 2>&1 的日志），随后 39 轮 `poll:`（≈ 8 min）到 21:08:38 FAIL。
- 旧启动写法 `cd X && nohup docker compose ... > log 2>&1 < /dev/null & echo compose-started` 的 `&` 作用于整个
  `cd && nohup` 列表：bash fork 子 shell 跑该列表并**等 compose 结束**，子 shell 的 stdout/stderr 仍是 ssh 管道，
  所以本地那条 ssh 直到 compose 进程消失才返回。本轮 R431 首次部署（还没改 `-f`）复现：launcher ssh 挂 ~90 s，
  远端 `ps` 看到子 shell（ppid=1、fd1/2→pipe）→ setsid bash → compose 三层。
- 由「ssh 无报错 + 返回时刻 ≈ dockerd cancel 时刻（21:00:08–23 CST）」推：**compose 进程先没了，才放开 ssh**，
  不是 ssh 掉线 → SIGHUP 牵连（且 nohup 已忽略 HUP）。compose 日志无 panic/错误尾行 → 外部信号（TERM/KILL）
  最可能；docker CLI 与 compose 插件间有插件 socket，CLI 进程消失即插件 context cancel，与 dockerd 侧
  「client 侧 cancel」形态吻合。谁发的信号无 auditd 不可考——**记为推断，不写成事实**。

## 3. 脚本缺口（源码核对旧第 4 步）
1. 后台 `nohup` 起 compose，**退出码丢失**——进程死了/被杀，脚本只能等 600 s 超时。
2. 单一 `/tmp/kg-compose.log`，下一次部署覆盖，事后无法对照。
3. 无宿主快照、不看别家 build 是否在跑（多产品同机互相挤是常态）。
4. FAIL 时不打现场（free/df/load/残留进程/内核 OOM），全靠人事后登录翻。
5. 启动写法让本地 ssh 被拖住整个 build（§2.4）。
- 旧容器保护：`docker compose up -d --build` 本身是 build 成功后才 recreate，build 失败旧容器不动（R430b 全程 healthy
  已证），这点不改。

## 4. 修（最小、可验证、不设未经论证的阈值）
- `deploy/host_probe.sh`：一行快照 `mem_avail=…MB disk_avail=…(…%) load=… other_builds=N`；
  `other_builds = pgrep -fc '[d]ocker compose .*(build|up)'`（`[d]` 防匹到自身；远端起一个假名进程
  `docker compose up -d --build` 实测计 1、无时 0）。
- 4-pre：打快照；`other_builds>0` 则 15 s 一看最多 300 s，超时只 WARN 不阻塞（不是分布式锁，只是让行）。
- compose 起法：`setsid -f nohup bash -c 'docker compose up -d --build; echo KG_COMPOSE_EXIT rc=$? at <utc>'
  > /tmp/kg-compose-<rev>-<utc>.log`，`/tmp/kg-compose.log` 改软链指向当次；`setsid -f` 总是 fork 立即返回，
  compose 自成会话。（R431 首版用 `setsid ... &` 仍是 && 列表后台化，launcher ssh 被拖 ~90 s；R431b 改 `-f`。）
- 轮询：每 10 s 一条 ssh 同时取 `StartedAt` 与日志末行；末行 `KG_COMPOSE_EXIT rc=N`——rc≠0 **立即 FAIL**，
  rc=0 再给 3 轮宽限等 rev 收敛；600 s 总上限不变。
- FAIL 现场：宿主快照 + `pgrep -af '[d]ocker compose'` + 日志尾 40 行 + `journalctl -k --since -20min` OOM 关键词。
- 不加内存阈值拦截：没有证据表明「free < X 就会失败」（本轮两次部署 free 313/383 MB 全成）。

## 5. 验证
- 本地：`bash -n` 通过（本机无 shellcheck）；`host_probe.sh` 本机/远端各跑一次输出格式正确。
- 生产部署 ①（rev `ed9e69e`，`--skip-build`）：`host: mem_avail=313MB disk_avail=4.6G(91%) load=0.40 other_builds=0`
  → `compose-started log=/tmp/kg-compose-ed9e69e-20260906T134752Z.log` → 首轮 `poll: started=…13:49:23 rev=ed9e69e
  compose_rc=0` 收敛，日志末行 `KG_COMPOSE_EXIT rc=0 at 13:49:24Z`；6/6 回归 200、6b 预算全过。
  launcher ssh 挂了 ~90 s（§2.4 复现）。
- 生产部署 ②（R431b rev `ce81242`）：`host: mem_avail=383MB disk_avail=3.1G(94%) load=2.72 other_builds=0`；
  launcher **立即返回**，第 1 轮 `poll` 看到旧 StartedAt（compose 仍在跑）、第 2 轮 `started=13:51:56 rev=ce81242
  compose_rc=0`；`KG_COMPOSE_EXIT rc=0 at 13:51:57Z`；整脚本 1m12s；6/6 200；6b `/` LCP 2785 一次 WARN
  （bundle 不变、宿主 load 2.7，同 R424/R427 形态），其余全过。
- 部署后：`/api/health {"ok":true,"rev":"ce81242"}`；容器 healthy、RestartCount 0；13:45Z 起容器日志 5xx 0、
  Traceback/locked 0；`/tmp/kg-compose*` 两份独立日志 + 软链正确；内核近 60 min OOM 0；free 354 MB、磁盘 94%/3.0 G。
- 不涉及 DB 写入，无测试数据需清理；无 UI 改动，不派 testing agent。

## 6. 如实说明 / 登记
- 「compose 被外部信号杀」是推断（§2.4），事实只到「client 侧 cancel、无内核 OOM、ssh 无报错且同刻返回」。
- `other_builds` 让行只是进程观测，不能防两个部署恰好同时起跑。
- 宿主磁盘 94%/3.0 G、多产品同机——扩盘/迁出 recruit·softcopyright 仍待老板决定；本轮只让失败可归因、不掩盖资源缺口。
