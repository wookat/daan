"""R439：今日计划 / 08:00 推送口径——昨晚复习过的错题（到期 = 今日 00:00 CST）在今天任意时刻都算到期；
今日新错题不入今日计划；_day_start 与 cn_day_start 同源。"""
import time

from app import db, plan
from tests.conftest import seed_questions

PFX = "test-r439-"
CN = 8 * 3600
LATE_YESTERDAY = 1788708600.0  # 2026-09-06 23:30 CST
PUSH_HOUR_TODAY = LATE_YESTERDAY + 8.5 * 3600  # 2026-09-07 08:00 CST


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_review_log(conn)
    db._ensure_user_profile(conn)
    for t in ("mistakes", "review_log", "user_profile"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"R439 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def _review_task(uid):
    return next((t for t in plan.today_plan(uid)["tasks"] if t["key"] == "review"), None)


def test_day_start_offsets_share_cn_day_start(monkeypatch):
    monkeypatch.setattr(db.time, "time", lambda: LATE_YESTERDAY)
    s = db._day_start()
    assert s == db.cn_day_start(LATE_YESTERDAY)
    assert time.strftime("%H:%M:%S", time.gmtime(s + CN)) == "00:00:00"
    assert db._day_start(-6) == s - 6 * 86400 and db._day_start(1) == s + 86400


def test_week_and_saturday_windows_anchor_on_cn_day_start():
    from app import insights, mock_event

    for ts in (LATE_YESTERDAY, LATE_YESTERDAY + 3 * 3600, LATE_YESTERDAY + 5 * 86400):
        day0 = db.cn_day_start(ts)
        assert time.strftime("%H:%M:%S", time.gmtime(day0 + CN)) == "00:00:00"
        ws = insights._week_start(ts)
        assert (ws - day0) % 86400 == 0 and 0 <= day0 - ws < 7 * 86400
        assert time.strftime("%w", time.gmtime(ws + CN)) == "1"
        o, c = mock_event._saturday_window(ts)
        assert time.strftime("%w", time.gmtime(o + CN)) == "6" and c > ts
        assert (o - day0) % 3600 == 0


def test_plan_counts_last_night_review_as_due_at_push_hour(client, monkeypatch):
    _cleanup()
    q_old, q_new = seed_questions(2, ("ziliao",))[:2]
    uid = PFX + "plan"
    db.save_user_profile(uid, {"exam_date": "2026-12-01", "daily_minutes": 60, "base_level": "mid"})

    # 昨晚 23:30 记错题并答对一次 → 到期 = 今日 00:00
    monkeypatch.setattr(db.time, "time", lambda: LATE_YESTERDAY)
    m_old = _mistake(client, uid, q_old)
    assert db.record_review(m_old, True, uid)["next_review_days"] == 1

    # 今日 08:00（推送时刻）：昨晚那题已到期；旧口径要到 23:30 才到期，08:00 推送会说「今日到期 0 题」
    monkeypatch.setattr(db.time, "time", lambda: PUSH_HOUR_TODAY)
    assert db.due_review_count(uid) == 1
    task = _review_task(uid)
    assert task and task["sub"] == "还有 1 道到期" and task["done"] is False

    # 今日新记的错题立即到期（next_review=now）但不入今日计划的 due，避免复习任务被新错题变回未完成；
    # R440：副标把这 1 道点出来，与首页「今日到期 2 题」对得上
    _mistake(client, uid, q_new)
    assert db.due_review_count(uid) == 2
    task = _review_task(uid)
    assert task and task["sub"] == "还有 1 道到期 · 另 1 道今日新错可随时巩固" and task["target"] == 1
    _cleanup()


def test_r440_review_sub_reconciles_home_due_count(client, monkeypatch):
    """昨晚到期题今早复习完 + 今日又新错 1 道：首页任务卡「今日到期 1 题」，计划副标不能只说「已清」。"""
    _cleanup()
    q_old, q_new = seed_questions(2, ("ziliao",))[:2]
    uid = PFX + "sub"
    db.save_user_profile(uid, {"exam_date": "2026-12-01", "daily_minutes": 60, "base_level": "mid"})
    monkeypatch.setattr(db.time, "time", lambda: LATE_YESTERDAY)
    m_old = _mistake(client, uid, q_old)
    db.record_review(m_old, True, uid)

    monkeypatch.setattr(db.time, "time", lambda: PUSH_HOUR_TODAY)
    db.record_review(m_old, True, uid)  # 今早复习掉 → due=0, reviewed=1
    task = _review_task(uid)
    assert task and task["done"] is True and task["sub"] == "今日到期错题已清"

    _mistake(client, uid, q_new)  # 今日新错：首页 due_mistakes=1，计划任务不回退
    assert db.daily_plan(uid)["due_mistakes"] == 1
    task = _review_task(uid)
    assert task and task["done"] is True and task["target"] == 1
    assert task["sub"] == "今日到期错题已清 · 另 1 道今日新错可随时巩固"
    assert plan._review_sub(0, 0) == "今日到期错题已清"
    _cleanup()
