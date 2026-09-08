"""R541：/api/review/{mid} 回包 mastered 契约锁——H5/小程序复习卡据此显示「已掌握，移出复习计划」并停止显示「下次复习」。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-r541-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def test_review_record_returns_mastered_and_leaves_due_queue(client):
    _cleanup()
    uid = PFX + "m"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": q1, "module": "ziliao", "question_type": "单选题",
        "question_text": f"R541 题干 {q1}", "user_answer": "B", "correct_answer": "A",
    })
    mid = r.json()["id"]
    n = len(db.REVIEW_INTERVALS_DAYS)
    for i in range(1, n + 1):
        body = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True}).json()
        assert set(body) == {"streak", "next_review_days", "mastered"}
        assert body["streak"] == i and body["mastered"] is False
        assert body["next_review_days"] == db.REVIEW_INTERVALS_DAYS[i - 1]
    body = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True}).json()
    assert body == {"streak": n + 1, "next_review_days": db.REVIEW_INTERVALS_DAYS[-1], "mastered": True}
    # 已掌握行不再进到期队列（前端「移出复习计划」文案的依据）
    conn = db.get_conn()
    conn.execute("UPDATE mistakes SET next_review=0 WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    assert mid not in [x["id"] for x in db.due_reviews(uid=uid)]
    assert db.due_review_count(uid=uid) == 0
    _cleanup()
