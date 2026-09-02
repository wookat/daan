"""练习偏好服务端化：user_profile.group_size/timed_mode/auto_next（R300）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM user_profile WHERE uid LIKE 'test-pprefs-%'")
    conn.commit()
    conn.close()


def test_practice_prefs_roundtrip(client):
    uid = "test-pprefs-uid"
    r = client.post("/api/profile", json={"uid": uid, "group_size": 30, "timed_mode": 1, "auto_next": 0})
    assert r.status_code == 200
    p = r.json()["profile"]
    assert p["group_size"] == 30 and p["timed_mode"] == 1 and p["auto_next"] == 0
    # 覆盖更新
    client.post("/api/profile", json={"uid": uid, "group_size": 50, "timed_mode": 0, "auto_next": 1})
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["group_size"] == 50 and p["timed_mode"] == 0 and p["auto_next"] == 1
    _cleanup()


def test_practice_prefs_do_not_touch_other_fields(client):
    uid = "test-pprefs-uid2"
    client.post("/api/profile", json={"uid": uid, "exam_type": "省考", "daily_goal": 50})
    client.post("/api/profile", json={"uid": uid, "group_size": 20})
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["exam_type"] == "省考" and p["daily_goal"] == 50 and p["group_size"] == 20
    _cleanup()


def test_group_size_validation(client):
    uid = "test-pprefs-uid3"
    for bad in (5, 15, 25, 40, 60, 100, 0, -1, "10", "20", 10.5, 20.0, True, False):
        r = client.post("/api/profile", json={"uid": uid, "group_size": bad})
        assert r.status_code == 400, bad
    for good in (10, 20, 30, 50):
        r = client.post("/api/profile", json={"uid": uid, "group_size": good})
        assert r.status_code == 200 and r.json()["profile"]["group_size"] == good
    _cleanup()


def test_flag_validation(client):
    uid = "test-pprefs-uid4"
    for key in ("timed_mode", "auto_next"):
        for bad in (2, -1, "1", "0", 0.5, 1.0, True, False):
            r = client.post("/api/profile", json={"uid": uid, key: bad})
            assert r.status_code == 400, (key, bad)
        for good in (0, 1):
            r = client.post("/api/profile", json={"uid": uid, key: good})
            assert r.status_code == 200 and r.json()["profile"][key] == good
    _cleanup()


def test_practice_prefs_none_clears_and_absent_untouched(client):
    uid = "test-pprefs-uid5"
    client.post("/api/profile", json={"uid": uid, "group_size": 30, "timed_mode": 1, "auto_next": 0})
    r = client.post("/api/profile", json={"uid": uid, "group_size": None, "timed_mode": None})
    p = r.json()["profile"]
    assert r.status_code == 200 and p["group_size"] is None and p["timed_mode"] is None and p["auto_next"] == 0
    client.post("/api/profile", json={"uid": uid, "target_region": "四川"})
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["auto_next"] == 0 and p["target_region"] == "四川"
    _cleanup()


def test_practice_prefs_legacy_schema_migration(client):
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
            daily_goal INTEGER,
            created_at REAL,
            updated_at REAL)"""
    )
    conn.commit()
    conn.close()
    uid = "test-pprefs-legacy"
    r = client.post("/api/profile", json={"uid": uid, "group_size": 10, "timed_mode": 1, "auto_next": 1})
    assert r.status_code == 200
    p = client.get(f"/api/profile?uid={uid}").json()["profile"]
    assert p["group_size"] == 10 and p["timed_mode"] == 1 and p["auto_next"] == 1
    _cleanup()
