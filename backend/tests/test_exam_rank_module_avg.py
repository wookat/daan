"""模考报告模块级全站均值：/api/exam/rank/{attempt_id} 响应 module_avg 字段（R306）。"""
import json
import sqlite3
import time

from app import db


def _conn():
    # 独立连接：避免污染线程共享连接的 lastrowid（seed_questions 依赖它）
    c = sqlite3.connect(db.DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def _seed_paper(title: str) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    conn.close()
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2023, "江苏", json.dumps([1, 2, 3]), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _attempt(pid: int, uid: str, score: float, t: float, per_module) -> int:
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO exam_attempts (uid, paper_id, started_at, submitted_at, answers, score, per_module)"
        " VALUES (?,?,?,?,?,?,?)",
        (uid, pid, t - 60, t, "{}", score,
         per_module if isinstance(per_module, str) else json.dumps(per_module)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def _cleanup(pid: int):
    conn = _conn()
    conn.execute("DELETE FROM exam_attempts WHERE paper_id=?", (pid,))
    conn.execute("DELETE FROM exam_papers WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    db._papers_cache.clear()


def test_module_avg_per_user_best_and_mean(client):
    pid = _seed_paper("模块均值聚合测试卷")
    now = time.time()
    _attempt(pid, "test-mavg-a", 80.0, now - 30, {"yanyu": {"n": 10, "correct": 8}})
    # per-user-best：同一用户低分那次的 per_module 不计入
    _attempt(pid, "test-mavg-a", 10.0, now - 20, {"yanyu": {"n": 10, "correct": 0}})
    my = _attempt(pid, "test-mavg-me", 40.0, now, {"yanyu": {"n": 10, "correct": 4}})
    d = client.get(f"/api/exam/rank/{my}?uid=test-mavg-me").json()
    assert d["module_avg"] == {"yanyu": {"pct": 60, "n_users": 2}}
    _cleanup(pid)


def test_module_avg_hidden_below_two_users(client):
    pid = _seed_paper("模块均值单人测试卷")
    now = time.time()
    # yanyu 只有本人一个用户；shuliang 两个用户但其中一行 n=0 只剩一人 → 都不返回
    _attempt(pid, "test-mavg-b", 70.0, now - 10, {"shuliang": {"n": 0, "correct": 0}})
    my = _attempt(pid, "test-mavg-me2", 40.0, now,
                  {"yanyu": {"n": 10, "correct": 4}, "shuliang": {"n": 5, "correct": 5}})
    d = client.get(f"/api/exam/rank/{my}?uid=test-mavg-me2").json()
    assert d["module_avg"] == {}
    _cleanup(pid)


def test_module_avg_skips_malformed_rows(client):
    pid = _seed_paper("模块均值脏数据测试卷")
    now = time.time()
    _attempt(pid, "test-mavg-c1", 70.0, now - 40, "not json")
    _attempt(pid, "test-mavg-c2", 60.0, now - 30, {"yanyu": "oops"})
    _attempt(pid, "test-mavg-c3", 50.0, now - 20, {"yanyu": {"n": True, "correct": 1}})
    _attempt(pid, "test-mavg-c4", 55.0, now - 10, {"yanyu": {"n": 10, "correct": 6}})
    my = _attempt(pid, "test-mavg-me3", 40.0, now, {"yanyu": {"n": 10, "correct": 2}})
    d = client.get(f"/api/exam/rank/{my}?uid=test-mavg-me3").json()
    # 只有两行合法：60% 与 20% → 40%
    assert d["module_avg"] == {"yanyu": {"pct": 40, "n_users": 2}}
    # 既有字段不回归
    assert d["total"] == 5 and isinstance(d["board"], list)
    _cleanup(pid)
