#!/usr/bin/env bash
# kaogong.zalize.com access log 周报（crontab：每周一 UTC 0 点 = 北京时间周一 08:00）
# 输出到 /home/ubuntu/kaogong-reports/access-weekly-YYYYMMDD.txt，只含聚合统计，不含敏感信息。
set -u

OUT_DIR=/home/ubuntu/kaogong-reports
LOG_GLOB='/var/log/caddy/kaogong.zalize.com-access*.log*'
SCRIPT=/home/ubuntu/kaogong-assistant/scripts/access_log_report.py

mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/access-weekly-$(date -u +%Y%m%d).txt"

{
  echo "# kaogong.zalize.com access log 周报（近7天，生成于 $(date -u '+%F %T') UTC）"
  # shellcheck disable=SC2086
  if ls $LOG_GLOB >/dev/null 2>&1; then
    zcat -f $LOG_GLOB 2>/dev/null | python3 "$SCRIPT" - --days 7
  else
    echo "未找到日志文件（$LOG_GLOB）"
  fi
} > "$OUT" 2>&1

# 周报保留 90 天
find "$OUT_DIR" -name 'access-weekly-*.txt' -mtime +90 -delete
