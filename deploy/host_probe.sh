#!/usr/bin/env bash
# 宿主一行快照（deploy_h5.sh 4-pre / FAIL 现场用，经 `ssh REMOTE bash -s < deploy/host_probe.sh` 执行）：
#   mem_avail=272MB disk_avail=4.5G(91%) load=0.93 other_builds=0
# other_builds = 宿主上正在跑的 docker compose build/up 进程数（[d]ocker 写法避免 pgrep 匹到自身）。
free -m | awk '/^Mem:/{printf "mem_avail=%sMB ", $7}'
df -h / | awk 'NR==2{printf "disk_avail=%s(%s) ", $4, $5}'
awk '{printf "load=%s ", $1}' /proc/loadavg
printf 'other_builds=%s\n' "$(pgrep -fc '[d]ocker compose .*(build|up)' || true)"
