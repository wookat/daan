#!/usr/bin/env python3
"""清理 exam_papers.question_ids 的卷内重复题。

历史 ingest 曾把同一 qid 在同一卷 question_ids 里写入多次（答题卡渲染两遍、判分重复计）。
去重保首次出现位置；不动跨 source 混入题（联考省际变体题混入属正常题源结构，
2024 国考聚合卷 kind=retired 不出现在前端列表，也不动）。

幂等：重复执行第二次应输出 0 改动。
用法：
    python backend/scripts/dedupe_exam_papers.py --dry-run   # 只打印将改动的卷
    python backend/scripts/dedupe_exam_papers.py            # 实际写入
    DB_PATH=/path/to/data.db python backend/scripts/dedupe_exam_papers.py
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import db


def scan(conn):
    """返回 [(pid, title, kind, old_n, new_qids)]。"""
    out = []
    for r in conn.execute(
        "SELECT id, title, kind, question_ids FROM exam_papers ORDER BY id"
    ).fetchall():
        qids = json.loads(r["question_ids"] or "[]")
        seen: set[int] = set()
        deduped = [i for i in qids if not (i in seen or seen.add(i))]
        if len(deduped) != len(qids):
            out.append((r["id"], r["title"], r["kind"], len(qids), deduped))
    return out


def main():
    ap = argparse.ArgumentParser(description="清理真题卷 question_ids 的卷内重复题")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    print(f"数据库：{os.path.abspath(db.DB_PATH)}")
    db.init_db()
    conn = db.get_conn()
    changes = scan(conn)
    for pid, title, kind, old_n, kept in changes:
        print(f"- id={pid} [{kind}] {title[:60]}")
        print(f"    {old_n} -> {len(kept)} 题（去重 -{old_n - len(kept)}）")
    if not changes:
        print("没有需要清理的卷。")
        conn.close()
        return
    if args.dry_run:
        print(f"\n[dry-run] 共 {len(changes)} 卷待清理，未写入。")
        conn.close()
        return
    for pid, _, _, _, kept in changes:
        conn.execute(
            "UPDATE exam_papers SET question_ids=? WHERE id=?",
            (json.dumps(kept), pid),
        )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    print(f"\n完成：清理 {len(changes)} 卷（幂等，可重复执行）。")


if __name__ == "__main__":
    main()
