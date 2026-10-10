#!/usr/bin/env python3
"""r419 比赛场次去重：同 (series, open_at, close_at) 出现多行时只留一行，其余删除；
之后建唯一索引；--renumber 时再按系列内 open_at 顺序把「第 N 期」重排（默认不动已对外展示过的标题）。

成因：`ensure_weekly_event` 的存在性检查与 INSERT 不在同一写锁事务内，并发首请求各插一行
（生产 2026-09-06 00:19:47.99–48.28 UTC 8 次 /api/mock/events 并发 → 8 行「第5期」）。

保留规则：组内优先留有参赛登记（mock_event_entries）的那行；都没有则留 id 最小的。
有 ≥2 行带登记的组不自动处理（打印后跳过，需人工定）。被删行须 0 登记。

  默认 dry-run；--apply 写库，写前把被删行全字段 + 被改标题的原值落到 --record 文件；
  --restore FILE 按记录原 id 重插被删行、还原标题，并删掉唯一索引（否则重插会撞索引）。

本地：DB_PATH=/path/data.db python3 scripts/r419_dedupe_mock_events.py [--apply --record r419.json]
生产：docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r419-mock-events-dedupe.json < scripts/r419_dedupe_mock_events.py
"""
import argparse
import json
import os
import re
import sqlite3
import time

INDEX = "idx_mock_events_window"
COLS = ["id", "title", "series", "paper_id", "open_at", "close_at", "created_at"]
TITLE_RE = re.compile(r"^(.*?第)(\d+)(期)$")


def _entries(conn: sqlite3.Connection, eid: int) -> int:
    return conn.execute("SELECT COUNT(*) FROM mock_event_entries WHERE event_id=?", (eid,)).fetchone()[0]


def scan(conn: sqlite3.Connection) -> dict:
    groups = conn.execute(
        """SELECT series, open_at, close_at, COUNT(*) n FROM mock_events
           GROUP BY series, open_at, close_at HAVING n > 1 ORDER BY open_at"""
    ).fetchall()
    delete: list[dict] = []
    keep: list[int] = []
    skipped = 0
    for series, o, c, n in groups:
        rows = [dict(zip(COLS, r)) for r in conn.execute(
            f"SELECT {','.join(COLS)} FROM mock_events WHERE series IS ? AND open_at=? AND close_at=? ORDER BY id",
            (series, o, c),
        )]
        for r in rows:
            r["entries"] = _entries(conn, r["id"])
        with_e = [r for r in rows if r["entries"]]
        if len(with_e) > 1:
            print(f"跳过 {series} {o}: {len(with_e)} 行都有登记 {[(r['id'], r['entries']) for r in with_e]}")
            skipped += 1
            continue
        k = with_e[0] if with_e else rows[0]
        keep.append(k["id"])
        for r in rows:
            if r["id"] != k["id"]:
                delete.append(r)
        print(f"{series} open={o}: {n} 行 → 留 {k['id']}「{k['title']}」，删 {[r['id'] for r in rows if r['id'] != k['id']]}")
    print(f"重复组 {len(groups)}，删 {len(delete)} 行，跳过 {skipped} 组")
    return {"delete": delete, "keep": keep, "skipped": skipped}


def renumber_plan(conn: sqlite3.Connection, delete_ids: set[int]) -> list[dict]:
    """去重后各系列按 open_at 顺序核「第 N 期」，编号不连续/重号的改成序号；只改能解析出「第N期」的标题。"""
    plan: list[dict] = []
    series_list = [r[0] for r in conn.execute("SELECT DISTINCT series FROM mock_events")]
    for s in series_list:
        rows = [r for r in conn.execute(
            "SELECT id, title FROM mock_events WHERE series IS ? ORDER BY open_at, id", (s,)
        ) if r[0] not in delete_ids]
        for i, (eid, title) in enumerate(rows, 1):
            m = TITLE_RE.match(title or "")
            if m and int(m.group(2)) != i:
                plan.append({"id": eid, "old": title, "new": f"{m.group(1)}{i}{m.group(3)}"})
    for p in plan:
        print(f"改标题 {p['id']}: 「{p['old']}」→「{p['new']}」")
    return plan


def apply(conn: sqlite3.Connection, hit: dict, plan: list[dict], record: str) -> None:
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "deleted": hit["delete"], "retitled": plan}, f, ensure_ascii=False)
    for r in hit["delete"]:
        if _entries(conn, r["id"]):
            raise SystemExit(f"event {r['id']} 已出现登记，中止（未写库）")
        conn.execute("DELETE FROM mock_events WHERE id=?", (r["id"],))
    for p in plan:
        conn.execute("UPDATE mock_events SET title=? WHERE id=? AND title=?", (p["new"], p["id"], p["old"]))
    conn.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {INDEX} ON mock_events(series, open_at, close_at)")
    conn.commit()
    print(f"deleted {len(hit['delete'])}, retitled {len(plan)}, index {INDEX} 已建")


def restore(conn: sqlite3.Connection, record: str) -> None:
    with open(record, encoding="utf-8") as f:
        rec = json.load(f)
    conn.execute(f"DROP INDEX IF EXISTS {INDEX}")
    n = 0
    for r in rec["deleted"]:
        if conn.execute("SELECT 1 FROM mock_events WHERE id=?", (r["id"],)).fetchone():
            continue
        conn.execute(
            f"INSERT INTO mock_events({','.join(COLS)}) VALUES({','.join('?' * len(COLS))})",
            [r[c] for c in COLS],
        )
        n += 1
    m = 0
    for p in rec["retitled"]:
        m += conn.execute("UPDATE mock_events SET title=? WHERE id=? AND title=?", (p["old"], p["id"], p["new"])).rowcount
    conn.commit()
    print(f"restored {n} rows, retitled back {m}, index {INDEX} dropped")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--renumber", action="store_true")
    ap.add_argument("--record", default="r419-mock-events-dedupe.json")
    ap.add_argument("--restore", metavar="FILE")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    try:
        if a.restore:
            restore(conn, a.restore)
            return
        hit = scan(conn)
        plan = renumber_plan(conn, {r["id"] for r in hit["delete"]}) if a.renumber else []
        if not a.apply:
            print("dry-run（加 --apply 写库）")
            return
        if hit["skipped"]:
            raise SystemExit("有需人工定的组，未写库")
        apply(conn, hit, plan, a.record)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
