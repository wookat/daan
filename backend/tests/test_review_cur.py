"""错题本复习会话跨设备同步：GET/POST /api/review/cur（R352）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    db._ensure_review_cur(conn)
    conn.execute("DELETE FROM review_cur WHERE uid LIKE 'test-rcur-%'")
    conn.commit()
    conn.close()


def _snap(uid, n=2, r_idx=0, ts=1000):
    return {
        "v": 1,
        "uid": uid,
        "ts": ts,
        "rIdx": r_idx,
        "items": [{"question_text": "题干", "id": 1}] * n,
        "picked": "B",
        "answered": True,
        "wasCorrect": False,
        "nextDays": 0,
    }


def _body(uid, **kw):
    return {"uid": uid, "snap": _snap(uid, **kw)}


def test_roundtrip_and_clear(client):
    uid = "test-rcur-rt"
    _cleanup()
    assert client.get(f"/api/review/cur?uid={uid}").json() == {}
    r = client.post("/api/review/cur", json=_body(uid, n=3, r_idx=1, ts=1234))
    assert r.status_code == 200 and r.json()["ok"] is True
    d = client.get(f"/api/review/cur?uid={uid}").json()["snap"]
    assert d["rIdx"] == 1 and d["ts"] == 1234 and len(d["items"]) == 3
    assert d["picked"] == "B" and d["answered"] is True
    # 覆盖更新（单快照 last-write-wins）
    client.post("/api/review/cur", json=_body(uid, n=1, r_idx=0, ts=2222))
    d = client.get(f"/api/review/cur?uid={uid}").json()["snap"]
    assert d["ts"] == 2222 and len(d["items"]) == 1
    # snap:null = 清除
    assert client.post("/api/review/cur", json={"uid": uid, "snap": None}).json()["ok"] is True
    assert client.get(f"/api/review/cur?uid={uid}").json() == {}
    _cleanup()


def test_uid_isolation(client):
    _cleanup()
    client.post("/api/review/cur", json=_body("test-rcur-a"))
    assert client.get("/api/review/cur?uid=test-rcur-b").json() == {}
    _cleanup()


def test_ttl_2h_stale_returns_empty(client):
    uid = "test-rcur-ttl"
    _cleanup()
    client.post("/api/review/cur", json=_body(uid))
    conn = db.get_conn()
    conn.execute("UPDATE review_cur SET updated_at=updated_at-3*3600 WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
    assert client.get(f"/api/review/cur?uid={uid}").json() == {}
    _cleanup()


def test_invalid_payloads(client):
    uid = "test-rcur-bad"
    _cleanup()
    assert client.get("/api/review/cur?uid=").status_code == 400
    assert client.post("/api/review/cur", json={"snap": _snap(uid)}).status_code == 400
    bad = [
        {"uid": uid, "snap": "not-a-dict"},
        {"uid": uid, "snap": {**_snap(uid), "v": 2}},
        {"uid": uid, "snap": _snap("test-rcur-other")},
        {"uid": uid, "snap": {**_snap(uid), "ts": 0}},
        {"uid": uid, "snap": {**_snap(uid), "ts": True}},
        {"uid": uid, "snap": {**_snap(uid), "ts": "9"}},
        {"uid": uid, "snap": {**_snap(uid), "items": []}},
        {"uid": uid, "snap": {**_snap(uid), "items": "x"}},
        {"uid": uid, "snap": {**_snap(uid), "items": ["str"]}},
        {"uid": uid, "snap": {**_snap(uid), "items": [{"question_text": ""}]}},
        {"uid": uid, "snap": {**_snap(uid), "items": [{"question_text": "题"}] * 81}},
        {"uid": uid, "snap": {**_snap(uid), "rIdx": 2}},
        {"uid": uid, "snap": {**_snap(uid), "rIdx": -1}},
        {"uid": uid, "snap": {**_snap(uid), "rIdx": True}},
        {"uid": uid, "snap": {**_snap(uid), "rIdx": "0"}},
    ]
    for b in bad:
        assert client.post("/api/review/cur", json=b).status_code == 400, b
    huge = _body(uid)
    huge["snap"]["items"] = [{"question_text": "长" * 220_000}]
    assert client.post("/api/review/cur", json=huge).status_code == 400
    assert client.get(f"/api/review/cur?uid={uid}").json() == {}
    _cleanup()


def test_cur_not_captured_by_mid_route(client):
    # /api/review/cur 必须注册在 /api/review/{mid} 之前，"cur" 不得被 int 路径吞掉
    r = client.post("/api/review/cur", json={"uid": "test-rcur-route", "snap": None})
    assert r.status_code == 200
    _cleanup()
