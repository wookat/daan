"""组队打卡 + 题目分享裂变（轮18）。

小队：创建/凭 6 位邀请码加入/退出/面板（每个成员今日做题数、连续打卡、今日正确率、
最近活跃、本周 7 天打卡格子——全部聚合 answer_log）。
题目分享：把一道题分享给队友/好友，被分享者先作答再看答案与大家的选择；
作答写 answer_log（source=share），匿名 uid 即可参与（裂变入口）。
uid 隔离：非小队成员不可见小队面板；分享作答明细仅分享者与已作答者可见。
"""
import random
import string
import time
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from . import db
from .auth import rate_limit

router = APIRouter(prefix="/api")

TEAM_MAX_MEMBERS = 20
TEAM_MAX_JOINED = 5
TEAM_NAME_MAX = 20


def init_team_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT NOT NULL UNIQUE,
            creator_uid TEXT NOT NULL,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS team_members (
            team_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            nickname TEXT,
            joined_at REAL NOT NULL,
            PRIMARY KEY (team_id, uid)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tm_uid ON team_members(uid)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shared_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sid TEXT NOT NULL UNIQUE,
            question_id INTEGER NOT NULL,
            from_uid TEXT NOT NULL,
            from_name TEXT,
            team_id INTEGER,
            open_count INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sq_from ON shared_questions(from_uid, created_at)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shared_answers (
            share_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            nickname TEXT,
            picked TEXT,
            correct INTEGER,
            created_at REAL NOT NULL,
            PRIMARY KEY (share_id, uid)
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS growth_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT,
            event TEXT NOT NULL,
            source TEXT,
            ref TEXT,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ge_event ON growth_events(event, created_at)")
    conn.commit()
    conn.close()


def _clean_uid(uid) -> str:
    u = str(uid or "").strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return u


def _clean_name(name) -> str:
    return str(name or "").strip()[:20] or "匿名考友"


def _gen_invite_code(conn) -> str:
    for _ in range(20):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not conn.execute("SELECT 1 FROM teams WHERE invite_code=?", (code,)).fetchone():
            return code
    raise HTTPException(500, "生成邀请码失败")


def _gen_sid(conn) -> str:
    for _ in range(20):
        sid = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        if not conn.execute("SELECT 1 FROM shared_questions WHERE sid=?", (sid,)).fetchone():
            return sid
    raise HTTPException(500, "生成分享码失败")


def _member(conn, team_id: int, uid: str):
    return conn.execute(
        "SELECT * FROM team_members WHERE team_id=? AND uid=?", (team_id, uid)
    ).fetchone()


def _team_payload(conn, t, uid: str) -> dict:
    n = conn.execute("SELECT COUNT(*) FROM team_members WHERE team_id=?", (t["id"],)).fetchone()[0]
    return {
        "id": t["id"],
        "name": t["name"],
        "invite_code": t["invite_code"],
        "n_members": n,
        "is_creator": t["creator_uid"] == uid,
        "created_at": t["created_at"],
    }


# ---------- 小队 ----------

@router.post("/team/create")
def api_team_create(body: dict):
    uid = _clean_uid(body.get("uid"))
    rate_limit(f"team_create:{uid}", 5, 3600)
    name = str(body.get("name") or "").strip()[:TEAM_NAME_MAX]
    if not name:
        raise HTTPException(400, "小队名不能为空")
    conn = db.get_conn()
    joined = conn.execute("SELECT COUNT(*) FROM team_members WHERE uid=?", (uid,)).fetchone()[0]
    if joined >= TEAM_MAX_JOINED:
        conn.close()
        raise HTTPException(400, f"最多同时加入 {TEAM_MAX_JOINED} 个小队")
    code = _gen_invite_code(conn)
    now = time.time()
    cur = conn.execute(
        "INSERT INTO teams (name, invite_code, creator_uid, created_at) VALUES (?,?,?,?)",
        (name, code, uid, now),
    )
    conn.execute(
        "INSERT INTO team_members (team_id, uid, nickname, joined_at) VALUES (?,?,?,?)",
        (cur.lastrowid, uid, _clean_name(body.get("nickname")), now),
    )
    conn.commit()
    t = conn.execute("SELECT * FROM teams WHERE id=?", (cur.lastrowid,)).fetchone()
    out = _team_payload(conn, t, uid)
    conn.close()
    return {"team": out}


@router.post("/team/join")
def api_team_join(body: dict):
    uid = _clean_uid(body.get("uid"))
    rate_limit(f"team_join:{uid}", 10, 300)
    code = str(body.get("code") or "").strip().upper()[:12]
    if not code:
        raise HTTPException(400, "缺少邀请码")
    conn = db.get_conn()
    t = conn.execute("SELECT * FROM teams WHERE invite_code=?", (code,)).fetchone()
    if not t:
        conn.close()
        raise HTTPException(404, "邀请码无效或小队不存在")
    if _member(conn, t["id"], uid):
        out = _team_payload(conn, t, uid)
        conn.close()
        return {"team": out, "already": True}
    n = conn.execute("SELECT COUNT(*) FROM team_members WHERE team_id=?", (t["id"],)).fetchone()[0]
    if n >= TEAM_MAX_MEMBERS:
        conn.close()
        raise HTTPException(400, f"该小队已满（上限 {TEAM_MAX_MEMBERS} 人）")
    joined = conn.execute("SELECT COUNT(*) FROM team_members WHERE uid=?", (uid,)).fetchone()[0]
    if joined >= TEAM_MAX_JOINED:
        conn.close()
        raise HTTPException(400, f"最多同时加入 {TEAM_MAX_JOINED} 个小队")
    conn.execute(
        "INSERT INTO team_members (team_id, uid, nickname, joined_at) VALUES (?,?,?,?)",
        (t["id"], uid, _clean_name(body.get("nickname")), time.time()),
    )
    conn.commit()
    out = _team_payload(conn, t, uid)
    conn.close()
    return {"team": out, "already": False}


@router.post("/team/leave")
def api_team_leave(body: dict):
    uid = _clean_uid(body.get("uid"))
    team_id = body.get("team_id")
    if not team_id:
        raise HTTPException(400, "缺少 team_id")
    conn = db.get_conn()
    cur = conn.execute("DELETE FROM team_members WHERE team_id=? AND uid=?", (int(team_id), uid))
    if cur.rowcount:
        left = conn.execute(
            "SELECT COUNT(*) FROM team_members WHERE team_id=?", (int(team_id),)
        ).fetchone()[0]
        if not left:
            conn.execute("DELETE FROM teams WHERE id=?", (int(team_id),))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(404, "你不在该小队中")
    return {"ok": True}


@router.get("/team/mine")
def api_team_mine(uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT t.* FROM teams t JOIN team_members m ON m.team_id=t.id
           WHERE m.uid=? ORDER BY m.joined_at""",
        (u,),
    ).fetchall()
    items = [_team_payload(conn, t, u) for t in rows]
    conn.close()
    return {"items": items, "max_teams": TEAM_MAX_JOINED}


def _week_days() -> list[str]:
    today = date.today()  # noqa: DTZ011  # 服务器本地时区，与 answer_log 的 localtime 聚合一致
    monday = today - timedelta(days=today.weekday())
    return [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]


def _member_stats(conn, uid: str) -> dict:
    days = {
        r["d"]: {"n": r["n"], "correct": r["c"] or 0}
        for r in conn.execute(
            """SELECT DATE(created_at, 'unixepoch', 'localtime') AS d,
                      COUNT(*) AS n, SUM(correct) AS c
               FROM answer_log WHERE uid=? GROUP BY d""",
            (uid,),
        )
    }
    last = conn.execute(
        "SELECT MAX(created_at) FROM answer_log WHERE uid=?", (uid,)
    ).fetchone()[0]
    d = date.today()  # noqa: DTZ011  # 服务器本地时区，与 answer_log 的 localtime 聚合一致
    today = d.strftime("%Y-%m-%d")
    t = days.get(today, {"n": 0, "correct": 0})
    streak = 0
    if today not in days:
        d -= timedelta(days=1)
    while d.strftime("%Y-%m-%d") in days:
        streak += 1
        d -= timedelta(days=1)
    week = [days.get(day, {}).get("n", 0) for day in _week_days()]
    return {
        "today_n": t["n"],
        "today_correct": t["correct"],
        "today_acc": round(100 * t["correct"] / t["n"]) if t["n"] else None,
        "streak": streak,
        "last_active": last,
        "week": week,
    }


@router.get("/team/{team_id}/panel")
def api_team_panel(team_id: int, uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    t = conn.execute("SELECT * FROM teams WHERE id=?", (team_id,)).fetchone()
    if not t:
        conn.close()
        raise HTTPException(404, "小队不存在")
    if not _member(conn, team_id, u):
        conn.close()
        raise HTTPException(403, "仅小队成员可查看")
    db._ensure_answer_log(conn)
    members = conn.execute(
        "SELECT * FROM team_members WHERE team_id=? ORDER BY joined_at", (team_id,)
    ).fetchall()
    items = []
    for m in members:
        st = _member_stats(conn, m["uid"])
        items.append({
            "nickname": m["nickname"] or "匿名考友",
            "is_me": m["uid"] == u,
            "is_creator": m["uid"] == t["creator_uid"],
            "joined_at": m["joined_at"],
            **st,
        })
    out = _team_payload(conn, t, u)
    conn.close()
    items.sort(key=lambda x: (-x["today_n"], -x["streak"]))
    return {"team": out, "members": items, "week_days": _week_days()}


# ---------- 题目分享 ----------

def _sanitized_question(qid: int) -> dict | None:
    items = db.questions_by_ids([qid])
    if not items:
        return None
    q = items[0]
    return {
        "id": q["id"],
        "module": q.get("module"),
        "submodule": q.get("submodule"),
        "question": q.get("question"),
        "options": q.get("options") or {},
        "image": q.get("image"),
    }


def _full_question(qid: int) -> dict | None:
    items = db.questions_by_ids([qid])
    return items[0] if items else None


def _sharer_invite(conn, s) -> dict | None:
    """分享者所在小队的邀请信息（用于落地页「和 TA 组队刷题」引导）。
    优先取分享时绑定的 team_id，否则取分享者最近加入的小队。"""
    t = None
    if s["team_id"]:
        t = conn.execute("SELECT * FROM teams WHERE id=?", (s["team_id"],)).fetchone()
    if not t:
        t = conn.execute(
            """SELECT t.* FROM teams t JOIN team_members m ON m.team_id=t.id
               WHERE m.uid=? ORDER BY m.joined_at DESC LIMIT 1""",
            (s["from_uid"],),
        ).fetchone()
    if not t:
        return None
    n = conn.execute("SELECT COUNT(*) FROM team_members WHERE team_id=?", (t["id"],)).fetchone()[0]
    if n >= TEAM_MAX_MEMBERS:
        return None
    return {"code": t["invite_code"], "name": t["name"], "n_members": n}


def _question_stats(conn, question_id: int) -> dict:
    """该题在 answer_log 中的全量作答统计（用于「你击败了 X%」）。"""
    row = conn.execute(
        "SELECT COUNT(*) AS n, COALESCE(SUM(correct),0) AS c FROM answer_log WHERE question_id=?",
        (question_id,),
    ).fetchone()
    n, c = row["n"], row["c"]
    return {
        "total": n,
        "acc": round(100 * c / n) if n else None,
        "beat_pct": round(100 * (n - c) / n) if n else None,
    }


def _answers_payload(conn, share_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM shared_answers WHERE share_id=? ORDER BY created_at", (share_id,)
    ).fetchall()
    return [
        {
            "nickname": r["nickname"] or "匿名考友",
            "picked": r["picked"],
            "correct": bool(r["correct"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.post("/share/create")
def api_share_create(body: dict):
    uid = _clean_uid(body.get("uid"))
    rate_limit(f"share_create:{uid}", 30, 3600)
    qid = body.get("question_id")
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    if not _sanitized_question(int(qid)):
        raise HTTPException(404, "题目不存在")
    team_id = body.get("team_id")
    conn = db.get_conn()
    if team_id and not _member(conn, int(team_id), uid):
        conn.close()
        raise HTTPException(403, "你不在该小队中")
    sid = _gen_sid(conn)
    conn.execute(
        """INSERT INTO shared_questions (sid, question_id, from_uid, from_name, team_id, created_at)
           VALUES (?,?,?,?,?,?)""",
        (sid, int(qid), uid, _clean_name(body.get("nickname")), int(team_id) if team_id else None, time.time()),
    )
    conn.commit()
    conn.close()
    q = _sanitized_question(int(qid)) or {}
    return {"sid": sid, "module": q.get("module"), "submodule": q.get("submodule")}


@router.get("/share/{sid}")
def api_share_detail(sid: str, uid: str = ""):
    u = (uid or "").strip()[:64] or None
    conn = db.get_conn()
    s = conn.execute("SELECT * FROM shared_questions WHERE sid=?", (sid.strip()[:16],)).fetchone()
    if not s:
        conn.close()
        raise HTTPException(404, "分享不存在或已过期")
    conn.execute("UPDATE shared_questions SET open_count=open_count+1 WHERE id=?", (s["id"],))
    conn.commit()
    my = conn.execute(
        "SELECT * FROM shared_answers WHERE share_id=? AND uid=?", (s["id"], u or "")
    ).fetchone() if u else None
    is_sharer = bool(u) and s["from_uid"] == u
    answered = bool(my)
    q = _sanitized_question(s["question_id"])
    if not q:
        conn.close()
        raise HTTPException(404, "题目不存在")
    out = {
        "sid": s["sid"],
        "from_name": s["from_name"] or "匿名考友",
        "is_sharer": is_sharer,
        "answered": answered,
        "n_answered": conn.execute(
            "SELECT COUNT(*) FROM shared_answers WHERE share_id=?", (s["id"],)
        ).fetchone()[0],
        "question": q,
        "created_at": s["created_at"],
    }
    out["team_invite"] = _sharer_invite(conn, s)
    if is_sharer or answered:
        full = _full_question(s["question_id"]) or {}
        out["question"] = {**q, "answer": full.get("answer"), "explanation": full.get("explanation")}
        out["answers"] = _answers_payload(conn, s["id"])
        db._ensure_answer_log(conn)
        out["q_stats"] = _question_stats(conn, s["question_id"])
        if my:
            out["my_answer"] = {"picked": my["picked"], "correct": bool(my["correct"])}
    conn.close()
    return out


@router.post("/share/{sid}/answer")
def api_share_answer(sid: str, body: dict):
    uid = _clean_uid(body.get("uid"))
    rate_limit(f"share_answer:{uid}", 60, 3600)
    picked = str(body.get("picked") or "").strip().upper()[:2]
    if not picked:
        raise HTTPException(400, "缺少作答选项")
    conn = db.get_conn()
    s = conn.execute("SELECT * FROM shared_questions WHERE sid=?", (sid.strip()[:16],)).fetchone()
    if not s:
        conn.close()
        raise HTTPException(404, "分享不存在或已过期")
    if s["from_uid"] == uid:
        conn.close()
        raise HTTPException(400, "不能作答自己分享的题")
    if conn.execute(
        "SELECT 1 FROM shared_answers WHERE share_id=? AND uid=?", (s["id"], uid)
    ).fetchone():
        conn.close()
        raise HTTPException(409, "你已作答过这道分享题")
    full = _full_question(s["question_id"])
    if not full:
        conn.close()
        raise HTTPException(404, "题目不存在")
    correct = picked == (full.get("answer") or "").strip().upper()
    conn.execute(
        "INSERT INTO shared_answers (share_id, uid, nickname, picked, correct, created_at) VALUES (?,?,?,?,?,?)",
        (s["id"], uid, _clean_name(body.get("nickname")), picked, 1 if correct else 0, time.time()),
    )
    conn.commit()
    answers = _answers_payload(conn, s["id"])
    team_invite = _sharer_invite(conn, s)
    conn.close()
    # 裂变埋点：分享作答同步写 answer_log（source=share）
    db.save_answer_log(uid, [{
        "qid": s["question_id"],
        "correct": correct,
        "secs": int(body.get("secs") or 0),
        "picked": picked,
        "source": "share",
    }])
    conn2 = db.get_conn()
    db._ensure_answer_log(conn2)
    q_stats = _question_stats(conn2, s["question_id"])
    conn2.close()
    return {
        "correct": correct,
        "answer": full.get("answer"),
        "explanation": full.get("explanation"),
        "answers": answers,
        "q_stats": q_stats,
        "team_invite": team_invite,
    }


@router.get("/share/{sid}/answers")
def api_share_answers(sid: str, uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    s = conn.execute("SELECT * FROM shared_questions WHERE sid=?", (sid.strip()[:16],)).fetchone()
    if not s:
        conn.close()
        raise HTTPException(404, "分享不存在或已过期")
    allowed = s["from_uid"] == u or conn.execute(
        "SELECT 1 FROM shared_answers WHERE share_id=? AND uid=?", (s["id"], u)
    ).fetchone()
    if not allowed:
        conn.close()
        raise HTTPException(403, "先作答才能查看大家的选择")
    answers = _answers_payload(conn, s["id"])
    conn.close()
    return {"items": answers}


# ---------- 裂变埋点 ----------

@router.post("/track")
def api_track(body: dict):
    event = str(body.get("event") or "").strip()[:32]
    if event not in {
        "share_open", "share_answer", "team_join_open", "register",
        "share_copy", "share_team_join", "team_invite_copy", "team_report_copy",
        "pk_result_open", "pk_result_copy", "pk_result_challenge", "badge_unlock",
        "review_entry_click", "task_card_click", "heatmap_view", "review_done_celebrate",
        "comeback_view",
    }:
        raise HTTPException(400, "无效事件")
    uid = str(body.get("uid") or "").strip()[:64] or None
    rate_limit(f"track:{uid or 'anon'}", 60, 300)
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO growth_events (uid, event, source, ref, created_at) VALUES (?,?,?,?,?)",
        (uid, event, str(body.get("source") or "")[:16] or None, str(body.get("ref") or "")[:32] or None, time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}
