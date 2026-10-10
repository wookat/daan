"""py 拆分之 taxonomy 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import time

from . import db

__all__ = ["questions_by_tag3", "tag3_counts", "tag3_lastmod", "tag3_review_add", "tag3_review_close", "tag3_review_list", "tag3_review_reopen", "year_module_counts"]


def tag3_counts() -> dict:
    """各三级考点 code 的题目数（不含已下架），进程内 5 分钟缓存。"""
    now = time.time()
    if db._TAG3_COUNTS_CACHE[1] is not None and now - db._TAG3_COUNTS_CACHE[0] < db.TAG3_COUNTS_TTL:
        return db._TAG3_COUNTS_CACHE[1]
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT tag3, COUNT(*) n FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    ).fetchall()
    conn.close()
    out = {r["tag3"]: r["n"] for r in rows}
    db._TAG3_COUNTS_CACHE[0] = now
    db._TAG3_COUNTS_CACHE[1] = out
    return out


def year_module_counts() -> dict:
    """各（年份, 模块）的在架真题数与最新 updated_at，进程内 5 分钟缓存。"""
    now = time.time()
    if db._YEAR_MODULE_CACHE[1] is not None and now - db._YEAR_MODULE_CACHE[0] < db.TAG3_COUNTS_TTL:
        return db._YEAR_MODULE_CACHE[1]
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT exam_year y, module m, COUNT(*) n, MAX({db._UPDATED_AT_EPOCH}) mu FROM questions "
        "WHERE is_real=1 AND disabled=0 AND exam_year IS NOT NULL GROUP BY exam_year, module"
    ).fetchall()
    conn.close()
    out = {(r["y"], r["m"]): (r["n"], r["mu"]) for r in rows}
    db._YEAR_MODULE_CACHE[0] = now
    db._YEAR_MODULE_CACHE[1] = out
    return out


def tag3_lastmod() -> dict:
    """各三级考点最新 updated_at（在架），进程内 5 分钟缓存，用于 sitemap lastmod。"""
    now = time.time()
    if db._TAG3_LASTMOD_CACHE[1] is not None and now - db._TAG3_LASTMOD_CACHE[0] < db.TAG3_COUNTS_TTL:
        return db._TAG3_LASTMOD_CACHE[1]
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT tag3, MAX({db._UPDATED_AT_EPOCH}) mu FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    ).fetchall()
    conn.close()
    out = {r["tag3"]: r["mu"] for r in rows}
    db._TAG3_LASTMOD_CACHE[0] = now
    db._TAG3_LASTMOD_CACHE[1] = out
    return out


def questions_by_tag3(code: str, offset: int = 0, limit: int = 20) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, module, submodule, tag3, question, options, answer, explanation, is_real, exam_year, exam_region "
        "FROM questions WHERE tag3=? AND disabled=0 ORDER BY id DESC LIMIT ? OFFSET ?",
        (code, min(max(limit, 0), 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def tag3_review_add(question_id: int, tag3: str | None, confidence: float | None, reason: str):
    conn = db.get_conn()
    conn.execute(
        "DELETE FROM tag3_review WHERE question_id=? AND status='open'", (question_id,)
    )
    conn.execute(
        "INSERT INTO tag3_review (created_at, question_id, tag3, confidence, reason) VALUES (?,?,?,?,?)",
        (time.time(), question_id, tag3, confidence, reason),
    )
    conn.commit()
    conn.close()


def tag3_review_list(limit: int = 100, module: str | None = None) -> dict:
    conn = db.get_conn()
    cond = "r.status='open'"
    args: list = []
    if module:
        cond += " AND q.module=?"
        args.append(module)
    total = conn.execute(
        f"SELECT COUNT(*) FROM tag3_review r LEFT JOIN questions q ON q.id=r.question_id WHERE {cond}",
        args,
    ).fetchone()[0]
    rows = conn.execute(
        f"""SELECT r.id, r.created_at, r.question_id, r.tag3, r.confidence, r.reason, r.status,
                  q.module, q.submodule, q.question, q.options, q.explanation, q.answer, q.tag3 AS cur_tag3
           FROM tag3_review r LEFT JOIN questions q ON q.id=r.question_id
           WHERE {cond} ORDER BY r.id DESC LIMIT ?""",
        args + [min(max(limit, 0), 300)],
    ).fetchall()
    conn.close()
    return {"total": total, "items": [dict(r) for r in rows]}


def tag3_review_close(question_id: int):
    conn = db.get_conn()
    conn.execute("UPDATE tag3_review SET status='done' WHERE question_id=? AND status='open'", (question_id,))
    conn.commit()
    conn.close()


def tag3_review_reopen(question_id: int) -> bool:
    conn = db.get_conn()
    cur = conn.execute(
        "UPDATE tag3_review SET status='open' WHERE question_id=? AND status='done'", (question_id,)
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


