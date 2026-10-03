"""B2：掌握状态机 new→reviewing→mastered|sticky_wrong，跃迁收敛在 _advance_review。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-mstate-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "answer_log", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid, explanation=None):
    body = {
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"MS 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    }
    if explanation:
        body["explanation"] = explanation
    r = client.post("/api/mistakes", json=body)
    assert r.status_code == 200
    return r.json()["id"]


def _state(mid):
    conn = db.get_conn()
    r = dict(conn.execute(
        "SELECT mastery_state, wrong_review_count, review_count, mastered FROM mistakes WHERE id=?",
        (mid,),
    ).fetchone())
    conn.close()
    return r


def _review(client, uid, mid, correct):
    return client.post(f"/api/review/{mid}", json={"uid": uid, "correct": correct}).json()


def test_new_to_reviewing_to_mastered(client):
    _cleanup()
    uid = PFX + "ok"
    (q,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q)
    assert _state(mid)["mastery_state"] == "new"
    _review(client, uid, mid, True)
    assert _state(mid)["mastery_state"] == "reviewing"
    for _ in range(len(db.REVIEW_INTERVALS_DAYS)):
        _review(client, uid, mid, True)
    st = _state(mid)
    assert st["mastery_state"] == "mastered" and st["mastered"] == 1
    _cleanup()


def test_two_wrongs_become_sticky_then_correct_back_to_reviewing(client):
    _cleanup()
    uid = PFX + "sticky"
    (q,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q)
    _review(client, uid, mid, True)          # reviewing
    _review(client, uid, mid, False)         # 再错 1
    st = _state(mid)
    assert st["mastery_state"] == "reviewing" and st["wrong_review_count"] == 1
    _review(client, uid, mid, False)         # 再错 2 → 长期易错
    st = _state(mid)
    assert st["mastery_state"] == "sticky_wrong" and st["wrong_review_count"] == 2
    _review(client, uid, mid, True)          # sticky 答对 → 回 reviewing（不直接 mastered）
    st = _state(mid)
    assert st["mastery_state"] == "reviewing" and st["wrong_review_count"] == 2
    _cleanup()


def test_dup_resave_counts_as_wrong_and_turns_sticky(client):
    _cleanup()
    uid = PFX + "dup"
    (q,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q)
    assert _mistake(client, uid, q) == mid   # 去重重存 = 再错 1
    st = _state(mid)
    assert st["mastery_state"] == "reviewing" and st["wrong_review_count"] == 1
    assert _mistake(client, uid, q) == mid   # 再错 2 → sticky
    assert _state(mid)["mastery_state"] == "sticky_wrong"
    _cleanup()


def test_structured_fields_saved_and_returned(client):
    _cleanup()
    uid = PFX + "rf"
    (q,) = seed_questions(1, ("ziliao",))[:1]
    expl = (
        "【答案】B｜【方法】赋值法｜【一句话】赋值秒杀\n"
        "## 错因分析\n主要是审题不清，把合作看成单独。\n"
        "## 快解技巧\n赋总量为最小公倍数。\n"
        "## 错项击破\n- A：效率比反了\n- D：看错题干\n"
        "## 易错点\n注意不是全程。\n"
    )
    mid = _mistake(client, uid, q, explanation=expl)
    items = [m for m in client.get(f"/api/mistakes?uid={uid}").json()["items"] if m["id"] == mid]
    assert len(items) == 1
    m = items[0]
    assert "审题不清" in m["mistake_analysis"]
    assert "最小公倍数" in m["fastest_solution"]
    assert len(m["trap_items"]) == 2
    assert "不是全程" in m["review_tip"]
    assert m["error_reason"] == "粗心大意"          # 解析归类自动补齐自评标签
    assert "赋值法" in m["methods"]
    assert m["mastery_state"] == "new" and m["wrong_review_count"] == 0
    _cleanup()
