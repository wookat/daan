"""AI 问答进行中会话跨设备同步：GET/POST /api/ask/cur（R332）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    db._ensure_ask_cur(conn)
    conn.execute("DELETE FROM ask_cur WHERE uid LIKE 'test-askcur-%'")
    conn.commit()
    conn.close()


def _body(uid, n=1, sid=0, ts=1000):
    return {
        "uid": uid,
        "sid": sid,
        "ts": ts,
        "items": [{"question_text": "题干", "explanation": "讲解", "fu": []}] * n,
    }


def test_roundtrip_and_clear(client):
    uid = "test-askcur-rt"
    _cleanup()
    assert client.get(f"/api/ask/cur?uid={uid}").json() == {}
    r = client.post("/api/ask/cur", json=_body(uid, n=2, sid=0, ts=1234))
    assert r.status_code == 200 and r.json()["ok"] is True
    d = client.get(f"/api/ask/cur?uid={uid}").json()
    assert d["sid"] == 0 and d["ts"] == 1234 and len(d["items"]) == 2
    assert d["items"][0]["explanation"] == "讲解"
    # 覆盖更新（单快照 last-write-wins），sid 衔接 R329 历史会话
    client.post("/api/ask/cur", json=_body(uid, n=1, sid=555, ts=2222))
    d = client.get(f"/api/ask/cur?uid={uid}").json()
    assert d["sid"] == 555 and d["ts"] == 2222 and len(d["items"]) == 1
    # items:[] = 清除
    assert client.post("/api/ask/cur", json={"uid": uid, "items": []}).json()["ok"] is True
    assert client.get(f"/api/ask/cur?uid={uid}").json() == {}
    _cleanup()


def test_uid_isolation(client):
    _cleanup()
    client.post("/api/ask/cur", json=_body("test-askcur-a"))
    assert client.get("/api/ask/cur?uid=test-askcur-b").json() == {}
    _cleanup()


def test_ttl_7d_stale_returns_empty(client):
    uid = "test-askcur-ttl"
    _cleanup()
    client.post("/api/ask/cur", json=_body(uid))
    conn = db.get_conn()
    conn.execute("UPDATE ask_cur SET updated_at=updated_at-8*24*3600 WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
    assert client.get(f"/api/ask/cur?uid={uid}").json() == {}
    _cleanup()


def test_invalid_payloads(client):
    uid = "test-askcur-bad"
    _cleanup()
    assert client.get("/api/ask/cur?uid=").status_code == 400
    assert client.post("/api/ask/cur", json={"items": [{"a": 1}]}).status_code == 400
    bad = [
        {**_body(uid), "items": "not-a-list"},
        {**_body(uid), "items": ["str-entry"]},
        {**_body(uid), "items": [{"a": 1}] * 51},
        {**_body(uid), "sid": True},
        {**_body(uid), "sid": -1},
        {**_body(uid), "sid": "1"},
        {**_body(uid), "ts": 0},
        {**_body(uid), "ts": True},
        {**_body(uid), "ts": "9"},
    ]
    for b in bad:
        assert client.post("/api/ask/cur", json=b).status_code == 400, b
    huge = _body(uid)
    huge["items"] = [{"explanation": "长" * 220_000}]
    assert client.post("/api/ask/cur", json=huge).status_code == 400
    assert client.get(f"/api/ask/cur?uid={uid}").json() == {}
    _cleanup()
