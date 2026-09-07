"""R404：写事务以 BEGIN IMMEDIATE 起头——DEFERRED 事务内先读后写，遇他连接提交即刻
SQLITE_BUSY（快照无法升级，busy_timeout 不介入）；先拿写锁则正常排队等待。"""
import os
import sqlite3
import threading
import time

from app import db


def test_get_conn_opens_write_txn_with_begin_immediate():
    conn = db.get_conn()
    seen = []
    conn._conn.set_trace_callback(lambda sql: seen.append(sql.strip().upper()))
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS _r404_probe (v INTEGER)")
        conn.execute("INSERT INTO _r404_probe (v) VALUES (1)")
        conn.rollback()
    finally:
        conn._conn.set_trace_callback(None)
    begins = [s for s in seen if s.startswith("BEGIN")]
    assert begins and all(s == "BEGIN IMMEDIATE" for s in begins), seen


def _scratch(path, isolation_level):
    c = sqlite3.connect(path, timeout=30, check_same_thread=False, isolation_level=isolation_level)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=5000")
    return c


def _read_then_write_racing_commit(path, isolation_level):
    """事务内先 SELECT 再 INSERT，期间另一连接持写锁并在 0.2s 后提交。"""
    conn = _scratch(path, isolation_level)
    holder = _scratch(path, "")
    holder.execute("INSERT INTO t (v) VALUES ('held')")  # 隐式 BEGIN，持写锁未提交
    t = threading.Thread(target=lambda: (time.sleep(0.2), holder.commit(), holder.close()))
    t.start()
    try:
        conn.execute("BEGIN" if isolation_level == "" else "BEGIN IMMEDIATE")
        conn.execute("SELECT COUNT(*) FROM t").fetchall()
        conn.execute("INSERT INTO t (v) VALUES ('x')")
        conn.commit()
        return None
    except sqlite3.OperationalError as e:
        conn.rollback()
        return e
    finally:
        t.join()
        conn.close()


def test_deferred_snapshot_upgrade_fails_immediate_waits(tmp_path):
    path = os.path.join(str(tmp_path), "r404.db")
    init = _scratch(path, None)
    init.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    init.close()

    err = _read_then_write_racing_commit(path, "")
    assert err is not None and "database is locked" in str(err)
    assert err.sqlite_errorcode == sqlite3.SQLITE_BUSY

    assert _read_then_write_racing_commit(path, "IMMEDIATE") is None
