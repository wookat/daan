"""申论真题收藏服务端同步：GET/POST /api/shenlun/qfavs（R296，镜像 mat_favs 口径）。"""
from app import db


def _seed_q():
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_questions"
        " (exam_year, exam_region, paper, qtype, material, question, reference, disabled)"
        " VALUES (?,?,?,?,?,?,?,0)",
        (2023, "国考", "2023年国考申论（副省级）", "归纳概括",
         "给定资料", "qfav 测试题干：请概括主要问题。", "参考解析：略。"),
    )
    conn.commit()
    qid = conn.execute(
        "SELECT id FROM shenlun_questions WHERE question LIKE 'qfav 测试题干%'").fetchone()[0]
    conn.close()
    return qid


def _cleanup(qid):
    conn = db.get_conn()
    conn.execute("UPDATE shenlun_questions SET disabled=1 WHERE id=?", (qid,))
    conn.execute("DELETE FROM shenlun_qfavs WHERE uid LIKE 'test-qfav-%'")
    conn.commit()
    conn.close()


def test_qfav_roundtrip(client):
    qid = _seed_q()
    uid = "test-qfav-uid"
    r = client.post("/api/shenlun/qfavs", json={"uid": uid, "qid": qid, "on": True})
    assert r.status_code == 200 and r.json()["ok"] is True
    d = client.get(f"/api/shenlun/qfavs?uid={uid}").json()
    assert qid in d["ids"]
    item = next(x for x in d["items"] if x["id"] == qid)
    assert set(item) == {"id", "qtype", "paper", "exam_year", "exam_region", "question"}
    # 取消收藏后清空
    client.post("/api/shenlun/qfavs", json={"uid": uid, "qid": qid, "on": False})
    d2 = client.get(f"/api/shenlun/qfavs?uid={uid}").json()
    assert qid not in d2["ids"]
    _cleanup(qid)


def test_qfav_idempotent_and_disabled_filter(client):
    qid = _seed_q()
    uid = "test-qfav-uid2"
    client.post("/api/shenlun/qfavs", json={"uid": uid, "qid": qid, "on": True})
    client.post("/api/shenlun/qfavs", json={"uid": uid, "qid": qid, "on": True})
    d = client.get(f"/api/shenlun/qfavs?uid={uid}").json()
    assert d["ids"].count(qid) == 1
    # 题目下架后 items 不含快照，但 id 保留（与素材侧 JOIN 过滤口径一致）
    conn = db.get_conn()
    conn.execute("UPDATE shenlun_questions SET disabled=1 WHERE id=?", (qid,))
    conn.commit()
    conn.close()
    d2 = client.get(f"/api/shenlun/qfavs?uid={uid}").json()
    assert qid in d2["ids"] and all(x["id"] != qid for x in d2["items"])
    _cleanup(qid)


def test_qfav_param_validation(client):
    assert client.get("/api/shenlun/qfavs?uid=").status_code == 400
    assert client.post("/api/shenlun/qfavs", json={"uid": "", "qid": 1}).status_code == 400
    assert client.post("/api/shenlun/qfavs", json={"uid": "test-qfav-uid3"}).status_code == 400
