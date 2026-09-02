"""R311：卷库 uid 合并契约补 best_attempt_id——考过的卷卡直达最好成绩报告。"""
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


def _seed_attempt(pid: int, uid: str, score: float, submitted: bool = True) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_attempts (paper_id, uid, score, started_at, submitted_at)"
        " VALUES (?,?,?,strftime('%s','now')," + ("strftime('%s','now')" if submitted else "NULL") + ")",
        (pid, uid, score),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def test_best_attempt_id_none_when_never_taken(client):
    pid = _seed_paper("未考过 best_attempt 测试卷", seed_questions()[:5])
    d = client.get("/api/exam/papers?kind=zhenti&uid=u-r311-a").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["best_score"] is None and p["attempt_count"] == 0
    assert p["best_attempt_id"] is None


def test_best_attempt_id_points_to_highest_score(client):
    pid = _seed_paper("多次模考 best_attempt 测试卷", seed_questions()[:5])
    _seed_attempt(pid, "u-r311-b", 40)
    hi = _seed_attempt(pid, "u-r311-b", 72.5)
    _seed_attempt(pid, "u-r311-b", 60)
    _seed_attempt(pid, "u-r311-b", 99, submitted=False)  # 未交卷不参与
    _seed_attempt(pid, "u-other", 100)  # 他人不串
    d = client.get("/api/exam/papers?kind=zhenti&uid=u-r311-b").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["best_score"] == 72.5 and p["attempt_count"] == 3
    assert p["best_attempt_id"] == hi


def test_best_attempt_id_tie_takes_latest(client):
    pid = _seed_paper("同分 best_attempt 测试卷", seed_questions()[:5])
    _seed_attempt(pid, "u-r311-c", 50)
    later = _seed_attempt(pid, "u-r311-c", 50)
    d = client.get("/api/exam/papers?kind=zhenti&uid=u-r311-c").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["best_score"] == 50 and p["attempt_count"] == 2
    assert p["best_attempt_id"] == later


def test_best_attempt_id_zero_score_still_linked(client):
    pid = _seed_paper("零分 best_attempt 测试卷", seed_questions()[:5])
    aid = _seed_attempt(pid, "u-r311-d", 0)
    d = client.get("/api/exam/papers?kind=zhenti&uid=u-r311-d").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["best_score"] == 0 and p["best_attempt_id"] == aid
