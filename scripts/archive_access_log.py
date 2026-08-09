#!/usr/bin/env python3
"""增量归档 Caddy access log 到按天文件，避免 Caddy 重载/轮转导致观测窗口丢失。

用法: archive_access_log.py <logfile_glob> <archive_dir>
- 归档文件: <archive_dir>/access-YYYYMMDD.jsonl（按日志行内 ts 的 UTC 日期分桶）
- 状态文件: <archive_dir>/.state 记录已归档的最大 ts，只追加更新的行（幂等，可高频 cron）
- 仅聚合请求日志行，不含额外敏感信息（与源日志一致）
"""
import glob
import json
import os
import sys
import time


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    log_glob, arc_dir = sys.argv[1], sys.argv[2]
    os.makedirs(arc_dir, exist_ok=True)
    state_path = os.path.join(arc_dir, ".state")
    last_ts = 0.0
    if os.path.exists(state_path):
        try:
            last_ts = float(open(state_path).read().strip() or 0)
        except ValueError:
            last_ts = 0.0

    rows = []
    for path in glob.glob(log_glob):
        opener = open
        if path.endswith(".gz"):
            import gzip

            opener = gzip.open
        try:
            with opener(path, "rt", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        ts = float(json.loads(line).get("ts") or 0)
                    except (ValueError, AttributeError):
                        continue
                    if ts > last_ts:
                        rows.append((ts, line))
        except OSError:
            continue

    rows.sort(key=lambda x: x[0])
    n = 0
    max_ts = last_ts
    by_day: dict[str, list[str]] = {}
    for ts, line in rows:
        day = time.strftime("%Y%m%d", time.gmtime(ts))
        by_day.setdefault(day, []).append(line)
        max_ts = max(max_ts, ts)
        n += 1
    for day, lines in by_day.items():
        with open(os.path.join(arc_dir, f"access-{day}.jsonl"), "a") as f:
            f.write("\n".join(lines) + "\n")
    if max_ts > last_ts:
        with open(state_path, "w") as f:
            f.write(repr(max_ts))
    print(f"archived {n} new lines (last_ts={max_ts})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
