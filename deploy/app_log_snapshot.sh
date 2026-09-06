#!/usr/bin/env bash
# 容器重建前把即将被销毁的旧容器应用日志（uvicorn stdout/stderr：启动、Traceback、access 行）落盘归档。
# json-file 日志随容器一起删除，`docker compose up --build` 每换一次容器 ID 就丢一份；部署频繁时
# 「过去 24h 应用日志」实际只剩当前容器存活的几十分钟，事后无法归因（R437 一手：22 次/日重建）。
# 用法（远端执行，deploy_h5.sh 以 `bash -s <rev>` 注入）：app_log_snapshot.sh [old_rev]
# 输出一行：snapshot=<path> lines=<n> bytes=<gz> | snapshot=skipped reason=<...>
set -u
CONTAINER=deploy-kaogong-1
DIR=/home/ubuntu/kaogong-reports/app-log
KEEP_DAYS=14
OLD_REV="${1:-unknown}"

STARTED=$(docker inspect "$CONTAINER" --format '{{.State.StartedAt}}' 2>/dev/null) \
  || { echo "snapshot=skipped reason=no-container"; exit 0; }
STAMP=$(date -u -d "$STARTED" +%Y%m%dT%H%M%SZ 2>/dev/null || echo "${STARTED//[^0-9TZ]/}")
mkdir -p "$DIR"
OUT="$DIR/kaogong-app-${OLD_REV}-${STAMP}-to-$(date -u +%Y%m%dT%H%M%SZ).log.gz"
TMP="$OUT.part"
# --timestamps：json-file 里的行本身不带时间，落盘后才能与 caddy/ops 日志对时
if ! docker logs --timestamps "$CONTAINER" 2>&1 | gzip -c > "$TMP"; then
  rm -f "$TMP"; echo "snapshot=skipped reason=docker-logs-failed"; exit 0
fi
mv "$TMP" "$OUT"
LINES=$(gzip -dc "$OUT" | wc -l)
find "$DIR" -name 'kaogong-app-*.log.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
echo "snapshot=$OUT lines=$LINES bytes=$(stat -c %s "$OUT")"
