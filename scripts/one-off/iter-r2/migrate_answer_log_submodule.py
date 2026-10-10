#!/usr/bin/env python3
"""迭代轮2 P0-2：answer_log.submodule 旧考点名一次性归一迁移。

按轮1 T3b 同义合并定案映射（backend/app/db.py SUBMODULE_MERGE）把 answer_log
中的旧考点名批量 UPDATE 为当前 taxonomy 名，并打印迁移前后对比。

用法：python3 scripts/iter-r2/migrate_answer_log_submodule.py <data.db> [--dry-run]
"""
import os
import sqlite3
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend"))
from app.db import SUBMODULE_MERGE  # noqa: E402


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    db_path = sys.argv[1]
    dry = "--dry-run" in sys.argv
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    total = conn.execute("SELECT COUNT(*) FROM answer_log").fetchone()[0]
    before = 0
    plan = []
    for module, mp in SUBMODULE_MERGE.items():
        for old, new in mp.items():
            n = conn.execute(
                "SELECT COUNT(*) FROM answer_log WHERE module=? AND submodule=?",
                (module, old),
            ).fetchone()[0]
            if n:
                before += n
                plan.append((module, old, new, n))

    print(f"answer_log 总行数: {total}")
    print(f"命中旧考点名行数: {before}")
    for module, old, new, n in sorted(plan, key=lambda x: -x[3]):
        print(f"  {module}: {old} -> {new}  ({n} 行)")

    if dry:
        print("--dry-run，未执行 UPDATE")
        return

    changed = 0
    for module, old, new, _ in plan:
        cur = conn.execute(
            "UPDATE answer_log SET submodule=? WHERE module=? AND submodule=?",
            (new, module, old),
        )
        changed += cur.rowcount
    conn.commit()

    remain = 0
    for module, mp in SUBMODULE_MERGE.items():
        for old in mp:
            remain += conn.execute(
                "SELECT COUNT(*) FROM answer_log WHERE module=? AND submodule=?",
                (module, old),
            ).fetchone()[0]
    print(f"已更新: {changed} 行；迁移后残留旧名: {remain} 行")
    conn.close()


if __name__ == "__main__":
    main()
