"""错题本存储（SQLite）。"""
import json
import os
import sqlite3
import time

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "data.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            correct_answer TEXT,
            methods TEXT,
            error_reason TEXT,
            explanation TEXT
        )"""
    )
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    for col, ddl in [
        ("review_count", "ALTER TABLE mistakes ADD COLUMN review_count INTEGER DEFAULT 0"),
        ("review_streak", "ALTER TABLE mistakes ADD COLUMN review_streak INTEGER DEFAULT 0"),
        ("next_review", "ALTER TABLE mistakes ADD COLUMN next_review REAL"),
        ("mastered", "ALTER TABLE mistakes ADD COLUMN mastered INTEGER DEFAULT 0"),
    ]:
        if col not in cols:
            conn.execute(ddl)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT,
            question_type TEXT,
            question TEXT UNIQUE,
            options TEXT,
            answer TEXT,
            explanation TEXT,
            source TEXT
        )"""
    )
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "submodule" not in qcols:
        conn.execute("ALTER TABLE questions ADD COLUMN submodule TEXT")
    conn.commit()
    conn.close()
    _seed_questions()


def _seed_questions():
    """启动时从 knowledge/questions_bank.jsonl 导入题库（按题干去重）。"""
    path = os.path.join(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".",
                        "knowledge", "questions_bank.jsonl")
    alt = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "questions_bank.jsonl")
    path = path if os.path.exists(path) else alt
    if not os.path.exists(path):
        return
    conn = get_conn()
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except json.JSONDecodeError:
                continue
            conn.execute(
                "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule) VALUES (?,?,?,?,?,?,?,?)",
                (
                    q.get("module"),
                    q.get("question_type"),
                    q.get("question"),
                    json.dumps(q.get("options", {}), ensure_ascii=False),
                    q.get("answer"),
                    q.get("explanation"),
                    q.get("source"),
                    q.get("submodule"),
                ),
            )
            if q.get("submodule"):
                conn.execute(
                    "UPDATE questions SET submodule=? WHERE question=? AND (submodule IS NULL OR submodule='')",
                    (q["submodule"], q.get("question")),
                )
    conn.commit()
    conn.close()


def random_questions(module: str | None = None, limit: int = 10, submodule: str | None = None) -> list[dict]:
    conn = get_conn()
    if module and submodule:
        rows = conn.execute(
            "SELECT * FROM questions WHERE module=? AND submodule=? ORDER BY RANDOM() LIMIT ?",
            (module, submodule, limit),
        ).fetchall()
    elif module:
        rows = conn.execute(
            "SELECT * FROM questions WHERE module=? ORDER BY RANDOM() LIMIT ?", (module, limit)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM questions ORDER BY RANDOM() LIMIT ?", (limit,)).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def question_counts() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT module, COUNT(*) n FROM questions GROUP BY module ORDER BY n DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def submodule_counts(module: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT submodule, COUNT(*) n FROM questions WHERE module=? AND submodule IS NOT NULL "
        "GROUP BY submodule ORDER BY n DESC",
        (module,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_mistake(rec: dict) -> int:
    conn = get_conn()
    qtext = rec.get("question_text")
    if qtext:
        dup = conn.execute(
            "SELECT id FROM mistakes WHERE question_text=? LIMIT 1", (qtext,)
        ).fetchone()
        if dup:
            conn.close()
            return dup["id"]
    cur = conn.execute(
        """INSERT INTO mistakes
           (created_at, module, question_type, question_text, user_answer,
            correct_answer, methods, error_reason, explanation)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            time.time(),
            rec.get("module"),
            rec.get("question_type"),
            rec.get("question_text"),
            rec.get("user_answer"),
            rec.get("correct_answer"),
            json.dumps(rec.get("methods", []), ensure_ascii=False),
            rec.get("error_reason"),
            rec.get("explanation"),
        ),
    )
    conn.commit()
    rowid = cur.lastrowid
    conn.close()
    return rowid


def list_mistakes(limit: int = 100) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM mistakes ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["methods"] = json.loads(d.get("methods") or "[]")
        out.append(d)
    return out


def update_mistake(mid: int, fields: dict):
    allowed = {"error_reason", "mastered"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    conn = get_conn()
    clause = ", ".join(f"{k}=?" for k in sets)
    conn.execute(f"UPDATE mistakes SET {clause} WHERE id=?", (*sets.values(), mid))
    conn.commit()
    conn.close()


def delete_mistake(mid: int):
    conn = get_conn()
    conn.execute("DELETE FROM mistakes WHERE id=?", (mid,))
    conn.commit()
    conn.close()


REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30]


def due_reviews(limit: int = 20) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM mistakes WHERE (mastered IS NULL OR mastered=0) "
        "AND (next_review IS NULL OR next_review <= ?) "
        "ORDER BY next_review IS NOT NULL, next_review, created_at LIMIT ?",
        (time.time(), limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["methods"] = json.loads(d.get("methods") or "[]")
        out.append(d)
    return out


def record_review(mid: int, correct: bool) -> dict:
    conn = get_conn()
    row = conn.execute("SELECT review_streak FROM mistakes WHERE id=?", (mid,)).fetchone()
    if not row:
        conn.close()
        raise KeyError(mid)
    streak = (row["review_streak"] or 0) + 1 if correct else 0
    days = REVIEW_INTERVALS_DAYS[min(streak - 1, len(REVIEW_INTERVALS_DAYS) - 1)] if correct else 1
    nxt = time.time() + days * 86400
    mastered = 1 if streak >= 2 else 0
    conn.execute(
        "UPDATE mistakes SET review_count=review_count+1, review_streak=?, next_review=?, mastered=? WHERE id=?",
        (streak, nxt, mastered, mid),
    )
    conn.commit()
    conn.close()
    return {"streak": streak, "next_review_days": days, "mastered": bool(mastered)}


def stats() -> dict:
    conn = get_conn()
    by_module = conn.execute(
        "SELECT module, COUNT(*) n FROM mistakes GROUP BY module ORDER BY n DESC"
    ).fetchall()
    by_type = conn.execute(
        "SELECT question_type, COUNT(*) n FROM mistakes GROUP BY question_type ORDER BY n DESC LIMIT 10"
    ).fetchall()
    by_reason = conn.execute(
        "SELECT error_reason, COUNT(*) n FROM mistakes WHERE error_reason IS NOT NULL AND error_reason != '' "
        "GROUP BY error_reason ORDER BY n DESC"
    ).fetchall()
    conn.close()
    return {
        "by_module": [dict(r) for r in by_module],
        "by_type": [dict(r) for r in by_type],
        "by_reason": [dict(r) for r in by_reason],
    }
