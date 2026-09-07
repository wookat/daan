#!/usr/bin/env bash
# 宿主一行快照（deploy_h5.sh 4-pre / FAIL 现场用，经 `ssh REMOTE bash -s < deploy/host_probe.sh` 执行）：
#   mem_avail=272MB disk_avail=4.5G(91%) load=0.93 other_builds=0 prunes=0
# other_builds = 宿主上正在跑的 docker compose build/up 进程数（[d]ocker 写法避免 pgrep 匹到自身；本家 compose 起来后会把自己的
#   bash -c 壳 + compose CLI 也数进去，所以只在 4-pre 本家未起时能当「别家」读）。
# prunes = 正在跑的 docker builder/image/system prune 或 docker rmi 进程数：同机磁盘守护 cron 在高水位时每 15 min
#   跑 `builder prune --keep-storage 1GB`，高负载下一次要 3–8 min，和 build 并发会清掉本家层缓存 / 卡死 dockerd（R469）。
free -m | awk '/^Mem:/{printf "mem_avail=%sMB ", $7}'
df -h / | awk 'NR==2{printf "disk_avail=%s(%s) ", $4, $5}'
awk '{printf "load=%s ", $1}' /proc/loadavg
printf 'other_builds=%s ' "$(pgrep -fc '[d]ocker compose .*(build|up)' || true)"
printf 'prunes=%s\n' "$(pgrep -fc '[d]ocker (builder|image|system) prune|[d]ocker rmi ' || true)"
