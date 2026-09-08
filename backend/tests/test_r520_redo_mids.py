"""R520：/api/mistakes/redo?mids=… 批量勾选重练——只取勾选行、仍按 uid 隔离与 mastered=0 约束、畸形/超限 400。"""
from app import db
from app.study_api import _REDO_MIDS_MAX

from .conftest import seed_questions


def _seed(uid: str, n: int = 4, mastered_last: bool = False) -> list[tuple[int, int]]:
    qids = seed_questions()[:n]
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    out = []
    for i, qid in enumerate(qids):
        row = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()
        cur = conn.execute(
            "INSERT INTO mistakes (question_text, uid, question_id, mastered, created_at) VALUES (?,?,?,?,strftime('%s','now'))",
            (row["question"], uid, qid, 1 if (mastered_last and i == n - 1) else 0),
        )
        out.append((cur.lastrowid, qid))
    conn.commit()
    conn.close()
    return out


def _cleanup(*uids: str):
    conn = db.get_conn()
    for u in uids:
        conn.execute("DELETE FROM mistakes WHERE uid=?", (u,))
    conn.commit()
    conn.close()


def test_mids_returns_only_selected_rows(client):
    uid = "test-r520-mids"
    rows = _seed(uid)
    pick = rows[1:3]
    d = client.get(f"/api/mistakes/redo?uid={uid}&mids={pick[0][0]},{pick[1][0]}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(q for _, q in pick)
    assert sorted(q["mistake_id"] for q in d["items"]) == sorted(m for m, _ in pick)
    _cleanup(uid)


def test_mids_respect_uid_isolation_and_mastered(client):
    a, b = "test-r520-mids-a", "test-r520-mids-b"
    ra = _seed(a, n=3, mastered_last=True)
    rb = _seed(b, n=1)
    ids = ",".join(str(m) for m, _ in ra) + f",{rb[0][0]}"
    d = client.get(f"/api/mistakes/redo?uid={a}&mids={ids}").json()
    # 别人的行与已掌握行都不进重练集
    assert sorted(q["mistake_id"] for q in d["items"]) == sorted(m for m, _ in ra[:2])
    _cleanup(a, b)


def test_mids_malformed_or_too_many_400(client):
    uid = "test-r520-mids-bad"
    for bad in ("abc", "1,-2", "0", ",", "1;2"):
        r = client.get(f"/api/mistakes/redo?uid={uid}&mids={bad}")
        assert r.status_code == 400, bad
        assert r.json()["detail"] == "无效的错题 ID"
    too_many = ",".join(str(i) for i in range(1, _REDO_MIDS_MAX + 2))
    assert client.get(f"/api/mistakes/redo?uid={uid}&mids={too_many}").status_code == 400
    ok = ",".join(str(i) for i in range(1, _REDO_MIDS_MAX + 1))
    assert client.get(f"/api/mistakes/redo?uid={uid}&mids={ok}").status_code == 200


def test_without_mids_unchanged(client):
    uid = "test-r520-nomids"
    rows = _seed(uid)
    d = client.get(f"/api/mistakes/redo?uid={uid}").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(q for _, q in rows)
    _cleanup(uid)
