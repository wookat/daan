"""R348-B1 连签口径统一：仅复习（review_log）的日子 badges.streak 与 summary.streak 一致。"""
import time

from app import db

UID = "test-w1-streak-parity"


def _seed(answer_days_ago: list[int], review_days_ago: list[int]):
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    now = time.time()
    for d in answer_days_ago:
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs) VALUES (?,?,?,?,?,?)",
            (UID, now - d * 86400, 1, "yanyu", 1, 10),
        )
    for d in review_days_ago:
        conn.execute(
            "INSERT INTO review_log (uid, mistake_id, correct, created_at) VALUES (?,?,?,?)",
            (UID, 1, 1, now - d * 86400),
        )
    conn.commit()
    conn.close()


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (UID,))
    conn.execute("DELETE FROM review_log WHERE uid=?", (UID,))
    conn.commit()
    conn.close()


def _both(client):
    b = client.get(f"/api/checkin/badges?uid={UID}")
    s = client.get(f"/api/checkin/summary?uid={UID}")
    assert b.status_code == 200 and s.status_code == 200
    return b.json(), s.json()


def test_review_only_days_count_in_badges_streak(client):
    _cleanup()
    try:
        _seed(answer_days_ago=[], review_days_ago=[0, 1, 2])
        badges, summary = _both(client)
        assert summary["streak"] == 3
        assert badges["streak"] == summary["streak"]
        assert badges["best_streak"] == 3
        assert badges["badges"][0] == {"days": 3, "unlocked": True}
    finally:
        _cleanup()


def test_mixed_answer_and_review_days_parity(client):
    _cleanup()
    try:
        _seed(answer_days_ago=[0, 2], review_days_ago=[1])
        badges, summary = _both(client)
        assert summary["streak"] == 3
        assert badges["streak"] == 3
        assert badges["best_streak"] == 3
        _seed(answer_days_ago=[], review_days_ago=[5])
        badges, summary = _both(client)
        assert badges["streak"] == summary["streak"] == 3
        assert badges["best_streak"] == 3
    finally:
        _cleanup()


def test_no_activity_zero_streak(client):
    _cleanup()
    badges, summary = _both(client)
    assert badges["streak"] == summary["streak"] == 0
    assert badges["best_streak"] == 0
