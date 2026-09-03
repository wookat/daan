"""/api/mistakes/redo 按三级考点过滤：错题重练遵循考点筛选（R344）。"""
from app import db

from .conftest import seed_questions

T3A = "ZL-JQ-01"
T3B = "ZL-JQ-02"


def _seed_mistakes(uid: str):
    qids = seed_questions()[:4]
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    tags = [T3A, T3A, T3B, None]
    for qid, t3 in zip(qids, tags):
        conn.execute("UPDATE questions SET tag3=? WHERE id=?", (t3, qid))
        row = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()
        conn.execute(
            "INSERT INTO mistakes (question_text, uid, question_id, mastered, created_at)"
            " VALUES (?,?,?,0,strftime('%s','now'))",
            (row["question"], uid, qid),
        )
    conn.commit()
    conn.close()
    return qids


def _cleanup(uid: str, qids):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    for qid in qids:
        conn.execute("UPDATE questions SET tag3=NULL WHERE id=?", (qid,))
    conn.commit()
    conn.close()


def test_redo_t3_exact_filter(client):
    uid = "test-r344-t3"
    qids = _seed_mistakes(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}&t3={T3A}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids[:2])
    _cleanup(uid, qids)


def test_redo_t3_invalid_400_and_default_unchanged(client):
    uid = "test-r344-t32"
    qids = _seed_mistakes(uid)
    r = client.get(f"/api/mistakes/redo?uid={uid}&t3=HACK-00")
    assert r.status_code == 400
    d = client.get(f"/api/mistakes/redo?uid={uid}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids)
    _cleanup(uid, qids)


def test_redo_t3_excludes_manual_mistakes_without_qid(client):
    uid = "test-r344-t33"
    qids = _seed_mistakes(uid)
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO mistakes (question_text, uid, mastered, created_at)"
        " VALUES ('手录错题：无题库关联',?,0,strftime('%s','now'))",
        (uid,),
    )
    conn.commit()
    conn.close()
    d = client.get(f"/api/mistakes/redo?uid={uid}&t3={T3A}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids[:2])
    _cleanup(uid, qids)


def test_redo_t3_combines_with_rz(client):
    uid = "test-r344-t34"
    qids = _seed_mistakes(uid)
    conn = db.get_conn()
    conn.execute("UPDATE mistakes SET error_reason='概念不清' WHERE uid=? AND question_id=?", (uid, qids[0]))
    conn.commit()
    conn.close()
    d = client.get(f"/api/mistakes/redo?uid={uid}&t3={T3A}&rz=概念不清").json()
    assert [q["id"] for q in d["items"]] == [qids[0]]
    _cleanup(uid, qids)
