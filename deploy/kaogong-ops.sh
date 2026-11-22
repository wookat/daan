#!/bin/bash
# 考公刷题 生产运营脚本：每日备份（本地 + R2 离站）+ 健康巡检
# 部署位置：VPS /home/ubuntu/kaogong-ops.sh，cron `40 3 * * *`。
# R2 凭证从 /home/ubuntu/.env 读取（R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT），不入库不打印。
set -u
# 与部署/生命周期审计同目录，容器只读挂载 /reports 供管理台 ops_status 外显
LOG=/home/ubuntu/kaogong-reports/kaogong-ops.log
mkdir -p "$(dirname "$LOG")"
TS=$(date '+%F %T')
DAY=$(date +%F)
# 1. 每日 DB 备份（本地保留 3 份，30 天历史在 R2；每步显式判错，防失败级联删掉旧好备份）
BK=/home/ubuntu/kaogong-backups
mkdir -p "$BK"
F="$BK/data-$DAY.db.gz"
BACKUP_OK=0
if (docker exec deploy-kaogong-1 sqlite3 /data/data.db ".backup /data/daily.db" 2>/dev/null \
    || docker exec deploy-kaogong-1 python3 -c "import sqlite3;s=sqlite3.connect('/data/data.db',timeout=60);d=sqlite3.connect('/data/daily.db');s.backup(d);d.close();s.close()") \
  && docker cp deploy-kaogong-1:/data/daily.db "$BK/data-$DAY.db" \
  && gzip -f "$BK/data-$DAY.db" \
  && [ -s "$F" ]; then
  BACKUP_OK=1
  docker exec deploy-kaogong-1 rm -f /data/daily.db 2>/dev/null || true
  # 文件名为 data-YYYY-MM-DD.db.gz，按名排序即按日期排序；仅本次备份成功后才轮转旧份
  # shellcheck disable=SC2012
  ls -t "$BK"/data-*.db.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
  find "$BK" -name "pre-*.db.gz" -mtime +3 -delete 2>/dev/null || true
else
  docker exec deploy-kaogong-1 rm -f /data/daily.db 2>/dev/null || true
  rm -f "$BK/data-$DAY.db" "$F"
  echo "$TS BACKUP FAILED local snapshot/gzip (retention & R2 upload skipped)" >> "$LOG"
fi
# 1b. R2 离站上传（zalize-backups/kaogong-sqlite，保留 30 天）
ENV_FILE=/home/ubuntu/.env
BUCKET_PREFIX=zalize-backups/kaogong-sqlite
R2_READY=0
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && [ -n "${R2_ENDPOINT:-}" ]; then
    export RCLONE_CONFIG_R2_TYPE=s3
    export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
    export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
    export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
    export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"
    R2_READY=1
  fi
fi
if [ "$BACKUP_OK" = "1" ] && [ "$R2_READY" = "1" ]; then
  size=$(stat -c%s "$F")
  if rclone copyto "$F" "r2:$BUCKET_PREFIX/$(basename "$F")"; then
    remote_size=$(rclone size --json "r2:$BUCKET_PREFIX/$(basename "$F")" | python3 -c 'import json,sys;print(json.load(sys.stdin)["bytes"])' 2>/dev/null || echo "")
    if [ "$remote_size" = "$size" ]; then
      echo "$TS r2 upload ok $(basename "$F") ($size bytes)" >> "$LOG"
      # 只清顶层每日备份；archive/ 是永久手工快照，rclone delete 默认递归会把它一并按 30 天清掉
      rclone delete --min-age 30d --max-depth 1 --include "data-*.db.gz" "r2:$BUCKET_PREFIX/" 2>/dev/null || true
    else
      echo "$TS r2 upload SIZE MISMATCH $(basename "$F") (${remote_size:-?} != $size)" >> "$LOG"
    fi
  else
    echo "$TS r2 upload FAILED $(basename "$F")" >> "$LOG"
  fi
elif [ "$BACKUP_OK" = "1" ]; then
  echo "$TS r2 upload SKIPPED (missing R2 creds in $ENV_FILE)" >> "$LOG"
fi
# 1c'. 备份可恢复性验证：解压当日备份 → quick_check + 题目行数，坏备份当天暴露而非灾难恢复时
if [ "$BACKUP_OK" = "1" ]; then
  VF=$(mktemp "$BK/.verify.XXXXXX.db")
  if gunzip -c "$F" > "$VF" 2>/dev/null; then
    VR=$(python3 -c "
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
q = c.execute('PRAGMA quick_check').fetchone()[0]
n = c.execute('SELECT count(*) FROM questions').fetchone()[0]
print(f'{q} questions={n}')
" "$VF" 2>&1) || VR="verify-script-failed: $VR"
  else
    VR="gunzip-failed"
  fi
  rm -f "$VF"
  case "$VR" in
    "ok questions="*) echo "$TS RESTORE-VERIFY $VR" >> "$LOG" ;;
    *) echo "$TS RESTORE-VERIFY FAILED $VR" >> "$LOG" ;;
  esac
fi
# 1b'. R2 副本每周独立验证（周日）：从远端真实下载 → 与本地 md5 比对，防「上传成功但远端不可恢复」
if [ "$BACKUP_OK" = "1" ] && [ "$R2_READY" = "1" ] && { [ "$(date +%u)" = "7" ] || [ "${FORCE_R2_VERIFY:-}" = "1" ]; }; then
  RF=$(mktemp /tmp/.kg-r2-verify.XXXXXX.db.gz)
  rclone copyto "r2:$BUCKET_PREFIX/$(basename "$F")" "$RF" 2>/dev/null || true
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
# 1c. 磁盘水位巡检：宿主根分区 ≥90% 时告警入日志（DB 快照/日志膨胀早发现；新机独享但盘仅 60G，同样需要）
PCT=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "${PCT:-0}" -ge 90 ]; then
  echo "$TS DISK HIGH ${PCT}% used on /" >> "$LOG"
fi
# 1c''. 卷内手工快照巡检：/data 只该有 data.db(+wal/shm)；手工全库快照须放 R2 archive/ 或宿主 pre-*.db.gz（3 天清理）
SNAP=$(docker exec deploy-kaogong-1 sh -c "find /data -maxdepth 1 -type f \( -name '*.db*' -o -name '*.gz' \) ! -name 'data.db*' -size +1M -exec ls -l {} + 2>/dev/null" \
  | awk '{s+=$5; n++; f=f" "$NF} END{if(n) printf "%d file(s) %d MB:%s", n, s/1048576, f}')
if [ -n "$SNAP" ]; then
  echo "$TS VOLUME-SNAPSHOT $SNAP (move to r2:$BUCKET_PREFIX/archive/)" >> "$LOG"
fi
# 1d. 宿主内存压力巡检：可用内存/交换占用/后端 RSS 每日一行（新机独享 3.7G，同机他家 earlyoom 误杀的老机场景已不存在，记录仍供容量观察）
MEMLINE=$(free -m | awk '/^Mem:/{printf "mem_avail=%sMiB", $7} /^Swap:/{printf " swap_used=%sMiB", $3}')
RSS=$(docker exec deploy-kaogong-1 sh -c "awk '/VmRSS/{print \$2}' /proc/1/status" 2>/dev/null || echo "?")
echo "$TS MEM $MEMLINE uvicorn_rss=${RSS}kB" >> "$LOG"
# 2. 健康巡检：优先探本机 127.0.0.1:8300/api/health，再复核公网；假死容器必须 restart（up -d 不会重启 Running 容器）
LOCAL_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:8300/api/health" || echo "000")
PUB_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://kaogong.zalize.com/api/questions?limit=1" || echo "000")
if [ "$LOCAL_CODE" != "200" ] || [ "$PUB_CODE" != "200" ]; then
  echo "$TS UNHEALTHY local=$LOCAL_CODE pub=$PUB_CODE, restarting kaogong" >> "$LOG"
  cd /home/ubuntu/kaogong-assistant/deploy && {
    if [ "$(docker inspect -f '{{.State.Running}}' deploy-kaogong-1 2>/dev/null)" = "true" ]; then
      docker compose restart kaogong >> "$LOG" 2>&1
    else
      docker compose up -d kaogong >> "$LOG" 2>&1
    fi
  }
else
  echo "$TS OK local=200 pub=200 backup_ok=$BACKUP_OK" >> "$LOG"
fi
