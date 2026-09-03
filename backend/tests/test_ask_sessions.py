"""AI 问答历史会话跨设备同步：GET/POST/DELETE /api/ask/sessions（R328）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    db._ensure_ask_sessions(conn)
    conn.execute("DELETE FROM ask_sessions WHERE uid LIKE 'test-asksess-%'")
    conn.commit()
    conn.close()


def _sess(sid, ts=None, n=1):
    return {
        "sid": sid,
        "ts": ts or sid,
        "title": f"会话{sid}",
        "n": n,
        "items": [{"question_text": "题干", "explanation": "讲解", "fu": []}] * n,
    }


def test_roundtrip_and_delete(client):
    uid = "test-asksess-rt"
    _cleanup()
    assert client.get(f"/api/ask/sessions?uid={uid}").json() == {"items": []}
    r = client.post("/api/ask/sessions", json={"uid": uid, **_sess(100)})
    assert r.status_code == 200 and r.json()["ok"] is True
    client.post("/api/ask/sessions", json={"uid": uid, **_sess(200, n=2)})
    items = client.get(f"/api/ask/sessions?uid={uid}").json()["items"]
    assert [s["id"] for s in items] == [200, 100]
    assert items[0]["n"] == 2 and items[0]["title"] == "会话200"
    assert items[1]["items"][0]["explanation"] == "讲解"
    # 幂等 upsert：同 sid 覆盖
    client.post("/api/ask/sessions", json={"uid": uid, **_sess(200), "title": "改名"})
    items = client.get(f"/api/ask/sessions?uid={uid}").json()["items"]
    assert len(items) == 2 and items[0]["title"] == "改名"
    # 删除
    assert client.delete(f"/api/ask/sessions/200?uid={uid}").json()["ok"] is True
    items = client.get(f"/api/ask/sessions?uid={uid}").json()["items"]
    assert [s["id"] for s in items] == [100]
    _cleanup()


def test_cap_20_prunes_oldest(client):
    uid = "test-asksess-cap"
    _cleanup()
    for i in range(1, 23):
        client.post("/api/ask/sessions", json={"uid": uid, **_sess(i)})
    items = client.get(f"/api/ask/sessions?uid={uid}").json()["items"]
    assert len(items) == 20
    assert items[0]["id"] == 22 and items[-1]["id"] == 3
    _cleanup()


def test_uid_isolation(client):
    _cleanup()
    client.post("/api/ask/sessions", json={"uid": "test-asksess-a", **_sess(1)})
    assert client.get("/api/ask/sessions?uid=test-asksess-b").json() == {"items": []}
    client.delete("/api/ask/sessions/1?uid=test-asksess-b")
    assert len(client.get("/api/ask/sessions?uid=test-asksess-a").json()["items"]) == 1
    _cleanup()


def test_invalid_payloads(client):
    uid = "test-asksess-bad"
    _cleanup()
    assert client.get("/api/ask/sessions?uid=").status_code == 400
    assert client.post("/api/ask/sessions", json={**_sess(1)}).status_code == 400
    assert client.delete("/api/ask/sessions/1?uid=").status_code == 400
    bad = [
        {"uid": uid, **_sess(1), "sid": True},
        {"uid": uid, **_sess(1), "sid": 0},
        {"uid": uid, **_sess(1), "ts": -5},
        {"uid": uid, **_sess(1), "n": 0},
        {"uid": uid, **_sess(1), "n": 51},
        {"uid": uid, **_sess(1), "items": []},
        {"uid": uid, **_sess(1), "items": "not-a-list"},
        {"uid": uid, **_sess(1), "items": ["str-entry"]},
    ]
    for b in bad:
        assert client.post("/api/ask/sessions", json=b).status_code == 400, b
    # 超大 payload 400
    huge = {"uid": uid, **_sess(1)}
    huge["items"] = [{"explanation": "长" * 220_000}]
    assert client.post("/api/ask/sessions", json=huge).status_code == 400
    assert client.get(f"/api/ask/sessions?uid={uid}").json() == {"items": []}
    _cleanup()
