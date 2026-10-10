"""py 拆分之 daily 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import hashlib
import json
import random
import time
from datetime import date, timedelta

from . import db

__all__ = ["_daily_pool", "_ensure_daily_set", "daily_archive_day", "daily_set_board", "daily_set_ids", "daily_set_questions", "daily_set_stats", "daily_set_submit", "shizheng_count", "shizheng_daily"]


def shizheng_daily(day: str, n: int = 10) -> list[dict]:
    """按日期取每日一组时政题：以日期为随机种子从底池确定性抽取，同一天所有人相同。"""
    conn = db.get_conn()
    ids = [r["id"] for r in conn.execute("SELECT id FROM shizheng_questions ORDER BY id")]
    if not ids:
        conn.close()
        return []
    rng = random.Random(day)
    picked = rng.sample(ids, min(n, len(ids)))
    rows = conn.execute(
        f"SELECT * FROM shizheng_questions WHERE id IN ({','.join('?' * len(picked))})", picked
    ).fetchall()
    conn.close()
    by_id = {r["id"]: r for r in rows}
    items = []
    for qid in picked:
        r = by_id.get(qid)
        if not r:
            continue
        try:
            options = json.loads(r["options"] or "{}")
        except json.JSONDecodeError:
            options = {}
        items.append({
            "id": r["id"],
            "date": r["date"],
            "question": r["question"],
            "options": options,
            "answer": r["answer"],
            "explanation": r["explanation"],
            "source_note": r["source_note"],
            "module": "时政",
            "question_type": "单选",
        })
    return items


def shizheng_count() -> int:
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM shizheng_questions").fetchone()[0]
    conn.close()
    return n


def _ensure_daily_set(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS daily_set_entries (
            day TEXT NOT NULL,
            uid TEXT NOT NULL,
            right INTEGER NOT NULL,
            total INTEGER NOT NULL,
            secs REAL,
            created_at REAL NOT NULL,
            PRIMARY KEY (day, uid)
        )"""
    )
    db.add_column_if_missing(conn, "daily_set_entries", "nickname", "TEXT")
    # 探针成绩（服务端三路判定）不进「N 人完成 / 排行榜 / 击败 X%」全站池；本人成绩对本人始终可见
    db.add_column_if_missing(conn, "daily_set_entries", "probe", "INTEGER")


def _daily_pool(uid: str | None) -> tuple[str, list]:
    if uid:
        return f"({db.REAL_TRAFFIC} OR uid=?)", [uid]
    return db.REAL_TRAFFIC, []


def daily_archive_day(date: str | None) -> str | None:
    """校验往期每日一练日期：仅接受今天之前 7 天内的 ISO 日期，否则 None。"""
    if not date:
        return None
    try:
        d = time.strptime(str(date)[:10], "%Y-%m-%d")
    except ValueError:
        return None
    day = time.strftime("%Y-%m-%d", d)
    today = db.cn_day()
    if day >= today:
        return None
    earliest = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600 - 7 * 86400))
    return day if day >= earliest else None


def daily_set_ids(day: str) -> list[int]:
    """全站同题每日一练选题：每模块 2 题共 10 题，md5(day:qid) 最小者优先。

    哈希选择对题库增删稳定（新增题最多顶掉一题），重启重算结果一致。
    """
    with db._daily_set_lock:
        if day in db._daily_set_cache:
            return db._daily_set_cache[day]
        conn = db.get_conn()
        ids: list[int] = []
        for mod in db._DAILY_SET_MODULES:
            pool = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM questions INDEXED BY idx_q_pick WHERE module=? AND disabled=0 AND is_real=1",
                    (mod,),
                )
            ]
            if len(pool) < 2:
                pool = [
                    r["id"]
                    for r in conn.execute(
                        "SELECT id FROM questions INDEXED BY idx_q_pick WHERE module=? AND disabled=0",
                        (mod,),
                    )
                ]
            pool.sort(key=lambda q: hashlib.md5(f"{day}:{q}".encode()).hexdigest())
            ids.extend(pool[:2])
        conn.close()
        if len(db._daily_set_cache) >= 16:
            db._daily_set_cache.clear()
        db._daily_set_cache[day] = ids
        return ids


def daily_set_questions(day: str) -> list[dict]:
    ids = daily_set_ids(day)
    if not ids:
        return []
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))}) AND disabled=0",
        ids,
    ).fetchall()
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        by_id[d["id"]] = d
    return [by_id[i] for i in ids if i in by_id]


def daily_set_stats(day: str) -> dict:
    conn = db.get_conn()
    _ensure_daily_set(conn)
    row = conn.execute(
        f"SELECT COUNT(*) n, AVG(right) a FROM daily_set_entries WHERE day=? AND {db.REAL_TRAFFIC}", (day,)
    ).fetchone()
    conn.close()
    return {"participants": row["n"] or 0, "avg_right": round(row["a"], 1) if row["a"] is not None else None}


def daily_set_submit(
    day: str,
    uid: str,
    right: int,
    total: int,
    secs: float | None,
    nickname: str | None = None,
    probe: int = 0,
) -> dict:
    conn = db.get_conn()
    _ensure_daily_set(conn)
    cur = conn.execute(
        "INSERT OR IGNORE INTO daily_set_entries(day, uid, right, total, secs, nickname, created_at, probe)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (day, uid, right, total, secs, nickname, time.time(), 1 if probe else 0),
    )
    already = cur.rowcount == 0
    conn.commit()
    mine = conn.execute(
        "SELECT right FROM daily_set_entries WHERE day=? AND uid=?", (day, uid)
    ).fetchone()
    my_right = mine["right"] if mine else right
    pool, pool_args = _daily_pool(uid)
    row = conn.execute(
        "SELECT COUNT(*) n, SUM(CASE WHEN right < ? THEN 1 ELSE 0 END) b, "
        f"SUM(CASE WHEN right > ? THEN 1 ELSE 0 END) a FROM daily_set_entries WHERE day=? AND {pool}",
        (my_right, my_right, day, *pool_args),
    ).fetchone()
    days = {
        r["day"]
        for r in conn.execute(
            "SELECT day FROM daily_set_entries WHERE uid=? ORDER BY day DESC LIMIT 60", (uid,)
        ).fetchall()
    }
    conn.close()
    streak = 0
    d = date.fromisoformat(day)
    while d.isoformat() in days:
        streak += 1
        d -= timedelta(days=1)
    participants = row["n"] or 0
    beat_pct = round(100 * (row["b"] or 0) / (participants - 1)) if participants > 1 else None
    # 名次只按答对数（比我分高的人数 + 1），同分并列不计用时
    my_rank = (row["a"] or 0) + 1 if participants else None
    return {
        "participants": participants,
        "beat_pct": beat_pct,
        "my_right": my_right,
        "my_rank": my_rank,
        "already": already,
        "streak": streak,
    }


def daily_set_board(day: str, limit: int = 20, uid: str | None = None) -> list[dict]:
    conn = db.get_conn()
    _ensure_daily_set(conn)
    pool, pool_args = _daily_pool(uid)
    rows = conn.execute(
        f"SELECT uid, nickname, right, total, secs FROM daily_set_entries WHERE day=? AND {pool} "
        "ORDER BY right DESC, COALESCE(secs, 9e9) ASC, created_at ASC LIMIT ?",
        (day, *pool_args, limit),
    ).fetchall()
    conn.close()
    return [
        {
            "rank": i + 1,
            "name": db.display_alias(r["uid"], r["nickname"]),
            "right": r["right"],
            "total": r["total"],
            "secs": r["secs"],
        }
        for i, r in enumerate(rows)
    ]


