"""W10-A：卷库列表社会证明（takers/avg_score）至少 5 个真人样本才透出，低样本置 0/None。"""
import json

from app import db

from .conftest import seed_questions


def _seed_paper(title: str, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2021, "山东", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _seed_attempt(pid: int, uid: str, score: float, probe: int = 0):
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO exam_attempts (paper_id, uid, score, started_at, submitted_at, probe)"
        " VALUES (?,?,?,strftime('%s','now'),strftime('%s','now'),?)",
        (pid, uid, score, probe),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()


def _paper(client, pid: int) -> dict:
    return {p["id"]: p for p in client.get("/api/exam/papers?kind=zhenti").json()["items"]}[pid]


def test_low_sample_social_proof_hidden(client):
    pid = _seed_paper("W10 低样本社会证明卷", seed_questions()[:5])
    _seed_attempt(pid, "test-w10-soc-1", 1.3)
    p = _paper(client, pid)
    assert p["takers"] == 0 and p["avg_score"] is None
    for i in range(2, 5):
        _seed_attempt(pid, f"test-w10-soc-{i}", 60)
    _seed_attempt(pid, "test-w10-soc-probe", 100, probe=1)  # 探针不计入样本
    p = _paper(client, pid)
    assert p["takers"] == 0 and p["avg_score"] is None


def test_social_proof_shown_at_five_real_takers(client):
    pid = _seed_paper("W10 足样本社会证明卷", seed_questions()[:5])
    for i in range(5):
        _seed_attempt(pid, f"test-w10-soc5-{i}", 50 + i * 10)
    _seed_attempt(pid, "test-w10-soc5-0", 40)  # 同人取最高分，不重复计人
    p = _paper(client, pid)
    assert p["takers"] == 5 and p["avg_score"] == 70.0
