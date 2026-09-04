"""R371：任意场次答对曾错题 → /api/answer_log 服务端推进该错题复习计划（与 /api/review 同一套 SRS）。"""
from app import db
from tests.conftest import seed_questions

PFX = "test-r371-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "answer_log", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid, text="R371 题干"):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"{text} {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def _row(mid):
    conn = db.get_conn()
    r = dict(conn.execute("SELECT review_count, review_streak, next_review, mastered FROM mistakes WHERE id=?", (mid,)).fetchone())
    r["logs"] = conn.execute("SELECT COUNT(*) n FROM review_log WHERE mistake_id=?", (mid,)).fetchone()["n"]
    conn.close()
    return r


def test_correct_answer_advances_open_mistake(client):
    _cleanup()
    uid = PFX + "adv"
    q1, q2 = seed_questions(2, ("ziliao",))[:2]
    mid = _mistake(client, uid, q1)
    assert _row(mid)["review_count"] == 0
    r = client.post("/api/answer_log", json={"uid": uid, "items": [
        {"qid": q1, "correct": True, "picked": "A", "source": "2024-国考-地市"},
        {"qid": q2, "correct": True, "picked": "A"},   # 不是错题 → 不推进
    ]})
    assert r.status_code == 200
    d = r.json()
    assert d["saved"] == 2
    assert d["reviewed"] == [{"mistake_id": mid, "streak": 1, "mastered": False}]
    row = _row(mid)
    assert row["review_count"] == 1 and row["review_streak"] == 1 and row["mastered"] == 0 and row["logs"] == 1
    assert row["next_review"] > db.time.time() + 0.5 * 86400   # 下次复习 1 天后
    _cleanup()


def test_wrong_answer_does_not_advance(client):
    _cleanup()
    uid = PFX + "wrong"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q1)
    d = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": q1, "correct": False, "picked": "C"}]}).json()
    assert d == {"saved": 1, "reviewed": []}
    assert _row(mid)["review_count"] == 0 and _row(mid)["logs"] == 0
    _cleanup()


def test_uid_isolation_and_mastered_skipped(client):
    _cleanup()
    uid, other = PFX + "iso", PFX + "iso-other"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q1)
    # 别人答对同一题不动我的错题
    assert client.post("/api/answer_log", json={"uid": other, "items": [{"qid": q1, "correct": True}]}).json()["reviewed"] == []
    assert _row(mid)["review_count"] == 0
    # 已掌握的不再推进
    conn = db.get_conn()
    conn.execute("UPDATE mistakes SET mastered=1 WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    assert client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": q1, "correct": True}]}).json()["reviewed"] == []
    assert _row(mid)["review_count"] == 0
    _cleanup()


def test_mid_locates_textual_mistake_and_dedup_in_batch(client):
    _cleanup()
    uid = PFX + "mid"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, None, text="无题号错题")   # question_id 为空（文本匹配型）
    d = client.post("/api/answer_log", json={"uid": uid, "items": [
        {"qid": q1, "correct": True, "mid": mid},
        {"qid": q1, "correct": True, "mid": mid},   # 同批同一错题只推进一次
        {"qid": q1, "correct": True, "mid": 999999999},   # 不存在的 mid 且题号无错题 → 忽略
    ]}).json()
    assert d["saved"] == 3
    assert [x["mistake_id"] for x in d["reviewed"]] == [mid]
    assert _row(mid)["review_count"] == 1 and _row(mid)["logs"] == 1
    # 越权 mid（别人的错题）不推进
    other_mid = _mistake(client, PFX + "mid-other", q1)
    d = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": q1, "correct": True, "mid": other_mid}]}).json()
    assert d["reviewed"] == [] and _row(other_mid)["review_count"] == 0
    _cleanup()


def test_streak_reaches_mastered_same_as_review_api(client):
    _cleanup()
    uid = PFX + "master"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q1)
    last = None
    for _ in range(len(db.REVIEW_INTERVALS_DAYS) + 1):
        last = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": q1, "correct": True}]}).json()["reviewed"]
    assert last == [{"mistake_id": mid, "streak": 6, "mastered": True}]
    row = _row(mid)
    assert row["mastered"] == 1 and row["review_count"] == 6 and row["logs"] == 6
    # 再答错 → save_mistake 去重路径重置 streak/mastered（既有行为，构成对称闭环）
    _mistake(client, uid, q1)
    row = _row(mid)
    assert row["mastered"] == 0 and row["review_streak"] == 0
    _cleanup()


def test_save_answer_log_int_contract_and_exam_path(client):
    """save_answer_log 仍返回 int（exam_api/team 调用方契约），且其内部同样推进。"""
    _cleanup()
    uid = PFX + "int"
    (q1,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, q1)
    assert db.save_answer_log(uid, [{"qid": q1, "correct": True}, "junk"]) == 1
    assert _row(mid)["review_count"] == 1
    _cleanup()
