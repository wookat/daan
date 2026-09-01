from app import db


def _rows(uid):
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT event, source, ref FROM growth_events WHERE uid=?", (uid,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def test_track_rejects_unknown_event(client):
    r = client.post("/api/track", json={"event": "made_up_event", "uid": "utesttrack1"})
    assert r.status_code == 400
    assert _rows("utesttrack1") == []


def test_track_whitelisted_event_persisted(client):
    r = client.post(
        "/api/track",
        json={"event": "share_open", "uid": "utesttrack2", "source": "share", "ref": "sid123"},
    )
    assert r.status_code == 200
    assert _rows("utesttrack2") == [{"event": "share_open", "source": "share", "ref": "sid123"}]


def test_track_slow_load_server_side_enrichment(client):
    r = client.post(
        "/api/track",
        json={"event": "slow_load", "uid": "utesttrack3", "ref": "nav:12s"},
        headers={"user-agent": "TestUA/1.0", "accept-language": "zh-CN"},
    )
    assert r.status_code == 200
    ref = _rows("utesttrack3")[0]["ref"]
    assert ref.startswith("nav:12s;ua:TestUA/1.0")
    assert ";hs:" in ref and ref.endswith("l")
