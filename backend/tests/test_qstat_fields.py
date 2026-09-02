"""复盘场景全站数据锚点字段透出：exam report items 与错题列表（R301）。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(title: str, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2023, "江苏", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _set_stats(qid: int, attempt_count: int, correct_ratio: float, most_wrong: str):
    conn = db.get_conn()
    db._ensure_question_stat_cols(conn)
    conn.execute(
        "UPDATE questions SET attempt_count=?, correct_ratio=?, most_wrong=? WHERE id=?",
        (attempt_count, correct_ratio, most_wrong, qid),
    )
    conn.commit()
    conn.close()


def test_exam_report_items_expose_qstat_fields(client):
    qids = seed_questions()[:5]
    _set_stats(qids[0], 12, 63.0, "B")
    pid = _seed_paper("R301报告全站数据测试卷", qids)
    uid = "test-qstat-u1"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    it = d["items"][0]
    assert it["attempt_count"] == 12
    assert it["correct_ratio"] == 63.0
    assert it["most_wrong"] == "B"
    # 无聚合数据题字段存在且为空，不伪造
    it2 = next(x for x in d["items"] if x["question_id"] == qids[1])
    assert "attempt_count" in it2 and "correct_ratio" in it2 and "most_wrong" in it2
    conn = db.get_conn()
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def test_list_mistakes_expose_qstat_fields(client):
    qids = seed_questions()[:2]
    _set_stats(qids[0], 8, 41.5, "C")
    uid = "test-qstat-u2"
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qids[0], "module": "ziliao",
        "question_text": "测试题干", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    items = client.get(f"/api/mistakes?uid={uid}").json()["items"]
    m = items[0]
    assert m["attempt_count"] == 8
    assert m["correct_ratio"] == 41.5
    assert m["most_wrong"] == "C"
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
