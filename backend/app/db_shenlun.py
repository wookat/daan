"""申论与收藏域（自 db.py 拆出）：题目/材料/答案/热点/笔记 + mat_fav/qfav。
经 `from . import db` 调 db.get_conn()：测试对 db.get_conn/db.DB_PATH 的 monkeypatch 依然生效。"""
import re
import time

from . import db

__all__ = ["SHENLUN_SEG_TYPES", "_ensure_mat_favs", "_ensure_qfavs", "_ensure_shenlun_answers", "_ensure_sl_drafts", "_shenlun_issue_lines", "import_shenlun", "mat_fav_ids", "mat_fav_items", "mat_fav_set", "qfav_ids", "qfav_items", "qfav_set", "save_shenlun_answer", "search_shenlun", "search_shenlun_materials", "shenlun_answer_history", "shenlun_filters", "shenlun_hotspots", "shenlun_material_type_counts", "shenlun_materials", "shenlun_materials_by_type", "shenlun_note_del", "shenlun_note_save", "shenlun_notes_list", "shenlun_paper_counts", "shenlun_paper_questions", "shenlun_qtype_counts", "shenlun_question", "shenlun_questions", "shenlun_stats", "shenlun_year_counts", "sl_draft_get", "sl_draft_set"]


def import_shenlun(questions: list[dict], materials: list[dict], batch: str) -> dict:
    """申论数据导入：进待审（disabled=2），按内容去重。"""
    conn = db.get_conn()
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


def shenlun_questions(qtype: str | None = None, year: int | None = None, region: str | None = None, limit: int = 20, offset: int = 0, paper: str | None = None) -> dict:
    conn = db.get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if paper:
        where.append("paper=?")
        args.append(paper)
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
        (*args, min(max(limit, 0), 50), offset),
    ).fetchall()
    total = conn.execute(
        f"SELECT COUNT(*) FROM shenlun_questions WHERE {' AND '.join(where)}", args
    ).fetchone()[0]
    conn.close()
    return {"items": [dict(r) for r in rows], "total": total}


def search_shenlun(q: str, limit: int = 5) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT id, exam_year, exam_region, paper, qtype, question
            FROM shenlun_questions
            WHERE (disabled IS NULL OR disabled=0)
              AND (question LIKE '%' || ? || '%' OR paper LIKE '%' || ? || '%')
            ORDER BY exam_year DESC, id LIMIT ?""",
        (q, q, min(max(limit, 1), 10)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def search_shenlun_materials(q: str, limit: int = 5) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT id, type, topic, content, source
            FROM shenlun_materials
            WHERE (disabled IS NULL OR disabled=0)
              AND (topic LIKE '%' || ? || '%' OR content LIKE '%' || ? || '%' OR source LIKE '%' || ? || '%')
            ORDER BY id LIMIT ?""",
        (q, q, q, min(max(limit, 1), 10)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def shenlun_filters() -> dict:
    conn = db.get_conn()
    years = [r[0] for r in conn.execute(
        "SELECT DISTINCT exam_year FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_year IS NOT NULL ORDER BY exam_year DESC")]
    regions = [r[0] for r in conn.execute(
        "SELECT exam_region FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_region IS NOT NULL "
        "GROUP BY exam_region ORDER BY COUNT(*) DESC")]
    conn.close()
    return {"years": years, "regions": regions}


def shenlun_year_counts() -> list[tuple[int, int]]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT exam_year, COUNT(*) n FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND exam_year IS NOT NULL
           GROUP BY exam_year ORDER BY exam_year DESC"""
    ).fetchall()
    conn.close()
    return [(r["exam_year"], r["n"]) for r in rows]


def shenlun_qtype_counts() -> list[tuple[str, int]]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT qtype, COUNT(*) n FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND qtype IS NOT NULL AND qtype != ''
           GROUP BY qtype ORDER BY n DESC"""
    ).fetchall()
    conn.close()
    return [(r["qtype"], r["n"]) for r in rows]


def shenlun_paper_counts() -> list[tuple[str, int | None, str | None, int]]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT paper, MAX(exam_year) y, MAX(exam_region) rg, COUNT(*) n
           FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND paper IS NOT NULL AND paper != ''
           GROUP BY paper ORDER BY y DESC, paper"""
    ).fetchall()
    conn.close()
    return [(r["paper"], r["y"], r["rg"], r["n"]) for r in rows]


def shenlun_paper_questions(paper: str) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT id, exam_year, exam_region, paper, qtype, material, question, reference
           FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND paper=? ORDER BY id""",
        (paper,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


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
    conn = db.get_conn()
    _ensure_mat_favs(conn)
    ids = [r[0] for r in conn.execute(
        "SELECT mid FROM shenlun_mat_favs WHERE uid=? ORDER BY created_at DESC", (uid,))]
    conn.close()
    return ids


def mat_fav_set(uid: str, mid: int, on: bool):
    conn = db.get_conn()
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
    conn = db.get_conn()
    _ensure_mat_favs(conn)
    rows = conn.execute(
        """SELECT m.* FROM shenlun_mat_favs f
           JOIN shenlun_materials m ON m.id=f.mid AND (m.disabled IS NULL OR m.disabled=0)
           WHERE f.uid=? ORDER BY f.created_at DESC LIMIT 200""",
        (uid,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _ensure_qfavs(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_qfavs (
            uid TEXT NOT NULL,
            qid INTEGER NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (uid, qid)
        )"""
    )


def qfav_ids(uid: str) -> list[int]:
    conn = db.get_conn()
    _ensure_qfavs(conn)
    ids = [r[0] for r in conn.execute(
        "SELECT qid FROM shenlun_qfavs WHERE uid=? ORDER BY created_at DESC", (uid,))]
    conn.close()
    return ids


def qfav_set(uid: str, qid: int, on: bool):
    conn = db.get_conn()
    _ensure_qfavs(conn)
    if on:
        conn.execute(
            "INSERT OR IGNORE INTO shenlun_qfavs (uid, qid, created_at) VALUES (?,?,?)",
            (uid, qid, time.time()))
    else:
        conn.execute("DELETE FROM shenlun_qfavs WHERE uid=? AND qid=?", (uid, qid))
    conn.commit()
    conn.close()


def qfav_items(uid: str) -> list[dict]:
    conn = db.get_conn()
    _ensure_qfavs(conn)
    rows = conn.execute(
        """SELECT q.id, q.qtype, q.paper, q.exam_year, q.exam_region, q.question
           FROM shenlun_qfavs f
           JOIN shenlun_questions q ON q.id=f.qid AND (q.disabled IS NULL OR q.disabled=0)
           WHERE f.uid=? ORDER BY f.created_at DESC LIMIT 200""",
        (uid,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _ensure_sl_drafts(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_drafts (
            uid TEXT NOT NULL,
            qid INTEGER NOT NULL,
            content TEXT NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (uid, qid)
        )"""
    )


def sl_draft_get(uid: str, qid: int) -> dict:
    conn = db.get_conn()
    _ensure_sl_drafts(conn)
    row = conn.execute(
        "SELECT content, updated_at FROM shenlun_drafts WHERE uid=? AND qid=?", (uid, qid)
    ).fetchone()
    conn.close()
    return {"content": row[0], "updated_at": row[1]} if row else {"content": "", "updated_at": 0}


def sl_draft_set(uid: str, qid: int, content: str):
    conn = db.get_conn()
    _ensure_sl_drafts(conn)
    if content:
        conn.execute(
            "INSERT INTO shenlun_drafts (uid, qid, content, updated_at) VALUES (?,?,?,?) "
            "ON CONFLICT(uid, qid) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at",
            (uid, qid, content, time.time()))
    else:
        conn.execute("DELETE FROM shenlun_drafts WHERE uid=? AND qid=?", (uid, qid))
    conn.commit()
    conn.close()


def save_shenlun_answer(uid: str, qid: int, answer: str, result: str) -> int:
    conn = db.get_conn()
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
    conn = db.get_conn()
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
        (*args, min(max(limit, 0), 50)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _shenlun_issue_lines(result: str, section: str, limit: int = 3) -> list[str]:
    m = re.search(rf"【{section}】(.*?)(?=【|$)", result or "", re.DOTALL)
    if not m:
        return []
    lines = []
    for ln in m.group(1).splitlines():
        ln = re.sub(r"^[\s\-•·*\d．．.、)）]+", "", ln).strip()
        if 4 <= len(ln) <= 60:
            lines.append(ln)
    return lines[:limit]


def shenlun_stats(uid: str) -> dict:
    conn = db.get_conn()
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
    conn = db.get_conn()
    r = conn.execute(
        "SELECT * FROM shenlun_questions WHERE id=? AND (disabled IS NULL OR disabled=0)", (qid,)
    ).fetchone()
    conn.close()
    return dict(r) if r else None


def shenlun_material_type_counts() -> list[tuple[str, int]]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT type, COUNT(*) n FROM shenlun_materials
           WHERE (disabled IS NULL OR disabled=0) AND type IS NOT NULL AND type<>''
           GROUP BY type ORDER BY n DESC"""
    ).fetchall()
    conn.close()
    return [(r["type"], r["n"]) for r in rows]


def shenlun_materials(topic: str | None = None, mtype: str | None = None, limit: int = 20, offset: int = 0,
                      mid: int | None = None) -> list[dict]:
    conn = db.get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if mid is not None:
        where.append("id=?")
        args.append(mid)
    if topic:
        where.append("topic=?")
        args.append(topic)
    if mtype:
        where.append("type=?")
        args.append(mtype)
    rows = conn.execute(
        f"SELECT * FROM shenlun_materials WHERE {' AND '.join(where)} ORDER BY id LIMIT ? OFFSET ?",
        (*args, min(max(limit, 0), 50), offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def shenlun_materials_by_type(mtype: str) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, type, topic, content, source FROM shenlun_materials"
        " WHERE (disabled IS NULL OR disabled=0) AND type=? ORDER BY id",
        (mtype,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


SHENLUN_SEG_TYPES = ("内涵", "角度", "金句")


def shenlun_hotspots(limit: int = 30, offset: int = 0) -> dict:
    """热点素材三段式聚合：按 topic 分组，组内按 内涵/角度/金句 分桶，其余类型进 others。

    三段式素材经 /api/shenlun/import 以 type∈{内涵,角度,金句}+topic=热点名 灌入；
    老数据（金句/案例/政策理论/范文等类型）仍归 others，不丢可见性。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, type, topic, content, source FROM shenlun_materials"
        " WHERE (disabled IS NULL OR disabled=0) AND topic IS NOT NULL AND TRIM(topic)<>''"
        " ORDER BY topic, id"
    ).fetchall()
    conn.close()
    topics: dict[str, dict] = {}
    for r in rows:
        m = dict(r)
        g = topics.setdefault(
            m["topic"],
            {"topic": m["topic"], "segs": {k: [] for k in SHENLUN_SEG_TYPES}, "others": []},
        )
        item = {"id": m["id"], "type": m["type"], "content": m["content"], "source": m["source"]}
        seg = g["segs"].get(m["type"])
        (seg if seg is not None else g["others"]).append(item)
    ordered = sorted(
        topics.values(),
        key=lambda g: (-sum(len(g["segs"][k]) for k in SHENLUN_SEG_TYPES), -len(g["others"]), g["topic"]),
    )
    return {"total": len(ordered), "items": ordered[offset: offset + min(max(limit, 0), 50)]}


def shenlun_notes_list(uid: str) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, topic, title, content, created_at, updated_at FROM shenlun_notes"
        " WHERE uid=? ORDER BY updated_at DESC LIMIT 200",
        (uid,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def shenlun_note_save(uid: str, nid: int | None, topic: str, title: str, content: str) -> dict:
    conn = db.get_conn()
    now = time.time()
    if nid:
        cur = conn.execute(
            "UPDATE shenlun_notes SET topic=?, title=?, content=?, updated_at=? WHERE id=? AND uid=?",
            (topic, title, content, now, nid, uid),
        )
        conn.commit()
        conn.close()
        return {"id": nid, "updated": bool(cur.rowcount)}
    cur = conn.execute(
        "INSERT INTO shenlun_notes(uid, topic, title, content, created_at, updated_at)"
        " VALUES(?,?,?,?,?,?)",
        (uid, topic, title, content, now, now),
    )
    nid_new = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": nid_new, "updated": True}


def shenlun_note_del(uid: str, nid: int) -> bool:
    conn = db.get_conn()
    cur = conn.execute("DELETE FROM shenlun_notes WHERE id=? AND uid=?", (nid, uid))
    conn.commit()
    conn.close()
    return bool(cur.rowcount)
