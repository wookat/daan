"""答题 PK（异步版）：发起挑战 → 分享挑战码 → 对手完成同组题 → 比分数+用时。

无实时对战（不依赖 websocket）；uid 隔离与收藏/笔记一致，匿名可用。
计分：每题答对 80 分 + 速度加成（30 秒内越快加成越高，最多 20 分）。
PK 作答不写入 answer_log / 错题本统计（防作弊 + 不污染个人数据）。
"""
import json
import random
import re
import string
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from . import db
from .auth import rate_limit

router = APIRouter(prefix="/api/pk")

PK_N_QUESTIONS = 10
PER_Q_MS_CAP = 30_000
BASE_SCORE = 80
SPEED_BONUS_MAX = 20
PK_MODULES = {"ziliao", "shuliang", "yanyu", "panduan", "changshi"}
_MULTI_RE = re.compile(r"不定项|多选")


def init_pk_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS pk_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            module TEXT,
            question_ids TEXT NOT NULL,
            creator_uid TEXT NOT NULL,
            creator_name TEXT,
            creator_score INTEGER,
            creator_correct INTEGER,
            creator_time_ms INTEGER,
            creator_answers TEXT,
            opponent_uid TEXT,
            opponent_name TEXT,
            opponent_score INTEGER,
            opponent_correct INTEGER,
            opponent_time_ms INTEGER,
            opponent_answers TEXT,
            status TEXT NOT NULL DEFAULT 'waiting',
            winner TEXT,
            created_at REAL NOT NULL,
            finished_at REAL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pk_creator ON pk_matches(creator_uid, created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pk_opponent ON pk_matches(opponent_uid, created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pk_open ON pk_matches(status, module, created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pk_finished ON pk_matches(status, finished_at)")
    conn.commit()
    conn.close()


def _clean_uid(uid) -> str:
    u = str(uid or "").strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return u


def _clean_name(name) -> str:
    return str(name or "").strip()[:20] or "匿名考友"


def _gen_code(conn) -> str:
    for _ in range(20):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not conn.execute("SELECT 1 FROM pk_matches WHERE code=?", (code,)).fetchone():
            return code
    raise HTTPException(500, "生成挑战码失败")


def _sanitized_questions(qids: list[int]) -> list[dict]:
    items = {q["id"]: q for q in db.questions_by_ids(qids)}
    out = []
    for i in qids:
        q = items.get(i)
        if not q:
            continue
        out.append({
            "id": q["id"],
            "module": q.get("module"),
            "submodule": q.get("submodule"),
            "question": q.get("question"),
            "options": q.get("options") or {},
            "image": q.get("image"),
        })
    return out


def _grade(qids: list[int], items: list[dict]) -> tuple[int, int, int, list[dict]]:
    answers = {q["id"]: (q.get("answer") or "").strip().upper() for q in db.questions_by_ids(qids)}
    by_qid = {}
    for it in items or []:
        try:
            qid = int(it.get("question_id"))
        except (TypeError, ValueError):
            continue
        if qid in answers and qid not in by_qid:
            by_qid[qid] = it
    score = correct = total_ms = 0
    detail = []
    for qid in qids:
        it = by_qid.get(qid)
        ans = str((it or {}).get("answer") or "").strip().upper()[:8]
        ms = min(max(int((it or {}).get("ms") or PER_Q_MS_CAP), 0), PER_Q_MS_CAP)
        ok = bool(ans) and ans == answers.get(qid)
        pts = 0
        if ok:
            pts = BASE_SCORE + round(SPEED_BONUS_MAX * (1 - ms / PER_Q_MS_CAP))
            correct += 1
        score += pts
        total_ms += ms
        detail.append({"question_id": qid, "answer": ans or None, "correct": ok, "ms": ms, "points": pts})
    return score, correct, total_ms, detail


def _side(m, uid: str) -> str | None:
    if m["creator_uid"] == uid:
        return "creator"
    if m["opponent_uid"] == uid:
        return "opponent"
    return None


def _player(m, side: str) -> dict:
    return {
        "name": m[f"{side}_name"],
        "score": m[f"{side}_score"],
        "correct": m[f"{side}_correct"],
        "time_ms": m[f"{side}_time_ms"],
        "done": m[f"{side}_score"] is not None,
    }


def _match_payload(m, uid: str | None = None, with_detail: bool = False) -> dict:
    side = _side(m, uid) if uid else None
    out = {
        "code": m["code"],
        "module": m["module"],
        "n_questions": len(json.loads(m["question_ids"])),
        "status": m["status"],
        "winner": m["winner"],
        "creator": _player(m, "creator"),
        "opponent": _player(m, "opponent") if m["opponent_uid"] else None,
        "my_side": side,
        "created_at": m["created_at"],
        "finished_at": m["finished_at"],
    }
    if with_detail and side and m[f"{side}_answers"]:
        out["my_detail"] = json.loads(m[f"{side}_answers"])
    return out


@router.post("/create")
def api_pk_create(body: dict):
    uid = _clean_uid(body.get("uid"))
    rate_limit(f"pk_create:{uid}", 10, 300)
    module = (body.get("module") or "").strip() or None
    if module and module not in PK_MODULES:
        raise HTTPException(400, "模块无效")
    # PK 计分按单选严格匹配，多选/不定项题不适合限时对战，抽题时排除
    # （answer 存单字母但题干标注「不定项/多选」的脏数据也一并按题干过滤）
    questions = [
        q for q in db.random_questions(module, PK_N_QUESTIONS * 3)
        if len((q.get("answer") or "").strip()) == 1
        and not _MULTI_RE.search(q.get("question") or "")
    ][:PK_N_QUESTIONS]
    if len(questions) < PK_N_QUESTIONS:
        raise HTTPException(400, "题库题量不足，无法发起 PK")
    qids = [q["id"] for q in questions]
    conn = db.get_conn()
    code = _gen_code(conn)
    conn.execute(
        """INSERT INTO pk_matches (code, module, question_ids, creator_uid, creator_name, created_at)
           VALUES (?,?,?,?,?,?)""",
        (code, module, json.dumps(qids), uid, _clean_name(body.get("nickname")), time.time()),
    )
    conn.commit()
    conn.close()
    return {"code": code, "questions": _sanitized_questions(qids)}


@router.post("/join")
def api_pk_join(body: dict):
    uid = _clean_uid(body.get("uid"))
    code = str(body.get("code") or "").strip().upper()[:12]
    if not code:
        raise HTTPException(400, "缺少挑战码")
    conn = db.get_conn()
    m = conn.execute("SELECT * FROM pk_matches WHERE code=?", (code,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(404, "挑战不存在或已过期")
    if m["creator_uid"] == uid:
        conn.close()
        raise HTTPException(400, "不能挑战自己发起的对局")
    if m["opponent_uid"] and m["opponent_uid"] != uid:
        conn.close()
        raise HTTPException(409, "该挑战已被其他考友接受")
    if not m["opponent_uid"]:
        conn.execute(
            "UPDATE pk_matches SET opponent_uid=?, opponent_name=? WHERE id=? AND opponent_uid IS NULL",
            (uid, _clean_name(body.get("nickname")), m["id"]),
        )
        conn.commit()
    conn.close()
    qids = json.loads(m["question_ids"])
    return {"code": code, "module": m["module"], "questions": _sanitized_questions(qids)}


@router.post("/random_match")
def api_pk_random(body: dict):
    """随机匹配：优先接入最近一份同模块、发起者已完成作答的等待中挑战；无则新建等待。"""
    uid = _clean_uid(body.get("uid"))
    module = (body.get("module") or "").strip() or None
    if module and module not in PK_MODULES:
        raise HTTPException(400, "模块无效")
    conn = db.get_conn()
    where = "status='waiting' AND opponent_uid IS NULL AND creator_uid!=? AND creator_score IS NOT NULL"
    args: list = [uid]
    if module:
        where += " AND module=?"
        args.append(module)
    else:
        where += " AND module IS NULL"
    m = conn.execute(
        f"SELECT code FROM pk_matches WHERE {where} ORDER BY created_at DESC LIMIT 1", args
    ).fetchone()
    conn.close()
    if m:
        return {"matched": True, **api_pk_join({"uid": uid, "code": m["code"], "nickname": body.get("nickname")})}
    return {"matched": False, **api_pk_create(body)}


@router.get("/match/{code}")
def api_pk_match(code: str, uid: str = ""):
    conn = db.get_conn()
    m = conn.execute("SELECT * FROM pk_matches WHERE code=?", (code.strip().upper()[:12],)).fetchone()
    conn.close()
    if not m:
        raise HTTPException(404, "挑战不存在或已过期")
    return {"match": _match_payload(m, (uid or "").strip()[:64] or None, with_detail=True)}


@router.get("/result/{code}")
def api_pk_result(code: str):
    """PK 战绩公开落地页数据：仅已结束对局，只含昵称/比分等展示字段，匿名可看。"""
    conn = db.get_conn()
    m = conn.execute("SELECT * FROM pk_matches WHERE code=?", (code.strip().upper()[:12],)).fetchone()
    conn.close()
    if not m or m["status"] != "finished":
        raise HTTPException(404, "战绩不存在或对局未结束")
    def pub(side):
        return {
            "role": side,
            "name": m[f"{side}_name"] or "匿名考友",
            "score": m[f"{side}_score"],
            "correct": m[f"{side}_correct"],
            "time_ms": m[f"{side}_time_ms"],
        }
    return {
        "code": m["code"],
        "module": m["module"],
        "n_questions": len(json.loads(m["question_ids"])),
        "winner": m["winner"],
        "creator": pub("creator"),
        "opponent": pub("opponent"),
        "finished_at": m["finished_at"],
    }


@router.post("/submit")
def api_pk_submit(body: dict):
    uid = _clean_uid(body.get("uid"))
    code = str(body.get("code") or "").strip().upper()[:12]
    items = body.get("items")
    if not code or not isinstance(items, list):
        raise HTTPException(400, "缺少 code 或作答记录")
    conn = db.get_conn()
    m = conn.execute("SELECT * FROM pk_matches WHERE code=?", (code,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(404, "挑战不存在或已过期")
    side = _side(m, uid)
    if not side:
        conn.close()
        raise HTTPException(403, "请先加入该挑战")
    if m[f"{side}_score"] is not None:
        conn.close()
        raise HTTPException(409, "你已提交过本局作答")
    qids = json.loads(m["question_ids"])
    score, correct, total_ms, detail = _grade(qids, items[: PK_N_QUESTIONS * 2])
    other = "opponent" if side == "creator" else "creator"
    both_done = m[f"{other}_score"] is not None
    winner = None
    finished_at = None
    status = m["status"]
    if both_done:
        status = "finished"
        finished_at = time.time()
        mine, theirs = (score, total_ms), (m[f"{other}_score"], m[f"{other}_time_ms"])
        if mine[0] != theirs[0]:
            winner = side if mine[0] > theirs[0] else other
        elif mine[1] != theirs[1]:
            winner = side if mine[1] < theirs[1] else other
        else:
            winner = "draw"
    conn.execute(
        f"""UPDATE pk_matches SET {side}_score=?, {side}_correct=?, {side}_time_ms=?, {side}_answers=?,
            status=?, winner=?, finished_at=? WHERE id=?""",
        (score, correct, total_ms, json.dumps(detail), status, winner, finished_at, m["id"]),
    )
    conn.commit()
    m = conn.execute("SELECT * FROM pk_matches WHERE id=?", (m["id"],)).fetchone()
    conn.close()
    return {"match": _match_payload(m, uid, with_detail=True)}


@router.get("/mine")
def api_pk_mine(uid: str, limit: int = 20):
    u = _clean_uid(uid)
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT * FROM pk_matches WHERE creator_uid=? OR opponent_uid=?
           ORDER BY created_at DESC LIMIT ?""",
        (u, u, min(int(limit), 50)),
    ).fetchall()
    conn.close()
    items = []
    wins = 0
    for m in rows:
        p = _match_payload(m, u)
        if m["status"] == "finished" and m["winner"] == _side(m, u):
            wins += 1
        items.append(p)
    return {"items": items, "wins": wins}


@router.get("/leaderboard")
def api_pk_leaderboard(uid: str = ""):
    """周维度 PK 胜场排行（本周一 00:00 起）。"""
    now = datetime.now()
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = monday.timestamp()
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT winner, creator_uid, creator_name, opponent_uid, opponent_name
           FROM pk_matches WHERE status='finished' AND finished_at>=? AND winner IN ('creator','opponent')""",
        (week_start,),
    ).fetchall()
    conn.close()
    wins: dict[str, dict] = {}
    for m in rows:
        w_uid = m[f"{m['winner']}_uid"]
        w_name = m[f"{m['winner']}_name"]
        e = wins.setdefault(w_uid, {"uid": w_uid, "name": w_name or "匿名考友", "wins": 0})
        e["wins"] += 1
    ranked = sorted(wins.values(), key=lambda x: -x["wins"])[:20]
    u = (uid or "").strip()[:64]
    my_rank = None
    my_wins = 0
    if u:
        all_ranked = sorted(wins.values(), key=lambda x: -x["wins"])
        for i, e in enumerate(all_ranked):
            if e["uid"] == u:
                my_rank, my_wins = i + 1, e["wins"]
                break
    for i, e in enumerate(ranked):
        e["rank"] = i + 1
        e["uid"] = e["uid"][:6] + "***"
    return {"items": ranked, "week_start": monday.strftime("%Y-%m-%d"), "my_rank": my_rank, "my_wins": my_wins}
