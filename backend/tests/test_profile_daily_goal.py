"""每日刷题目标服务端化：user_profile.daily_goal（R299）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM user_profile WHERE uid LIKE 'test-dgoal-%'")
    conn.commit()
    conn.close()


def test_daily_goal_roundtrip(client):
    uid = "test-dgoal-uid"
    r = client.post("/api/profile", json={"uid": uid, "daily_goal": 50})
    assert r.status_code == 200 and r.json()["profile"]["daily_goal"] == 50
    assert client.get(f"/api/profile?uid={uid}").json()["profile"]["daily_goal"] == 50
    # 覆盖更新
    client.post("/api/profile", json={"uid": uid, "daily_goal": 100})
    assert client.get(f"/api/profile?uid={uid}").json()["profile"]["daily_goal"] == 100
    _cleanup()


def test_daily_goal_does_not_touch_other_fields(client):
    uid = "test-dgoal-uid2"
    client.post("/api/profile", json={"uid": uid, "exam_type": "国考", "daily_minutes": 60})
    client.post("/api/profile", json={"uid": uid, "daily_goal": 20})
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["exam_type"] == "国考" and p["daily_minutes"] == 60 and p["daily_goal"] == 20
    _cleanup()


def test_daily_goal_validation(client):
    uid = "test-dgoal-uid3"
    for bad in (5, 19, 21, 49, 51, 101, 500, 0, -1, "50", "20", 20.5, 50.0, True, False):
        r = client.post("/api/profile", json={"uid": uid, "daily_goal": bad})
        assert r.status_code == 400, bad
    for good in (20, 50, 100):
        r = client.post("/api/profile", json={"uid": uid, "daily_goal": good})
        assert r.status_code == 200 and r.json()["profile"]["daily_goal"] == good
    _cleanup()


def test_daily_goal_empty_uid_rejected(client):
    r = client.post("/api/profile", json={"uid": "", "daily_goal": 50})
    assert r.status_code == 400


def test_daily_goal_legacy_schema_migration(client):
    conn = db.get_conn()
    conn.execute("DROP TABLE IF EXISTS user_profile")
    conn.execute(
        """CREATE TABLE user_profile (
            uid TEXT PRIMARY KEY,
            exam_type TEXT,
            target_region TEXT,
            exam_date TEXT,
            target_score INTEGER,
            daily_minutes INTEGER,
            base_level TEXT,
            created_at REAL,
            updated_at REAL)"""
    )
    conn.commit()
    conn.close()
    uid = "test-dgoal-legacy"
    r = client.post("/api/profile", json={"uid": uid, "daily_goal": 20})
    assert r.status_code == 200 and r.json()["profile"]["daily_goal"] == 20
    assert client.get(f"/api/profile?uid={uid}").json()["profile"]["daily_goal"] == 20
    _cleanup()


def test_daily_goal_none_clears(client):
    uid = "test-dgoal-uid4"
    client.post("/api/profile", json={"uid": uid, "daily_goal": 50})
    r = client.post("/api/profile", json={"uid": uid, "daily_goal": None})
    assert r.status_code == 200 and r.json()["profile"]["daily_goal"] is None
    _cleanup()


def test_daily_goal_absent_key_untouched(client):
    uid = "test-dgoal-uid5"
    client.post("/api/profile", json={"uid": uid, "daily_goal": 100})
    client.post("/api/profile", json={"uid": uid, "target_region": "四川"})
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["daily_goal"] == 100 and p["target_region"] == "四川"
    _cleanup()
