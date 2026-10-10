"""py 拆分之 review 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import re
import time

from . import db, difficulty, review_fields, taxonomy

__all__ = ["_advance_review", "_ensure_mistake_uid", "_ensure_review_cur", "_ensure_review_log", "_find_open_mistake", "_hydrate_mistake", "_shizheng_redo_item", "clear_review_cur", "delete_mistake", "due_mix_questions", "due_review_count", "due_reviews", "get_review_cur", "list_mistakes", "mistake_analysis_stats", "mistake_counts", "mistakes_by_qids", "mistakes_redo", "mistakes_redo_questions", "record_review", "save_mistake", "save_review_cur", "update_mistake"]


def mistakes_redo_questions(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: bool = False, uid: str | None = None, reason: str | None = None, source: str | None = None, tag3: str | None = None, mids: list[int] | None = None) -> list[dict]:
    """把待掌握错题匹配回题库原题，供刷题页重练。mids 限定为用户勾选的错题行（仍受 uid 隔离与 mastered=0 约束）。"""
    return mistakes_redo(limit, qtype=qtype, module=module, noqt=noqt, uid=uid, reason=reason, source=source, tag3=tag3, mids=mids)["items"]


def mistakes_redo(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: bool = False, uid: str | None = None, reason: str | None = None, source: str | None = None, tag3: str | None = None, mids: list[int] | None = None, sub: str | None = None) -> dict:
    """同 mistakes_redo_questions，另回 skipped：本次扫到但对不回题库原题（手录题 / 题已下线 / 题干已对不回时政库）而被跳过的错题行数；
    同题干重复行不计。取够 limit 题后不再往后扫，所以 skipped 是【本次加载】口径而非全部待掌握行。"""
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    cl, cargs = db._uid_clause(uid)
    where = "mastered=0" + cl
    args: list = list(cargs)
    if mids:
        where += f" AND id IN ({','.join('?' * len(mids))})"
        args.extend(mids)
    if qtype:
        where += " AND question_type=?"
        args.append(qtype)
    if module:
        where += " AND module=?"
        args.append(module)
    if noqt:
        where += " AND (question_type IS NULL OR question_type='')"
    if sub:
        subs = taxonomy.group_submodules(module, sub)
        where += f" AND question_id IN (SELECT id FROM questions WHERE submodule IN ({','.join('?' * len(subs))}))"
        args.extend(subs)
    if reason == "未标注":
        where += " AND (error_reason IS NULL OR error_reason='')"
    elif reason:
        where += " AND error_reason=?"
        args.append(reason)
    if source == "exam":
        where += " AND source='exam'"
    elif source == "practice":
        where += " AND (source IS NULL OR source!='exam')"
    if tag3:
        where += " AND question_id IN (SELECT id FROM questions WHERE tag3=?)"
        args.append(tag3)
    rows = conn.execute(
        f"SELECT id, question_text, question_id FROM mistakes WHERE {where} ORDER BY COALESCE(next_review, created_at), created_at DESC LIMIT ?",
        (*args, limit * 2),
    ).fetchall()
    out = []
    seen = set()
    skipped = 0
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
                d["difficulty"] = difficulty.band(d.get("correct_ratio"), d.get("attempt_count"))
                d["difficulty_label"] = difficulty.label(d["difficulty"])
                d["mistake_id"] = r["id"]
                out.append(d)
                if len(out) >= limit:
                    break
                continue
        else:
            d = _shizheng_redo_item(conn, head)
            if d:
                d["mistake_id"] = r["id"]
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
            skipped += 1
            continue
        d = dict(q)
        d["options"] = json.loads(d.get("options") or "{}")
        d["mistake_id"] = r["id"]
        out.append(d)
        if len(out) >= limit:
            break
    conn.close()
    return {"items": out, "skipped": skipped}


def _shizheng_redo_item(conn, head: str) -> dict | None:
    """时政错题的题号属于 shizheng_questions（写入侧 question_id 置空、题干首行=原题干），按题干回原题；
    与 shizheng_daily 同形态并带 _sz，刷题页按时政题处理（不写 question_id、不挂社交/纠错）。
    无 question_id 的行先走这里的索引等值查，未命中才回落到 questions 的 LIKE 前缀扫（每次扫全部活跃行）。"""
    if not head:
        return None
    r = conn.execute("SELECT * FROM shizheng_questions WHERE question=?", (head,)).fetchone()
    if not r:
        return None
    try:
        options = json.loads(r["options"] or "{}")
    except json.JSONDecodeError:
        options = {}
    expl = r["explanation"] or ""
    if r["source_note"]:
        expl += "\n【出处】" + r["source_note"]
    return {
        "id": r["id"],
        "date": r["date"],
        "question": r["question"],
        "options": options,
        "answer": r["answer"],
        "explanation": expl,
        "source_note": r["source_note"],
        "module": "时政",
        "question_type": "单选",
        "_sz": True,
    }


def _find_open_mistake(conn, uid: str, mid, qid) -> int | None:
    """定位本 uid 尚未掌握的错题：优先条目自带 mistake_id（兼容 question_id 为空的文本匹配错题），否则按题号。"""
    mid, qid = db._pos_int(mid), db._pos_int(qid)
    if mid:
        row = conn.execute(
            "SELECT id FROM mistakes WHERE id=? AND uid=? AND (mastered IS NULL OR mastered=0)", (mid, uid)
        ).fetchone()
        if row:
            return row["id"]
    if qid:
        row = conn.execute(
            "SELECT id FROM mistakes WHERE question_id=? AND uid=? AND (mastered IS NULL OR mastered=0) "
            "ORDER BY id LIMIT 1",
            (qid, uid),
        ).fetchone()
        if row:
            return row["id"]
    return None


def mistake_counts(conn, uid: str) -> dict:
    """本人错题计数 {total, mastered, pending}：个人页/统计页只要数字时不必拉 list_mistakes 全表。"""
    _ensure_mistake_uid(conn)
    row = conn.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(mastered=1),0) m FROM mistakes WHERE uid=?", (uid,)
    ).fetchone()
    total, mastered = row["n"], row["m"]
    return {"total": total, "mastered": mastered, "pending": total - mastered}


def mistake_analysis_stats(uid: str) -> dict:
    """汇总错题分布与近期作答数据，供 AI 错题分析使用。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    uc, ua = db._uid_clause(uid)
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
    # B1：已落库结构化复盘字段的错题数（观测解析覆盖度）
    fields_n = conn.execute(
        f"SELECT COUNT(*) n FROM mistakes WHERE mastered=0 AND mistake_analysis IS NOT NULL AND mistake_analysis!=''{uc}",
        ua,
    ).fetchone()
    conn.close()
    return {
        "mistake_types": [dict(r) for r in types],
        "error_reasons": [dict(r) for r in reasons],
        "last7days": {"n": week["n"], "correct": week["c"], "avg_secs": round(week["s"], 1)},
        "slowest_types": [{"t": r["t"], "n": r["n"], "avg_secs": round(r["s"], 1), "correct": r["c"]} for r in slow],
        "structured_n": fields_n["n"],
    }


def _ensure_mistake_uid(conn):
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    if "uid" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN uid TEXT")
    if "question_id" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN question_id INTEGER")
    # 探针打标（与 answer_log.probe 同口径）：跨用户研究/看板剔除内部测试流量；本人列表/复习不受影响
    if "probe" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN probe INTEGER")


def save_mistake(rec: dict, probe: bool = False) -> int:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    qtext = rec.get("question_text")
    qid = rec.get("question_id")
    if db.foreign_module_qid(rec.get("module"), qid):
        qid = None
    dup = None
    uc, ua = db._uid_clause(rec.get("uid") or None)
    if qid:
        dup = conn.execute(
            f"SELECT id FROM mistakes WHERE question_id=?{uc} LIMIT 1", (qid, *ua)
        ).fetchone()
    if not dup and qtext:
        dup = conn.execute(
            f"SELECT id FROM mistakes WHERE question_text=?{uc} LIMIT 1", (qtext, *ua)
        ).fetchone()
    if dup:
        # 再错一次：累计 wrong_review_count 并同步状态机（累计再错≥2 → sticky_wrong）；
        # 带来新解析时顺带刷新结构化复盘字段（B1）
        rf_dup = review_fields.parse_explain(rec.get("explanation"))
        has_new_expl = bool((rec.get("explanation") or "").strip())
        conn.execute(
            "UPDATE mistakes SET times=COALESCE(times,1)+1, mastered=0, mastered_at=NULL, review_streak=0, "
            "wrong_review_count=COALESCE(wrong_review_count,0)+1, "
            "mastery_state=CASE WHEN COALESCE(wrong_review_count,0)+1>=2 THEN 'sticky_wrong' ELSE 'reviewing' END, "
            "next_review=?, user_answer=COALESCE(?, user_answer), "
            "question_id=COALESCE(question_id, ?), source=COALESCE(source, ?), "
            "explanation=CASE WHEN ? THEN ? ELSE explanation END, "
            "mistake_analysis=CASE WHEN ? THEN ? ELSE mistake_analysis END, "
            "fastest_solution=CASE WHEN ? THEN ? ELSE fastest_solution END, "
            "trap_analysis=CASE WHEN ? THEN ? ELSE trap_analysis END, "
            "review_tip=CASE WHEN ? THEN ? ELSE review_tip END, "
            "error_reason=CASE WHEN ? AND (error_reason IS NULL OR error_reason='') THEN ? ELSE error_reason END "
            "WHERE id=?",
            (
                time.time(), rec.get("user_answer"), qid, rec.get("source"),
                1 if has_new_expl else 0, rec.get("explanation"),
                1 if has_new_expl else 0, rf_dup["mistake_analysis"],
                1 if has_new_expl else 0, rf_dup["fastest_solution"],
                1 if has_new_expl else 0, review_fields.trap_json(rf_dup["trap_items"]),
                1 if has_new_expl else 0, rf_dup["review_tip"],
                1 if has_new_expl else 0, rf_dup["error_reason_tag"],
                dup["id"],
            ),
        )
        conn.commit()
        conn.close()
        return dup["id"]
    explanation = rec.get("explanation")
    if qid and not (explanation or "").strip():
        # 快照写入侧回落：隔离/无官方解析的题，客户端传空时用 hs 兜底，与 list_mistakes/due_reviews 读取侧口径一致
        hs_row = conn.execute("SELECT hs_explanation FROM questions WHERE id=?", (qid,)).fetchone()
        explanation = (hs_row["hs_explanation"] if hs_row else None) or explanation
    # B1：把 AI 讲解的六段式解析成结构化字段；用户没自评错因时用解析归类的标签补齐
    rf = review_fields.parse_explain(explanation)
    methods = list(rec.get("methods") or [])
    if rf["method"] and rf["method"] not in methods:
        methods.append(rf["method"])
    error_reason = rec.get("error_reason") or rf["error_reason_tag"]
    cur = conn.execute(
        """INSERT INTO mistakes
           (created_at, module, question_type, question_text, user_answer,
            correct_answer, methods, error_reason, explanation, uid, question_id, source, probe,
            mistake_analysis, fastest_solution, trap_analysis, review_tip, mastery_state, wrong_review_count)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            time.time(),
            rec.get("module"),
            db.norm_qtype(rec.get("question_type")),
            rec.get("question_text"),
            rec.get("user_answer"),
            rec.get("correct_answer"),
            json.dumps(methods, ensure_ascii=False),
            error_reason,
            explanation,
            (rec.get("uid") or None),
            qid,
            rec.get("source"),
            1 if probe else 0,
            rf["mistake_analysis"],
            rf["fastest_solution"],
            review_fields.trap_json(rf["trap_items"]),
            rf["review_tip"],
            "new",
            0,
        ),
    )
    conn.commit()
    rowid = cur.lastrowid
    conn.close()
    return rowid


def mistakes_by_qids(uid: str, qids: list[int]) -> dict[int, dict]:
    """本人错题按题目 id 映射 {question_id: {id, error_reason}}，供成绩报告透出错因自评状态。"""
    if not uid or not qids:
        return {}
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    ph = ",".join("?" * len(qids))
    rows = conn.execute(
        f"SELECT id, question_id, error_reason FROM mistakes WHERE uid=? AND question_id IN ({ph})",
        (uid, *qids),
    ).fetchall()
    conn.close()
    return {r["question_id"]: {"id": r["id"], "error_reason": r["error_reason"]} for r in rows}


def list_mistakes(limit: int = 500, uid: str | None = None) -> list[dict]:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    db._ensure_question_stat_cols(conn)
    cl = " AND m.uid=?" if uid else " AND m.uid IS NULL"
    args = (uid,) if uid else ()
    rows = conn.execute(
        f"""SELECT m.*, q.tag3, q.options AS q_options, q.question AS q_question,
            q.hs_explanation AS q_hs, q.submodule AS q_submodule,
            q.attempt_count, q.correct_ratio, q.most_wrong,
            q.source AS q_source, q.is_real AS q_is_real FROM mistakes m
            LEFT JOIN questions q ON q.id=m.question_id
            WHERE 1=1{cl} ORDER BY m.created_at DESC LIMIT ?""",
        (*args, limit),
    ).fetchall()
    papers = db._paper_by_psource(conn) if any(r["q_is_real"] and r["q_source"] for r in rows) else {}
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        _hydrate_mistake(d)
        src = d.pop("q_source", None)
        hit = papers.get(src) if d.pop("q_is_real", None) and src else None
        d["paper"] = dict(hit) if hit else None
        out.append(d)
    return out


def update_mistake(mid: int, fields: dict, uid: str | None = None) -> bool:
    allowed = {"error_reason", "mastered"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return False
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    clause = ", ".join(f"{k}=?" for k in sets)
    vals = list(sets.values())
    if "mastered" in sets:
        if sets["mastered"]:
            clause += ", mastered_at=COALESCE(mastered_at, ?)"
            vals.append(time.time())
        else:
            clause += ", mastered_at=NULL"
    cl, args = db._uid_clause(uid)
    cur = conn.execute(
        f"UPDATE mistakes SET {clause} WHERE id=?{cl}", (*vals, mid, *args)
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def delete_mistake(mid: int, uid: str | None = None) -> bool:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    cl, args = db._uid_clause(uid)
    cur = conn.execute(f"DELETE FROM mistakes WHERE id=?{cl}", (mid, *args))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def due_review_count(uid: str | None = None, created_before: float | None = None) -> int:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    cl, args = db._uid_clause(uid)
    extra = ""
    if created_before is not None:
        extra = " AND created_at < ?"
        args = (*args, created_before)
    n = conn.execute(
        "SELECT COUNT(*) n FROM mistakes WHERE (mastered IS NULL OR mastered=0) "
        f"AND (next_review IS NULL OR next_review <= ?){cl}{extra}",
        (time.time(), *args),
    ).fetchone()["n"]
    conn.close()
    return n


def due_mix_questions(
    uid: str, limit: int, module: str | None = None, submodule: str | None = None, exclude: set | None = None
) -> list[dict]:
    """普通练习混入的到期错题：本 uid 未掌握且已到期（next_review NULL/≤now）、题库仍有效的行测题，
    最早到期优先；同题多条错题只取最早一条；本次练习会话（近 30 分钟）已作答过的不重出。
    返回 questions 行（同 random_questions 形态）并附 due_mid / due_streak，
    供客户端标「曾错题」、answer_log 答对后按 qid 连带推进复习。"""
    if not uid or limit <= 0:
        return []
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    db._ensure_answer_log(conn)
    now = time.time()
    where = ["m.uid=?", "(m.mastered IS NULL OR m.mastered=0)", "(m.next_review IS NULL OR m.next_review<=?)",
             "m.question_id IS NOT NULL", "q.disabled=0",
             "NOT EXISTS (SELECT 1 FROM answer_log a WHERE a.uid=m.uid AND a.question_id=m.question_id AND a.created_at>?)"]
    args: list = [uid, now, now - db._HISTORY_SESSION_GAP]
    if module:
        where.append("q.module=?")
        args.append(module)
    if submodule:
        where.append("q.submodule=?")
        args.append(submodule)
    rows = conn.execute(
        "SELECT q.*, m.id AS due_mid, m.module AS m_module, COALESCE(m.review_streak,0) AS due_streak "
        f"FROM mistakes m JOIN questions q ON q.id=m.question_id WHERE {' AND '.join(where)} "
        "ORDER BY m.next_review IS NOT NULL, m.next_review, m.created_at, m.id LIMIT ?",
        (*args, limit * 4),
    ).fetchall()
    conn.close()
    out: list[dict] = []
    seen: set = set(exclude or ())
    for r in rows:
        d = dict(r)
        if d["id"] in seen or db.foreign_module_qid(d.pop("m_module"), d["id"]):
            continue
        seen.add(d["id"])
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
        if len(out) >= limit:
            break
    return out


def due_reviews(limit: int = 20, uid: str | None = None) -> list[dict]:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    cl, args = db._uid_clause(uid)
    rows = conn.execute(
        "SELECT m.*, q.options AS q_options, q.question AS q_question, "
        "q.hs_explanation AS q_hs, q.submodule AS q_submodule FROM mistakes m "
        "LEFT JOIN questions q ON q.id=m.question_id "
        "WHERE (m.mastered IS NULL OR m.mastered=0) "
        f"AND (m.next_review IS NULL OR m.next_review <= ?){cl} "
        "ORDER BY m.next_review IS NOT NULL, m.next_review, m.created_at LIMIT ?",
        (time.time(), *args, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        _hydrate_mistake(d)
        out.append(d)
    return out


def _hydrate_mistake(d: dict) -> None:
    """联查到题库题时 question_text 取规范题干（历史写入把选项行拼进了 question_text，
    与结构化 options 同时展示会重复）；未联查到（手录/已下架）保持原文。"""
    d["methods"] = json.loads(d.get("methods") or "[]")
    d.pop("probe", None)
    d["options"] = db._parse_options(d.pop("q_options", None))
    stem = (d.pop("q_question", None) or "").strip()
    if stem and d["options"]:
        d["question_text"] = stem
    hs = d.pop("q_hs", None)
    d["explanation"] = d.get("explanation") or hs or ""
    d["submodule"] = (d.pop("q_submodule", None) or "").strip() or None
    d["type_group"] = taxonomy.group_name(d.get("module"), d["submodule"])
    # B1：结构化复盘字段——存量行没有落库值时按 explanation 现解析（读侧兜底，不写库）
    if d["explanation"] and d.get("mistake_analysis") is None:
        rf = review_fields.parse_explain(d["explanation"])
        for k in ("mistake_analysis", "fastest_solution", "review_tip"):
            if d.get(k) is None:
                d[k] = rf[k]
        if d.get("trap_analysis") is None:
            d["trap_analysis"] = review_fields.trap_json(rf["trap_items"])
        if not d.get("error_reason") and rf["error_reason_tag"]:
            d["error_reason"] = rf["error_reason_tag"]
    d["trap_items"] = review_fields.trap_list(d.pop("trap_analysis", None))
    # B2：状态机列兜底（理论上迁移已回填，防异常路径下的 NULL）
    if not d.get("mastery_state"):
        d["mastery_state"] = "mastered" if d.get("mastered") else ("reviewing" if d.get("review_count") else "new")
    d["wrong_review_count"] = d.get("wrong_review_count") or 0


def _ensure_review_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS review_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT, mistake_id INTEGER, correct INTEGER, created_at REAL)"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rl_uid ON review_log(uid, created_at)")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(review_log)")}
    for col, ddl in [
        ("picked", "ALTER TABLE review_log ADD COLUMN picked TEXT"),
        ("secs", "ALTER TABLE review_log ADD COLUMN secs INTEGER"),
        ("via", "ALTER TABLE review_log ADD COLUMN via TEXT"),
        ("probe", "ALTER TABLE review_log ADD COLUMN probe INTEGER"),
    ]:
        if col not in cols:
            conn.execute(ddl)


def _advance_review(
    conn,
    mid: int,
    correct: bool,
    uid: str | None,
    picked: str | None = None,
    secs: int | None = None,
    via: str = "review",
    probe: bool = False,
) -> dict | None:
    """一次复习结果推进 SRS：写 review_log（有 uid 时）、更新 streak/next_review/mastered。错题不存在返回 None。

    via='answer' 表示由练习 answer_log 连带推进（同一次作答已在 answer_log 有行，历次作答时间线不重复计）。"""
    cl, args = db._uid_clause(uid)
    row = conn.execute(
        f"SELECT review_streak, wrong_review_count FROM mistakes WHERE id=?{cl}", (mid, *args)
    ).fetchone()
    if not row:
        return None
    if uid:
        _ensure_review_log(conn)
        conn.execute(
            "INSERT INTO review_log (uid, mistake_id, correct, created_at, picked, secs, via, probe) VALUES (?,?,?,?,?,?,?,?)",
            (
                uid,
                mid,
                1 if correct else 0,
                time.time(),
                db.normalize_answer(picked)[:8] or None,
                int(secs) if secs else None,
                via,
                1 if probe else 0,
            ),
        )
    streak = (row["review_streak"] or 0) + 1 if correct else 0
    days = db.REVIEW_INTERVALS_DAYS[min(streak - 1, len(db.REVIEW_INTERVALS_DAYS) - 1)] if correct else 1
    # 到期点落在中国日历日 00:00，与 UI「今日到期 / 明天复习」及 cn_day 的「今天」同口径
    nxt = db.cn_day_start() + days * 86400
    mastered = 1 if streak > len(db.REVIEW_INTERVALS_DAYS) else 0
    # B2 状态机（唯一跃迁点）：再错累计 wrong_review_count；连对>间隔数 → mastered；
    # 复习中再错累计≥2 → sticky_wrong；sticky_wrong 再答对 → reviewing（不直接 mastered，防震荡）
    wrc = (row["wrong_review_count"] or 0) + (0 if correct else 1)
    if mastered:
        state = "mastered"
    elif not correct and wrc >= 2:
        state = "sticky_wrong"
    else:
        state = "reviewing"
    conn.execute(
        "UPDATE mistakes SET review_count=review_count+1, review_streak=?, next_review=?, "
        "mastered=?, mastered_at=CASE WHEN ? THEN COALESCE(mastered_at, ?) ELSE NULL END, "
        "wrong_review_count=?, mastery_state=? "
        f"WHERE id=?{cl}",
        (streak, nxt, mastered, mastered, time.time(), wrc, state, mid, *args),
    )
    return {"streak": streak, "next_review_days": days, "mastered": bool(mastered)}


def record_review(
    mid: int,
    correct: bool,
    uid: str | None = None,
    picked: str | None = None,
    secs: int | None = None,
    probe: bool = False,
) -> dict:
    conn = db.get_conn()
    _ensure_mistake_uid(conn)
    res = _advance_review(conn, mid, correct, uid, picked=picked, secs=secs, probe=probe)
    if res is None:
        conn.close()
        raise KeyError(mid)
    conn.commit()
    conn.close()
    return res


def _ensure_review_cur(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS review_cur (
            uid TEXT PRIMARY KEY,
            snap TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )


def save_review_cur(uid: str, snap_json: str) -> None:
    conn = db.get_conn()
    _ensure_review_cur(conn)
    conn.execute(
        """INSERT INTO review_cur (uid, snap, updated_at)
           VALUES (?,?,?)
           ON CONFLICT(uid) DO UPDATE SET
             snap=excluded.snap, updated_at=excluded.updated_at""",
        (uid, snap_json, time.time()),
    )
    conn.commit()
    conn.close()


def clear_review_cur(uid: str) -> None:
    conn = db.get_conn()
    _ensure_review_cur(conn)
    conn.execute("DELETE FROM review_cur WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def get_review_cur(uid: str) -> dict | None:
    conn = db.get_conn()
    _ensure_review_cur(conn)
    row = conn.execute("SELECT snap, updated_at FROM review_cur WHERE uid=?", (uid,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["snap"] = json.loads(d["snap"] or "null")
    except ValueError:
        d["snap"] = None
    return d


