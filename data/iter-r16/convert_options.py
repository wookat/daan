"""轮16：把 options 为 Python dict 字符串（非 JSON）的题转换成合法 JSON。

用法：python convert_options.py <data.db>
只生成 SQL（stdout），不直接改库；每条 UPDATE 带 options 原值守卫，幂等可重放。
"""
import ast
import json
import sqlite3
import sys


def esc(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, options FROM questions WHERE options LIKE \"{'%\" ORDER BY id"
    ).fetchall()
    for r in rows:
        d = ast.literal_eval(r["options"])
        assert isinstance(d, dict), r["id"]
        new = json.dumps(d, ensure_ascii=False)
        json.loads(new)
        print(f"UPDATE questions SET options={esc(new)} WHERE id={r['id']} AND options={esc(r['options'])};")


if __name__ == "__main__":
    main(sys.argv[1])
