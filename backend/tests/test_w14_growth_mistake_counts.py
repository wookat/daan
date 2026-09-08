"""W14-B2：/api/growth 附 mistakes={total,mastered,pending}——个人页/统计页取错题计数不再拉 /api/mistakes 全表。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-w14-b2-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    conn.execute("DELETE FROM mistakes WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"W14 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_fresh_uid_zero_counts_and_legacy_fields_intact(client):
    _cleanup()
    r = client.get(f"/api/growth?uid={PFX}fresh")
    assert r.status_code == 200
    d = r.json()
    assert d["mistakes"] == {"total": 0, "mastered": 0, "pending": 0}
    assert d["total"] == {"n": 0, "c": 0}
    assert d["modules"] == {} and d["weeks"] == []


def test_three_mistakes_one_mastered_uid_isolated(client):
    _cleanup()
    qids = seed_questions(3, modules=("ziliao",))
    uid, other = PFX + "a", PFX + "b"
    m1 = _mistake(client, uid, qids[0])
    _mistake(client, uid, qids[1])
    _mistake(client, uid, qids[2])
    _mistake(client, other, qids[0])
    assert client.patch(f"/api/mistakes/{m1}", json={"uid": uid, "mastered": True}).status_code == 200
    try:
        assert client.get(f"/api/growth?uid={uid}").json()["mistakes"] == {"total": 3, "mastered": 1, "pending": 2}
        assert client.get(f"/api/growth?uid={other}").json()["mistakes"] == {"total": 1, "mastered": 0, "pending": 1}
        conn = db.get_conn()
        assert db.mistake_counts(conn, uid) == {"total": 3, "mastered": 1, "pending": 2}
        conn.close()
    finally:
        _cleanup()
