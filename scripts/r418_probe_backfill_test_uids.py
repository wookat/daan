#!/usr/bin/env python3
"""r418 探针回填：把内部走查 uid（命名约定 `test-*`，见 .agents/skills/testing-kaogong-assistant）在
answer_log / growth_events / exam_attempts 里 probe 为 NULL 的行标为 probe=1。

R374 的口径「历史行不造假」针对的是无法归因的匿名 uid；`test-*` 是团队自己的命名约定、只有内部走查会造，
把它标为探针是补齐事实而非造假。不删行（活跃的走查会话可能仍在用），只让跨用户聚合（题目正确率/人次/易错项、
同卷人数/均分/排行榜/分数池、候选真人日报）按 probe=0 口径自然剔除。

  默认 dry-run 只打印各表命中行数与 uid 分布；--apply 才写库，写前把被改行的 (table, id) 落到 --record 文件；
  --restore FILE 把记录里的行 probe 改回 NULL（只还原当前仍为 1 的行）。
  --like 可改匹配前缀（默认 'test-%'）。

本地：DB_PATH=/path/data.db python3 scripts/r418_probe_backfill_test_uids.py [--apply --record r418.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r418-probe-backfill.json < scripts/r418_probe_backfill_test_uids.py
"""
import argparse
import json
import os
import sqlite3
import time

TABLES = ["answer_log", "growth_events", "exam_attempts"]


def _has_probe(conn: sqlite3.Connection, table: str) -> bool:
    return "probe" in {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}


def scan(conn: sqlite3.Connection, like: str) -> dict[str, list[int]]:
    hit: dict[str, list[int]] = {}
    for t in TABLES:
        if not _has_probe(conn, t):
            print(f"{t}: 无 probe 列，跳过")
            continue
        ids = [r[0] for r in conn.execute(
            f"SELECT id FROM {t} WHERE uid LIKE ? AND probe IS NULL ORDER BY id", (like,)
        )]
        by_uid = conn.execute(
            f"SELECT uid, COUNT(*) FROM {t} WHERE uid LIKE ? AND probe IS NULL GROUP BY uid ORDER BY uid", (like,)
        ).fetchall()
        print(f"{t}: probe IS NULL 命中 {len(ids)} 行 {[tuple(r) for r in by_uid]}")
        hit[t] = ids
    return hit


def apply(conn: sqlite3.Connection, hit: dict[str, list[int]], record: str) -> None:
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "rows": hit}, f, ensure_ascii=False)
    for t, ids in hit.items():
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            marks = ",".join("?" * len(chunk))
            conn.execute(f"UPDATE {t} SET probe=1 WHERE id IN ({marks}) AND probe IS NULL", chunk)
    conn.commit()
    for t, ids in hit.items():
        n = conn.execute(f"SELECT COUNT(*) FROM {t} WHERE id IN ({','.join('?' * len(ids))}) AND probe=1", ids).fetchone()[0] if ids else 0
        print(f"{t}: 已标 probe=1 {n}/{len(ids)}")


def restore(conn: sqlite3.Connection, record: str) -> None:
    with open(record, encoding="utf-8") as f:
        rows: dict[str, list[int]] = json.load(f)["rows"]
    for t, ids in rows.items():
        n = 0
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            marks = ",".join("?" * len(chunk))
            n += conn.execute(f"UPDATE {t} SET probe=NULL WHERE id IN ({marks}) AND probe=1", chunk).rowcount
        print(f"{t}: 还原 probe→NULL {n}/{len(ids)}")
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--like", default="test-%")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--record", default="r418-probe-backfill.json")
    ap.add_argument("--restore", metavar="FILE")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    try:
        if a.restore:
            restore(conn, a.restore)
            return
        hit = scan(conn, a.like)
        if not a.apply:
            print("dry-run（加 --apply 写库）")
            return
        apply(conn, hit, a.record)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
