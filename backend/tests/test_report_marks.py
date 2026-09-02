"""exam report 考中标记透出：报告网格/浮层「考中标记」数据来源（R316）。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(qids: list[int], title: str) -> int:
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


def test_exam_report_items_expose_marked(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids, "R316报告标记测试卷")
    uid = "test-r316-u1"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={
        "uid": uid, "attempt_id": aid,
        "picks": {"1": "A", "2": "B"},
        # 越界(0/99)、非法("x")、重复(2) 均应被清洗
        "marks": [2, 5, 2, 0, 99, "x", None],
    })
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    by_no = {x["no"]: x for x in d["items"]}
    assert by_no[2]["marked"] is True
    assert by_no[5]["marked"] is True
    assert by_no[1]["marked"] is False
    assert by_no[3]["marked"] is False
    # 既有字段兼容
    assert by_no[1]["picked"] == "A"
    _cleanup(uid)


def test_exam_report_old_attempt_without_marks_all_false(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids, "R316报告标记测试卷B")
    uid = "test-r316-u2"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    assert all(x["marked"] is False for x in d["items"])
    _cleanup(uid)


def test_exam_submit_marks_non_list_ignored(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids, "R316报告标记测试卷C")
    uid = "test-r316-u3"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={
        "uid": uid, "attempt_id": aid, "picks": {"1": "A"}, "marks": {"1": True},
    })
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    assert all(x["marked"] is False for x in d["items"])
    _cleanup(uid)
