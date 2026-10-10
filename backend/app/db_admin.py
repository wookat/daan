"""py 拆分之 admin 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import time

from . import db, quality

__all__ = ["_admin_dashboard_uncached", "_admin_stats_uncached", "_ensure_reports", "_governance_scan_uncached", "add_question_report", "add_report", "admin_batch_decide", "admin_batch_sample", "admin_batches", "admin_batches_v3", "admin_create_announcement", "admin_dashboard", "admin_dashboard_state", "admin_delete_cache", "admin_flagged_cache", "admin_handle_report", "admin_list_announcements", "admin_list_reports", "admin_open_report_count", "admin_resolve_report", "admin_search_questions", "admin_set_announcement", "admin_shenlun_overview", "admin_shizheng", "admin_stats", "admin_stats_state", "admin_update_question", "admin_user_detail", "admin_users", "batch_answer_dist", "dup_cluster_detail", "dup_cluster_list", "dup_cluster_resolve", "dup_cluster_stats", "governance_scan", "governance_scan_state", "rescore_question"]


def admin_list_announcements() -> list[dict]:
    conn = db.get_conn()
    db._ensure_announcements(conn)
    rows = conn.execute(
        "SELECT id, created_at, title, body, active FROM announcements ORDER BY id DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_create_announcement(title: str, body: str) -> int:
    conn = db.get_conn()
    db._ensure_announcements(conn)
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
    rcols = {r["name"] for r in conn.execute("PRAGMA table_info(question_reports)")}
    for col, ddl in [
        ("uid", "ALTER TABLE question_reports ADD COLUMN uid TEXT"),
        ("note", "ALTER TABLE question_reports ADD COLUMN note TEXT"),
        ("handled_at", "ALTER TABLE question_reports ADD COLUMN handled_at REAL"),
    ]:
        if col not in rcols:
            conn.execute(ddl)


def add_report(question_id: int | None, reason: str, detail: str) -> int:
    conn = db.get_conn()
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


def add_question_report(question_id: int, uid: str | None, rtype: str, detail: str) -> tuple[int, bool]:
    """同一 uid 对同一题重复提交时去重更新，返回 (id, 是否为更新)。"""
    conn = db.get_conn()
    _ensure_reports(conn)
    if uid:
        dup = conn.execute(
            "SELECT id FROM question_reports WHERE question_id=? AND uid=? LIMIT 1",
            (question_id, uid),
        ).fetchone()
        if dup:
            conn.execute(
                "UPDATE question_reports SET reason=?, detail=?, created_at=?, status='open', "
                "note=NULL, handled_at=NULL WHERE id=?",
                (rtype, detail, time.time(), dup["id"]),
            )
            conn.commit()
            conn.close()
            return dup["id"], True
    cur = conn.execute(
        "INSERT INTO question_reports (created_at, question_id, uid, reason, detail) VALUES (?,?,?,?,?)",
        (time.time(), question_id, uid, rtype, detail),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid, False


def admin_list_reports(status: str = "open") -> list[dict]:
    conn = db.get_conn()
    _ensure_reports(conn)
    statuses = db._REPORT_STATUS_ALIASES.get(status, (status,))
    ph = ",".join("?" for _ in statuses)
    rows = conn.execute(
        f"""SELECT r.id, r.created_at, r.question_id, r.uid, r.reason, r.detail, r.status,
                  r.note, r.handled_at,
                  q.question, q.options, q.module, q.submodule, q.answer, q.explanation,
                  q.hs_explanation, q.disabled
           FROM question_reports r LEFT JOIN questions q ON q.id = r.question_id
           WHERE r.status IN ({ph}) ORDER BY r.id DESC LIMIT 100""",
        statuses,
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_open_report_count() -> int:
    conn = db.get_conn()
    _ensure_reports(conn)
    n = conn.execute("SELECT COUNT(*) AS n FROM question_reports WHERE status='open'").fetchone()["n"]
    conn.close()
    return n


def admin_handle_report(rid: int, status: str, note: str | None = None) -> bool:
    conn = db.get_conn()
    _ensure_reports(conn)
    handled = time.time() if status in ("fixed", "rejected", "resolved", "dismissed") else None
    cur = conn.execute(
        "UPDATE question_reports SET status=?, note=COALESCE(?, note), handled_at=? WHERE id=?",
        (status, note, handled, rid),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_resolve_report(rid: int, status: str) -> bool:
    conn = db.get_conn()
    _ensure_reports(conn)
    cur = conn.execute("UPDATE question_reports SET status=? WHERE id=?", (status, rid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_set_announcement(aid: int, active: bool) -> bool:
    conn = db.get_conn()
    db._ensure_announcements(conn)
    cur = conn.execute("UPDATE announcements SET active=? WHERE id=?", (1 if active else 0, aid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_stats() -> dict:
    return db._cached("stats", 300, _admin_stats_uncached)


def admin_stats_state() -> tuple[dict, str]:
    return db._cached_state("stats", 300, _admin_stats_uncached)


def _admin_stats_uncached() -> dict:
    conn = db.get_conn()
    db._ensure_practice_results(conn)
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
                f"""SELECT date(created_at, 'unixepoch') d,
                          COUNT(*) sessions, SUM(n) answered,
                          ROUND(SUM(correct)*100.0/SUM(n), 1) acc
                   FROM practice_results WHERE n>0 AND {db.REAL_TRAFFIC}
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
    qid: int | None = None,
    min_score: int | None = None,
    max_score: int | None = None,
    sort: str | None = None,
) -> list[dict]:
    conn = db.get_conn()
    where = []
    args: list = []
    if qid:
        where.append("id=?")
        args.append(qid)
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
    if min_score is not None:
        where.append("quality_score>=?")
        args.append(min_score)
    if max_score is not None:
        where.append("quality_score<=?")
        args.append(max_score)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    if sort == "score_asc":
        order = "quality_score IS NULL, quality_score ASC, id DESC"
    elif sort == "score_desc":
        order = "quality_score IS NULL, quality_score DESC, id DESC"
    elif flagged:
        order = "hs_down DESC, id DESC"
    else:
        order = "id DESC"
    rows = conn.execute(
        f"SELECT id, module, submodule, question, options, answer, explanation, hs_explanation, "
        f"hs_up, hs_down, is_real, exam_year, exam_region, source, disabled, tag3, quality_score "
        f"FROM questions {clause} ORDER BY {order} LIMIT ? OFFSET ?",
        (*args, min(max(limit, 0), 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def rescore_question(conn, qid: int):
    """按现行口径重算并回写单题 quality_score（内容变更后调用，防打分过期）。"""
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    if row:
        conn.execute(
            "UPDATE questions SET quality_score=? WHERE id=?",
            (quality.score_question(dict(row)), qid),
        )


def admin_update_question(qid: int, fields: dict) -> bool:
    sets = {k: v for k, v in fields.items() if k in db.ADMIN_EDITABLE}
    if not sets:
        return False
    conn = db.get_conn()
    assignments = ", ".join(f"{k}=?" for k in sets)
    cur = conn.execute(
        f"UPDATE questions SET {assignments}, updated_at=? WHERE id=?",
        (*sets.values(), time.time(), qid),
    )
    rescore_question(conn, qid)
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def dup_cluster_list(offset: int = 0, limit: int = 20, status: str = "open") -> dict:
    conn = db.get_conn()
    total = conn.execute(
        "SELECT COUNT(DISTINCT cluster_id) FROM dup_clusters WHERE status=?", (status,)
    ).fetchone()[0]
    rows = conn.execute(
        """SELECT d.cluster_id, COUNT(*) n, MAX(d.similarity) max_sim,
                  COUNT(DISTINCT q.module) modules_n,
                  GROUP_CONCAT(DISTINCT q.module) modules,
                  COUNT(DISTINCT q.answer) answers_n,
                  MIN(q.question) sample
           FROM dup_clusters d JOIN questions q ON q.id=d.qid
           WHERE d.status=?
           GROUP BY d.cluster_id ORDER BY n DESC, d.cluster_id
           LIMIT ? OFFSET ?""",
        (status, min(max(limit, 0), 100), offset),
    ).fetchall()
    conn.close()
    return {"total": total, "items": [dict(r) for r in rows]}


def dup_cluster_detail(cluster_id: int) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT q.id, q.module, q.submodule, q.question, q.options, q.answer,
                  q.explanation, q.hs_explanation, q.is_real, q.exam_year, q.exam_region,
                  q.source, q.disabled, q.tag3, q.quality_score, d.similarity, d.status
           FROM dup_clusters d JOIN questions q ON q.id=d.qid
           WHERE d.cluster_id=? ORDER BY q.quality_score DESC, q.id""",
        (cluster_id,),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def dup_cluster_resolve(cluster_id: int, keep_qid: int | None) -> dict:
    """一键保留最优：保留 keep_qid，下架簇内其余题；keep_qid 为 None 时仅标记忽略。"""
    conn = db.get_conn()
    qids = [r["qid"] for r in conn.execute(
        "SELECT qid FROM dup_clusters WHERE cluster_id=? AND status='open'", (cluster_id,)
    )]
    if not qids:
        conn.close()
        return {"ok": False, "error": "簇不存在或已处理"}
    disabled = []
    if keep_qid is not None:
        if keep_qid not in qids:
            conn.close()
            return {"ok": False, "error": "keep_qid 不在该簇内"}
        disabled = [q for q in qids if q != keep_qid]
        conn.executemany(
            "UPDATE questions SET disabled=1, updated_at=? WHERE id=?",
            [(time.time(), q) for q in disabled],
        )
    new_status = "resolved" if keep_qid is not None else "ignored"
    conn.execute("UPDATE dup_clusters SET status=? WHERE cluster_id=?", (new_status, cluster_id))
    conn.commit()
    conn.close()
    return {"ok": True, "kept": keep_qid, "disabled": disabled, "status": new_status}


def dup_cluster_stats() -> dict:
    conn = db.get_conn()
    row = conn.execute(
        """SELECT COUNT(DISTINCT CASE WHEN status='open' THEN cluster_id END) open_clusters,
                  COUNT(CASE WHEN status='open' THEN 1 END) open_questions,
                  COUNT(DISTINCT CASE WHEN status='resolved' THEN cluster_id END) resolved,
                  COUNT(DISTINCT CASE WHEN status='ignored' THEN cluster_id END) ignored
           FROM dup_clusters"""
    ).fetchone()
    meta = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM sim_meta")}
    conn.close()
    return {**dict(row), "meta": meta}


def admin_flagged_cache(limit: int = 30) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT key, module, question_type, question_text, user_answer, explanation, hits, up, down "
        "FROM explain_cache WHERE down>0 ORDER BY down DESC, hits DESC LIMIT ?",
        (min(max(limit, 0), 100),),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_delete_cache(key: str) -> bool:
    conn = db.get_conn()
    cur = conn.execute("DELETE FROM explain_cache WHERE key=?", (key,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def admin_batches() -> list[dict]:
    conn = db.get_conn()
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
    conn = db.get_conn()
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
    conn = db.get_conn()
    if approve:
        cur = conn.execute(
            "UPDATE questions SET disabled=0, updated_at=? WHERE import_batch=? AND disabled=2",
            (time.time(), batch),
        )
    else:
        cur = conn.execute(
            "DELETE FROM questions WHERE import_batch=? AND disabled=2", (batch,)
        )
    conn.commit()
    n = cur.rowcount
    conn.close()
    return n


def admin_dashboard() -> dict:
    return db._cached("dashboard", 300, _admin_dashboard_uncached)


def admin_dashboard_state() -> tuple[dict, str]:
    return db._cached_state("dashboard", 300, _admin_dashboard_uncached)


def _admin_dashboard_uncached() -> dict:
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    _ensure_reports(conn)
    q = conn.execute
    day0 = db._day_start()
    day_1 = db._day_start(-1)
    day_14 = db._day_start(-13)

    def day_kpis(start: float, end: float | None) -> dict:
        cond = "created_at>=?" + (" AND created_at<?" if end else "")
        args = (start, end) if end else (start,)
        row = q(
            f"SELECT COUNT(DISTINCT uid) au, COUNT(*) n, COALESCE(SUM(correct),0) c "
            f"FROM answer_log WHERE {cond} AND {db.REAL_TRAFFIC}",
            args,
        ).fetchone()
        probe = q(
            f"SELECT COUNT(*) n FROM answer_log WHERE {cond} AND probe=1", args
        ).fetchone()["n"]
        return {"active": row["au"], "answered": row["n"], "correct": row["c"], "probe_excluded": probe}

    today = day_kpis(day0, None)
    yesterday = day_kpis(day_1, day0)
    firsts = q(
        f"SELECT MIN(created_at) t FROM answer_log WHERE {db.REAL_TRAFFIC} GROUP BY uid HAVING t>=?", (day_1,)
    ).fetchall()
    new_today = sum(1 for r in firsts if r["t"] >= day0)
    new_yesterday = len(firsts) - new_today

    trend = [
        dict(r)
        for r in q(
            f"""SELECT date(created_at, 'unixepoch', '+8 hours') d,
                      COUNT(*) answered, COUNT(DISTINCT uid) active,
                      ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*), 1) acc
               FROM answer_log WHERE created_at>=? AND {db.REAL_TRAFFIC} GROUP BY d ORDER BY d""",
            (day_14,),
        )
    ]
    ai_trend = {
        r["d"]: r["n"]
        for r in q(
            """SELECT date(created_at, 'unixepoch', '+8 hours') d, COUNT(*) n
               FROM explain_cache WHERE created_at>=? GROUP BY d""",
            (day_14,),
        )
    }
    for row in trend:
        row["ai_calls"] = ai_trend.get(row["d"], 0)
    ai_today = q("SELECT COUNT(*) FROM explain_cache WHERE created_at>=?", (day0,)).fetchone()[0]
    ai_yesterday = q(
        "SELECT COUNT(*) FROM explain_cache WHERE created_at>=? AND created_at<?", (day_1, day0)
    ).fetchone()[0]

    total = q("SELECT COUNT(*) FROM questions").fetchone()[0]
    disabled = q("SELECT COUNT(*) FROM questions WHERE disabled=1").fetchone()[0]
    pending = q("SELECT COUNT(*) FROM questions WHERE disabled=2").fetchone()[0]
    # 写成 COALESCE 而非 (disabled IS NULL OR disabled=0)：OR 形式会让规划器走 disabled 索引的
    # MULTI-INDEX OR 再逐行回表看 hs_down（全部活跃题宽行），COALESCE 形式才选 idx_q_hs_down 部分索引
    flagged = q("SELECT COUNT(*) FROM questions WHERE hs_down>0 AND COALESCE(disabled,0)=0").fetchone()[0]
    open_reports = q("SELECT COUNT(*) FROM question_reports WHERE status='open'").fetchone()[0]
    # 健康度口径：基于当前可运营题库（历史下架存量是治理成果，不计入分母惩罚）
    active = max(total - disabled - pending, 0)
    health = round(100.0 * max(active - flagged, 0) / active, 1) if active else 100.0

    todos = {
        "pending_batches": q(
            "SELECT COUNT(DISTINCT import_batch) FROM questions WHERE disabled=2 AND import_batch IS NOT NULL"
        ).fetchone()[0],
        "tag3_review": q("SELECT COUNT(*) FROM tag3_review WHERE status='open'").fetchone()[0],
        "open_reports": open_reports,
    }
    by_module = [
        dict(r)
        for r in q(
            "SELECT module, COUNT(*) n FROM questions WHERE (disabled IS NULL OR disabled=0) "
            "GROUP BY module ORDER BY n DESC"
        )
    ]
    acc7 = [
        dict(r)
        for r in q(
            f"""SELECT module, COUNT(*) n, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc
               FROM answer_log WHERE created_at>=? AND module IS NOT NULL AND {db.REAL_TRAFFIC}
               GROUP BY module ORDER BY n DESC""",
            (db._day_start(-6),),
        )
    ]
    # 探针口径生效时刻 = 首条被打标的行；此前行 probe 为 NULL，无法区分、按真人计（看板外显此起点）
    probe_since = q("SELECT MIN(created_at) t FROM answer_log WHERE probe IS NOT NULL").fetchone()["t"]
    conn.close()
    return {
        "today": {**today, "new_users": new_today, "ai_calls": ai_today},
        "yesterday": {**yesterday, "new_users": new_yesterday, "ai_calls": ai_yesterday},
        "health": {"pct": health, "total": total, "active": active, "disabled": disabled,
                   "pending": pending, "flagged": flagged, "open_reports": open_reports},
        "trend": trend,
        "todos": todos,
        "by_module": by_module,
        "acc7": acc7,
        "probe_since": probe_since,
        "generated_at": time.time(),
    }


def batch_answer_dist(batch: str) -> dict:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT UPPER(SUBSTR(TRIM(answer),1,1)) a, COUNT(*) n FROM questions "
        "WHERE import_batch=? GROUP BY a",
        (batch,),
    ).fetchall()
    conn.close()
    return {r["a"]: r["n"] for r in rows if r["a"]}


def admin_batches_v3() -> list[dict]:
    conn = db.get_conn()
    db._ensure_sample_reviews(conn)
    rows = conn.execute(
        """SELECT import_batch AS batch, COUNT(*) AS n,
                  SUM(CASE WHEN disabled=2 THEN 1 ELSE 0 END) AS pending,
                  SUM(is_real) AS real_n
           FROM questions WHERE import_batch IS NOT NULL
           GROUP BY import_batch ORDER BY import_batch DESC LIMIT 50"""
    ).fetchall()
    reviews = {
        r["batch"]: dict(r)
        for r in conn.execute(
            """SELECT batch, SUM(CASE WHEN verdict='ok' THEN 1 ELSE 0 END) ok,
                      SUM(CASE WHEN verdict='problem' THEN 1 ELSE 0 END) problem
               FROM sample_reviews GROUP BY batch"""
        )
    }
    out = []
    for r in rows:
        d = dict(r)
        rv = reviews.get(d["batch"], {})
        d["review_ok"] = rv.get("ok", 0)
        d["review_problem"] = rv.get("problem", 0)
        d["answer_dist"] = batch_answer_dist(d["batch"])
        out.append(d)
    conn.close()
    return out


def governance_scan() -> dict:
    return db._cached("governance", 600, _governance_scan_uncached)


def governance_scan_state() -> tuple[dict, str]:
    return db._cached_state("governance", 600, _governance_scan_uncached)


def _governance_scan_uncached() -> dict:
    conn = db.get_conn()
    q = conn.execute
    broken: list[dict] = []
    dist_all: dict = {}
    for r in q(
        "SELECT id, module, question, options, answer FROM questions "
        "WHERE (disabled IS NULL OR disabled!=1) LIMIT 200000"
    ):
        problems = []
        text = (r["question"] or "").strip()
        try:
            opts = json.loads(r["options"] or "{}")
        except ValueError:
            opts = None
        ans = db.normalize_answer(r["answer"])
        if not text:
            problems.append("空题干")
        if opts is None:
            problems.append("选项 JSON 损坏")
        elif len(opts) < 2:
            problems.append("选项不足 2 个")
        else:
            vals = [str(v).strip() for v in opts.values()]
            if len(set(vals)) < len(vals):
                problems.append("选项内容重复")
            if ans and ans != db.normalize_answer(ans, opts):
                problems.append(f"答案 {ans} 越界")
        if not ans:
            problems.append("缺答案")
        elif ans:
            dist_all[ans] = dist_all.get(ans, 0) + 1
        if problems:
            broken.append({"id": r["id"], "module": r["module"],
                           "question": text[:80], "problems": problems})
        if len(broken) >= 100:
            break
    clones = [
        dict(r)
        for r in q(
            """SELECT SUBSTR(TRIM(question),1,40) prefix, COUNT(*) n,
                      GROUP_CONCAT(id) ids, COUNT(DISTINCT UPPER(SUBSTR(TRIM(answer),1,1))) answers
               FROM questions WHERE (disabled IS NULL OR disabled!=1)
                 AND LENGTH(TRIM(question))>=40
               GROUP BY prefix HAVING n>1
               ORDER BY answers DESC, n DESC LIMIT 50"""
        )
    ]
    batch_dists = []
    for b in q(
        "SELECT DISTINCT import_batch b FROM questions WHERE import_batch IS NOT NULL "
        "ORDER BY import_batch DESC LIMIT 12"
    ).fetchall():
        batch_dists.append({"batch": b["b"], "dist": batch_answer_dist(b["b"])})
    missing_expl = q(
        "SELECT COUNT(*) FROM questions WHERE (disabled IS NULL OR disabled=0) "
        "AND (explanation IS NULL OR explanation='') AND (hs_explanation IS NULL OR hs_explanation='')"
    ).fetchone()[0]
    conn.close()
    return {
        "broken": broken,
        "clones": clones,
        "answer_dist": {"overall": dist_all, "batches": batch_dists},
        "missing_explanation": missing_expl,
        "generated_at": time.time(),
    }


def admin_users(keyword: str | None = None, offset: int = 0, limit: int = 20,
                inactive_days: int | None = None) -> dict:
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    where = "uid IS NOT NULL AND uid!=''"
    args: list = []
    if keyword:
        where += " AND uid LIKE ?"
        args.append(f"%{keyword}%")
    having = ""
    if inactive_days:
        having = "HAVING MAX(created_at) < ?"
    total = conn.execute(
        f"SELECT COUNT(*) FROM (SELECT uid FROM answer_log WHERE {where} GROUP BY uid "
        f"{having})",
        args + ([db._day_start(-inactive_days + 1)] if inactive_days else []),
    ).fetchone()[0]
    rows = conn.execute(
        f"""SELECT uid, COUNT(*) answered, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc,
                  MIN(created_at) first_seen, MAX(created_at) last_seen
           FROM answer_log WHERE {where} GROUP BY uid {having}
           ORDER BY last_seen DESC LIMIT ? OFFSET ?""",
        args + ([db._day_start(-inactive_days + 1)] if inactive_days else []) + [min(max(limit, 0), 50), offset],
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["mistakes"] = conn.execute(
            "SELECT COUNT(*) FROM mistakes WHERE uid=?", (d["uid"],)
        ).fetchone()[0]
        out.append(d)
    conn.close()
    return {"total": total, "items": out}


def admin_user_detail(uid: str) -> dict | None:
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    row = conn.execute(
        """SELECT COUNT(*) answered, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc,
                  MIN(created_at) first_seen, MAX(created_at) last_seen
           FROM answer_log WHERE uid=?""",
        (uid,),
    ).fetchone()
    if not row or not row["answered"]:
        return None
    by_module = [
        dict(r)
        for r in conn.execute(
            """SELECT module, COUNT(*) n, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc
               FROM answer_log WHERE uid=? AND module IS NOT NULL GROUP BY module ORDER BY n DESC""",
            (uid,),
        )
    ]
    recent = [
        dict(r)
        for r in conn.execute(
            """SELECT date(created_at, 'unixepoch', '+8 hours') d, COUNT(*) n,
                      COALESCE(SUM(correct),0) c
               FROM answer_log WHERE uid=? AND created_at>=? GROUP BY d ORDER BY d""",
            (uid, db._day_start(-13)),
        )
    ]
    mistakes = conn.execute("SELECT COUNT(*) FROM mistakes WHERE uid=?", (uid,)).fetchone()[0]
    conn.close()
    return {"uid": uid, **dict(row), "by_module": by_module, "recent": recent, "mistakes": mistakes}


def admin_shizheng(offset: int = 0, limit: int = 20) -> dict:
    conn = db.get_conn()
    total = conn.execute("SELECT COUNT(*) FROM shizheng_questions").fetchone()[0]
    rows = conn.execute(
        "SELECT id, date, question, options, answer, explanation, source_note FROM shizheng_questions "
        "ORDER BY date DESC, id DESC LIMIT ? OFFSET ?",
        (min(max(limit, 0), 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return {"total": total, "items": out}


def admin_shenlun_overview() -> dict:
    conn = db.get_conn()
    papers = [
        dict(r)
        for r in conn.execute(
            """SELECT exam_year, exam_region, paper, COUNT(*) n,
                      SUM(CASE WHEN reference IS NOT NULL AND reference!='' THEN 1 ELSE 0 END) with_ref,
                      SUM(COALESCE(disabled,0)) disabled_n
               FROM shenlun_questions
               GROUP BY exam_year, exam_region, paper
               ORDER BY exam_year DESC, exam_region LIMIT 100"""
        )
    ]
    materials = [
        dict(r)
        for r in conn.execute(
            "SELECT topic, type, COUNT(*) n FROM shenlun_materials GROUP BY topic, type ORDER BY n DESC LIMIT 50"
        )
    ]
    totals = {
        "questions": conn.execute("SELECT COUNT(*) FROM shenlun_questions").fetchone()[0],
        "materials": conn.execute("SELECT COUNT(*) FROM shenlun_materials").fetchone()[0],
    }
    conn.close()
    return {"papers": papers, "materials": materials, "totals": totals}


