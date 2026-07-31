"""错题本存储（SQLite）。"""
import json
import os
import secrets
import sqlite3
import time

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "data.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
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
    for col, ddl in [
        ("submodule", "ALTER TABLE questions ADD COLUMN submodule TEXT"),
        ("hs_explanation", "ALTER TABLE questions ADD COLUMN hs_explanation TEXT"),
        ("hs_up", "ALTER TABLE questions ADD COLUMN hs_up INTEGER DEFAULT 0"),
        ("hs_down", "ALTER TABLE questions ADD COLUMN hs_down INTEGER DEFAULT 0"),
        ("is_real", "ALTER TABLE questions ADD COLUMN is_real INTEGER DEFAULT 0"),
        ("exam_year", "ALTER TABLE questions ADD COLUMN exam_year INTEGER"),
        ("exam_region", "ALTER TABLE questions ADD COLUMN exam_region TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS backups (
            code TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_module ON questions(module, submodule)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_real ON questions(is_real)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS explain_cache (
            key TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            explanation TEXT,
            hits INTEGER DEFAULT 0,
            up INTEGER DEFAULT 0,
            down INTEGER DEFAULT 0
        )"""
    )
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


def random_questions(
    module: str | None = None,
    limit: int = 10,
    submodule: str | None = None,
    real_only: bool = False,
    year: int | None = None,
    region: str | None = None,
) -> list[dict]:
    conn = get_conn()
    where = []
    args: list = []
    if module:
        where.append("module=?")
        args.append(module)
    if submodule:
        where.append("submodule=?")
        args.append(submodule)
    if real_only:
        where.append("is_real=1")
    if year:
        where.append("exam_year=?")
        args.append(year)
    if region:
        where.append("exam_region=?")
        args.append(region)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(
        f"SELECT * FROM questions {clause} ORDER BY (hs_explanation IS NULL OR hs_explanation=''), RANDOM() LIMIT ?",
        (*args, limit),
    ).fetchall()
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
        "SELECT submodule, COUNT(*) n FROM questions WHERE module=? AND submodule IS NOT NULL AND submodule!='' "
        "GROUP BY submodule HAVING n >= 8 ORDER BY n DESC LIMIT 30",
        (module,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def real_filters() -> dict:
    """真题可用的年份/地区筛选项及题量。"""
    conn = get_conn()
    years = [
        dict(r)
        for r in conn.execute(
            "SELECT exam_year y, COUNT(*) n FROM questions WHERE is_real=1 AND exam_year IS NOT NULL "
            "GROUP BY exam_year ORDER BY exam_year DESC"
        )
    ]
    regions = [
        dict(r)
        for r in conn.execute(
            "SELECT exam_region r, COUNT(*) n FROM questions WHERE is_real=1 AND exam_region IS NOT NULL AND exam_region!='' "
            "GROUP BY exam_region HAVING n >= 20 ORDER BY n DESC"
        )
    ]
    conn.close()
    return {"years": years, "regions": regions}


def get_explain_cache(key: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM explain_cache WHERE key=?", (key,)).fetchone()
    if row:
        conn.execute("UPDATE explain_cache SET hits=hits+1 WHERE key=?", (key,))
        conn.commit()
    conn.close()
    return dict(row) if row else None


def save_explain_cache(key: str, meta: dict, explanation: str):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO explain_cache (key, created_at, module, question_type, question_text, user_answer, explanation, hits, up, down) "
        "VALUES (?,?,?,?,?,?,?, COALESCE((SELECT hits FROM explain_cache WHERE key=?),0), "
        "COALESCE((SELECT up FROM explain_cache WHERE key=?),0), COALESCE((SELECT down FROM explain_cache WHERE key=?),0))",
        (
            key,
            time.time(),
            meta.get("module"),
            meta.get("question_type"),
            meta.get("question_text"),
            meta.get("user_answer"),
            explanation,
            key,
            key,
            key,
        ),
    )
    conn.commit()
    conn.close()


def rate_explain(key: str, up: bool):
    conn = get_conn()
    col = "up" if up else "down"
    conn.execute(f"UPDATE explain_cache SET {col}={col}+1 WHERE key=?", (key,))
    conn.commit()
    conn.close()


def rate_question_hs(qid: int, up: bool):
    conn = get_conn()
    col = "hs_up" if up else "hs_down"
    conn.execute(f"UPDATE questions SET {col}={col}+1 WHERE id=?", (qid,))
    conn.commit()
    conn.close()


def set_question_hs_explanation(qid: int, text: str):
    conn = get_conn()
    conn.execute("UPDATE questions SET hs_explanation=? WHERE id=?", (text, qid))
    conn.commit()
    conn.close()


def export_questions(offset: int = 0, limit: int = 200, module: str | None = None, missing_only: bool = True) -> list[dict]:
    conn = get_conn()
    where = []
    args: list = []
    if module:
        where.append("module=?")
        args.append(module)
    if missing_only:
        where.append("(hs_explanation IS NULL OR hs_explanation='')")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(
        f"SELECT id, module, submodule, question_type, question, options, answer, explanation FROM questions {clause} ORDER BY id LIMIT ? OFFSET ?",
        (*args, limit, offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


VALID_MODULES = {"ziliao", "shuliang", "yanyu", "panduan", "changshi"}

_SUB_PREFIXES = (
    "数学运算-", "数量关系-", "资料分析-", "言语理解-", "言语理解与表达-",
    "判断推理-", "逻辑判断-", "常识判断-", "常识-",
)
_SUB_SYNONYMS = {
    "溶液问题": "浓度问题",
    "经济利润问题": "经济利润",
    "行程": "行程问题",
    "工程": "工程问题",
    "排列组合与概率问题": "排列组合与概率",
    "排列组合": "排列组合与概率",
    "概率问题": "排列组合与概率",
    "概率": "排列组合与概率",
    "几何": "几何问题",
    "逻辑填空（实词/成语辨析）": "逻辑填空",
    "中心理解题": "中心理解",
    "主旨概括": "中心理解",
    "细节理解题": "细节理解",
    "细节判断": "细节理解",
}


def normalize_submodule(sub: str | None) -> str | None:
    if not sub:
        return sub
    s = str(sub).strip()
    for p in _SUB_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
            break
    return _SUB_SYNONYMS.get(s, s) or None


def import_questions(items: list[dict]) -> dict:
    conn = get_conn()
    inserted = 0
    skipped = 0
    for q in items:
        opts = q.get("options") or {}
        if q.get("is_real") and (not q.get("source") or q.get("source") == "original"):
            q["is_real"] = False
        if (
            q.get("module") not in VALID_MODULES
            or not q.get("question")
            or not q.get("answer")
            or not isinstance(opts, dict)
            or q.get("answer") not in opts
        ):
            skipped += 1
            continue
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, is_real, exam_year, exam_region) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                q.get("module"),
                q.get("question_type"),
                q.get("question"),
                json.dumps(opts, ensure_ascii=False),
                q.get("answer"),
                q.get("explanation"),
                q.get("source"),
                normalize_submodule(q.get("submodule")),
                1 if q.get("is_real") else 0,
                q.get("exam_year"),
                q.get("exam_region"),
            ),
        )
        if cur.rowcount:
            inserted += 1
        else:
            skipped += 1
            if q.get("is_real"):
                conn.execute(
                    "UPDATE questions SET is_real=1, exam_year=COALESCE(exam_year,?), exam_region=COALESCE(exam_region,?) WHERE question=?",
                    (q.get("exam_year"), q.get("exam_region"), q.get("question")),
                )
    conn.commit()
    conn.close()
    return {"inserted": inserted, "skipped": skipped}


def import_hs_explanations(items: list[dict]) -> int:
    conn = get_conn()
    n = 0
    for it in items:
        qid = it.get("id")
        text = (it.get("hs_explanation") or "").strip()
        if not qid or not text:
            continue
        cur = conn.execute("UPDATE questions SET hs_explanation=? WHERE id=?", (text, int(qid)))
        n += cur.rowcount
    conn.commit()
    conn.close()
    return n


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


def save_backup(code: str | None, data: dict) -> str:
    conn = get_conn()
    if not code:
        code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    else:
        code = str(code).strip().upper()[:16]
    conn.execute(
        "INSERT INTO backups (code, data, updated_at) VALUES (?,?,?) "
        "ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (code, json.dumps(data, ensure_ascii=False)[:500000], time.time()),
    )
    conn.commit()
    conn.close()
    return code


def get_backup(code: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT data FROM backups WHERE code=?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["data"])
