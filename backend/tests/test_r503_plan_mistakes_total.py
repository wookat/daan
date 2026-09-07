"""R503：daily_plan 带 mistakes_total（本 uid 全部错题数，含已掌握）——首页「错题复习」任务只对有过错题的用户算清零。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-r503-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    conn.execute("DELETE FROM mistakes WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"R503 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_fresh_uid_has_zero_mistakes_total_and_zero_due(client):
    _cleanup()
    uid = PFX + "fresh"
    plan = client.get(f"/api/daily_plan?uid={uid}").json()
    assert plan["due_mistakes"] == 0
    assert plan["mistakes_total"] == 0
    bundle = client.get(f"/api/home_bundle?uid={uid}").json()
    assert bundle["plan"]["mistakes_total"] == 0


def test_mistakes_total_counts_mastered_and_is_uid_isolated(client):
    _cleanup()
    qids = seed_questions(2, modules=("ziliao",))
    uid, other = PFX + "a", PFX + "b"
    m1 = _mistake(client, uid, qids[0])
    _mistake(client, uid, qids[1])
    _mistake(client, other, qids[0])
    r = client.patch(f"/api/mistakes/{m1}", json={"uid": uid, "mastered": True})
    assert r.status_code == 200
    plan = client.get(f"/api/daily_plan?uid={uid}").json()
    assert plan["mistakes_total"] == 2
    assert plan["due_mistakes"] == 1
    assert client.get(f"/api/daily_plan?uid={other}").json()["mistakes_total"] == 1
    _cleanup()
