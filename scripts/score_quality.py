#!/usr/bin/env python3
"""全库题目质量打分管线：规则综合打分写入 questions.quality_score。

用法：DB_PATH=/path/to/data.db python3 scripts/score_quality.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import db, quality  # noqa: E402


def main():
    conn = db.get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "quality_score" not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN quality_score INTEGER")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_q_quality ON questions(quality_score)")
        conn.commit()
    stats = quality.score_all(conn, log=print)
    print(f"scored {stats['n']} questions in {stats['seconds']}s")
    for r in conn.execute(
        "SELECT CASE WHEN quality_score>=80 THEN '80-100' WHEN quality_score>=60 THEN '60-79' "
        "WHEN quality_score>=40 THEN '40-59' ELSE '0-39' END bucket, COUNT(*) n "
        "FROM questions GROUP BY bucket ORDER BY bucket DESC"
    ):
        print(f"  {r['bucket']}: {r['n']}")
    conn.close()


if __name__ == "__main__":
    main()
