"""R284：真题卷 SSR 详情页「已有 N 人模考 · 平均 X 分」社会证明契约。"""
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


def _seed_attempt(pid: int, uid: str, score: float):
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    conn.execute(
        "INSERT INTO exam_attempts (paper_id, uid, score, started_at, submitted_at)"
        " VALUES (?,?,?,strftime('%s','now'),strftime('%s','now'))",
        (pid, uid, score),
    )
    conn.commit()
    conn.close()


def test_no_attempts_no_social_proof(client):
    pid = _seed_paper("无人考过社会证明测试卷", seed_questions()[:3])
    html = client.get(f"/tiku/papers/{pid}").text
    assert "人模考" not in html


def test_social_proof_per_user_best_score(client):
    pid = _seed_paper("有人考过社会证明测试卷", seed_questions()[:3])
    _seed_attempt(pid, "u1", 40)
    _seed_attempt(pid, "u1", 60)  # 同人取最高分
    _seed_attempt(pid, "u2", 80)
    html = client.get(f"/tiku/papers/{pid}").text
    assert "已有 2 人模考 · 平均 70.0 分" in html
    assert db.exam_paper_social(pid) == {"n": 2, "avg": 70.0}


def test_paper_list_social_proof(client):
    """卷列表社会证明需 ≥5 个真人样本（W10-A）；同人取最高分。"""
    pid = _seed_paper("卷库列表社会证明测试卷", seed_questions()[:5])
    empty_pid = _seed_paper("卷库列表无人考过测试卷", seed_questions()[:5])
    _seed_attempt(pid, "u1", 40)
    _seed_attempt(pid, "u1", 60)  # 同人取最高分
    for u, s in (("u2", 80), ("u3", 70), ("u4", 70), ("u5", 70)):
        _seed_attempt(pid, u, s)
    db._papers_cache.clear()
    html = client.get("/tiku/papers/").text
    assert "已有 5 人模考 · 平均 70.0 分" in html
    d = client.get("/api/exam/papers?kind=zhenti").json()
    by_id = {p["id"]: p for p in d["items"]}
    assert by_id[pid]["takers"] == 5 and by_id[pid]["avg_score"] == 70.0
    assert by_id[empty_pid]["takers"] == 0 and by_id[empty_pid]["avg_score"] is None
