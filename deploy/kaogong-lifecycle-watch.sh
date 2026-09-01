#!/bin/bash
# 容器生命周期审计：每分钟比对 deploy-kaogong-1 的 ContainerID/StartedAt，
# 变化即落一行审计（UTC、旧→新 StartedAt、健康态、宿主内存/交换水位、近 10 分钟 earlyoom kill 数）。
# 部署位置：VPS /home/ubuntu/kaogong-lifecycle-watch.sh，cron `* * * * *`。
# 背景：docker events 历史查询在该宿主上不可用（--since 返回空），采用轮询比对兜底。
set -u
STATE=/home/ubuntu/kaogong-reports/.kaogong-lifecycle-state
LOG=/home/ubuntu/kaogong-reports/container-events.log
mkdir -p /home/ubuntu/kaogong-reports
CUR=$(docker inspect deploy-kaogong-1 --format '{{.Id}} {{.State.StartedAt}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.State.ExitCode}} oom={{.State.OOMKilled}}' 2>/dev/null) || CUR="MISSING"
PREV=$(cat "$STATE" 2>/dev/null || echo "")
if [ "$CUR" != "$PREV" ]; then
  MEM=$(free -m | awk '/^Mem:/{printf "mem_avail=%sMiB", $7} /^Swap:/{printf " swap_used=%sMiB", $3}')
  EOK=$(journalctl -u earlyoom --since "-10 min" 2>/dev/null | grep -c "sending SIG" || true)
  echo "$(date -u '+%FT%TZ') CHANGE prev=[${PREV:-none}] cur=[$CUR] $MEM earlyoom_kills_10m=$EOK" >> "$LOG"
  echo "$CUR" > "$STATE"
fi
