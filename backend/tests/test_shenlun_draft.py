"""申论作答草稿服务端同步：GET/POST /api/shenlun/draft（R297）。"""
from app import db


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM shenlun_drafts WHERE uid LIKE 'test-sldraft-%'")
    conn.commit()
    conn.close()


def test_draft_roundtrip(client):
    uid = "test-sldraft-uid"
    d0 = client.get(f"/api/shenlun/draft?uid={uid}&qid=1").json()
    assert d0 == {"content": "", "updated_at": 0}
    r = client.post("/api/shenlun/draft", json={"uid": uid, "qid": 1, "content": "草稿一版"})
    assert r.status_code == 200 and r.json()["ok"] is True
    d1 = client.get(f"/api/shenlun/draft?uid={uid}&qid=1").json()
    assert d1["content"] == "草稿一版" and d1["updated_at"] > 0
    # 覆盖更新
    client.post("/api/shenlun/draft", json={"uid": uid, "qid": 1, "content": "草稿二版"})
    assert client.get(f"/api/shenlun/draft?uid={uid}&qid=1").json()["content"] == "草稿二版"
    # 逐题隔离
    assert client.get(f"/api/shenlun/draft?uid={uid}&qid=2").json()["content"] == ""
    _cleanup()


def test_draft_empty_deletes(client):
    uid = "test-sldraft-uid2"
    client.post("/api/shenlun/draft", json={"uid": uid, "qid": 3, "content": "将被删除"})
    client.post("/api/shenlun/draft", json={"uid": uid, "qid": 3, "content": ""})
    assert client.get(f"/api/shenlun/draft?uid={uid}&qid=3").json() == {"content": "", "updated_at": 0}
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM shenlun_drafts WHERE uid=?", (uid,)).fetchone()[0]
    conn.close()
    assert n == 0
    _cleanup()


def test_draft_param_validation(client):
    assert client.get("/api/shenlun/draft?uid=&qid=1").status_code == 400
    assert client.post("/api/shenlun/draft", json={"uid": "", "qid": 1, "content": "x"}).status_code == 400
    assert client.post("/api/shenlun/draft", json={"uid": "test-sldraft-uid3"}).status_code == 400
    # 超长 3000+ 拒绝
    assert client.post(
        "/api/shenlun/draft", json={"uid": "test-sldraft-uid3", "qid": 1, "content": "字" * 3001}
    ).status_code == 400
    _cleanup()
