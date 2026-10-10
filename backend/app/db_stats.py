"""py 拆分之 stats 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import time

from . import db

__all__ = ["daily_plan", "growth_stats", "mock_done_this_week", "reviews_today", "stats", "submodule_progress", "today_answer_counts"]


def submodule_progress(uid: str, module: str | None = None) -> dict:
    conn = db.get_conn()
    db._ensure_answer_log(conn)
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
    """按周（近 8 周）返回整体和各模块正确率成长曲线，附错题计数。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    since = time.time() - 8 * 7 * 86400
    rows = conn.execute(
        """SELECT strftime('%Y-%W', created_at, 'unixepoch', '+8 hours') wk, module,
                  COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE uid=? AND created_at>?
           GROUP BY wk, module ORDER BY wk""",
        (uid, since),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log WHERE uid=?", (uid,)
    ).fetchone()
    # 全量分模块：雷达等能力画像的服务端口径（按 uid，不依赖设备本地缓存）
    mod_rows = conn.execute(
        """SELECT module, COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log
           WHERE uid=? AND module IN ('changshi','yanyu','shuliang','panduan','ziliao')
           GROUP BY module""",
        (uid,),
    ).fetchall()
    mistakes = db.mistake_counts(conn, uid)
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
        "modules": {r["module"]: {"n": r["n"], "c": r["c"]} for r in mod_rows},
        "weeks": list(weeks.values()),
        "mistakes": mistakes,
    }


def daily_plan(uid: str) -> dict:
    """昨日学习摘要 + 今日推荐（规则版：待复习错题 + 弱项题型）。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    now = time.time()
    day0 = db.cn_day_start(now)
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
    uc, ua = db._uid_clause(uid)
    due = conn.execute(
        f"""SELECT COUNT(*) n FROM mistakes
            WHERE (mastered IS NULL OR mastered=0)
              AND (next_review IS NULL OR next_review<=?){uc}""",
        (now, *ua),
    ).fetchone()
    mtotal = conn.execute(
        f"SELECT COUNT(*) n FROM mistakes WHERE 1=1{uc}", ua
    ).fetchone()
    conn.close()
    state = db.get_user_state(uid)
    focus = (state or {}).get("focus_module") or ""
    weak = db.recommend_stats(uid, top=6)["items"]
    if focus:
        weak.sort(key=lambda w: 0 if w.get("module") == focus else 1)
    return {
        "yesterday": {
            "n": yest["n"], "correct": yest["c"], "secs": yest["s"],
            "modules": [{"module": r["module"], "n": r["n"], "c": r["c"]} for r in ymods],
        },
        "due_mistakes": due["n"],
        "mistakes_total": mtotal["n"],
        "weak": weak[:2],
        "focus": focus,
    }


def stats(uid: str | None = None) -> dict:
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    uc, ua = db._uid_clause(uid)
    by_module = conn.execute(
        f"SELECT module, COUNT(*) n FROM mistakes WHERE 1=1{uc} GROUP BY module ORDER BY n DESC",
        ua,
    ).fetchall()
    by_type = conn.execute(
        f"SELECT question_type, COUNT(*) n FROM mistakes WHERE 1=1{uc} GROUP BY question_type ORDER BY n DESC LIMIT 10",
        ua,
    ).fetchall()
    by_reason = conn.execute(
        "SELECT error_reason, COUNT(*) n FROM mistakes WHERE error_reason IS NOT NULL AND error_reason != ''"
        f"{uc} GROUP BY error_reason ORDER BY n DESC",
        ua,
    ).fetchall()
    conn.close()
    return {
        "by_module": [dict(r) for r in by_module],
        "by_type": [dict(r) for r in by_type],
        "by_reason": [dict(r) for r in by_reason],
    }


def today_answer_counts(uid: str) -> dict:
    """今日（东八区）作答统计：总数 + 按模块/二级题型分组。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    day0 = db._day_start()
    rows = conn.execute(
        """SELECT module, submodule, COUNT(*) n, COALESCE(SUM(correct),0) c
           FROM answer_log WHERE uid=? AND created_at>=?
           GROUP BY module, submodule""",
        (uid, day0),
    ).fetchall()
    conn.close()
    total = 0
    correct = 0
    by_module: dict = {}
    by_sub: dict = {}
    for r in rows:
        total += r["n"]
        correct += r["c"]
        if r["module"]:
            m = by_module.setdefault(r["module"], {"n": 0, "c": 0})
            m["n"] += r["n"]
            m["c"] += r["c"]
        if r["submodule"]:
            s = by_sub.setdefault(r["submodule"], {"n": 0, "c": 0})
            s["n"] += r["n"]
            s["c"] += r["c"]
    return {"total": total, "correct": correct, "by_module": by_module, "by_sub": by_sub}


def reviews_today(uid: str) -> int:
    conn = db.get_conn()
    db._ensure_review_log(conn)
    n = conn.execute(
        "SELECT COUNT(*) n FROM review_log WHERE uid=? AND created_at>=?",
        (uid, db._day_start()),
    ).fetchone()["n"]
    conn.close()
    return n


def mock_done_this_week(uid: str) -> bool:
    """本周（东八区，周一起算）是否已交卷过一次模考/真题卷。"""
    tz = 8 * 3600
    now = time.time()
    weekday = int(((now + tz) // 86400 + 4) % 7)  # 1970-01-01 是周四
    week_start = db._day_start() - ((weekday - 1) % 7) * 86400
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    row = conn.execute(
        "SELECT 1 FROM exam_attempts WHERE uid=? AND submitted_at>=? LIMIT 1",
        (uid, week_start),
    ).fetchone()
    conn.close()
    return bool(row)


