"""模考未交卷进度服务端同步：POST /api/exam/progress + GET /api/exam/resume（R298）。"""
import json
import time

from app import db

from .conftest import seed_questions


def _seed_paper(title: str, qids: list[int], duration_min: int = 120) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2023, "江苏", json.dumps(qids), duration_min),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _cleanup():
    conn = db.get_conn()
    db._ensure_exam_progress(conn)
    conn.execute(
        "DELETE FROM exam_progress WHERE uid LIKE 'test-eprog-%'")
    conn.execute("DELETE FROM exam_attempts WHERE uid LIKE 'test-eprog-%'")
    conn.commit()
    conn.close()


def _start(client, uid: str, pid: int) -> int:
    d = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()
    return d["attempt_id"]


def test_progress_roundtrip_resume(client):
    qids = seed_questions()[:5]
    pid = _seed_paper("进度同步roundtrip测试卷", qids)
    uid = "test-eprog-u1"
    aid = _start(client, uid, pid)
    r = client.post("/api/exam/progress", json={
        "uid": uid, "attempt_id": aid, "picks": {str(qids[0]): "A", str(qids[2]): "C"}, "idx": 2,
    })
    assert r.status_code == 200 and r.json()["ok"] is True
    d = client.get(f"/api/exam/resume?uid={uid}").json()
    assert d["attempt_id"] == aid and d["paper"]["id"] == pid
    assert d["picks"] == {str(qids[0]): "A", str(qids[2]): "C"} and d["idx"] == 2
    assert len(d["items"]) == 5 and d["items"][0]["id"] == qids[0]
    assert d["end_at_ms"] > time.time() * 1000
    # 覆盖更新
    client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {str(qids[1]): "B"}, "idx": 1})
    d2 = client.get(f"/api/exam/resume?uid={uid}").json()
    assert d2["picks"] == {str(qids[1]): "B"} and d2["idx"] == 1
    _cleanup()


def test_progress_ownership_and_state(client):
    qids = seed_questions()[:5]
    pid = _seed_paper("进度同步归属校验测试卷", qids)
    uid = "test-eprog-u2"
    aid = _start(client, uid, pid)
    # 他人 attempt 拒绝
    r = client.post("/api/exam/progress", json={"uid": "test-eprog-other", "attempt_id": aid, "picks": {}})
    assert r.status_code == 404
    # 交卷后拒收进度且 resume 消失
    client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {str(qids[0]): "A"}})
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    assert client.post(
        "/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {}}).status_code == 400
    assert client.get(f"/api/exam/resume?uid={uid}").json() == {}
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM exam_progress WHERE attempt_id=?", (aid,)).fetchone()[0]
    conn.close()
    assert n == 0
    _cleanup()


def test_progress_expired_attempt(client):
    qids = seed_questions()[:5]
    pid = _seed_paper("进度同步超时测试卷", qids, duration_min=1)
    uid = "test-eprog-u3"
    aid = _start(client, uid, pid)
    client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {str(qids[0]): "A"}})
    conn = db.get_conn()
    conn.execute("UPDATE exam_attempts SET started_at=? WHERE id=?", (time.time() - 3600, aid))
    conn.commit()
    conn.close()
    # 超时后拒收进度，且 resume 不再返回
    assert client.post(
        "/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {}}).status_code == 400
    assert client.get(f"/api/exam/resume?uid={uid}").json() == {}
    _cleanup()


def test_progress_param_validation(client):
    qids = seed_questions()[:5]
    pid = _seed_paper("进度同步参数校验测试卷", qids)
    uid = "test-eprog-u4"
    aid = _start(client, uid, pid)
    assert client.get("/api/exam/resume?uid=").status_code == 400
    assert client.post("/api/exam/progress", json={"uid": "", "attempt_id": aid, "picks": {}}).status_code == 400
    assert client.post("/api/exam/progress", json={"uid": uid, "picks": {}}).status_code == 400
    # picks 非字典 / 非法键 / 非法值 / 超上限
    assert client.post(
        "/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": [1]}).status_code == 400
    assert client.post(
        "/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {"abc": "A"}}).status_code == 400
    assert client.post(
        "/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {str(qids[0]): "E"}}).status_code == 400
    assert client.post(
        "/api/exam/progress",
        json={"uid": uid, "attempt_id": aid, "picks": {str(i): "A" for i in range(301)}}).status_code == 400
    # 非法 idx 回落 0
    client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {}, "idx": -3})
    assert client.get(f"/api/exam/resume?uid={uid}").json()["idx"] == 0
    _cleanup()
