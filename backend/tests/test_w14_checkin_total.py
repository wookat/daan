"""W14-B1：/api/checkin/summary 的 total 与 today_n/days 同口径（练习 + 复习），仅复习不再出现 today_n=3,total=0。"""
import time

from app import db

UID = "test-w14-checkin-total"


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (UID,))
    conn.execute("DELETE FROM review_log WHERE uid=?", (UID,))
    conn.commit()
    conn.close()


def _seed_review(n: int, days_ago: int = 0):
    conn = db.get_conn()
    db._ensure_review_log(conn)
    ts = time.time() - days_ago * 86400
    for _ in range(n):
        conn.execute(
            "INSERT INTO review_log (uid, mistake_id, correct, created_at) VALUES (?,?,?,?)",
            (UID, 1, 1, ts),
        )
    conn.commit()
    conn.close()


def _seed_answer(n: int, days_ago: int = 0):
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    ts = time.time() - days_ago * 86400
    for _ in range(n):
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs) VALUES (?,?,?,?,?,?)",
            (UID, ts, 1, "yanyu", 1, 10),
        )
    conn.commit()
    conn.close()


def test_review_only_total_equals_today_n(client):
    _cleanup()
    try:
        _seed_review(3)
        s = client.get(f"/api/checkin/summary?uid={UID}").json()
        assert s["today_n"] == 3
        assert s["total"] == 3
        assert s["total"] == sum(d["n"] for d in s["days"].values())
    finally:
        _cleanup()


def test_total_sums_answer_and_review_across_days(client):
    _cleanup()
    try:
        _seed_answer(2)
        _seed_review(1)
        _seed_answer(4, days_ago=3)
        _seed_review(2, days_ago=3)
        s = client.get(f"/api/checkin/summary?uid={UID}").json()
        assert s["today_n"] == 3
        assert s["total"] == 9
        assert s["total"] == sum(d["n"] for d in s["days"].values())
    finally:
        _cleanup()


def test_no_activity_total_zero(client):
    _cleanup()
    s = client.get(f"/api/checkin/summary?uid={UID}").json()
    assert s["today_n"] == 0 and s["total"] == 0 and s["days"] == {}
