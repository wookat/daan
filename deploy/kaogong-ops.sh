#!/bin/bash
# 考公刷题 生产运营脚本：每日备份（本地 + R2 离站）+ 健康巡检
# 部署位置：VPS /home/ubuntu/kaogong-ops.sh，cron `40 3 * * *`。
# R2 凭证从 /home/ubuntu/.env 读取（R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT），不入库不打印。
set -u
# 与部署/生命周期审计同目录，容器只读挂载 /reports 供管理台 ops_status 外显
LOG=/home/ubuntu/kaogong-reports/kaogong-ops.log
mkdir -p "$(dirname "$LOG")"
TS=$(date '+%F %T')
# 1. 每日 DB 备份（本地保留 7 份）
BK=/home/ubuntu/kaogong-backups
mkdir -p "$BK"
docker exec deploy-kaogong-1 sqlite3 /data/data.db ".backup /data/daily.db" 2>/dev/null \
  || docker exec deploy-kaogong-1 python3 -c "import sqlite3;s=sqlite3.connect('/data/data.db');d=sqlite3.connect('/data/daily.db');s.backup(d)"
docker cp deploy-kaogong-1:/data/daily.db "$BK/data-$(date +%F).db" && docker exec deploy-kaogong-1 rm -f /data/daily.db
gzip -f "$BK/data-$(date +%F).db"
# 文件名为 data-YYYY-MM-DD.db.gz，按名排序即按日期排序
# shellcheck disable=SC2012
ls -t "$BK"/data-*.db.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
find "$BK" -name "pre-*.db.gz" -mtime +3 -delete 2>/dev/null
# 1b. R2 离站上传（zalize-backups/kaogong-sqlite，保留 30 天）
ENV_FILE=/home/ubuntu/.env
BUCKET_PREFIX=zalize-backups/kaogong-sqlite
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
  F="$BK/data-$(date +%F).db.gz"
  size=$(stat -c%s "$F")
  if rclone copyto "$F" "r2:$BUCKET_PREFIX/$(basename "$F")"; then
    remote_size=$(rclone size --json "r2:$BUCKET_PREFIX/$(basename "$F")" | python3 -c 'import json,sys;print(json.load(sys.stdin)["bytes"])')
    if [ "$remote_size" = "$size" ]; then
      echo "$TS r2 upload ok $(basename "$F") ($size bytes)" >> "$LOG"
      rclone delete --min-age 30d "r2:$BUCKET_PREFIX/" 2>/dev/null
    else
      echo "$TS r2 upload SIZE MISMATCH $(basename "$F") ($remote_size != $size)" >> "$LOG"
    fi
  else
    echo "$TS r2 upload FAILED $(basename "$F")" >> "$LOG"
  fi
else
  echo "$TS r2 upload SKIPPED (no $ENV_FILE)" >> "$LOG"
fi
# 1c'. 备份可恢复性验证：解压当日备份 → quick_check + 题目行数，坏备份当天暴露而非灾难恢复时
VF="$BK/.verify.db"
if gunzip -c "$BK/data-$(date +%F).db.gz" > "$VF" 2>/dev/null; then
  VR=$(python3 -c "
import sqlite3
c = sqlite3.connect('$VF')
q = c.execute('PRAGMA quick_check').fetchone()[0]
n = c.execute('SELECT count(*) FROM questions').fetchone()[0]
print(f'{q} questions={n}')
" 2>&1) || VR="verify-script-failed: $VR"
else
  VR="gunzip-failed"
fi
rm -f "$VF"
case "$VR" in
  "ok questions="*) echo "$TS RESTORE-VERIFY $VR" >> "$LOG" ;;
  *) echo "$TS RESTORE-VERIFY FAILED $VR" >> "$LOG" ;;
esac
# 1b'. R2 副本每周独立验证（周日）：从远端真实下载 → 与本地 md5 比对，防「上传成功但远端不可恢复」
if [ -f "$ENV_FILE" ] && { [ "$(date +%u)" = "7" ] || [ "${FORCE_R2_VERIFY:-}" = "1" ]; }; then
  RF=/tmp/.kg-r2-verify.db.gz
  F="$BK/data-$(date +%F).db.gz"
  rclone copyto "r2:$BUCKET_PREFIX/$(basename "$F")" "$RF" 2>/dev/null
  # rclone copyto 对远端缺失对象 exit 0 且不落文件（v1.75 实测），以产物存在性为准
  if [ -s "$RF" ]; then
    if [ "$(md5sum "$RF" | cut -d' ' -f1)" = "$(md5sum "$F" | cut -d' ' -f1)" ]; then
      echo "$TS R2-VERIFY ok md5 match $(basename "$F")" >> "$LOG"
    else
      echo "$TS R2-VERIFY FAILED md5 mismatch $(basename "$F")" >> "$LOG"
    fi
  else
    echo "$TS R2-VERIFY FAILED download $(basename "$F")" >> "$LOG"
  fi
  rm -f "$RF"
fi
# 1c. 磁盘水位巡检：共享宿主根分区 ≥90% 时告警入日志（DB 快照/日志膨胀早发现）
PCT=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "${PCT:-0}" -ge 90 ]; then
  echo "$TS DISK HIGH ${PCT}% used on /" >> "$LOG"
fi
# 1d. 宿主内存压力巡检：可用内存/交换占用/后端 RSS 每日一行（共享宿主 earlyoom 误杀早发现）
MEMLINE=$(free -m | awk '/^Mem:/{printf "mem_avail=%sMiB", $7} /^Swap:/{printf " swap_used=%sMiB", $3}')
RSS=$(docker exec deploy-kaogong-1 sh -c "awk '/VmRSS/{print \$2}' /proc/1/status" 2>/dev/null || echo "?")
echo "$TS MEM $MEMLINE uvicorn_rss=${RSS}kB" >> "$LOG"
# 2. 健康巡检
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 https://kaogong.zalize.com/api/questions?limit=1)
if [ "$CODE" != "200" ]; then
  echo "$TS UNHEALTHY api=$CODE, restarting" >> "$LOG"
  cd /home/ubuntu/kaogong-assistant/deploy && docker compose up -d >> "$LOG" 2>&1
else
  echo "$TS OK api=200 backup done" >> "$LOG"
fi
