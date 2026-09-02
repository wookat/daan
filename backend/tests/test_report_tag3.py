"""exam report items 透出 tag3：报告解析浮层逐题「练同类题」CTA 数据来源（R313）。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("R313报告tag3测试卷", "zhenti", 2023, "江苏", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def test_exam_report_items_expose_tag3(client):
    qids = seed_questions()[:5]
    conn = db.get_conn()
    conn.execute("UPDATE questions SET tag3=? WHERE id=?", ("增长率计算", qids[0]))
    conn.execute("UPDATE questions SET tag3=NULL WHERE id=?", (qids[1],))
    conn.commit()
    conn.close()
    pid = _seed_paper(qids)
    uid = "test-tag3-u1"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    d = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    it = next(x for x in d["items"] if x["question_id"] == qids[0])
    assert it["tag3"] == "增长率计算"
    it2 = next(x for x in d["items"] if x["question_id"] == qids[1])
    assert "tag3" in it2 and it2["tag3"] is None
    conn = db.get_conn()
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
