#!/bin/bash
# 考公刷题 生产运营脚本：每日备份（本地 + R2 离站）+ 健康巡检
# 部署位置：VPS /home/ubuntu/kaogong-ops.sh，cron `40 3 * * *`。
# R2 凭证从 /home/ubuntu/.env 读取（R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT），不入库不打印。
set -u
LOG=/home/ubuntu/kaogong-ops.log
TS=$(date '+%F %T')
# 1. 每日 DB 备份（本地保留 7 份）
BK=/home/ubuntu/kaogong-backups
mkdir -p "$BK"
docker exec deploy-kaogong-1 sqlite3 /data/data.db ".backup /data/daily.db" 2>/dev/null \
  || docker exec deploy-kaogong-1 python3 -c "import sqlite3;s=sqlite3.connect('/data/data.db');d=sqlite3.connect('/data/daily.db');s.backup(d)"
docker cp deploy-kaogong-1:/data/daily.db "$BK/data-$(date +%F).db" && docker exec deploy-kaogong-1 rm -f /data/daily.db
gzip -f "$BK/data-$(date +%F).db"
ls -t "$BK"/data-*.db.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
find "$BK" -name "pre-*.db.gz" -mtime +3 -delete 2>/dev/null
# 1b. R2 离站上传（zalize-backups/kaogong-sqlite，保留 30 天）
ENV_FILE=/home/ubuntu/.env
BUCKET_PREFIX=zalize-backups/kaogong-sqlite
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
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
# 2. 健康巡检
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 https://kaogong.zalize.com/api/questions?limit=1)
if [ "$CODE" != "200" ]; then
  echo "$TS UNHEALTHY api=$CODE, restarting" >> "$LOG"
  cd /home/ubuntu/kaogong-assistant/deploy && docker compose up -d >> "$LOG" 2>&1
else
  echo "$TS OK api=200 backup done" >> "$LOG"
fi
