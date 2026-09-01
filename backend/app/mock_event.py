"""定期模考大赛：每周六全站同卷限时比赛（东八区 9:00-24:00）。

复用 exam_papers / exam_attempts 全套模考流程，仅新增比赛场次与参赛登记两张表；
窗口内交卷（首次）计入排名，窗口外该卷退化为普通试卷、不影响比赛榜单。
排名在赛后首次访问时按事务惰性冻结；无人建赛时自动兜底生成下周六场次。
"""
import hashlib
import json
import random
import time

from fastapi import APIRouter, Header, HTTPException

from . import db, taxonomy
from .deps import check_admin

router = APIRouter(prefix="/api/mock")
admin_router = APIRouter(prefix="/api/admin/mock")

TZ = 8 * 3600
OPEN_HOUR = 9          # 周六 09:00 开赛
CLOSE_HOUR = 24        # 周六 24:00 截止
SERIES_DEFAULT = "weekly"
RANK_BUCKETS = 10
# 各模块单题建议用时（秒），用于赛后报告的时间对比
REC_SECS = {"ziliao": 80, "shuliang": 70, "yanyu": 50, "panduan": 55, "changshi": 30}


def init_mock_event_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS mock_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            series TEXT,
            paper_id INTEGER NOT NULL,
            open_at REAL NOT NULL,
            close_at REAL NOT NULL,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS mock_event_entries (
            event_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            registered_at REAL,
            attempt_id INTEGER,
            score REAL,
            rank INTEGER,
            PRIMARY KEY (event_id, uid)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mee_event ON mock_event_entries(event_id, score)")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mock_event_entries)").fetchall()}
    if "nickname" not in cols:
        conn.execute("ALTER TABLE mock_event_entries ADD COLUMN nickname TEXT")
    conn.commit()
    conn.close()


def _clean_uid(uid) -> str:
    u = str(uid or "").strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return u


def _clean_nickname(nickname) -> str | None:
    n = str(nickname or "").strip()[:20]
    return None if not n or n.lower() in ("null", "undefined") else n


def _alias(uid: str, nickname: str | None) -> str:
    """榜单展示名：报名时留存的昵称优先，缺失时用 uid 派生的稳定化名（不暴露 uid）。"""
    nickname = _clean_nickname(nickname)
    if nickname:
        return nickname
    h = hashlib.sha1(uid.encode()).hexdigest()[:4].upper()
    return f"考友{h}"


def _saturday_window(now: float) -> tuple[float, float]:
    """本周六（若已结束则下周六）的比赛窗口 [open, close)。"""
    day0 = ((now + TZ) // 86400) * 86400 - TZ           # 东八区今天 0 点
    weekday = int(((now + TZ) // 86400 + 4) % 7)        # 周一=1 … 周六=6, 周日=0
    sat0 = day0 + ((6 - weekday) % 7) * 86400
    close = sat0 + CLOSE_HOUR * 3600
    if close <= now:                                     # 本周六已结束 → 下周六
        sat0 += 7 * 86400
        close = sat0 + CLOSE_HOUR * 3600
    return sat0 + OPEN_HOUR * 3600, close


def _pick_paper_id(conn) -> int:
    rows = conn.execute(
        "SELECT id, question_ids FROM exam_papers WHERE kind='zhenti' ORDER BY id DESC LIMIT 50"
    ).fetchall()
    ok = [r["id"] for r in rows
          if len(db.exam_active_qids(json.loads(r["question_ids"] or "[]"))) >= 60]
    if ok:
        return random.choice(ok)
    return db.create_mock_paper(n=30, duration_min=30)


def ensure_weekly_event() -> None:
    """无管理员建赛时兜底：保证最近一个周六窗口有比赛场次。"""
    now = time.time()
    open_at, close_at = _saturday_window(now)
    conn = db.get_conn()
    try:
        db._ensure_exam_tables(conn)
        exists = conn.execute(
            "SELECT 1 FROM mock_events WHERE open_at=? AND close_at=?", (open_at, close_at)
        ).fetchone()
        if exists:
            return
        n = conn.execute(
            "SELECT COUNT(*) n FROM mock_events WHERE series=?", (SERIES_DEFAULT,)
        ).fetchone()["n"]
        pid = _pick_paper_id(conn)
        conn.execute(
            "INSERT INTO mock_events(title, series, paper_id, open_at, close_at, created_at)"
            " VALUES(?,?,?,?,?,?)",
            (f"全站模考大赛 第{n + 1}期", SERIES_DEFAULT, pid, open_at, close_at, now),
        )
        conn.commit()
    finally:
        conn.close()


def _event(conn, event_id: int) -> dict:
    row = conn.execute("SELECT * FROM mock_events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "比赛不存在")
    return dict(row)


def _phase(ev: dict, now: float) -> str:
    if now < ev["open_at"]:
        return "upcoming"
    if now < ev["close_at"]:
        return "running"
    return "ended"


def _entry(conn, event_id: int, uid: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM mock_event_entries WHERE event_id=? AND uid=?", (event_id, uid)
    ).fetchone()
    return dict(row) if row else None


def _counts(conn, event_id: int) -> dict:
    row = conn.execute(
        """SELECT COUNT(*) reg, SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) sub
           FROM mock_event_entries WHERE event_id=?""",
        (event_id,),
    ).fetchone()
    return {"registered": row["reg"] or 0, "submitted": row["sub"] or 0}


def _event_brief(conn, ev: dict, uid: str, now: float) -> dict:
    entry = _entry(conn, ev["id"], uid) if uid else None
    paper = conn.execute(
        "SELECT title, duration_min, question_ids FROM exam_papers WHERE id=?", (ev["paper_id"],)
    ).fetchone()
    return {
        "id": ev["id"],
        "title": ev["title"],
        "series": ev["series"],
        "paper_id": ev["paper_id"],
        "paper_title": paper["title"] if paper else "",
        "duration_min": paper["duration_min"] if paper else 120,
        "n_questions": len(db.exam_active_qids(json.loads(paper["question_ids"]))) if paper else 0,
        "open_at": ev["open_at"],
        "close_at": ev["close_at"],
        "phase": _phase(ev, now),
        **_counts(conn, ev["id"]),
        "my_state": (
            "已交卷" if entry and entry.get("score") is not None
            else "已报名" if entry else "未报名"
        ),
        "my_score": entry.get("score") if entry else None,
        "my_rank": entry.get("rank") if entry else None,
    }


@router.get("/events")
def api_events(uid: str = ""):
    uid = uid.strip()[:64]
    ensure_weekly_event()
    now = time.time()
    conn = db.get_conn()
    try:
        rows = [dict(r) for r in conn.execute("SELECT * FROM mock_events ORDER BY open_at").fetchall()]
        current = next((e for e in rows if e["open_at"] <= now < e["close_at"]), None)
        nxt = next((e for e in rows if e["open_at"] > now), None)
        past = [e for e in rows if e["close_at"] <= now][-10:][::-1]
        my_past = []
        if uid:
            for e in past:
                en = _entry(conn, e["id"], uid)
                if en and en.get("score") is not None and en.get("rank") is None:
                    _freeze_ranks(conn, e["id"])
                    en = _entry(conn, e["id"], uid)
                my_past.append({
                    "id": e["id"], "title": e["title"], "close_at": e["close_at"],
                    "score": en.get("score") if en else None,
                    "rank": en.get("rank") if en else None,
                    "joined": bool(en and en.get("score") is not None),
                })
        return {
            "current": _event_brief(conn, current, uid, now) if current else None,
            "next": _event_brief(conn, nxt, uid, now) if nxt else None,
            "past": my_past,
        }
    finally:
        conn.close()


@router.get("/events/{event_id}")
def api_event_detail(event_id: int, uid: str = ""):
    uid = uid.strip()[:64]
    now = time.time()
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        return {"event": _event_brief(conn, ev, uid, now)}
    finally:
        conn.close()


@router.post("/events/{event_id}/register")
def api_event_register(event_id: int, body: dict):
    uid = _clean_uid(body.get("uid"))
    now = time.time()
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        if now >= ev["close_at"]:
            raise HTTPException(400, "比赛已结束，无法报名")
        conn.execute(
            """INSERT INTO mock_event_entries(event_id, uid, registered_at, nickname)
               VALUES(?,?,?,?)
               ON CONFLICT(event_id, uid) DO UPDATE SET
                 registered_at=COALESCE(registered_at, excluded.registered_at),
                 nickname=COALESCE(excluded.nickname, nickname)""",
            (event_id, uid, now, _clean_nickname(body.get("nickname"))),
        )
        conn.commit()
        return {"ok": True, "state": "已报名"}
    finally:
        conn.close()


@router.post("/events/{event_id}/enter")
def api_event_enter(event_id: int, body: dict):
    uid = _clean_uid(body.get("uid"))
    now = time.time()
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        if now < ev["open_at"]:
            raise HTTPException(400, "比赛尚未开始")
        if now >= ev["close_at"]:
            raise HTTPException(400, "比赛已结束，可作为普通试卷练习")
        entry = _entry(conn, event_id, uid)
        if entry and entry.get("score") is not None:
            raise HTTPException(400, "你已交卷，成绩以首次为准")
        conn.execute(
            """INSERT INTO mock_event_entries(event_id, uid, registered_at, nickname)
               VALUES(?,?,?,?)
               ON CONFLICT(event_id, uid) DO UPDATE SET
                 registered_at=COALESCE(registered_at, excluded.registered_at),
                 nickname=COALESCE(excluded.nickname, nickname)""",
            (event_id, uid, now, _clean_nickname(body.get("nickname"))),
        )
        conn.commit()
        return {"paper_id": ev["paper_id"], "close_at": ev["close_at"]}
    finally:
        conn.close()


@router.post("/events/{event_id}/attach")
def api_event_attach(event_id: int, body: dict):
    uid = _clean_uid(body.get("uid"))
    attempt_id = body.get("attempt_id")
    if not attempt_id:
        raise HTTPException(400, "缺少 attempt_id")
    attempt = db.get_exam_attempt(int(attempt_id))
    if not attempt or attempt["uid"] != uid:
        raise HTTPException(404, "答题记录不存在")
    if not attempt["submitted_at"]:
        raise HTTPException(400, "该次模考尚未交卷")
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        if attempt["paper_id"] != ev["paper_id"]:
            raise HTTPException(400, "答题记录与比赛试卷不符")
        if not (ev["open_at"] <= attempt["submitted_at"] < ev["close_at"]):
            raise HTTPException(400, "交卷时间不在比赛窗口内，不计入排名")
        entry = _entry(conn, event_id, uid)
        if entry and entry.get("score") is not None:
            if entry.get("attempt_id") == int(attempt_id):
                return {"ok": True, "score": entry["score"], "first": False}
            raise HTTPException(400, "已有比赛成绩，以首次交卷为准")
        conn.execute(
            """INSERT INTO mock_event_entries(event_id, uid, registered_at, attempt_id, score)
               VALUES(?,?,?,?,?)
               ON CONFLICT(event_id, uid) DO UPDATE SET
                 attempt_id=excluded.attempt_id, score=excluded.score""",
            (event_id, uid, attempt["submitted_at"], int(attempt_id), attempt["score"]),
        )
        conn.commit()
        return {"ok": True, "score": attempt["score"], "first": True}
    finally:
        conn.close()


def _freeze_ranks(conn, event_id: int):
    """赛后首次访问时冻结名次（事务内，重复调用无副作用）。"""
    conn.execute("BEGIN IMMEDIATE")
    try:
        pending = conn.execute(
            "SELECT 1 FROM mock_event_entries WHERE event_id=? AND score IS NOT NULL AND rank IS NULL LIMIT 1",
            (event_id,),
        ).fetchone()
        if pending:
            rows = conn.execute(
                """SELECT uid, score FROM mock_event_entries
                   WHERE event_id=? AND score IS NOT NULL
                   ORDER BY score DESC, attempt_id ASC""",
                (event_id,),
            ).fetchall()
            prev_score, prev_rank = None, 0
            for i, r in enumerate(rows):
                rank = prev_rank if r["score"] == prev_score else i + 1
                conn.execute(
                    "UPDATE mock_event_entries SET rank=? WHERE event_id=? AND uid=?",
                    (rank, event_id, r["uid"]),
                )
                prev_score, prev_rank = r["score"], rank
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _score_pool(conn, ev: dict) -> dict:
    """历史同卷分数池（含比赛窗口外作答），小样本时作参照。"""
    rows = conn.execute(
        """SELECT uid, MAX(score) s FROM exam_attempts
           WHERE paper_id=? AND submitted_at IS NOT NULL GROUP BY uid""",
        (ev["paper_id"],),
    ).fetchall()
    scores = [r["s"] for r in rows]
    return {
        "n": len(scores),
        "avg": round(sum(scores) / len(scores), 1) if scores else 0,
    }


@router.get("/events/{event_id}/rank")
def api_event_rank(event_id: int, uid: str = ""):
    uid = uid.strip()[:64]
    now = time.time()
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        phase = _phase(ev, now)
        if phase == "upcoming":
            raise HTTPException(400, "比赛尚未开始")
        frozen = phase == "ended"
        if frozen:
            _freeze_ranks(conn, event_id)
        rows = conn.execute(
            """SELECT uid, score, rank, nickname FROM mock_event_entries
               WHERE event_id=? AND score IS NOT NULL
               ORDER BY score DESC, attempt_id ASC""",
            (event_id,),
        ).fetchall()
        scores = [r["score"] for r in rows]
        n = len(scores)
        me = next((dict(r) for r in rows if r["uid"] == uid), None)
        my_rank = my_pct = my_bucket = None
        if me:
            my_rank = me["rank"] if frozen else sum(1 for s in scores if s > me["score"]) + 1
            my_pct = round(100 * sum(1 for s in scores if s < me["score"]) / n) if n > 1 else 100
            my_bucket = min(RANK_BUCKETS - 1, int(me["score"] // (100 / RANK_BUCKETS)))
        dist = [0] * RANK_BUCKETS
        for s in scores:
            dist[min(RANK_BUCKETS - 1, int(s // (100 / RANK_BUCKETS)))] += 1
        return {
            "event_id": event_id,
            "phase": phase,
            "frozen": frozen,
            "total": n,
            "avg": round(sum(scores) / n, 1) if n else 0,
            "distribution": dist,
            "my_score": me["score"] if me else None,
            "my_rank": my_rank,
            "my_pct": my_pct,
            "my_bucket": my_bucket,
            "small_sample": n < 10,
            "history_pool": _score_pool(conn, ev),
            # 公共榜单 Top10：非参赛者也可围观；展示名不暴露 uid
            "top": [
                {
                    "rank": (r["rank"] if frozen and r["rank"] else i + 1),
                    "score": r["score"],
                    "nickname": _alias(r["uid"], r["nickname"]),
                    "me": r["uid"] == uid,
                }
                for i, r in enumerate(rows[:10])
            ],
        }
    finally:
        conn.close()


@router.get("/events/{event_id}/report")
def api_event_report(event_id: int, uid: str = ""):
    uid = _clean_uid(uid)
    now = time.time()
    conn = db.get_conn()
    try:
        ev = _event(conn, event_id)
        entry = _entry(conn, event_id, uid)
        if not entry or entry.get("score") is None or not entry.get("attempt_id"):
            raise HTTPException(404, "尚无比赛成绩")
        if _phase(ev, now) == "ended":
            _freeze_ranks(conn, event_id)
            entry = _entry(conn, event_id, uid) or entry
        attempt = db.get_exam_attempt(entry["attempt_id"])
        paper = db.get_exam_paper(ev["paper_id"])
        if not attempt or not paper:
            raise HTTPException(404, "成绩数据缺失")
        rows = conn.execute(
            "SELECT score FROM mock_event_entries WHERE event_id=? AND score IS NOT NULL",
            (event_id,),
        ).fetchall()
        scores = [r["score"] for r in rows]
        n = len(scores)
        my = entry["score"]
        rank = entry.get("rank") or (sum(1 for s in scores if s > my) + 1)
        pct = round(100 * sum(1 for s in scores if s < my) / n) if n > 1 else 100
        dist = [0] * RANK_BUCKETS
        for s in scores:
            dist[min(RANK_BUCKETS - 1, int(s // (100 / RANK_BUCKETS)))] += 1
        # 与目标分 / 前 25% 差距
        profile = db.get_user_profile(uid) or {}
        top = sorted(scores, reverse=True)
        top25 = top[max(0, (n + 3) // 4 - 1)] if n >= 4 else None
        # 模块用时与建议用时
        per_module = attempt.get("per_module") or {}
        mod_rows = []
        for m, v in per_module.items():
            rec = REC_SECS.get(m, 60) * (v.get("n") or 0)
            avg_rows = conn.execute(
                """SELECT AVG(CAST(json_extract(a.per_module, ?) AS REAL)) v
                   FROM mock_event_entries e JOIN exam_attempts a ON a.id = e.attempt_id
                   WHERE e.event_id=? AND e.score IS NOT NULL""",
                (f"$.{m}.correct", event_id),
            ).fetchone()
            mod_rows.append({
                "module": m,
                "n": v.get("n") or 0,
                "correct": v.get("correct") or 0,
                "secs": v.get("secs") or 0,
                "rec_secs": rec,
                "avg_correct": round(avg_rows["v"], 1) if avg_rows and avg_rows["v"] is not None else None,
            })
        # 弱项三级考点 top5（本卷错题聚合）
        picks = {int(k): v for k, v in (attempt.get("answers") or {}).items()}
        qids = db.exam_active_qids(paper["question_ids"])
        qmap = {q["id"]: q for q in db.questions_by_ids(qids)}
        tag_wrong: dict[str, list[int]] = {}
        for i, qid in enumerate(qids):
            q = qmap.get(qid)
            if not q:
                continue
            picked = (picks.get(i + 1) or "").strip().upper()
            correct = picked == (q.get("answer") or "").strip().upper()[:1]
            tag = q.get("tag3")
            if tag and tag != "UNKNOWN":
                tag_wrong.setdefault(tag, [0, 0])
                tag_wrong[tag][0] += 1
                if picked and not correct:
                    tag_wrong[tag][1] += 1
        topic_idx = taxonomy.topic_index()
        weak_tags = sorted(
            (
                {
                    "tag3": t,
                    "name": (topic_idx.get(t) or {}).get("name") or t,
                    "n": v[0],
                    "wrong": v[1],
                }
                for t, v in tag_wrong.items()
                if v[1] > 0
            ),
            key=lambda x: (-x["wrong"], -x["n"]),
        )[:5]
        # 同系列历史成绩曲线
        hist = []
        if ev.get("series"):
            hrows = conn.execute(
                """SELECT ev.id, ev.title, ev.close_at, en.score, en.rank
                   FROM mock_events ev JOIN mock_event_entries en ON en.event_id = ev.id
                   WHERE ev.series=? AND en.uid=? AND en.score IS NOT NULL
                   ORDER BY ev.open_at""",
                (ev["series"], uid),
            ).fetchall()
            hist = [dict(r) for r in hrows]
        return {
            "event": {"id": ev["id"], "title": ev["title"], "close_at": ev["close_at"],
                      "phase": _phase(ev, now)},
            "attempt_id": entry["attempt_id"],
            "score": my,
            "rank": rank,
            "total": n,
            "pct": pct,
            "avg": round(sum(scores) / n, 1) if n else 0,
            "distribution": dist,
            "my_bucket": min(RANK_BUCKETS - 1, int(my // (100 / RANK_BUCKETS))),
            "small_sample": n < 10,
            "history_pool": _score_pool(conn, ev),
            "target_score": profile.get("target_score"),
            "gap_to_target": round(profile["target_score"] - my, 1) if profile.get("target_score") is not None else None,
            "top25_score": top25,
            "modules": mod_rows,
            "weak_tags": weak_tags,
            "history": hist,
        }
    finally:
        conn.close()


# ---------- 管理端 ----------

@admin_router.post("/events")
def api_admin_create_event(body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    title = str(body.get("title") or "").strip()
    paper_id = body.get("paper_id")
    open_at = body.get("open_at")
    close_at = body.get("close_at")
    if not title or not paper_id or not open_at or not close_at:
        raise HTTPException(400, "缺少 title / paper_id / open_at / close_at")
    if float(close_at) <= float(open_at):
        raise HTTPException(400, "close_at 需晚于 open_at")
    if not db.get_exam_paper(int(paper_id)):
        raise HTTPException(404, "试卷不存在")
    conn = db.get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO mock_events(title, series, paper_id, open_at, close_at, created_at)"
            " VALUES(?,?,?,?,?,?)",
            (title[:80], str(body.get("series") or SERIES_DEFAULT)[:40], int(paper_id),
             float(open_at), float(close_at), time.time()),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@admin_router.delete("/events/{event_id}")
def api_admin_delete_event(event_id: int, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM mock_event_entries WHERE event_id=?", (event_id,))
        n = conn.execute("DELETE FROM mock_events WHERE id=?", (event_id,)).rowcount
        conn.commit()
        return {"deleted": n}
    finally:
        conn.close()
