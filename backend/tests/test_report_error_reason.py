"""exam report 答错题透出 mistake_id/error_reason：报告解析浮层「错因自评」数据来源（R314）。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("R314报告错因测试卷", "zhenti", 2023, "江苏", json.dumps(qids), 120),
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


def test_exam_report_wrong_items_expose_mistake_and_reason_patch(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids)
    uid = "test-r314-u1"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    # 第 1 题答错（正确答案 A）、第 2 题答对、第 3 题未答
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "B", "2": "A"}})
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    wrong = next(x for x in d["items"] if x["question_id"] == qids[0])
    assert wrong["mistake_id"] and wrong["error_reason"] is None
    right = next(x for x in d["items"] if x["question_id"] == qids[1])
    assert right["mistake_id"] is None and right["error_reason"] is None
    skipped = next(x for x in d["items"] if x["question_id"] == qids[2])
    assert skipped["mistake_id"] is None and skipped["error_reason"] is None
    # PATCH 错因后报告回读一致（与错题本同源）
    r = client.patch(f"/api/mistakes/{wrong['mistake_id']}", json={"uid": uid, "error_reason": "粗心大意"})
    assert r.status_code == 200
    d2 = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    wrong2 = next(x for x in d2["items"] if x["question_id"] == qids[0])
    assert wrong2["error_reason"] == "粗心大意"
    _cleanup(uid)


def test_mistakes_by_qids_empty_inputs():
    assert db.mistakes_by_qids("", [1]) == {}
    assert db.mistakes_by_qids("u", []) == {}
