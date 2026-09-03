"""/api/mistakes/redo 按错因过滤：错题重练遵循错因筛选（R342）。"""
from app import db

from .conftest import seed_questions


def _seed_mistakes(uid: str):
    qids = seed_questions()[:4]
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    reasons = ["概念不清", "粗心大意", None, ""]
    for qid, rz in zip(qids, reasons):
        row = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()
        conn.execute(
            "INSERT INTO mistakes (question_text, error_reason, uid, question_id, mastered, created_at)"
            " VALUES (?,?,?,?,0,strftime('%s','now'))",
            (row["question"], rz, uid, qid),
        )
    conn.commit()
    conn.close()
    return qids


def _cleanup(uid: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def test_redo_rz_filters_by_reason(client):
    uid = "test-r342-rz"
    qids = _seed_mistakes(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}&rz=概念不清").json()
    assert [q["id"] for q in d["items"]] == [qids[0]]
    d = client.get(f"/api/mistakes/redo?uid={uid}&rz=粗心大意").json()
    assert [q["id"] for q in d["items"]] == [qids[1]]
    _cleanup(uid)


def test_redo_rz_untagged_bucket_covers_null_and_empty(client):
    uid = "test-r342-rz2"
    qids = _seed_mistakes(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}&rz=未标注").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids[2:])
    _cleanup(uid)


def test_redo_rz_invalid_400_and_default_unchanged(client):
    uid = "test-r342-rz3"
    qids = _seed_mistakes(uid)
    r = client.get(f"/api/mistakes/redo?uid={uid}&rz=不存在错因")
    assert r.status_code == 400
    d = client.get(f"/api/mistakes/redo?uid={uid}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids)
    _cleanup(uid)
