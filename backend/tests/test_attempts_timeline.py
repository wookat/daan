"""R544：/api/attempts 历次作答合并复习作答——生产实测：错题完成今日复习后，卡片「历次作答」仍只见初次练习错答

（review_log 与 answer_log 分表）。合并后 source=practice|review；练习连带推进的 review_log 行不重复计。"""
import time

from app import db
from tests.conftest import seed_questions

PFX = "test-r544-att-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "answer_log", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao", "question_type": "单选题",
        "question_text": f"R544 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_review_answers_appear_in_attempts_with_source(client):
    _cleanup()
    uid = PFX + "merge"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)
    r = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": qid, "correct": False, "picked": "B", "secs": 12}]})
    assert r.status_code == 200
    time.sleep(0.01)
    r = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True, "picked": "A", "secs": 7})
    assert r.status_code == 200 and r.json()["streak"] == 1

    items = client.get(f"/api/attempts?uid={uid}&question_id={qid}").json()["items"]
    assert [(i["source"], bool(i["correct"]), i["picked"]) for i in items] == [
        ("review", True, "A"),
        ("practice", False, "B"),
    ]
    assert items[0]["secs"] == 7 and items[1]["secs"] == 12
    assert items[0]["created_at"] >= items[1]["created_at"]
    _cleanup()


def test_answer_log_driven_advance_not_double_counted(client):
    _cleanup()
    uid = PFX + "dedupe"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)
    r = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": qid, "mid": mid, "correct": True, "picked": "A"}]})
    assert r.json()["reviewed"][0]["mistake_id"] == mid
    conn = db.get_conn()
    via = conn.execute("SELECT via FROM review_log WHERE uid=? AND mistake_id=?", (uid, mid)).fetchone()["via"]
    conn.close()
    assert via == "answer"
    items = client.get(f"/api/attempts?uid={uid}&question_id={qid}").json()["items"]
    assert [i["source"] for i in items] == ["practice"]
    _cleanup()


def test_legacy_review_rows_without_via_dedupe_by_time(client):
    _cleanup()
    uid = PFX + "legacy"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)
    now = time.time()
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs, picked, probe) VALUES (?,?,?,?,?,?,?,0)",
        (uid, now - 100, qid, "ziliao", 1, 5, "A"),
    )
    # 历史行：练习连带推进（无 via，与练习作答同秒）→ 去重；独立复习（相隔 60s）→ 计入
    conn.execute("INSERT INTO review_log (uid, mistake_id, correct, created_at) VALUES (?,?,?,?)", (uid, mid, 1, now - 99.5))
    conn.execute("INSERT INTO review_log (uid, mistake_id, correct, created_at) VALUES (?,?,?,?)", (uid, mid, 0, now - 40))
    conn.commit()
    conn.close()
    items = client.get(f"/api/attempts?uid={uid}&question_id={qid}").json()["items"]
    assert [(i["source"], bool(i["correct"]), i["picked"]) for i in items] == [
        ("review", False, None),
        ("practice", True, "A"),
    ]
    _cleanup()


def test_review_secs_and_picked_are_sanitized(client):
    _cleanup()
    uid = PFX + "sanitize"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)
    r = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": False, "picked": " d,b ", "secs": True})
    assert r.status_code == 200
    items = client.get(f"/api/attempts?uid={uid}&question_id={qid}").json()["items"]
    assert items == [{**items[0], "source": "review", "picked": "BD", "secs": None}]
    _cleanup()


def test_review_secs_upper_clamp(client):
    # R546：复习 secs 客户端上限 1h，服务端兜底 86400（超大/非有限值不得 500）
    _cleanup()
    uid = PFX + "clamp"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)
    r = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True, "secs": 10**12})
    assert r.status_code == 200
    r = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True, "secs": 5.7})
    assert r.status_code == 200
    items = client.get(f"/api/attempts?uid={uid}&question_id={qid}").json()["items"]
    assert [a["secs"] for a in items] == [5, 86400]
    _cleanup()


def test_mistakes_list_carries_review_streak(client):
    # R546：列表卡「连对 n/6」消费 /api/mistakes 的 review_streak（连对+1 / 答错清零）
    _cleanup()
    uid = PFX + "streak"
    (qid,) = seed_questions(1, ("ziliao",))[:1]
    mid = _mistake(client, uid, qid)

    def row():
        return next(m for m in client.get(f"/api/mistakes?uid={uid}").json()["items"] if m["id"] == mid)

    assert row()["review_streak"] == 0
    client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True})
    client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True})
    assert row()["review_streak"] == 2
    client.post(f"/api/review/{mid}", json={"uid": uid, "correct": False})
    assert row()["review_streak"] == 0
    _cleanup()
