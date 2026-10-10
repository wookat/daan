#!/usr/bin/env python3
"""r483 时政题号撞号回填：answer_log / mistakes 里 module='时政' 且 question_id 非空的行，把 question_id 置 NULL。

时政题存 shizheng_questions（id 1–11180），客户端曾把该 id 当 question_id 上传；后端所有按题号的
JOIN questions（错题本/复习流选项渲染、全站正确率/易错项 refresh_question_stats、考点掌握图、
answer_log 答对推进错题 SRS、save_mistake 按题号去重）都会算到同号的无关行测题上。
R483 生产一手：answer_log 39 行 / mistakes 3 行撞号；19 道行测题的「N 人做过 / 正确率 / 易错项」
全部或部分来自时政作答；真人 uid 的 3 条时政错题在 /api/review、/api/mistakes 里被套上资料分析题的选项。
写入侧已改（db.foreign_module_qid），本脚本只补历史行；--record 落 {表: {id: 旧 question_id}}，--restore 按记录还原。
置空后下一轮 refresh_question_stats 会把只剩时政作答的题目统计清成 NULL（既有 stale 分支），无需手工改 questions。

  默认 dry-run；--apply 写库并把旧值落到 --record；--restore FILE 还原（只还原当前仍为 NULL 的行）。

本地：DB_PATH=/path/data.db python3 scripts/r483_shizheng_qid_null.py [--apply --record r483.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - --apply --record /data/r483-shizheng-qid-null.json < scripts/r483_shizheng_qid_null.py
"""
import argparse
import json
import os
import sqlite3
import time

TABLES = ("answer_log", "mistakes")
MODULE = "时政"


def _exists(conn: sqlite3.Connection, table: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is not None


def scan(conn: sqlite3.Connection) -> dict[str, dict[int, int]]:
    out: dict[str, dict[int, int]] = {}
    for t in TABLES:
        if not _exists(conn, t):
            print(f"{t}: 表不存在，跳过")
            out[t] = {}
            continue
        rows = conn.execute(
            f"SELECT id, uid, question_id FROM {t} WHERE module=? AND question_id IS NOT NULL ORDER BY id",
            (MODULE,),
        ).fetchall()
        out[t] = {int(r[0]): int(r[2]) for r in rows}
        print(f"{t}: module={MODULE} 且 question_id 非空 {len(rows)} 行：")
        for r in rows:
            print(f"  id={r[0]} uid={r[1]} question_id={r[2]}")
    return out


def apply(conn: sqlite3.Connection, hits: dict[str, dict[int, int]], record: str) -> None:
    with open(record, "w", encoding="utf-8") as f:
        json.dump({"at": time.time(), "rows": hits}, f, ensure_ascii=False)
    for t, m in hits.items():
        if not m:
            continue
        ids = list(m)
        marks = ",".join("?" * len(ids))
        n = conn.execute(
            f"UPDATE {t} SET question_id=NULL WHERE id IN ({marks}) AND module=? AND question_id IS NOT NULL",
            (*ids, MODULE),
        ).rowcount
        print(f"{t}: 已置空 question_id {n}/{len(ids)}")
    conn.commit()
    print(f"记录 {record}")


def restore(conn: sqlite3.Connection, record: str) -> None:
    with open(record, encoding="utf-8") as f:
        rows = json.load(f)["rows"]
    for t, m in rows.items():
        n = 0
        for sid, qid in m.items():
            n += conn.execute(
                f"UPDATE {t} SET question_id=? WHERE id=? AND question_id IS NULL", (qid, int(sid))
            ).rowcount
        print(f"{t}: 还原 question_id {n}/{len(m)}")
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--record", default="r483-shizheng-qid-null.json")
    ap.add_argument("--restore", metavar="FILE")
    a = ap.parse_args()
    conn = sqlite3.connect(a.db, timeout=30)
    if a.restore:
        restore(conn, a.restore)
        return
    hits = scan(conn)
    if a.apply:
        apply(conn, hits, a.record)
    else:
        print("dry-run：未写库（--apply 写入）")


if __name__ == "__main__":
    main()
