"""错题本存储（SQLite）。"""
import hashlib
import json
import os
import random
import re
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
        ("times", "ALTER TABLE mistakes ADD COLUMN times INTEGER DEFAULT 1"),
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
        ("disabled", "ALTER TABLE questions ADD COLUMN disabled INTEGER DEFAULT 0"),
        ("import_batch", "ALTER TABLE questions ADD COLUMN import_batch TEXT"),
        ("image", "ALTER TABLE questions ADD COLUMN image TEXT"),
        ("image_credit", "ALTER TABLE questions ADD COLUMN image_credit TEXT"),
        ("xp_explanation", "ALTER TABLE questions ADD COLUMN xp_explanation TEXT"),
        ("xp_school", "ALTER TABLE questions ADD COLUMN xp_school TEXT"),
        ("has_hs", "ALTER TABLE questions ADD COLUMN has_hs INTEGER DEFAULT 0"),
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
    if "has_hs" not in qcols:
        conn.execute("UPDATE questions SET has_hs=(hs_explanation IS NOT NULL AND hs_explanation!='')")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_pick ON questions"
        "(module, submodule, is_real, disabled, has_hs, exam_year, exam_region, id)"
    )
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
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_year INTEGER,
            exam_region TEXT,
            paper TEXT,
            qtype TEXT,
            material TEXT,
            question TEXT UNIQUE,
            reference TEXT,
            notes TEXT,
            import_batch TEXT,
            disabled INTEGER
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            topic TEXT,
            content TEXT UNIQUE,
            source TEXT,
            import_batch TEXT,
            disabled INTEGER
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
    uid: str | None = None,
    adaptive: bool = False,
) -> list[dict]:
    conn = get_conn()
    where = []
    args: list = []
    order = "has_hs DESC, RANDOM()"
    if adaptive and uid and (module or submodule):
        _ensure_answer_log(conn)
        acl = "uid=?"
        aargs: list = [uid]
        if submodule:
            acl += " AND submodule=?"
            aargs.append(submodule)
        elif module:
            acl += " AND module=?"
            aargs.append(module)
        st = conn.execute(
            f"SELECT COUNT(*) n, SUM(correct) c FROM (SELECT correct FROM answer_log WHERE {acl} ORDER BY id DESC LIMIT 60)",
            aargs,
        ).fetchone()
        if st and (st["n"] or 0) >= 5:
            target = max(20, min(90, round(100 * (st["c"] or 0) / st["n"]) - 10))
            order = (
                "has_hs DESC, CASE WHEN correct_ratio IS NULL THEN 1 ELSE 0 END, "
                f"ABS(correct_ratio - {target}) + ABS(RANDOM()) % 15"
            )
    if uid:
        _ensure_answer_log(conn)
        done = [
            r["question_id"]
            for r in conn.execute(
                "SELECT DISTINCT question_id FROM (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL ORDER BY id DESC LIMIT 3000)",
                (uid,),
            )
        ]
        if done:
            where.append(f"id NOT IN ({','.join('?' * len(done))})")
            args.extend(done)
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
    where.append("(disabled IS NULL OR disabled=0)")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    ids: list[int] = []
    if not real_only:
        want_real = max(1, round(limit * 0.6))
        ids = [
            r["id"]
            for r in conn.execute(
                f"SELECT id FROM questions {clause} AND is_real=1 ORDER BY {order} LIMIT ?",
                (*args, want_real),
            )
        ]
    if len(ids) < limit:
        placeholders = ",".join("?" * len(ids)) or "0"
        ids += [
            r["id"]
            for r in conn.execute(
                f"SELECT id FROM questions {clause} AND id NOT IN ({placeholders}) "
                f"ORDER BY {order} LIMIT ?",
                (*args, *ids, limit - len(ids)),
            )
        ]
    if uid and len(ids) < limit:
        where2 = [w for w in where if not w.startswith("id NOT IN")]
        base_args = []
        if module:
            base_args.append(module)
        if submodule:
            base_args.append(submodule)
        if year:
            base_args.append(year)
        if region:
            base_args.append(region)
        clause2 = "WHERE " + " AND ".join(where2)
        placeholders = ",".join("?" * len(ids)) or "0"
        ids += [
            r["id"]
            for r in conn.execute(
                f"SELECT id FROM questions {clause2} AND id NOT IN ({placeholders}) "
                "ORDER BY has_hs DESC, RANDOM() LIMIT ?",
                (*base_args, *ids, limit - len(ids)),
            )
        ]
    random.shuffle(ids)
    rows = (
        conn.execute(
            f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))})", ids
        ).fetchall()
        if ids
        else []
    )
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        by_id[d["id"]] = d
    return [by_id[i] for i in ids if i in by_id]


def _material_key(text: str) -> str | None:
    """提取资料分析题的材料指纹（用于同材料题组）。"""
    t = text or ""
    if "【资料】" in t:
        t = t.split("【资料】", 1)[1]
    m = re.split(r"问题\s*[：:]", t, maxsplit=1)
    mat = m[0] if len(m) > 1 else t
    mat = re.sub(r"\s+", "", mat)
    if len(mat) < 120:
        return None
    return hashlib.md5(mat[:400].encode()).hexdigest()


def refresh_material_hash(batch: int = 20000) -> int:
    conn = get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "material_hash" not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN material_hash TEXT")
    rows = conn.execute(
        "SELECT id, question FROM questions WHERE module='ziliao' AND material_hash IS NULL LIMIT ?",
        (batch,),
    ).fetchall()
    n = 0
    for r in rows:
        conn.execute(
            "UPDATE questions SET material_hash=? WHERE id=?",
            (_material_key(r["question"]) or "-", r["id"]),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


def grouped_ziliao_questions(limit: int = 10, uid: str | None = None) -> list[dict]:
    """资料分析材料题组：选若干材料，同材料题连续出，标注 组内序号/组题数。"""
    conn = get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "material_hash" not in cols:
        conn.close()
        return random_questions("ziliao", limit, uid=uid)
    out: list[dict] = []
    done: set[int] = set()
    if uid:
        done = {
            r["question_id"]
            for r in conn.execute(
                "SELECT DISTINCT question_id FROM (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL ORDER BY id DESC LIMIT 3000)",
                (uid,),
            )
        }
    hashes = [
        r["material_hash"]
        for r in conn.execute(
            """SELECT material_hash FROM questions
               WHERE module='ziliao' AND material_hash IS NOT NULL AND material_hash!='-'
                 AND (disabled IS NULL OR disabled=0)
               GROUP BY material_hash HAVING COUNT(*)>=2
               ORDER BY RANDOM() LIMIT 24"""
        )
    ]
    for h in hashes:
        if len(out) >= limit:
            break
        rows = conn.execute(
            "SELECT * FROM questions WHERE module='ziliao' AND material_hash=? "
            "AND (disabled IS NULL OR disabled=0) ORDER BY id LIMIT 5",
            (h,),
        ).fetchall()
        if len(rows) < 2:
            continue
        if done and any(r["id"] in done for r in rows):
            continue
        for i, r in enumerate(rows):
            d = dict(r)
            d["options"] = json.loads(d.get("options") or "{}")
            d["group_seq"] = f"{i + 1}/{len(rows)}"
            out.append(d)
    conn.close()
    if len(out) < limit:
        seen = {d["id"] for d in out}
        out += [q for q in random_questions("ziliao", limit - len(out), uid=uid) if q["id"] not in seen]
    return out


def import_shenlun(questions: list[dict], materials: list[dict], batch: str) -> dict:
    """申论数据导入：进待审（disabled=2），按内容去重。"""
    conn = get_conn()
    qn = mn = 0
    for q in questions or []:
        qt = (q.get("qtype") or "").split("(")[0].split("（")[0] or None
        cur = conn.execute(
            """INSERT OR IGNORE INTO shenlun_questions
               (exam_year, exam_region, paper, qtype, material, question, reference, notes, import_batch, disabled)
               VALUES (?,?,?,?,?,?,?,?,?,2)""",
            (q.get("exam_year"), q.get("exam_region"), q.get("paper"), qt,
             q.get("material"), q.get("question"), q.get("reference"), q.get("notes"), batch),
        )
        qn += cur.rowcount
    for m in materials or []:
        cur = conn.execute(
            """INSERT OR IGNORE INTO shenlun_materials
               (type, topic, content, source, import_batch, disabled)
               VALUES (?,?,?,?,?,2)""",
            (m.get("type"), m.get("topic"), m.get("content"), m.get("source"), batch),
        )
        mn += cur.rowcount
    conn.commit()
    conn.close()
    return {"questions": qn, "materials": mn, "batch": batch}


def shenlun_questions(qtype: str | None = None, year: int | None = None, region: str | None = None, limit: int = 20, offset: int = 0) -> list[dict]:
    conn = get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if qtype:
        where.append("qtype LIKE ? || '%'")
        args.append(qtype)
    if year:
        where.append("exam_year=?")
        args.append(year)
    if region:
        where.append("exam_region=?")
        args.append(region)
    rows = conn.execute(
        f"""SELECT id, exam_year, exam_region, paper, qtype, question,
                   LENGTH(material) material_len
            FROM shenlun_questions WHERE {' AND '.join(where)}
            ORDER BY exam_year DESC, id LIMIT ? OFFSET ?""",
        (*args, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def shenlun_filters() -> dict:
    conn = get_conn()
    years = [r[0] for r in conn.execute(
        "SELECT DISTINCT exam_year FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_year IS NOT NULL ORDER BY exam_year DESC")]
    regions = [r[0] for r in conn.execute(
        "SELECT exam_region FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_region IS NOT NULL "
        "GROUP BY exam_region ORDER BY COUNT(*) DESC")]
    conn.close()
    return {"years": years, "regions": regions}


def _ensure_shenlun_answers(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            qid INTEGER NOT NULL,
            answer TEXT NOT NULL,
            result TEXT,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sa_uid ON shenlun_answers(uid, qid, id)")


def _ensure_mat_favs(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_mat_favs (
            uid TEXT NOT NULL,
            mid INTEGER NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (uid, mid)
        )"""
    )


def mat_fav_ids(uid: str) -> list[int]:
    conn = get_conn()
    _ensure_mat_favs(conn)
    ids = [r[0] for r in conn.execute(
        "SELECT mid FROM shenlun_mat_favs WHERE uid=? ORDER BY created_at DESC", (uid,))]
    conn.close()
    return ids


def mat_fav_set(uid: str, mid: int, on: bool):
    conn = get_conn()
    _ensure_mat_favs(conn)
    if on:
        conn.execute(
            "INSERT OR IGNORE INTO shenlun_mat_favs (uid, mid, created_at) VALUES (?,?,?)",
            (uid, mid, time.time()))
    else:
        conn.execute("DELETE FROM shenlun_mat_favs WHERE uid=? AND mid=?", (uid, mid))
    conn.commit()
    conn.close()


def mat_fav_items(uid: str) -> list[dict]:
    conn = get_conn()
    _ensure_mat_favs(conn)
    rows = conn.execute(
        """SELECT m.* FROM shenlun_mat_favs f
           JOIN shenlun_materials m ON m.id=f.mid AND (m.disabled IS NULL OR m.disabled=0)
           WHERE f.uid=? ORDER BY f.created_at DESC LIMIT 200""",
        (uid,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_shenlun_answer(uid: str, qid: int, answer: str, result: str) -> int:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    cur = conn.execute(
        "INSERT INTO shenlun_answers (uid, qid, answer, result, created_at) VALUES (?,?,?,?,?)",
        (uid, qid, answer, result, time.time()),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def shenlun_answer_history(uid: str, qid: int | None = None, limit: int = 20) -> list[dict]:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    where = "uid=?"
    args: list = [uid]
    if qid:
        where += " AND qid=?"
        args.append(qid)
    rows = conn.execute(
        f"""SELECT a.id, a.qid, a.answer, a.result, a.created_at,
                   q.qtype, q.question
            FROM shenlun_answers a LEFT JOIN shenlun_questions q ON q.id=a.qid
            WHERE {where} ORDER BY a.id DESC LIMIT ?""",
        (*args, min(limit, 50)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _shenlun_issue_lines(result: str, section: str, limit: int = 3) -> list[str]:
    m = re.search(rf"【{section}】(.*?)(?=【|$)", result or "", re.S)
    if not m:
        return []
    lines = []
    for ln in m.group(1).splitlines():
        ln = re.sub(r"^[\s\-•·*\d．．.、)）]+", "", ln).strip()
        if 4 <= len(ln) <= 60:
            lines.append(ln)
    return lines[:limit]


def shenlun_stats(uid: str) -> dict:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    total, last = conn.execute(
        "SELECT COUNT(*), MAX(created_at) FROM shenlun_answers WHERE uid=?", (uid,)
    ).fetchone()
    by_type = [
        {"qtype": r[0] or "其他", "n": r[1]}
        for r in conn.execute(
            """SELECT q.qtype, COUNT(*) FROM shenlun_answers a
               LEFT JOIN shenlun_questions q ON q.id=a.qid
               WHERE a.uid=? GROUP BY q.qtype ORDER BY COUNT(*) DESC""",
            (uid,),
        )
    ]
    issues = []
    for (res, qtype) in conn.execute(
        """SELECT a.result, q.qtype FROM shenlun_answers a
           LEFT JOIN shenlun_questions q ON q.id=a.qid
           WHERE a.uid=? AND a.result IS NOT NULL ORDER BY a.id DESC LIMIT 10""",
        (uid,),
    ):
        for sec in ("遗漏要点", "提升建议"):
            for ln in _shenlun_issue_lines(res, sec, 2):
                issues.append({"qtype": qtype or "申论", "kind": sec, "text": ln})
        if len(issues) >= 8:
            break
    conn.close()
    return {"total": total, "last_at": last, "by_type": by_type, "issues": issues[:8]}


def shenlun_question(qid: int) -> dict | None:
    conn = get_conn()
    r = conn.execute(
        "SELECT * FROM shenlun_questions WHERE id=? AND (disabled IS NULL OR disabled=0)", (qid,)
    ).fetchone()
    conn.close()
    return dict(r) if r else None


def shenlun_materials(topic: str | None = None, mtype: str | None = None, limit: int = 20, offset: int = 0) -> list[dict]:
    conn = get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if topic:
        where.append("topic=?")
        args.append(topic)
    if mtype:
        where.append("type=?")
        args.append(mtype)
    rows = conn.execute(
        f"SELECT * FROM shenlun_materials WHERE {' AND '.join(where)} ORDER BY id LIMIT ? OFFSET ?",
        (*args, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def question_counts() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT module, COUNT(*) n FROM questions WHERE (disabled IS NULL OR disabled=0) GROUP BY module ORDER BY n DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def submodule_counts(module: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT submodule, COUNT(*) n FROM questions WHERE module=? AND (disabled IS NULL OR disabled=0) AND submodule IS NOT NULL AND submodule!='' "
        "GROUP BY submodule HAVING n >= 8 OR submodule='图形推理' ORDER BY n DESC LIMIT 30",
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


def save_practice_result(module: str | None, n: int, correct: int, secs: int) -> dict:
    """保存一次刷题结果并返回正确率百分位（击败了多少历史记录）。"""
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS practice_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            module TEXT,
            n INTEGER,
            correct INTEGER,
            secs INTEGER
        )"""
    )
    acc = correct / n if n else 0
    conn.execute(
        "INSERT INTO practice_results (created_at, module, n, correct, secs) VALUES (?,?,?,?,?)",
        (time.time(), module, n, correct, secs),
    )
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM practice_results WHERE n>0").fetchone()[0]
    beaten = conn.execute(
        "SELECT COUNT(*) FROM practice_results WHERE n>0 AND CAST(correct AS REAL)/n < ?", (acc,)
    ).fetchone()[0]
    conn.close()
    percentile = round(beaten / total * 100) if total >= 10 else None
    return {"percentile": percentile, "samples": total}


def _ensure_announcements(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            active INTEGER DEFAULT 1
        )"""
    )


def active_announcement() -> dict | None:
    conn = get_conn()
    _ensure_announcements(conn)
    row = conn.execute(
        "SELECT id, title, body FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def admin_list_announcements() -> list[dict]:
    conn = get_conn()
    _ensure_announcements(conn)
    rows = conn.execute(
        "SELECT id, created_at, title, body, active FROM announcements ORDER BY id DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_create_announcement(title: str, body: str) -> int:
    conn = get_conn()
    _ensure_announcements(conn)
    cur = conn.execute(
        "INSERT INTO announcements (created_at, title, body, active) VALUES (?,?,?,1)",
        (time.time(), title, body),
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid


def _ensure_reports(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            question_id INTEGER,
            reason TEXT NOT NULL,
            detail TEXT,
            status TEXT DEFAULT 'open'
        )"""
    )


def add_report(question_id: int | None, reason: str, detail: str) -> int:
    conn = get_conn()
    _ensure_reports(conn)
    if question_id:
        dup = conn.execute(
            "SELECT id FROM question_reports WHERE question_id=? AND reason=? "
            "AND status='open' AND created_at > ? LIMIT 1",
            (question_id, reason, time.time() - 86400),
        ).fetchone()
        if dup:
            conn.close()
            return dup["id"]
    cur = conn.execute(
        "INSERT INTO question_reports (created_at, question_id, reason, detail) VALUES (?,?,?,?)",
        (time.time(), question_id, reason, detail),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def admin_list_reports(status: str = "open") -> list[dict]:
    conn = get_conn()
    _ensure_reports(conn)
    rows = conn.execute(
        """SELECT r.id, r.created_at, r.question_id, r.reason, r.detail, r.status,
                  q.question, q.options, q.module, q.answer, q.disabled
           FROM question_reports r LEFT JOIN questions q ON q.id = r.question_id
           WHERE r.status = ? ORDER BY r.id DESC LIMIT 100""",
        (status,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_resolve_report(rid: int, status: str) -> bool:
    conn = get_conn()
    _ensure_reports(conn)
    cur = conn.execute("UPDATE question_reports SET status=? WHERE id=?", (status, rid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_set_announcement(aid: int, active: bool) -> bool:
    conn = get_conn()
    _ensure_announcements(conn)
    cur = conn.execute("UPDATE announcements SET active=? WHERE id=?", (1 if active else 0, aid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_stats() -> dict:
    conn = get_conn()
    q = conn.execute
    stats = {
        "total": q("SELECT COUNT(*) FROM questions").fetchone()[0],
        "real": q("SELECT COUNT(*) FROM questions WHERE is_real=1").fetchone()[0],
        "disabled": q("SELECT COUNT(*) FROM questions WHERE disabled=1").fetchone()[0],
        "hs_done": q("SELECT COUNT(*) FROM questions WHERE hs_explanation IS NOT NULL AND hs_explanation!=''").fetchone()[0],
        "hs_down_total": q("SELECT COUNT(*) FROM questions WHERE hs_down>0").fetchone()[0],
        "by_module": [dict(r) for r in q("SELECT module, COUNT(*) n FROM questions GROUP BY module ORDER BY n DESC")],
        "cache_entries": q("SELECT COUNT(*) FROM explain_cache").fetchone()[0],
        "cache_hits": q("SELECT COALESCE(SUM(hits),0) FROM explain_cache").fetchone()[0],
        "cache_down": q("SELECT COUNT(*) FROM explain_cache WHERE down>0").fetchone()[0],
        "mistakes": q("SELECT COUNT(*) FROM mistakes").fetchone()[0],
    }
    try:
        stats["daily_usage"] = [
            dict(r)
            for r in q(
                """SELECT date(created_at, 'unixepoch') d,
                          COUNT(*) sessions, SUM(n) answered,
                          ROUND(SUM(correct)*100.0/SUM(n), 1) acc
                   FROM practice_results WHERE n>0
                     AND created_at > strftime('%s','now') - 14*86400
                   GROUP BY d ORDER BY d"""
            )
        ]
    except Exception:
        stats["daily_usage"] = []
    conn.close()
    return stats


def admin_search_questions(
    keyword: str | None = None,
    module: str | None = None,
    flagged: bool = False,
    disabled_only: bool = False,
    offset: int = 0,
    limit: int = 20,
) -> list[dict]:
    conn = get_conn()
    where = []
    args: list = []
    if keyword:
        where.append("question LIKE ?")
        args.append(f"%{keyword}%")
    if module:
        where.append("module=?")
        args.append(module)
    if flagged:
        where.append("hs_down>0")
    if disabled_only:
        where.append("disabled=1")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    order = "hs_down DESC, id DESC" if flagged else "id DESC"
    rows = conn.execute(
        f"SELECT id, module, submodule, question, options, answer, explanation, hs_explanation, "
        f"hs_up, hs_down, is_real, exam_year, exam_region, source, disabled "
        f"FROM questions {clause} ORDER BY {order} LIMIT ? OFFSET ?",
        (*args, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


ADMIN_EDITABLE = {"answer", "explanation", "hs_explanation", "submodule", "question", "disabled", "module", "exam_year", "exam_region", "is_real"}


def admin_update_question(qid: int, fields: dict) -> bool:
    sets = {k: v for k, v in fields.items() if k in ADMIN_EDITABLE}
    if not sets:
        return False
    conn = get_conn()
    assignments = ", ".join(f"{k}=?" for k in sets)
    cur = conn.execute(f"UPDATE questions SET {assignments} WHERE id=?", (*sets.values(), qid))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def admin_flagged_cache(limit: int = 30) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT key, module, question_type, question_text, user_answer, explanation, hits, up, down "
        "FROM explain_cache WHERE down>0 ORDER BY down DESC, hits DESC LIMIT ?",
        (min(limit, 100),),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_delete_cache(key: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM explain_cache WHERE key=?", (key,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


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
    conn.execute("UPDATE questions SET hs_explanation=?, has_hs=? WHERE id=?", (text, 1 if text else 0, qid))
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
    "判断推理-", "逻辑判断-", "常识判断-", "常识-", "综合题组-",
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
    "法律常识": "法律",
    "科技常识": "科技",
    "政治常识": "政治",
    "经济常识": "经济",
    "地理常识": "地理",
    "人文": "历史人文",
    "人文常识": "历史人文",
    "历史常识": "历史人文",
    "理论政策": "政治",
    "理论": "政治",
}


_SUB_COLLAPSE = ("类比推理", "定义判断", "图形推理")


def normalize_submodule(sub: str | None) -> str | None:
    if not sub:
        return sub
    s = str(sub).strip()
    for c in _SUB_COLLAPSE:
        if s.startswith(c + "-") or s.startswith(c + "："):
            return c
    for p in _SUB_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
            break
    return _SUB_SYNONYMS.get(s, s) or None


_RESIDUE_RE = re.compile(r"[一二三四五六七八九十]、|第[一二三四五]部分|共\d+题")


def _bad_options(opts: dict) -> bool:
    vals = [str(v).strip() for v in opts.values()]
    if len(vals) < 2 or any(not v for v in vals) or len(set(vals)) < len(vals):
        return True
    return any(len(v) > 120 or _RESIDUE_RE.search(v) for v in vals)


def import_questions(items: list[dict], batch: str | None = None) -> dict:
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
            or _bad_options(opts)
        ):
            skipped += 1
            continue
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, is_real, exam_year, exam_region, disabled, import_batch, image, image_credit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
                2 if batch else 0,
                batch,
                q.get("image"),
                q.get("image_credit"),
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
    return {"inserted": inserted, "skipped": skipped, "batch": batch}


def mistakes_redo_questions(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: bool = False, uid: str | None = None) -> list[dict]:
    """把待掌握错题匹配回题库原题，供刷题页重练。"""
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, cargs = _uid_clause(uid)
    where = "mastered=0" + cl
    args: list = list(cargs)
    if qtype:
        where += " AND question_type=?"
        args.append(qtype)
    if module:
        where += " AND module=?"
        args.append(module)
    if noqt:
        where += " AND (question_type IS NULL OR question_type='')"
    rows = conn.execute(
        f"SELECT question_text, question_id FROM mistakes WHERE {where} ORDER BY COALESCE(next_review, created_at), created_at DESC LIMIT ?",
        (*args, limit * 2),
    ).fetchall()
    out = []
    seen = set()
    for r in rows:
        full = (r["question_text"] or "").strip()
        head = full.split("\n")[0].strip()
        key = re.sub(r"\s+", "", full)
        if not head or key in seen:
            continue
        seen.add(key)
        if r["question_id"]:
            byid = conn.execute(
                "SELECT * FROM questions WHERE id=? AND (disabled IS NULL OR disabled=0)",
                (r["question_id"],),
            ).fetchone()
            if byid:
                d = dict(byid)
                d["options"] = json.loads(d.get("options") or "{}")
                out.append(d)
                if len(out) >= limit:
                    break
                continue
        esc = lambda s: s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        cands = conn.execute(
            "SELECT * FROM questions WHERE question LIKE ? ESCAPE '\\' AND (disabled IS NULL OR disabled=0) LIMIT 80",
            (esc(full) + "%",),
        ).fetchall()
        if not cands:
            lines = [ln.strip() for ln in full.split("\n") if ln.strip()]
            second = lines[1][:20] if len(lines) > 1 else ""
            pats = []
            if second:
                pats.append(esc(head) + "%" + esc(second) + "%")
            pats.append(esc(head) + "%")
            for p in pats:
                cands = conn.execute(
                    "SELECT * FROM questions WHERE question LIKE ? ESCAPE '\\' AND (disabled IS NULL OR disabled=0) LIMIT 80",
                    (p,),
                ).fetchall()
                if cands:
                    break
        norm = re.sub(r"\s+", "", full)
        q = None
        for c in cands:
            cn = re.sub(r"\s+", "", c["question"] or "")
            if cn == norm or cn.startswith(norm) or norm.startswith(cn):
                q = c
                break
        if not q:
            continue
        d = dict(q)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
        if len(out) >= limit:
            break
    conn.close()
    return out


def admin_batches() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT import_batch AS batch, COUNT(*) AS n,
                  SUM(CASE WHEN disabled=2 THEN 1 ELSE 0 END) AS pending,
                  SUM(is_real) AS real_n
           FROM questions WHERE import_batch IS NOT NULL
           GROUP BY import_batch ORDER BY import_batch DESC LIMIT 50"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_batch_sample(batch: str, limit: int = 10) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM questions WHERE import_batch=? ORDER BY RANDOM() LIMIT ?",
        (batch, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d["options"] or "{}")
        out.append(d)
    return out


def admin_batch_decide(batch: str, approve: bool) -> int:
    conn = get_conn()
    if approve:
        cur = conn.execute(
            "UPDATE questions SET disabled=0 WHERE import_batch=? AND disabled=2", (batch,)
        )
    else:
        cur = conn.execute(
            "DELETE FROM questions WHERE import_batch=? AND disabled=2", (batch,)
        )
    conn.commit()
    n = cur.rowcount
    conn.close()
    return n


def import_hs_explanations(items: list[dict]) -> int:
    conn = get_conn()
    n = 0
    for it in items:
        qid = it.get("id")
        if not qid:
            continue
        text = (it.get("hs_explanation") or "").strip()
        xp = (it.get("xp_explanation") or "").strip()
        school = (it.get("xp_school") or "").strip()
        if text:
            n += conn.execute(
                "UPDATE questions SET hs_explanation=?, has_hs=1 WHERE id=?", (text, int(qid))
            ).rowcount
        if xp:
            n += conn.execute(
                "UPDATE questions SET xp_explanation=?, xp_school=? WHERE id=?",
                (xp, school or None, int(qid)),
            ).rowcount
    conn.commit()
    conn.close()
    return n


def _ensure_answer_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS answer_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            created_at REAL NOT NULL,
            question_id INTEGER,
            module TEXT,
            submodule TEXT,
            correct INTEGER,
            secs INTEGER
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_al_uid ON answer_log(uid, created_at)")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(answer_log)")}
    if "picked" not in cols:
        conn.execute("ALTER TABLE answer_log ADD COLUMN picked TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_al_qid ON answer_log(question_id)")


def save_answer_log(uid: str, items: list[dict]) -> int:
    conn = get_conn()
    _ensure_answer_log(conn)
    now = time.time()
    n = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, submodule, correct, secs, picked) VALUES (?,?,?,?,?,?,?,?)",
            (
                uid,
                now,
                it.get("qid") or it.get("question_id") or it.get("id"),
                it.get("module"),
                it.get("submodule"),
                1 if it.get("correct") else 0,
                int(it.get("secs") or 0),
                str(it.get("picked") or "")[:2] or None,
            ),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


def refresh_question_stats() -> int:
    """聚合 answer_log 为每题刷新全站作答人次/正确率/易错项。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    for col, ddl in [
        ("attempt_count", "ALTER TABLE questions ADD COLUMN attempt_count INTEGER"),
        ("correct_ratio", "ALTER TABLE questions ADD COLUMN correct_ratio INTEGER"),
        ("most_wrong", "ALTER TABLE questions ADD COLUMN most_wrong TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)
    rows = conn.execute(
        """SELECT question_id qid, COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE question_id IS NOT NULL GROUP BY question_id"""
    ).fetchall()
    wrong = {
        r["qid"]: r["p"]
        for r in conn.execute(
            """SELECT qid, p FROM (
                 SELECT question_id qid, picked p,
                        ROW_NUMBER() OVER (
                          PARTITION BY question_id
                          ORDER BY COUNT(*) DESC, picked ASC
                        ) rk
                 FROM answer_log
                 WHERE question_id IS NOT NULL AND correct=0 AND picked IS NOT NULL
                 GROUP BY question_id, picked
               ) WHERE rk=1"""
        )
    }
    n = 0
    for r in rows:
        conn.execute(
            "UPDATE questions SET attempt_count=?, correct_ratio=?, most_wrong=? WHERE id=?",
            (r["n"], round(100 * (r["c"] or 0) / r["n"]), wrong.get(r["qid"]), r["qid"]),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


_PAPER_TITLE_RE = re.compile(r"(\d{4}年[^（(）).]{2,40}《行测》(?:真题|试卷|试题)?(?:（[^）]{1,8}）)?)")


def list_papers() -> list[dict]:
    """从真题 source 派生真题套卷列表（≥40 题视为整卷）。"""
    conn = get_conn()
    rows = conn.execute(
        """SELECT source, COUNT(*) n, MAX(exam_year) y, MAX(exam_region) rg
           FROM questions
           WHERE is_real=1 AND (disabled IS NULL OR disabled=0) AND source IS NOT NULL AND source!=''
           GROUP BY source HAVING n>=40
           ORDER BY y DESC, n DESC"""
    ).fetchall()
    conn.close()
    papers = []
    seen = set()
    for r in rows:
        m = _PAPER_TITLE_RE.search(r["source"] or "")
        if not m:
            continue
        title = m.group(1)
        if title in seen:
            continue
        seen.add(title)
        papers.append({"title": title, "source": r["source"], "n": r["n"], "year": r["y"], "region": r["rg"]})
    return papers[:120]


def paper_questions(source: str, limit: int = 140) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM questions
           WHERE source=? AND is_real=1 AND (disabled IS NULL OR disabled=0)
           ORDER BY id LIMIT ?""",
        (source, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def submodule_progress(uid: str, module: str | None = None) -> dict:
    conn = get_conn()
    _ensure_answer_log(conn)
    where = "uid=? AND submodule IS NOT NULL AND submodule!=''"
    args: list = [uid]
    if module:
        where += " AND module=?"
        args.append(module)
    rows = conn.execute(
        f"SELECT submodule, COUNT(*) n, SUM(correct) c FROM answer_log WHERE {where} GROUP BY submodule",
        args,
    ).fetchall()
    conn.close()
    return {r["submodule"]: {"n": r["n"], "c": r["c"] or 0} for r in rows}


def growth_stats(uid: str) -> dict:
    """按周（近 8 周）返回整体和各模块正确率成长曲线。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    since = time.time() - 8 * 7 * 86400
    rows = conn.execute(
        """SELECT strftime('%Y-%W', created_at, 'unixepoch') wk, module,
                  COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE uid=? AND created_at>?
           GROUP BY wk, module ORDER BY wk""",
        (uid, since),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log WHERE uid=?", (uid,)
    ).fetchone()
    conn.close()
    weeks: dict = {}
    for r in rows:
        w = weeks.setdefault(r["wk"], {"week": r["wk"], "n": 0, "c": 0, "modules": {}})
        w["n"] += r["n"]
        w["c"] += r["c"]
        if r["module"]:
            w["modules"][r["module"]] = {"n": r["n"], "c": r["c"]}
    return {
        "total": {"n": total["n"], "c": total["c"]},
        "weeks": list(weeks.values()),
    }


def _ensure_user_state(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_state (
            uid TEXT NOT NULL, day TEXT NOT NULL, focus_module TEXT, note TEXT,
            created_at REAL, PRIMARY KEY (uid, day))"""
    )


def _today_str() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))


def set_user_state(uid: str, focus_module: str, note: str = "") -> None:
    conn = get_conn()
    _ensure_user_state(conn)
    conn.execute(
        "INSERT OR REPLACE INTO user_state (uid, day, focus_module, note, created_at) VALUES (?,?,?,?,?)",
        (uid, _today_str(), focus_module or None, (note or "")[:200] or None, time.time()),
    )
    conn.commit()
    conn.close()


def get_user_state(uid: str) -> dict | None:
    conn = get_conn()
    _ensure_user_state(conn)
    row = conn.execute(
        "SELECT focus_module, note FROM user_state WHERE uid=? AND day=?",
        (uid, _today_str()),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def daily_plan(uid: str) -> dict:
    """昨日学习摘要 + 今日推荐（规则版：待复习错题 + 弱项题型）。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    now = time.time()
    tz = 8 * 3600
    day0 = ((now + tz) // 86400) * 86400 - tz  # 今日 0 点（东八区）
    yest = conn.execute(
        """SELECT COUNT(*) n, COALESCE(SUM(correct),0) c, COALESCE(SUM(secs),0) s
           FROM answer_log WHERE uid=? AND created_at>=? AND created_at<?""",
        (uid, day0 - 86400, day0),
    ).fetchone()
    ymods = conn.execute(
        """SELECT module, COUNT(*) n, SUM(correct) c FROM answer_log
           WHERE uid=? AND created_at>=? AND created_at<? AND module IS NOT NULL
           GROUP BY module ORDER BY n DESC LIMIT 5""",
        (uid, day0 - 86400, day0),
    ).fetchall()
    uc, ua = _uid_clause(uid)
    due = conn.execute(
        f"""SELECT COUNT(*) n FROM mistakes
            WHERE (mastered IS NULL OR mastered=0)
              AND (next_review IS NULL OR next_review<=?){uc}""",
        (now, *ua),
    ).fetchone()
    conn.close()
    state = get_user_state(uid)
    focus = (state or {}).get("focus_module") or ""
    weak = recommend_stats(uid, top=6)["items"]
    if focus:
        weak.sort(key=lambda w: 0 if w.get("module") == focus else 1)
    return {
        "yesterday": {
            "n": yest["n"], "correct": yest["c"], "secs": yest["s"],
            "modules": [{"module": r["module"], "n": r["n"], "c": r["c"]} for r in ymods],
        },
        "due_mistakes": due["n"],
        "weak": weak[:2],
        "focus": focus,
    }


def question_attempts(uid: str, question_id: int, limit: int = 20) -> list[dict]:
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT created_at, correct, secs, picked FROM answer_log
           WHERE uid=? AND question_id=? ORDER BY created_at DESC LIMIT ?""",
        (uid, question_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mistake_analysis_stats(uid: str) -> dict:
    """汇总错题分布与近期作答数据，供 AI 错题分析使用。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    uc, ua = _uid_clause(uid)
    types = conn.execute(
        f"""SELECT COALESCE(question_type, module, '其他') t, COUNT(*) n,
                   SUM(CASE WHEN times>=2 THEN 1 ELSE 0 END) rep
            FROM mistakes WHERE mastered=0{uc} GROUP BY t ORDER BY n DESC LIMIT 12""",
        ua,
    ).fetchall()
    reasons = conn.execute(
        f"""SELECT error_reason r, COUNT(*) n FROM mistakes
            WHERE mastered=0 AND error_reason IS NOT NULL AND error_reason!=''{uc}
            GROUP BY r ORDER BY n DESC LIMIT 8""",
        ua,
    ).fetchall()
    week = conn.execute(
        """SELECT COUNT(*) n, COALESCE(SUM(correct),0) c, COALESCE(AVG(secs),0) s
           FROM answer_log WHERE uid=? AND created_at>?""",
        (uid, time.time() - 7 * 86400),
    ).fetchone()
    slow = conn.execute(
        """SELECT COALESCE(submodule, module) t, COUNT(*) n, AVG(secs) s, SUM(correct) c
           FROM answer_log WHERE uid=? AND secs>0 GROUP BY t
           HAVING n>=5 ORDER BY s DESC LIMIT 5""",
        (uid,),
    ).fetchall()
    conn.close()
    return {
        "mistake_types": [dict(r) for r in types],
        "error_reasons": [dict(r) for r in reasons],
        "last7days": {"n": week["n"], "correct": week["c"], "avg_secs": round(week["s"], 1)},
        "slowest_types": [{"t": r["t"], "n": r["n"], "avg_secs": round(r["s"], 1), "correct": r["c"]} for r in slow],
    }


FREQ_WEIGHT = {
    "ziliao": 1.0, "panduan": 0.9, "yanyu": 0.9, "shuliang": 0.7, "changshi": 0.6,
}


def recommend_stats(uid: str, top: int = 3) -> dict:
    """规则版查漏补缺：按二级题型算弱项分数（平滑正确率+近期趋势+遗忘+考频）。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT module, submodule, correct, created_at FROM answer_log
           WHERE uid=? AND submodule IS NOT NULL AND submodule!=''
           ORDER BY created_at""",
        (uid,),
    ).fetchall()
    conn.close()
    skills: dict = {}
    for r in rows:
        k = (r["module"] or "", r["submodule"])
        s = skills.setdefault(k, {"seq": [], "last": 0.0})
        s["seq"].append(1 if r["correct"] else 0)
        s["last"] = max(s["last"], r["created_at"])
    now = time.time()
    out = []
    for (mod, sub), s in skills.items():
        seq = s["seq"]
        n = len(seq)
        if n < 3:
            continue
        c = sum(seq)
        acc = (c + 3 * 0.6) / (n + 3)
        trend = 0.0
        if n >= 10:
            recent = seq[-20:]
            prev = seq[-40:-20] or seq[:-20]
            if prev:
                trend = sum(recent) / len(recent) - sum(prev) / len(prev)
        days = (now - s["last"]) / 86400
        stab = min(60.0, max(2.0, 2 + 0.6 * c))
        forget = 1 - (1 + 19 / 81 * days / stab) ** -0.5
        freq = FREQ_WEIGHT.get(mod, 0.5)
        w = 0.45 * (1 - acc) + 0.2 * max(0.0, -trend) + 0.2 * forget + 0.15 * freq
        reason = (
            "近期退步" if trend < -0.1 else
            "正确率偏低" if acc < 0.6 else
            "久未练习" if forget > 0.4 else "巩固提升"
        )
        out.append({
            "module": mod, "submodule": sub, "n": n,
            "acc": round(c / n, 3), "weakness": round(w, 3), "reason": reason,
        })
    out.sort(key=lambda x: -x["weakness"])
    return {"items": out[:top], "total_skills": len(out)}


def _ensure_mistake_uid(conn):
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    if "uid" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN uid TEXT")
    if "question_id" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN question_id INTEGER")


def _uid_clause(uid: str | None) -> tuple[str, tuple]:
    """历史无 uid 的记录对所有设备可见，新记录按 uid 隔离。"""
    if not uid:
        return "", ()
    return " AND (uid IS NULL OR uid=?)", (uid,)


def save_mistake(rec: dict) -> int:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    qtext = rec.get("question_text")
    if qtext:
        dup = conn.execute(
            "SELECT id FROM mistakes WHERE question_text=? LIMIT 1", (qtext,)
        ).fetchone()
        if dup:
            conn.execute(
                "UPDATE mistakes SET times=COALESCE(times,1)+1, mastered=0, review_streak=0, "
                "next_review=?, user_answer=COALESCE(?, user_answer), "
                "question_id=COALESCE(question_id, ?) WHERE id=?",
                (time.time(), rec.get("user_answer"), rec.get("question_id"), dup["id"]),
            )
            conn.commit()
            conn.close()
            return dup["id"]
    cur = conn.execute(
        """INSERT INTO mistakes
           (created_at, module, question_type, question_text, user_answer,
            correct_answer, methods, error_reason, explanation, uid, question_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
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
            (rec.get("uid") or None),
            rec.get("question_id"),
        ),
    )
    conn.commit()
    rowid = cur.lastrowid
    conn.close()
    return rowid


def list_mistakes(limit: int = 500, uid: str | None = None) -> list[dict]:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    rows = conn.execute(
        f"SELECT * FROM mistakes WHERE 1=1{cl} ORDER BY created_at DESC LIMIT ?",
        (*args, limit),
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


def due_review_count(uid: str | None = None) -> int:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    n = conn.execute(
        "SELECT COUNT(*) n FROM mistakes WHERE (mastered IS NULL OR mastered=0) "
        f"AND (next_review IS NULL OR next_review <= ?){cl}",
        (time.time(), *args),
    ).fetchone()["n"]
    conn.close()
    return n


def due_reviews(limit: int = 20, uid: str | None = None) -> list[dict]:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    rows = conn.execute(
        "SELECT * FROM mistakes WHERE (mastered IS NULL OR mastered=0) "
        f"AND (next_review IS NULL OR next_review <= ?){cl} "
        "ORDER BY next_review IS NOT NULL, next_review, created_at LIMIT ?",
        (time.time(), *args, limit),
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
