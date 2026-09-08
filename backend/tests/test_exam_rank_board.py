"""模考同卷排行榜：/api/exam/rank/{attempt_id} 响应 board 字段（R305）。"""
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


def _attempt(pid: int, uid: str, score: float, t: float) -> int:
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO exam_attempts (uid, paper_id, started_at, submitted_at, answers, score, per_module)"
        " VALUES (?,?,?,?,?,?,?)",
        (uid, pid, t - 60, t, "{}", score, "{}"),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def _seed_user(nickname: str) -> str:
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO users (phone, password_hash, nickname, created_at) VALUES (?,?,?,?)",
        (f"1390000{int(time.time() * 1000) % 10000:04d}", "x", nickname, time.time()),
    )
    conn.commit()
    conn.close()
    return f"u{cur.lastrowid}"


def _cleanup(pid: int):
    conn = _conn()
    conn.execute("DELETE FROM exam_attempts WHERE paper_id=?", (pid,))
    conn.execute("DELETE FROM exam_papers WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    db._papers_cache.clear()


def test_board_order_masking_and_me(client):
    pid = _seed_paper("排行榜排序脱敏测试卷")
    now = time.time()
    _attempt(pid, "test-board-anon1", 80.0, now - 30)
    # 同分：先参与者排前
    _attempt(pid, "test-board-anon2", 60.0, now - 20)
    _attempt(pid, "test-board-anon3", 60.0, now - 10)
    my = _attempt(pid, "test-board-me00", 40.0, now)
    # per-user-best：低分历史不占多行
    _attempt(pid, "test-board-anon1", 10.0, now - 5)
    d = client.get(f"/api/exam/rank/{my}?uid=test-board-me00").json()
    b = d["board"]
    assert [r["rank"] for r in b] == [1, 2, 3, 4]
    assert [r["score"] for r in b] == [80.0, 60.0, 60.0, 40.0]
    assert b[1]["name"] == db.display_alias("test-board-anon2", None)
    assert b[2]["name"] == db.display_alias("test-board-anon3", None)
    assert b[1]["name"] != b[2]["name"] and all("test-b" not in r["name"] for r in b)
    assert [r["me"] for r in b] == [False, False, False, True]
    # 既有字段不回归
    assert d["rank"] == 4 and d["total"] == 4
    _cleanup(pid)


def test_board_nickname_and_truncation(client):
    pid = _seed_paper("排行榜昵称测试卷")
    uid = _seed_user("小明冲刺2026" + "长" * 30)
    _attempt(pid, uid, 90.0, time.time() - 10)
    my = _attempt(pid, "test-board-me01", 50.0, time.time())
    d = client.get(f"/api/exam/rank/{my}?uid=test-board-me01").json()
    top = d["board"][0]
    assert top["name"].startswith("小明冲刺2026") and len(top["name"]) == 20
    conn = _conn()
    conn.execute("DELETE FROM users WHERE id=?", (int(uid[1:]),))
    conn.commit()
    conn.close()
    _cleanup(pid)


def test_board_blank_nickname_falls_back_to_masked_uid(client):
    pid = _seed_paper("排行榜空昵称测试卷")
    uid = _seed_user("  ")
    _attempt(pid, uid, 70.0, time.time() - 10)
    my = _attempt(pid, "test-board-me03", 30.0, time.time())
    d = client.get(f"/api/exam/rank/{my}?uid=test-board-me03").json()
    assert d["board"][0]["name"] == db.display_alias(uid, None) and uid not in d["board"][0]["name"]
    conn = _conn()
    conn.execute("DELETE FROM users WHERE id=?", (int(uid[1:]),))
    conn.commit()
    conn.close()
    _cleanup(pid)


def test_board_top10_cap(client):
    pid = _seed_paper("排行榜前十截断测试卷")
    now = time.time()
    for i in range(12):
        _attempt(pid, f"test-board-cap{i:02d}", 90.0 - i, now - 100 + i)
    my = _attempt(pid, "test-board-me02", 1.0, now)
    d = client.get(f"/api/exam/rank/{my}?uid=test-board-me02").json()
    assert len(d["board"]) == 10
    assert all(not r["me"] for r in d["board"])
    _cleanup(pid)
