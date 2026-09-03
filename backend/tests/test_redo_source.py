"""/api/mistakes/redo 按来源过滤：错题重练遵循来源筛选（R343）。"""
from app import db

from .conftest import seed_questions


def _seed_mistakes(uid: str):
    qids = seed_questions()[:4]
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    sources = ["exam", "exam", None, "practice"]
    for qid, src in zip(qids, sources):
        row = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()
        conn.execute(
            "INSERT INTO mistakes (question_text, source, uid, question_id, mastered, created_at)"
            " VALUES (?,?,?,?,0,strftime('%s','now'))",
            (row["question"], src, uid, qid),
        )
    conn.commit()
    conn.close()
    return qids


def _cleanup(uid: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def test_redo_src_exam_only(client):
    uid = "test-r343-src"
    qids = _seed_mistakes(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}&src=exam").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids[:2])
    _cleanup(uid)


def test_redo_src_practice_covers_null_and_non_exam(client):
    uid = "test-r343-src2"
    qids = _seed_mistakes(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}&src=practice").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids[2:])
    _cleanup(uid)


def test_redo_src_invalid_400_and_default_unchanged(client):
    uid = "test-r343-src3"
    qids = _seed_mistakes(uid)
    r = client.get(f"/api/mistakes/redo?uid={uid}&src=hack")
    assert r.status_code == 400
    d = client.get(f"/api/mistakes/redo?uid={uid}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids)
    _cleanup(uid)


def test_redo_src_combines_with_rz(client):
    uid = "test-r343-src4"
    qids = _seed_mistakes(uid)
    conn = db.get_conn()
    conn.execute("UPDATE mistakes SET error_reason='概念不清' WHERE uid=? AND question_id=?", (uid, qids[0]))
    conn.commit()
    conn.close()
    d = client.get(f"/api/mistakes/redo?uid={uid}&src=exam&rz=概念不清").json()
    assert [q["id"] for q in d["items"]] == [qids[0]]
    _cleanup(uid)
