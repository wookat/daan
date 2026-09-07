#!/usr/bin/env python3
"""r429 探针回填：daily_set_entries 里 probe 为 NULL 的行，按两条可复核规则标 probe=1。

R429 生产一手：`/tiku/daily/` SEO 页与 App 完成页「今天已有 1 人完成 / 今日排行榜 1. 考友CPV8 3/10」
来自一条探针成绩（caddy 日志该 POST 出口 140.232.64.5 ∈ KG_PROBE_CIDRS，同 uid 当日 answer_log 30 行
全部 probe=1）。历史行不能凭 IP 归因（库内无 IP），只用库内证据：
  1. uid 命中团队走查命名约定（`test-*`、`devin-test-*`、`r<N>-*`），与 R418/R427 同口径；
  2. 同 uid 在 answer_log 有 probe=1 行且 **没有** probe=0 行（服务端三路判定对同一 uid 的既有结论）。
其余 NULL 行不动、不删行；--restore 按记录把 probe 改回 NULL。

  默认 dry-run；--apply 写库并把被改行 (day, uid) 落到 --record；--restore FILE 还原（只还原当前仍为 1 的行）。

本地：DB_PATH=/path/data.db python3 scripts/r429_daily_set_probe_backfill.py [--apply --record r429.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r429-daily-set-probe-backfill.json < scripts/r429_daily_set_probe_backfill.py
"""
import argparse
import json
import os
import re
import sqlite3
import time

TABLE = "daily_set_entries"
INTERNAL_UID = re.compile(r"^(test-|devin-test-|r\d+[a-z]?-)")


def _has_probe(conn: sqlite3.Connection) -> bool:
    return "probe" in {r[1] for r in conn.execute(f"PRAGMA table_info({TABLE})")}


def _uid_probe_verdict(conn: sqlite3.Connection, uid: str) -> tuple[int, int]:
    row = conn.execute(
        "SELECT SUM(CASE WHEN probe=1 THEN 1 ELSE 0 END), SUM(CASE WHEN probe=0 THEN 1 ELSE 0 END)"
        " FROM answer_log WHERE uid=?",
        (uid,),
    ).fetchone()
    return int(row[0] or 0), int(row[1] or 0)


def scan(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    where = "WHERE probe IS NULL" if _has_probe(conn) else ""
    if not where:
        print(f"{TABLE}: 尚无 probe 列（全表视为 NULL；--apply 时加列）")
    rows = conn.execute(
        f"SELECT day, uid, right, total, nickname, created_at FROM {TABLE} {where} ORDER BY created_at"
    ).fetchall()
    hit: list[tuple[str, str]] = []
    rest = []
    for day, uid, right, total, nick, created in rows:
        p1, p0 = _uid_probe_verdict(conn, uid)
        if INTERNAL_UID.match(uid or ""):
            why = "内部命名"
        elif p1 and not p0:
            why = f"answer_log probe=1 ×{p1} / probe=0 ×0"
        else:
            rest.append((day, uid, p1, p0))
            continue
        hit.append((day, uid))
        print(f"  {day} {uid} {right}/{total} {nick!r} created={created:.0f} ← {why}")
    print(f"{TABLE}: probe IS NULL {len(rows)} 行，命中 {len(hit)} 行")
    print(f"未命中（不动）{len(rest)} 行：{rest}")
    return hit


def apply(conn: sqlite3.Connection, keys: list[tuple[str, str]], record: str) -> None:
    if not _has_probe(conn):
        conn.execute(f"ALTER TABLE {TABLE} ADD COLUMN probe INTEGER")
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "rows": {TABLE: keys}}, f, ensure_ascii=False)
    n = 0
    for day, uid in keys:
        n += conn.execute(
            f"UPDATE {TABLE} SET probe=1 WHERE day=? AND uid=? AND probe IS NULL", (day, uid)
        ).rowcount
    conn.commit()
    print(f"{TABLE}: 已标 probe=1 {n}/{len(keys)}，记录 {record}")


def restore(conn: sqlite3.Connection, record: str) -> None:
    with open(record, encoding="utf-8") as f:
        keys = json.load(f)["rows"].get(TABLE, [])
    n = 0
    for day, uid in keys:
        n += conn.execute(
            f"UPDATE {TABLE} SET probe=NULL WHERE day=? AND uid=? AND probe=1", (day, uid)
        ).rowcount
    conn.commit()
    print(f"{TABLE}: 还原 probe→NULL {n}/{len(keys)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--record", default="r429-daily-set-probe-backfill.json")
    ap.add_argument("--restore", metavar="FILE")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    if a.restore:
        restore(conn, a.restore)
        return
    keys = scan(conn)
    if a.apply:
        apply(conn, keys, a.record)
    else:
        print("dry-run（加 --apply 写库）")
    conn.close()


if __name__ == "__main__":
    main()
