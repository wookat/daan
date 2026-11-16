# R469 取证：层缓存「再丢」根因 = 同机磁盘守护 cron 每 15 min `builder prune --keep-storage 1GB`；R468 三项到期项绕 `docker exec` 补齐；4-pre 让行加 prune（生产未部署，脚本层改动）

日期：2026-09-07 01:40–02:25Z。取证方式：宿主 ssh 只读（`sudo` 读 cron / 守护脚本 / 守护日志 / rsyslog / compose 日志 / `ps` 谱系；SQLite 走卷挂载点 `mode=ro`），
边缘/源站 caddy 日志只读。**产品代码 0 行、后端不动、无 DB 写入**；改动只在 `deploy/host_probe.sh` + `deploy/deploy_h5.sh` 4-pre（本机运行的部署脚本，不需要发版即生效）。

## 1. 结论

1. **R468 §1.6「层缓存 00:48Z 建好 01:09Z 就不在，原因未坐实」——坐实了，且不是 BuildKit 默认 GC、不是「兄弟会话手工 prune」**：
   宿主 `/etc/cron.d/recruit-disk-maintenance` 装了 recruit_app 的 **`/usr/local/bin/recruit-disk-guard.sh`，每 15 分钟（`*/15`）以 root 跑一次**，
   根盘 **≥80% 即执行** `docker image prune -f` + **`docker builder prune -f --keep-storage 1GB`**（≥88% 再多一档快照清理 + `docker rmi softcopyright:prod-b*` 只留 2 个）。
   宿主 09-06 全天 96/96 个 15 分钟槽位全部触发（盘全天 87–96%），累计 617 次。→ **整机 BuildKit 缓存上限 1 GB、每 15 分钟强制执行一次**，
   由 recruit / softcopyright（其脚本自注「单次构建 1.28 GB」）/ kaogong 三产品共享；只要别家在两次 kaogong 部署之间构建过，LRU 先清的就是本家层 → 下一次 kaogong 构建 apt/pip 从头（R467 ×2、R468 三次离群都是这个形态）。
   **事实层**：脚本内容、cron 表、守护日志逐次时间戳、`ps` 谱系（`cron → /bin/sh -c recruit-disk-guard.sh → bash → docker builder prune -f --keep-storage 1GB → docker-buildx prune`）四路一手；
   **推断层**：「本家层被这次 prune 清掉」——`docker buildx du` 在负载下两次 >120 s 取不到逐层 LastUsed，靠「上限 1 GB < 单次 sco 构建」+ 三次离群都在别家构建之后 推断。
2. **R467 / R468 归因勘误（如实认错）**：R467 §2b 00:22:05 看到的 `docker builder prune -f --keep-storage 1GB`（PID 653735）被写成「兄弟会话手工 ssh」——**是 root cron 的守护脚本**，
   00:15:02Z 那次因盘 96% + 高负载**跑了 15 min 39 s（08:15:02→08:30:40 CST）**，完整盖住 R467 第 1 次构建的 pip 层（00:17–00:27Z，`exit 4294967295`）；
   R468 §1.6 列的排除项「cron 的 `builder prune -af` 在 20:20Z 不在窗口」只看了每日 `recruit-disk-maintenance.sh`（20:10Z），漏了同一 cron 文件第二行的 15 分钟守护。两文档已加勘误指针。
3. **守护 prune 的耗时随负载放大，是 dockerd 卡死的直接来源之一**：09-06 21:15–00:00Z 每次 4–17 s；00:15Z 起 15m39s / 40s / 1m54 / 1m55 / **5m05 / 3m23 / 5m31 / 8m25**（01:15–02:08Z）、02:15Z 那次取证时已跑 >2 min。
   R468 三次 `docker exec` / `docker system df` / `docker buildx du` 120 s 无响应里，02:00–02:08Z 两次落在 8m25 那次 prune 里（01:54–01:56Z 那次不在，是并发 build 本身）。
   R468 本轮构建 01:09–01:36Z 与 01:15 / 01:30 两次 prune（合计 8.5 min）重叠。
4. **处置**：
   - **仓库内最小修（本轮已做，未发版——部署脚本在本机跑，下次部署即生效）**：`host_probe.sh` 多打一项 `prunes=`（`docker builder/image/system prune` / `docker rmi` 进程数），
     `deploy_h5.sh` 4-pre 让行条件从「别家 build」扩成「别家 build 或 prune 在跑」，上限仍 300 s、超时只 WARN 不阻塞；`host_probe.sh` 头注顺带写明 `other_builds` 在本家 compose 起来后会把自己数进去（R468 勘误落到源码）。
     实跑：对生产宿主 45 s 上限跑同一段循环 → `other_builds=2 prunes=1` 连续 WAIT 3 次后 WARN 退出；`probe-failed` 路径 BUSY=0 直接放行（与原行为一致）。`bash -n` 两文件通过。
   - **宿主级请老板定（不在本仓库权限内，不动别家脚本）**：`recruit-disk-guard.sh` 的 `--keep-storage 1GB` 是三产品共享的整机上限，且盘常年 ≥80% 等于**每 15 分钟无条件跑一次**；
     可选：① 上限抬到 ≥3 GB 或只在 ≥90% 才 prune builder；② 有 `docker compose build` 在跑时跳过 builder prune；③ 扩盘（R454 起第六次提）。任一项都比 kaogong 侧让行更根本——让行只能避开「起点撞上 prune」，避不开 17–28 min 构建中途被 prune。
5. **R468 三项未取到的到期项（绕 `docker exec`，宿主直接读卷 `file:…/data.db?mode=ro`）**：`push_subs=0`、`weekly_reports=2`（与 R467 相同，无增量）、`PRAGMA quick_check` **rc=0，耗时 201 s**（负载 22 下；输出经 `head` 管道未回显，以退出码 + 无错误行为准）。
   `mistakes.error_reason` 非空 7 / **≥09-11 0**（首版脚本把列写到 `answer_log` 上报 `no such column`，纠正后重跑）。`answer_log` `probe=0` 33/1、`growth_events` 20/4 与 R468 同。
6. **R468 发版后 (c)**：容器 01:36:26Z 起至 02:22Z 源站 47 请求：`/assets/*` 404 **0**、`/api/monitor/report` **0**、小程序 UA 0、探针头 12；非 2xx 只有 `/api/health` 403 ×2（无边缘头直连探针）+ `/sw.js` 304。
   首版脚本 epoch 常量写成 2025 年（1757208986）把全量 14303 行都算进去，纠正为 1788744986 后重跑。

## 2. 一手证据

### 2a. cron 与守护脚本（宿主，`sudo cat`）

```
# /etc/cron.d/recruit-disk-maintenance
10 20 * * * root /usr/local/bin/recruit-disk-maintenance.sh >> /var/log/recruit-disk-maintenance.log 2>&1
*/15 * * * * root /usr/local/bin/recruit-disk-guard.sh      >> /var/log/recruit-disk-maintenance.log 2>&1

# /usr/local/bin/recruit-disk-guard.sh（Aug 14 09:15 安装版；与 /opt/recruit_app/scripts/setup-disk-maintenance.sh 仓库版不同——仓库版是 2GB）
USE=$(df --output=pcent / | tail -1 | tr -dc '0-9'); [ "${USE:-0}" -lt 80 ] && exit 0
… (≥88% 二级档：快照只留 2 份、logger "guard high-water tier ran")
docker image prune -f >/dev/null 2>&1
docker builder prune -f --keep-storage 1GB >/dev/null 2>&1
docker images … softcopyright:prod-b* … head -n -2 | xargs -r docker rmi
find /var/lib/docker/containers -name "*-json.log" -size +200M … truncate -s 0
… logger -t recruit-disk "guard ran at ${USE}%"
```

每日脚本 `recruit-disk-maintenance.sh`（20:10Z）：`docker system prune -af --filter until=72h` + `docker builder prune -f --keep-storage 2GB`（R468 只核了这条，在窗口外——结论对、但没覆盖 15 分钟守护）。
softcopyright `/opt/SoftCopyrightAgent/scripts/deploy.sh` 每次部署 `docker builder prune -f --filter until=168h` + `image prune until=168h`（`until` 按创建时间，对 7 天前拉的基础层同样生效——未逐次核对其部署时刻，只登记）。

### 2b. 守护每次 prune 段耗时（rsyslog `recruit-disk:` 两行相减；CST 时间戳，UTC = −8h）

| 触发（CST） | 盘 | `high-water tier ran` → `ran` | 耗时 | 同期 kaogong |
|---|---|---|---|---|
| 05:15–08:00 每 15 min（21:15–00:00Z） | 90–96% | 4–17 s | 常态 | 19 次常态 build 都在这段之前/之中（R468 §2） |
| **08:15:02**（00:15Z） | **96%** | → 08:30:40 | **15 m 39 s** | **R467 第 1 次 build 00:10:51–00:27:27Z，pip 层 exit 4294967295** |
| 08:30:02（00:30Z） | 91% | → 08:31:10 | 40 s（与上次尾部重叠） | R467 第 2 次 build 00:31:10Z 起 |
| 08:45:04 / 09:00:04 | 93 / 92% | → 08:46:58 / 09:01:59 | 1 m 54 / 1 m 55 | R467 第 2 次 build 至 00:48Z |
| **09:15:01 / 09:30:03**（01:15 / 01:30Z） | 92 / 93% | → 09:20:07 / 09:33:26 | **5 m 05 / 3 m 23** | **R468 build 01:09–01:36Z 之中** |
| 09:45:03（01:45Z） | 94% | → 09:50:34 | 5 m 31 | 盘 94→88%（−3 GB，推断 `rmi softcopyright:prod-b*`） |
| 10:00:02（02:00Z） | 87% | → 10:08:27 | **8 m 25** | R469 `docker exec`/`system df`/`buildx du` 02:00–02:08Z 全部 >120 s |
| 10:15:04（02:15Z） | 88% | 取证时 `etimes=101` 仍在 | >2 min | `host_probe.sh` 实跑读到 `prunes=1` |

守护日志 `/var/log/recruit-disk-maintenance.log`：09-06 `guard triggered` 96 次（= 全部槽位）、累计 617 次；00:15Z 那次没有 `after guard` 行（15 min 后 00:30Z 那次先写完，两行 `after guard: 91%` 连在一起）。

### 2c. `ps` 谱系（02:17:04Z）

```
777415  777403  122  /bin/sh -c /usr/local/bin/recruit-disk-guard.sh >> /var/log/recruit-disk-maintenance.log 2>&1
777420  777415  122  bash /usr/local/bin/recruit-disk-guard.sh
777569  777420  101  docker builder prune -f --keep-storage 1GB
777607  777569   94  /usr/libexec/docker/cli-plugins/docker-buildx buildx prune -f --keep-storage 1GB
```

02:05Z 同机还有 `docker compose -f docker-compose.prod.yml build app`（recruit）+ `docker compose … up -d --build`（softcopyright）两条 `docker buildx bake` 并发；`/var/lib/docker/buildkit` 1.1 G。

### 2d. R467 第 1 次构建日志（`/tmp/kg-compose-a49b52c-20260907T001051Z.log`，mtime 00:27:27Z）

`#7 40.4 s → #5 FROM 113.3 s → #8 apt 178.5 s → #9 19.0 s → #10 pip ERROR exit code: 4294967295 → KG_COMPOSE_EXIT rc=1 at 00:27:27Z`：
pip 层起点 ≈ 00:10:51 + 6 min ≈ 00:17Z，全程在守护 00:15:02–00:30:40Z 那次 prune 之内。

### 2e. 到期项（宿主直读卷，`sqlite3 "file:$VOL/data.db?mode=ro"`）

```
push_subs|0        weekly_reports|2
error_reason_nonempty|7   error_reason_ge0911|0        （mistakes 表；首版误查 answer_log → no such column）
quick_check: rc=0 took=201s
data.db 449,310,720 B  data.db-wal 4,124,152 B（R466 起同字节，高水位复用）
```

### 2f. (c) 源站 01:36:26Z→02:22Z

`requests=47 assets404=0 monitor=0 miniapp_ua=0 probe_hdr=12`；非 2xx：`(403,'/api/health')×2`、`(304,'/sw.js')×1`。

## 3. 改动

- `deploy/host_probe.sh`：末尾多打 `prunes=N`（`pgrep -fc '[d]ocker (builder|image|system) prune|[d]ocker rmi '`）；头注写明 `other_builds` 在本家 compose 起来后含自身 2 进程。
- `deploy/deploy_h5.sh` 4-pre：`BUSY = other_builds + prunes`，非 0 即 WAIT（15 s 一看、最多 300 s、超时 WARN 不阻塞）；`probe-failed` 时两项为空 → BUSY=0 放行（原行为）。
- `deploy/README.md` 4-pre 一行加 `prunes`。
- 门：`bash -n` ×2 通过；`shellcheck` 本机无未跑。**未发版**：这两个脚本只在本机执行，下次任何一次部署自然走到新 4-pre；本轮不为验证一个让行循环在 load 20 / 2 个别家 build / prune 并发的宿主上再压一次 17–28 min 构建。

## 4. 未验证 / 边界

- 「本家层被守护 prune 清掉」是机制 + 时序推断，未拿到 `buildx du` 逐层 `LastUsedAt`；BuildKit `--keep-storage` 的逐层淘汰顺序按官方文档为 LRU-ish，本轮未翻源码。
- 守护 prune 段耗时用 rsyslog 两条 `logger` 行相减，`docker image prune` 与 `docker rmi` 也在这段里，未拆分到 `builder prune` 单项。
- 4-pre 让行只覆盖「起点撞上 prune」；构建中途每 15 min 一次的 prune 让不掉，宿主级修改在 recruit_app 仓库 / 老板权限。
- softcopyright 每次部署的 `until=168h` prune 未逐次核对与 kaogong 构建的时序，只登记。
- `quick_check` 输出经管道未回显，以 rc=0 + 无 `Error` 行判 ok。
