"""R426：练习完成页「本组正确率击败了 X% 的刷题记录」——practice_results 加 uid/probe，
池只算 probe=0（该表无 uid 从未随测试账号清理，历史 NULL 行不视为真人）；探针会话不进池、不刷百分位。"""
import sqlite3

from app import db

PROBE = {"X-Kg-Probe": "1"}


def _reset() -> None:
    conn = db.get_conn()
    db._ensure_practice_results(conn)
    conn.execute("DELETE FROM practice_results")
    conn.commit()
    conn.close()


def _post(client, correct: int, uid: str | None = None, headers: dict | None = None) -> dict:
    body: dict = {"module": "ziliao", "n": 10, "correct": correct, "secs": 60}
    if uid:
        body["uid"] = uid
    r = client.post("/api/practice_result", json=body, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def test_probe_sessions_do_not_enter_pool_and_null_history_excluded(client):
    _reset()
    # 历史行（无 uid/probe，模拟加列前的旧行）——不能算真人
    conn = db.get_conn()
    for c in (10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10):
        conn.execute(
            "INSERT INTO practice_results (created_at, module, n, correct, secs) VALUES (strftime('%s','now'),?,?,?,?)",
            ("ziliao", 10, c, 60),
        )
    conn.commit()
    conn.close()
    try:
        # 探针 12 次全对：池仍为 0 → 百分位 None
        for _ in range(12):
            d = _post(client, 10, uid="test-r426-probe", headers=PROBE)
        assert d == {"percentile": None, "samples": 0}
        conn = db.get_conn()
        rows = conn.execute("SELECT uid, probe FROM practice_results WHERE uid='test-r426-probe'").fetchall()
        conn.close()
        assert len(rows) == 12 and all(r["probe"] == 1 for r in rows)

        # 真人 9 次（对 2）：不足 10 样本 → None，但 samples 按真人计
        for _ in range(9):
            d = _post(client, 2, uid="r426-real")
        assert d == {"percentile": None, "samples": 9}
        # 第 10 次全对：击败 9/10 = 90%；探针 12 次全对与 12 行历史全对均不在分母、也不抬高门槛
        d = _post(client, 10, uid="r426-real")
        assert d == {"percentile": 90, "samples": 10}
        conn = db.get_conn()
        real = conn.execute("SELECT uid, probe FROM practice_results WHERE uid='r426-real'").fetchall()
        conn.close()
        assert len(real) == 10 and all(r["probe"] == 0 for r in real)
    finally:
        _reset()


def test_uid_optional_and_truncated(client):
    _reset()
    try:
        _post(client, 5)
        _post(client, 5, uid="x" * 100)
        conn = db.get_conn()
        rows = conn.execute("SELECT uid FROM practice_results ORDER BY id").fetchall()
        conn.close()
        assert rows[0]["uid"] is None
        assert rows[1]["uid"] == "x" * 64
    finally:
        _reset()


def test_admin_stats_daily_usage_uses_real_traffic(client):
    _reset()
    try:
        _post(client, 3, uid="r426-real")
        _post(client, 10, uid="test-r426-probe", headers=PROBE)
        stats = db._admin_stats_uncached()
        assert sum(r["sessions"] for r in stats["daily_usage"]) == 1
    finally:
        _reset()


def test_ensure_practice_results_idempotent_on_fresh_table(tmp_path):
    p = tmp_path / "t.db"
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    db._ensure_practice_results(conn)
    db._ensure_practice_results(conn)
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(practice_results)")}
    assert {"uid", "probe"} <= cols
    conn.close()
