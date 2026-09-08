"""W10-A：语句绑定失败不得把写事务留在线程本地连接上（否则全站写请求 busy_timeout 后 500）。"""
import sqlite3
import threading
import time

from app import db

from .conftest import seed_questions


def _external_begin_immediate() -> tuple[bool, float]:
    """另起线程用独立连接抢写锁：残留事务会让它在 timeout 后 locked。"""
    out: dict = {}

    def run():
        t0 = time.perf_counter()
        c = sqlite3.connect(db.DB_PATH, timeout=0.5)
        try:
            c.execute("BEGIN IMMEDIATE")
            out["ok"] = True
        except sqlite3.OperationalError:
            out["ok"] = False
        finally:
            out["dt"] = time.perf_counter() - t0
            c.close()

    th = threading.Thread(target=run)
    th.start()
    th.join()
    return out["ok"], out["dt"]


def test_malformed_module_returns_400_and_releases_write_lock(client):
    qid = seed_questions()[0]
    for _ in range(3):
        t0 = time.perf_counter()
        r = client.post("/api/mistakes", json={"uid": "test-w10-rb", "question_id": qid, "module": {"a": 1}})
        assert r.status_code == 400 and r.json()["detail"] == "参数格式错误"
        assert time.perf_counter() - t0 < 1
    ok, dt = _external_begin_immediate()
    assert ok and dt < 0.5
    t0 = time.perf_counter()
    r = client.post("/api/mistakes", json={"uid": "test-w10-rb", "question_id": qid, "module": "ziliao",
                                            "user_answer": "B", "correct_answer": "A"})
    assert r.status_code == 200 and r.json()["id"]
    assert time.perf_counter() - t0 < 1


def test_get_conn_rolls_back_leftover_transaction():
    conn = db.get_conn()
    conn.execute("CREATE TABLE IF NOT EXISTS w10_tmp (k INTEGER)")
    conn.commit()
    conn.execute("INSERT INTO w10_tmp VALUES (1)")
    assert conn._conn.in_transaction
    conn2 = db.get_conn()
    assert conn2._conn is conn._conn and not conn2._conn.in_transaction
    assert conn2.execute("SELECT COUNT(*) FROM w10_tmp").fetchone()[0] == 0
    conn2.execute("DROP TABLE w10_tmp")
    conn2.commit()
    conn2.close()
