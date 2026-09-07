"""R514：/api/review 与 /api/mistakes 条目带题库联查的 submodule（复习答错后「同类题」按子模块抽题的口径），
未联查/题库 submodule 为空 → null。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-r514-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    conn.execute("DELETE FROM mistakes WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _set_sub(qid, sub):
    conn = db.get_conn()
    conn.execute("UPDATE questions SET submodule=? WHERE id=?", (sub, qid))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid, qt="定义判断"):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "panduan", "question_type": qt,
        "question_text": f"R514 题干 {qid}\nA.甲 B.乙 C.丙 D.丁", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_review_and_mistakes_carry_bank_submodule(client):
    _cleanup()
    uid = PFX + "sub"
    q1, q2 = seed_questions(2, ("panduan",))[:2]
    _set_sub(q1, "逻辑判断")
    _set_sub(q2, "")
    m1 = _mistake(client, uid, q1)
    m2 = _mistake(client, uid, q2)
    m3 = _mistake(client, uid, None, qt="手录")  # 未联查题库

    by_id = {d["id"]: d for d in client.get(f"/api/review?uid={uid}").json()["items"]}
    assert by_id[m1]["submodule"] == "逻辑判断"
    assert by_id[m1]["question_type"] == "定义判断"  # mistakes.question_type 不改
    assert by_id[m1]["options"] == {"A": "甲", "B": "乙", "C": "丙", "D": "丁"}
    assert by_id[m2]["submodule"] is None
    assert by_id[m3]["submodule"] is None
    assert by_id[m3]["options"] in (None, {})

    by_id = {d["id"]: d for d in client.get(f"/api/mistakes?uid={uid}").json()["items"]}
    assert by_id[m1]["submodule"] == "逻辑判断"
    assert by_id[m2]["submodule"] is None and by_id[m3]["submodule"] is None
    _set_sub(q1, None)
    _set_sub(q2, None)
    _cleanup()
