"""exam report 逐题用时透出：报告解析浮层「本题用时」数据来源（R315）。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(qids: list[int], title: str = "R315报告用时测试卷") -> int:
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


def _cleanup(uid: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def test_exam_report_items_expose_per_question_secs(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids)
    uid = "test-r315-u1"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={
        "uid": uid, "attempt_id": aid,
        "picks": {"1": "A", "2": "B"},
        "secs": {"1": 45, "2": 80, "3": 12, "4": "bad", "5": -3},
    })
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    by_no = {x["no"]: x for x in d["items"]}
    assert by_no[1]["secs"] == 45
    assert by_no[2]["secs"] == 80
    # 未作答但浏览过的题也有用时
    assert by_no[3]["secs"] == 12
    # 非法/负数用时 fail-closed 为 null
    assert by_no[4]["secs"] is None
    assert by_no[5]["secs"] is None
    _cleanup(uid)


def test_exam_report_old_attempt_without_secs_all_null(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids, "R315报告用时测试卷B")
    uid = "test-r315-u2"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    assert all(x["secs"] is None for x in d["items"])
    _cleanup(uid)
