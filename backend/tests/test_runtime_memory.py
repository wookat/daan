"""R372：进程内存驻留加固——SQLite 连接页缓存收敛到 mmap、冷启动静默期推迟重任务、治理扫描流式迭代。"""
import os
import sqlite3

from app import db, main


def test_conn_pragmas_favor_shared_mmap_over_heap_cache():
    conn = db.get_conn()
    assert conn.execute("PRAGMA cache_size").fetchone()[0] == db.SQLITE_CACHE_KIB == -8192
    assert conn.execute("PRAGMA mmap_size").fetchone()[0] == db.SQLITE_MMAP_BYTES == 1 << 30
    assert conn.execute("PRAGMA journal_size_limit").fetchone()[0] == db.SQLITE_WAL_LIMIT_BYTES == 64 << 20


def test_wal_file_truncated_back_to_limit_after_reset(tmp_path):
    """R435：一次性大写入把 -wal 撑大后，被动 checkpoint 回填 + 下一次写入触发 WAL 重置时应把文件截回上限；
    不设上限的对照连接文件长度永久停在峰值。"""

    def burst(name, limit):
        path = tmp_path / name
        conn = sqlite3.connect(path, isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA wal_autocheckpoint=0")
        if limit is not None:
            conn.execute(f"PRAGMA journal_size_limit={limit}")
        conn.execute("CREATE TABLE t(x)")
        conn.execute("BEGIN")
        conn.executemany("INSERT INTO t VALUES(?)", (("x" * 4000,) for _ in range(2000)))
        conn.execute("COMMIT")
        wal = str(path) + "-wal"
        peak = os.path.getsize(wal)
        conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
        assert os.path.getsize(wal) == peak
        conn.execute("INSERT INTO t VALUES('y')")
        return peak, os.path.getsize(wal)

    limit = 1 << 20
    peak, after = burst("limited.db", limit)
    assert peak > 4 * limit
    assert after <= limit
    peak, after = burst("unbounded.db", None)
    assert after == peak


def test_boot_quiet_gate_defers_heavy_startup_work():
    assert main.BOOT_QUIET_S == 600
    assert not main.boot_quiet_elapsed(main.BOOT_TS)
    assert not main.boot_quiet_elapsed(main.BOOT_TS + main.BOOT_QUIET_S - 1)
    assert main.boot_quiet_elapsed(main.BOOT_TS + main.BOOT_QUIET_S)


def test_governance_scan_streams_rows(monkeypatch):
    """全表扫描不再 fetchall：游标迭代到 100 条问题题即止，结果契约不变。"""
    from tests.conftest import seed_questions

    seed_questions(3)
    called = {"fetchall": 0}

    class _Cur:
        def __init__(self, cur):
            self._cur = cur

        def __iter__(self):
            return iter(self._cur)

        def fetchone(self):
            return self._cur.fetchone()

        def fetchall(self):
            called["fetchall"] += 1
            return self._cur.fetchall()

    class _Conn:
        def __init__(self, conn):
            self._conn = conn

        def execute(self, sql, *a):
            cur = self._conn.execute(sql, *a)
            return _Cur(cur) if "FROM questions" in sql and "LIMIT 200000" in sql else cur

        def __getattr__(self, name):
            return getattr(self._conn, name)

    real_get_conn = db.get_conn
    monkeypatch.setattr(db, "get_conn", lambda: _Conn(real_get_conn()))
    out = db._governance_scan_uncached()
    assert called["fetchall"] == 0
    assert set(out) >= {"broken", "clones", "answer_dist", "missing_explanation", "generated_at"}
    assert isinstance(out["answer_dist"]["overall"], dict)
