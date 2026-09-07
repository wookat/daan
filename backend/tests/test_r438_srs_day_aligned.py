"""R438：SRS 到期点对齐中国日历日 00:00（此前按复习时刻滚动 24 h，与 UI「今日到期 / 明天复习」的日历口径不一致）。"""
import time

from app import db
from tests.conftest import seed_questions

PFX = "test-r438-"
CN = 8 * 3600
# 2026-09-06 23:30 CST / 08:00 CST（Unix 秒）
NIGHT = 1788708600.0  # 2026-09-06T15:30:00Z = 23:30 CST
MORNING = NIGHT - 15.5 * 3600  # 2026-09-06T00:00:00Z = 08:00 CST


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _cn_hms(ts: float) -> str:
    return time.strftime("%H:%M:%S", time.gmtime(ts + CN))


def _cn_date(ts: float) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(ts + CN))


def _mistake(client, uid, qid):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"R438 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def _nr(mid):
    conn = db.get_conn()
    v = conn.execute("SELECT next_review FROM mistakes WHERE id=?", (mid,)).fetchone()["next_review"]
    conn.close()
    return v


def test_cn_day_start_is_cst_midnight():
    assert _cn_hms(NIGHT) == "23:30:00" and _cn_hms(MORNING) == "08:00:00"
    for ts in (NIGHT, MORNING):
        s = db.cn_day_start(ts)
        assert _cn_hms(s) == "00:00:00" and _cn_date(s) == _cn_date(ts) and s <= ts
    assert db.cn_day_start(NIGHT) == db.cn_day_start(MORNING)


def test_night_and_morning_review_both_due_next_cst_midnight(client, monkeypatch):
    _cleanup()
    q1, q2 = seed_questions(2, ("ziliao",))[:2]
    uid = PFX + "align"
    m_night, m_morning = _mistake(client, uid, q1), _mistake(client, uid, q2)

    monkeypatch.setattr(db.time, "time", lambda: NIGHT)
    res = db.record_review(m_night, True, uid)
    assert res["next_review_days"] == 1
    nr_night = _nr(m_night)

    monkeypatch.setattr(db.time, "time", lambda: MORNING)
    db.record_review(m_morning, True, uid)
    nr_morning = _nr(m_morning)

    # 同一天早/晚复习 → 同一到期点：次日 00:00 CST；旧实现会分别落在次日 08:00 / 23:30
    assert nr_night == nr_morning
    assert _cn_hms(nr_night) == "00:00:00" and _cn_date(nr_night) == "2026-09-07"
    assert nr_night - NIGHT == 30 * 60
    # 到期前一刻不算到期、00:00 起算到期（与 due_reviews 谓词 next_review<=now 一致）
    monkeypatch.setattr(db.time, "time", lambda: nr_night - 1)
    assert {r["id"] for r in db.due_reviews(uid=uid)} == set()
    monkeypatch.setattr(db.time, "time", lambda: nr_night)
    assert {r["id"] for r in db.due_reviews(uid=uid)} == {m_night, m_morning}
    _cleanup()


def test_longer_intervals_stay_on_midnight_and_wrong_resets_to_tomorrow(client, monkeypatch):
    _cleanup()
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    uid = PFX + "interval"
    mid = _mistake(client, uid, q1)
    now = NIGHT
    for days in db.REVIEW_INTERVALS_DAYS:
        monkeypatch.setattr(db.time, "time", lambda now=now: now)
        assert db.record_review(mid, True, uid)["next_review_days"] == days
        nr = _nr(mid)
        assert _cn_hms(nr) == "00:00:00"
        assert nr == db.cn_day_start(now) + days * 86400
        now = nr + 3600  # 到期日 01:00 再复习
    monkeypatch.setattr(db.time, "time", lambda: now)
    assert db.record_review(mid, False, uid)["next_review_days"] == 1
    assert _nr(mid) == db.cn_day_start(now) + 86400
    _cleanup()
