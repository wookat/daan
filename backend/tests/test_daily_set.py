import time

from app import db

from .conftest import seed_questions


def _day_offset(n: int) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600 + n * 86400))


def test_daily_set_archive_deterministic(client):
    seed_questions()
    yesterday = _day_offset(-1)
    r1 = client.get(f"/api/daily_set?date={yesterday}")
    r2 = client.get(f"/api/daily_set?date={yesterday}")
    assert r1.status_code == r2.status_code == 200
    ids1 = [q["id"] for q in r1.json()["items"]]
    assert ids1 == [q["id"] for q in r2.json()["items"]]
    assert len(ids1) == 10
    modules = [q["module"] for q in r1.json()["items"]]
    assert all(modules.count(m) == 2 for m in set(modules))
    assert r1.json()["date"] == yesterday


def test_daily_set_invalid_dates_fall_back_to_today(client):
    seed_questions()
    today = db.cn_day()
    for bad in ("not-a-date", _day_offset(1), _day_offset(-9)):
        r = client.get(f"/api/daily_set?date={bad}")
        assert r.status_code == 200
        assert r.json()["date"] == today


def test_daily_set_submit_idempotent_and_streak():
    yesterday, today = _day_offset(-1), _day_offset(0)
    first = db.daily_set_submit(yesterday, "utestdaily1", 7, 10, 120.0)
    assert first["already"] is False and first["my_right"] == 7 and first["streak"] == 1
    again = db.daily_set_submit(yesterday, "utestdaily1", 9, 10, 60.0)
    assert again["already"] is True and again["my_right"] == 7  # 重复提交不覆盖
    second_day = db.daily_set_submit(today, "utestdaily1", 5, 10, 90.0)
    assert second_day["streak"] == 2
