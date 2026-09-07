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


def test_track_ask_view_question_whitelisted(client):
    r = client.post(
        "/api/track",
        json={"event": "ask_view_question", "uid": "utesttrack_avq", "source": "ask"},
    )
    assert r.status_code == 200
    assert _rows("utesttrack_avq") == [{"event": "ask_view_question", "source": "ask", "ref": None}]


def test_track_practice_ask_click_whitelisted(client):
    r = client.post(
        "/api/track",
        json={"event": "practice_ask_click", "uid": "utesttrack_pac", "source": "shuliang", "ref": "296322"},
    )
    assert r.status_code == 200
    assert _rows("utesttrack_pac") == [{"event": "practice_ask_click", "source": "shuliang", "ref": "296322"}]


def test_track_book_ask_click_whitelisted(client):
    r = client.post(
        "/api/track",
        json={"event": "book_ask_click", "uid": "utesttrack_bac", "source": "yanyu", "ref": "234494"},
    )
    assert r.status_code == 200
    assert _rows("utesttrack_bac") == [{"event": "book_ask_click", "source": "yanyu", "ref": "234494"}]


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


def _created_at(uid):
    conn = db.get_conn()
    v = conn.execute(
        "SELECT created_at FROM growth_events WHERE uid=?", (uid,)
    ).fetchone()[0]
    conn.close()
    return v


def test_track_ago_ms_backdates_created_at(client):
    import time

    r = client.post(
        "/api/track", json={"event": "boot", "uid": "utesttrack4", "ago_ms": 60000}
    )
    assert r.status_code == 200
    assert abs(_created_at("utesttrack4") - (time.time() - 60)) < 5


def test_track_ago_ms_clamped_and_tolerant(client):
    import time

    r = client.post(
        "/api/track",
        json={"event": "boot", "uid": "utesttrack5", "ago_ms": 999 * 86400 * 1000},
    )
    assert r.status_code == 200
    assert abs(_created_at("utesttrack5") - (time.time() - 7 * 86400)) < 5

    r = client.post(
        "/api/track", json={"event": "boot", "uid": "utesttrack6", "ago_ms": "junk"}
    )
    assert r.status_code == 200
    assert abs(_created_at("utesttrack6") - time.time()) < 5
