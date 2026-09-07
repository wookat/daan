#!/usr/bin/env python3
"""r427 探针回填：pk_matches 里任一方 uid 命中内部走查命名的行，probe 为 NULL 时标为 probe=1。

R427 生产一手：本周 PK 榜 3 个胜者全是 `test-w*-mp*` 走查 uid；随机匹配等待池 5 局里 4 局发起者是
`r9-pk-a`/`r10-pk-a`（08-14 R9/R10 走查），真实用户随机匹配会被配给这些幽灵对局。口径与 R418 一致：
只标团队命名约定的 uid（`test-*`、`devin-test-*`、`r<N>-*`、`opponentuid12345`），普通匿名 `ums…` uid
无法归因不动、不删行；--restore 按记录把 probe 改回 NULL。

  默认 dry-run；--apply 写库并把被改行 id 落到 --record；--restore FILE 还原（只还原当前仍为 1 的行）。

本地：DB_PATH=/path/data.db python3 scripts/r427_pk_probe_backfill.py [--apply --record r427.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r427-pk-probe-backfill.json < scripts/r427_pk_probe_backfill.py
"""
import argparse
import json
import os
import re
import sqlite3
import time

TABLE = "pk_matches"
# 团队走查 uid 命名约定（.agents/skills/testing-kaogong-assistant）：只有内部会造
INTERNAL_UID = re.compile(r"^(test-|devin-test-|r\d+[a-z]?-|opponentuid12345$)")


def _has_probe(conn: sqlite3.Connection) -> bool:
    return "probe" in {r[1] for r in conn.execute(f"PRAGMA table_info({TABLE})")}


def scan(conn: sqlite3.Connection) -> list[int]:
    where = "WHERE probe IS NULL" if _has_probe(conn) else ""
    if not where:
        print(f"{TABLE}: 尚无 probe 列（全表视为 NULL；--apply 时加列）")
    rows = conn.execute(
        f"SELECT id, code, creator_uid, opponent_uid, status FROM {TABLE} {where} ORDER BY id"
    ).fetchall()
    hit = [r for r in rows if INTERNAL_UID.match(r[2] or "") or INTERNAL_UID.match(r[3] or "")]
    rest = [r for r in rows if r not in hit]
    print(f"{TABLE}: probe IS NULL {len(rows)} 行，命中内部 uid {len(hit)} 行：")
    for r in hit:
        print(f"  id={r[0]} {r[1]} {r[2]} vs {r[3]} {r[4]}")
    print(f"未命中（不动）{len(rest)} 行：{[(r[1], r[2], r[3]) for r in rest]}")
    return [r[0] for r in hit]


def apply(conn: sqlite3.Connection, ids: list[int], record: str) -> None:
    if not _has_probe(conn):
        conn.execute(f"ALTER TABLE {TABLE} ADD COLUMN probe INTEGER")
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "rows": {TABLE: ids}}, f, ensure_ascii=False)
    if ids:
        marks = ",".join("?" * len(ids))
        conn.execute(f"UPDATE {TABLE} SET probe=1 WHERE id IN ({marks}) AND probe IS NULL", ids)
    conn.commit()
    n = conn.execute(
        f"SELECT COUNT(*) FROM {TABLE} WHERE id IN ({','.join('?' * len(ids))}) AND probe=1", ids
    ).fetchone()[0] if ids else 0
    print(f"{TABLE}: 已标 probe=1 {n}/{len(ids)}，记录 {record}")


def restore(conn: sqlite3.Connection, record: str) -> None:
    with open(record, encoding="utf-8") as f:
        ids = json.load(f)["rows"].get(TABLE, [])
    n = 0
    if ids:
        marks = ",".join("?" * len(ids))
        n = conn.execute(f"UPDATE {TABLE} SET probe=NULL WHERE id IN ({marks}) AND probe=1", ids).rowcount
    conn.commit()
    print(f"{TABLE}: 还原 probe→NULL {n}/{len(ids)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--record", default="r427-pk-probe-backfill.json")
    ap.add_argument("--restore", metavar="FILE")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    if a.restore:
        restore(conn, a.restore)
        return
    ids = scan(conn)
    if a.apply:
        apply(conn, ids, a.record)
    else:
        print("dry-run（加 --apply 写库）")
    conn.close()


if __name__ == "__main__":
    main()
