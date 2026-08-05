#!/usr/bin/env python3
"""将重排后的 shizheng_bank.jsonl 同步到已有数据库（生产/本地）。

_seed_shizheng 使用 INSERT OR IGNORE（按题干去重），已存在的行不会被更新，
因此需要本迁移脚本按题干 UPDATE options/answer/explanation。

用法：
    python3 backend/scripts/migrate_shizheng_rebalance.py [db_path]
db_path 默认取环境变量 KAOGONG_DB 或 backend/kaogong.db。
"""
import json
import os
import sqlite3
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
BANK = os.path.join(ROOT, "knowledge", "shizheng_bank.jsonl")


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "KAOGONG_DB", os.path.join(ROOT, "backend", "kaogong.db"))
    if not os.path.exists(db_path):
        print(f"db not found: {db_path}")
        sys.exit(1)
    conn = sqlite3.connect(db_path)
    updated = missing = unchanged = 0
    with open(BANK, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            q = json.loads(line)
            row = conn.execute(
                "SELECT options, answer, explanation FROM shizheng_questions WHERE question=?",
                (q["question"],),
            ).fetchone()
            if row is None:
                missing += 1
                print(f"MISSING: {q['question'][:40]}")
                continue
            opts = json.dumps(q["options"], ensure_ascii=False)
            if row[0] == opts and row[1] == q["answer"] and row[2] == q["explanation"]:
                unchanged += 1
                continue
            conn.execute(
                "UPDATE shizheng_questions SET options=?, answer=?, explanation=? WHERE question=?",
                (opts, q["answer"], q["explanation"], q["question"]),
            )
            updated += 1
    conn.commit()
    conn.close()
    print(f"updated={updated} unchanged={unchanged} missing_in_db={missing}")


if __name__ == "__main__":
    main()
