"""py 拆分之 practice 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import time

from . import db

__all__ = ["_ensure_answer_log", "_ensure_practice_progress", "_ensure_practice_results", "_ensure_question_stat_cols", "clear_practice_progress", "get_practice_progress", "practice_history", "practice_history_detail", "question_attempts", "refresh_question_stats", "save_answer_log", "save_answer_log_detail", "save_practice_progress", "save_practice_result"]


def _ensure_practice_results(conn) -> None:
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
    db.add_column_if_missing(conn, "practice_results", "uid", "TEXT")
    db.add_column_if_missing(conn, "practice_results", "probe", "INTEGER")


def save_practice_result(
    module: str | None, n: int, correct: int, secs: int, uid: str | None = None, probe: bool = False
) -> dict:
    """保存一次刷题结果并返回正确率百分位（击败了多少真人记录）。"""
    conn = db.get_conn()
    _ensure_practice_results(conn)
    acc = correct / n if n else 0
    conn.execute(
        "INSERT INTO practice_results (created_at, module, n, correct, secs, uid, probe) VALUES (?,?,?,?,?,?,?)",
        (time.time(), module, n, correct, secs, uid or None, 1 if probe else 0),
    )
    conn.commit()
    total = conn.execute(f"SELECT COUNT(*) FROM practice_results WHERE {db.PRACTICE_POOL}").fetchone()[0]
    beaten = conn.execute(
        f"SELECT COUNT(*) FROM practice_results WHERE {db.PRACTICE_POOL} AND CAST(correct AS REAL)/n < ?", (acc,)
    ).fetchone()[0]
    conn.close()
    percentile = round(beaten / total * 100) if total >= 10 else None
    return {"percentile": percentile, "samples": total}


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
    db.add_column_if_missing(conn, "answer_log", "picked", "TEXT")
    # 推荐埋点：进入练习的入口（reco/weak/reinforce），旧数据默认 NULL
    db.add_column_if_missing(conn, "answer_log", "source", "TEXT")
    # 探针流量标记（1=来自 KG_PROBE_CIDRS 网段，运营看板剔除）；旧行 NULL=未知
    db.add_column_if_missing(conn, "answer_log", "probe", "INTEGER")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_al_qid ON answer_log(question_id)")
    # uid+question_id 过滤热路径（alembic 0002 同款，幂等兜底：被守卫跳过的库也能拿到）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_al_uid_qid ON answer_log(uid, question_id) "
        "WHERE question_id IS NOT NULL"
    )


def save_answer_log_detail(uid: str, items: list[dict], probe: bool = False) -> dict:
    """落 answer_log；答对且命中本 uid 未掌握错题的条目同步推进该错题复习计划（与 /api/review 同一套 SRS）。
    probe=True 标记为探针流量（运营看板剔除，用户自身的统计/复习不受影响）。
    条目 t（离线补传时的客户端作答时刻）在合理窗口内时作为 created_at。"""
    conn = db.get_conn()
    _ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    now = time.time()
    n = 0
    reviewed: list[dict] = []
    advanced: set[int] = set()
    for it in items:
        if not isinstance(it, dict):
            continue
        qid = it.get("qid") or it.get("question_id") or it.get("id")
        module, sub = it.get("module"), it.get("submodule")
        if db.foreign_module_qid(module, qid):
            qid = None
        if qid:
            qrow = conn.execute(
                "SELECT module, submodule FROM questions WHERE id=?", (qid,)
            ).fetchone()
            if qrow:
                module = qrow["module"] or module
                sub = qrow["submodule"] or sub
        sub = db.merge_submodule(module, sub)
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, submodule, correct, secs, picked, source, probe) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                uid,
                db._client_ts(it.get("t"), now),
                qid,
                module,
                sub,
                1 if it.get("correct") else 0,
                int(it.get("secs") or 0),
                db.normalize_answer(it.get("picked"))[:8] or None,
                (str(it.get("source") or "")[:32] or None),
                1 if probe else 0,
            ),
        )
        n += 1
        if not it.get("correct"):
            continue
        mid = db._find_open_mistake(conn, uid, it.get("mid"), qid)
        if mid is None or mid in advanced:
            continue
        advanced.add(mid)
        res = db._advance_review(conn, mid, True, uid, via="answer", probe=probe)
        if res:
            reviewed.append({"mistake_id": mid, "streak": res["streak"], "mastered": res["mastered"]})
    conn.commit()
    conn.close()
    return {"saved": n, "reviewed": reviewed}


def save_answer_log(uid: str, items: list[dict], probe: bool = False) -> int:
    return save_answer_log_detail(uid, items, probe=probe)["saved"]


def practice_history(uid: str, limit: int = 50) -> list[dict]:
    """把 answer_log 按时间间隔切分为练习会话（倒序）。"""
    conn = db.get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        "SELECT created_at, module, correct, secs, source FROM answer_log WHERE uid=? ORDER BY created_at DESC LIMIT 2000",
        (uid,),
    ).fetchall()
    conn.close()
    sessions: list[dict] = []
    cur: dict | None = None
    for r in rows:  # 倒序遍历：r 比 cur['start'] 更早
        if cur is None or cur["start"] - r["created_at"] > db._HISTORY_SESSION_GAP:
            if len(sessions) >= limit:
                break
            cur = {
                "start": r["created_at"],
                "end": r["created_at"],
                "n": 0,
                "correct": 0,
                "secs": 0,
                "modules": [],
                "source": r["source"],
            }
            sessions.append(cur)
        cur["start"] = r["created_at"]
        cur["n"] += 1
        cur["correct"] += 1 if r["correct"] else 0
        cur["secs"] += r["secs"] or 0
        if r["module"] and r["module"] not in cur["modules"]:
            cur["modules"].append(r["module"])
    return sessions


def practice_history_detail(uid: str, start: float, end: float) -> list[dict]:
    """某次练习的逐题记录，附题库原题（供回看与重练）。"""
    conn = db.get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.created_at, a.question_id, a.module, a.submodule, a.correct, a.secs, a.picked, q.id qid
           FROM answer_log a LEFT JOIN questions q
             ON q.id = a.question_id AND (q.disabled IS NULL OR q.disabled=0)
           WHERE a.uid=? AND a.created_at BETWEEN ? AND ?
           ORDER BY a.created_at LIMIT 100""",
        (uid, start - 0.001, end + 0.001),
    ).fetchall()
    out = []
    for r in rows:
        item = {
            "created_at": r["created_at"],
            "module": r["module"],
            "submodule": r["submodule"],
            "correct": bool(r["correct"]),
            "secs": r["secs"],
            "picked": r["picked"],
            "question": None,
        }
        if r["qid"]:
            qrow = conn.execute("SELECT * FROM questions WHERE id=?", (r["qid"],)).fetchone()
            if qrow:
                d = dict(qrow)
                d["options"] = json.loads(d.get("options") or "{}")
                item["question"] = d
        out.append(item)
    conn.close()
    return out


def _ensure_question_stat_cols(conn) -> None:
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    for col, ddl in [
        ("attempt_count", "ALTER TABLE questions ADD COLUMN attempt_count INTEGER"),
        ("correct_ratio", "ALTER TABLE questions ADD COLUMN correct_ratio INTEGER"),
        ("most_wrong", "ALTER TABLE questions ADD COLUMN most_wrong TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)


def refresh_question_stats() -> int:
    """聚合 answer_log 为每题刷新全站作答人次/正确率/易错项。"""
    conn = db.get_conn()
    _ensure_answer_log(conn)
    _ensure_question_stat_cols(conn)
    rows = conn.execute(
        f"""SELECT question_id qid, COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE question_id IS NOT NULL AND {db.REAL_TRAFFIC} GROUP BY question_id"""
    ).fetchall()
    wrong = {
        r["qid"]: r["p"]
        for r in conn.execute(
            f"""SELECT qid, p FROM (
                 SELECT question_id qid, picked p,
                        ROW_NUMBER() OVER (
                          PARTITION BY question_id
                          ORDER BY COUNT(*) DESC, picked ASC
                        ) rk
                 FROM answer_log
                 WHERE question_id IS NOT NULL AND correct=0 AND picked IS NOT NULL AND {db.REAL_TRAFFIC}
                 GROUP BY question_id, picked
               ) WHERE rk=1"""
        )
    }
    target = {
        r["qid"]: (r["n"], round(100 * (r["c"] or 0) / r["n"]), wrong.get(r["qid"]))
        for r in rows
    }
    # 先在读事务里取现值：把要改的页读热且不持写锁（冷页缓存下逐题 UPDATE 会把随机页读全算进写锁持有期），
    # 仅对变化行分批写，写锁单次持有毫秒级。
    current = {}
    ids = list(target)
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in conn.execute(
            f"SELECT id, attempt_count, correct_ratio, most_wrong FROM questions WHERE id IN ({','.join('?' * len(chunk))})",
            chunk,
        ):
            current[r["id"]] = (r["attempt_count"], r["correct_ratio"], r["most_wrong"])
    changed = [(v[0], v[1], v[2], qid) for qid, v in target.items() if qid in current and current[qid] != v]
    # 已无真人作答行（仅剩探针行/行被清理）但仍挂着旧统计的题目一并清空，否则外显的「全站正确率」是陈旧聚合
    stale = [
        r["id"] for r in conn.execute("SELECT id FROM questions WHERE attempt_count IS NOT NULL")
        if r["id"] not in target
    ]
    changed += [(None, None, None, qid) for qid in stale]
    for i in range(0, len(changed), db.QUESTION_STATS_BATCH):
        conn.executemany(
            "UPDATE questions SET attempt_count=?, correct_ratio=?, most_wrong=? WHERE id=?",
            changed[i:i + db.QUESTION_STATS_BATCH],
        )
        conn.commit()
    conn.close()
    return len(target)


def question_attempts(uid: str, question_id: int, limit: int = 20) -> list[dict]:
    """某题历次作答时间线：练习作答（answer_log，source='practice'）+ 复习作答（review_log，source='review'）合并倒序。

    练习连带推进复习的 review_log 行（via='answer'，或历史 NULL 行与某条练习作答相隔 <3s）不重复计。"""
    conn = db.get_conn()
    _ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    db._ensure_review_log(conn)
    rows = conn.execute(
        """SELECT created_at, correct, secs, picked FROM answer_log
           WHERE uid=? AND question_id=? ORDER BY created_at DESC LIMIT ?""",
        (uid, question_id, limit),
    ).fetchall()
    items = [{**dict(r), "source": "practice"} for r in rows]
    practice_ts = [r["created_at"] for r in rows]
    rrows = conn.execute(
        """SELECT r.created_at, r.correct, r.secs, r.picked, r.via FROM review_log r
           JOIN mistakes m ON m.id = r.mistake_id
           WHERE r.uid=? AND m.question_id=? ORDER BY r.created_at DESC LIMIT ?""",
        (uid, question_id, limit),
    ).fetchall()
    conn.close()
    for r in rrows:
        if r["via"] == "answer":
            continue
        if r["via"] is None and any(abs(t - r["created_at"]) < db._ATTEMPT_DEDUPE_SECS for t in practice_ts):
            continue
        items.append(
            {
                "created_at": r["created_at"],
                "correct": r["correct"],
                "secs": r["secs"],
                "picked": r["picked"],
                "source": "review",
            }
        )
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return items[:limit]


def _ensure_practice_progress(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS practice_progress (
            uid TEXT PRIMARY KEY,
            qids TEXT NOT NULL,
            picks TEXT NOT NULL,
            excl TEXT,
            idx INTEGER NOT NULL DEFAULT 0,
            right_n INTEGER NOT NULL DEFAULT 0,
            streak INTEGER NOT NULL DEFAULT 0,
            best_streak INTEGER NOT NULL DEFAULT 0,
            module TEXT,
            submodule TEXT,
            updated_at REAL NOT NULL
        )"""
    )
    pcols = {r["name"] for r in conn.execute("PRAGMA table_info(practice_progress)")}
    if "psource" not in pcols:
        conn.execute("ALTER TABLE practice_progress ADD COLUMN psource TEXT")
    if "ptitle" not in pcols:
        conn.execute("ALTER TABLE practice_progress ADD COLUMN ptitle TEXT")
    if "daily" not in pcols:
        conn.execute("ALTER TABLE practice_progress ADD COLUMN daily TEXT")


def save_practice_progress(uid: str, qids: list[int], picks: dict, excl: dict, idx: int,
                           right: int, streak: int, best_streak: int,
                           module: str | None, submodule: str | None,
                           psource: str | None = None, ptitle: str | None = None,
                           daily: dict | None = None) -> None:
    conn = db.get_conn()
    _ensure_practice_progress(conn)
    conn.execute(
        """INSERT INTO practice_progress (uid, qids, picks, excl, idx, right_n, streak, best_streak,
                                          module, submodule, psource, ptitle, daily, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(uid) DO UPDATE SET
             qids=excluded.qids, picks=excluded.picks, excl=excluded.excl, idx=excluded.idx,
             right_n=excluded.right_n, streak=excluded.streak, best_streak=excluded.best_streak,
             module=excluded.module, submodule=excluded.submodule,
             psource=excluded.psource, ptitle=excluded.ptitle, daily=excluded.daily,
             updated_at=excluded.updated_at""",
        (uid, json.dumps(qids), json.dumps(picks), json.dumps(excl) if excl else None,
         idx, right, streak, best_streak, module, submodule, psource, ptitle,
         json.dumps(daily) if daily else None, time.time()),
    )
    conn.commit()
    conn.close()


def clear_practice_progress(uid: str) -> None:
    conn = db.get_conn()
    _ensure_practice_progress(conn)
    conn.execute("DELETE FROM practice_progress WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def get_practice_progress(uid: str) -> dict | None:
    conn = db.get_conn()
    _ensure_practice_progress(conn)
    row = conn.execute("SELECT * FROM practice_progress WHERE uid=?", (uid,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["qids"] = json.loads(d["qids"] or "[]")
    d["picks"] = json.loads(d["picks"] or "{}")
    d["excl"] = json.loads(d.get("excl") or "{}")
    d["daily"] = json.loads(d["daily"]) if d.get("daily") else None
    return d


