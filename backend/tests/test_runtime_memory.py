"""R372：进程内存驻留加固——SQLite 连接页缓存收敛到 mmap、冷启动静默期推迟重任务、治理扫描流式迭代。"""
from app import db, main


def test_conn_pragmas_favor_shared_mmap_over_heap_cache():
    conn = db.get_conn()
    assert conn.execute("PRAGMA cache_size").fetchone()[0] == db.SQLITE_CACHE_KIB == -8192
    assert conn.execute("PRAGMA mmap_size").fetchone()[0] == db.SQLITE_MMAP_BYTES == 1 << 30


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
