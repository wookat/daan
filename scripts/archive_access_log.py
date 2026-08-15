#!/usr/bin/env python3
"""增量归档 Caddy access log 到按天文件，避免 Caddy 重载/轮转导致观测窗口丢失。

用法: archive_access_log.py <logfile_glob> <archive_dir>
- 归档文件: <archive_dir>/access-YYYYMMDD.jsonl（按日志行内 ts 的 UTC 日期分桶）
- 状态文件: <archive_dir>/.state（JSON）记录已归档最大 ts 与各文件已读字节偏移，
  每次只读活跃日志的追加部分、已处理过的轮转 .gz 直接跳过（幂等，可高频 cron）
- 仅聚合请求日志行，不含额外敏感信息（与源日志一致）
"""
import glob
import json
import os
import sys
import time


def _load_state(path: str) -> dict:
    try:
        with open(path) as f:
            raw = f.read().strip()
    except OSError:
        return {"last_ts": 0.0, "files": {}, "done_gz": []}
    try:
        st = json.loads(raw)
        if isinstance(st, dict):
            st.setdefault("last_ts", 0.0)
            st.setdefault("files", {})
            st.setdefault("done_gz", [])
            return st
    except ValueError:
        pass
    try:  # 兼容旧版纯 float 状态文件
        return {"last_ts": float(raw or 0), "files": {}, "done_gz": []}
    except ValueError:
        return {"last_ts": 0.0, "files": {}, "done_gz": []}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    try:
        os.nice(19)  # 低优先级，避免与线上服务争抢
    except OSError:
        pass
    log_glob, arc_dir = sys.argv[1], sys.argv[2]
    os.makedirs(arc_dir, exist_ok=True)
    state_path = os.path.join(arc_dir, ".state")
    state = _load_state(state_path)
    last_ts = float(state["last_ts"])
    offsets: dict = state["files"]
    done_gz = set(state["done_gz"])

    rows = []

    def _collect(f):
        for line in f:
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="replace")
            line = line.strip()
            if not line:
                continue
            try:
                ts = float(json.loads(line).get("ts") or 0)
            except (ValueError, AttributeError):
                continue
            if ts > last_ts:
                rows.append((ts, line))

    new_offsets: dict = {}
    for path in glob.glob(log_glob):
        if path.endswith(".gz"):
            # 轮转产物内容不变，处理过一次即永久跳过
            if os.path.basename(path) in done_gz:
                continue
            import gzip

            try:
                with gzip.open(path, "rt", errors="replace") as f:
                    _collect(f)
                done_gz.add(os.path.basename(path))
            except OSError:
                continue
            continue
        try:
            st = os.stat(path)
            key = f"{st.st_ino}:{path}"
            start = int(offsets.get(key, 0))
            if start > st.st_size:  # 文件被截断/轮转，重读
                start = 0
            with open(path, "rb") as f:  # 二进制模式支持任意字节偏移 seek/tell
                f.seek(start)
                _collect(f)
                new_offsets[key] = f.tell()
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
    state = {"last_ts": max_ts, "files": new_offsets, "done_gz": sorted(done_gz)[-64:]}
    with open(state_path, "w") as f:
        json.dump(state, f)
    print(f"archived {n} new lines (last_ts={max_ts})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
