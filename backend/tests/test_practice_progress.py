"""普通刷题未完成进度服务端同步：POST /api/practice/progress + GET /api/practice/resume（R322）。"""
import time

from app import db

from .conftest import seed_questions


def _cleanup():
    conn = db.get_conn()
    db._ensure_practice_progress(conn)
    conn.execute("DELETE FROM practice_progress WHERE uid LIKE 'test-pprog-%'")
    conn.commit()
    conn.close()


def test_progress_roundtrip_resume(client):
    qids = seed_questions()[:5]
    uid = "test-pprog-u1"
    r = client.post("/api/practice/progress", json={
        "uid": uid, "qids": qids,
        "picks": {str(qids[0]): "A", str(qids[2]): "C"},
        "excl": {str(qids[1]): ["B", "D", "B"]},
        "idx": 2, "right": 1, "streak": 1, "best_streak": 7,
        "module": "yanyu", "submodule": "逻辑填空",
    })
    assert r.status_code == 200 and r.json()["ok"] is True
    d = client.get(f"/api/practice/resume?uid={uid}").json()
    assert [q["id"] for q in d["items"]] == qids
    assert d["picks"] == {str(qids[0]): "A", str(qids[2]): "C"}
    assert d["excl"] == {str(qids[1]): ["B", "D"]}  # 去重保序
    assert d["idx"] == 2 and d["right"] == 1 and d["streak"] == 1 and d["best_streak"] == 7
    assert d["module"] == "yanyu" and d["submodule"] == "逻辑填空"
    # 覆盖更新（uid 单行 UPSERT）
    client.post("/api/practice/progress", json={"uid": uid, "qids": qids[:3], "picks": {str(qids[1]): "B"}, "idx": 1})
    d2 = client.get(f"/api/practice/resume?uid={uid}").json()
    assert len(d2["items"]) == 3 and d2["picks"] == {str(qids[1]): "B"} and d2["idx"] == 1
    _cleanup()


def test_empty_qids_clears(client):
    qids = seed_questions()[:3]
    uid = "test-pprog-u2"
    client.post("/api/practice/progress", json={"uid": uid, "qids": qids, "idx": 0})
    assert client.get(f"/api/practice/resume?uid={uid}").json() != {}
    r = client.post("/api/practice/progress", json={"uid": uid, "qids": []})
    assert r.status_code == 200
    assert client.get(f"/api/practice/resume?uid={uid}").json() == {}
    _cleanup()


def test_expired_returns_empty(client):
    qids = seed_questions()[:3]
    uid = "test-pprog-u3"
    client.post("/api/practice/progress", json={"uid": uid, "qids": qids})
    conn = db.get_conn()
    conn.execute("UPDATE practice_progress SET updated_at=? WHERE uid=?", (time.time() - 25 * 3600, uid))
    conn.commit()
    conn.close()
    assert client.get(f"/api/practice/resume?uid={uid}").json() == {}
    _cleanup()


def test_invalid_inputs_400(client):
    qids = seed_questions()[:3]
    uid = "test-pprog-u4"
    bad = [
        {"qids": "x"},
        {"qids": [0]},
        {"qids": [True]},
        {"qids": list(range(1, 102))},
        {"qids": qids, "picks": {str(qids[0]): "E"}},
        {"qids": qids, "picks": {"999999999": "A"}},
        {"qids": qids, "picks": {"abc": "A"}},
        {"qids": qids, "excl": {str(qids[0]): "A"}},
        {"qids": qids, "excl": {str(qids[0]): ["A", "B", "C", "D", "A"]}},
        {"qids": qids, "excl": {str(qids[0]): [1]}},
        {"qids": qids, "excl": {"999999999": ["A"]}},
    ]
    for body in bad:
        r = client.post("/api/practice/progress", json={"uid": uid, **body})
        assert r.status_code == 400, body
    assert client.post("/api/practice/progress", json={"qids": qids}).status_code == 400
    assert client.get("/api/practice/resume?uid=").status_code == 400
    _cleanup()


def test_bounds_fail_closed(client):
    qids = seed_questions()[:3]
    uid = "test-pprog-u5"
    client.post("/api/practice/progress", json={
        "uid": uid, "qids": qids, "idx": 99, "right": -2, "streak": True, "best_streak": 99999,
    })
    d = client.get(f"/api/practice/resume?uid={uid}").json()
    assert d["idx"] == 0 and d["right"] == 0 and d["streak"] == 0 and d["best_streak"] == 10000
    _cleanup()


def test_resume_skips_removed_questions(client):
    qids = seed_questions()[:3]
    uid = "test-pprog-u6"
    client.post("/api/practice/progress", json={"uid": uid, "qids": qids + [98765432]})
    d = client.get(f"/api/practice/resume?uid={uid}").json()
    assert [q["id"] for q in d["items"]] == qids
    _cleanup()
