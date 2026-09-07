"""R419：`ensure_weekly_event` 并发首请求各插一行（生产 8 行「第5期」）——存在性检查与 INSERT 同在
BEGIN IMMEDIATE 内 + (series, open_at, close_at) 唯一索引；scripts/r419_dedupe_mock_events.py 去重可还原。"""
import importlib.util
import os
import sqlite3
import threading
import time

from app import db, deps, mock_event

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r419_dedupe_mock_events.py")
_spec = importlib.util.spec_from_file_location("r419_dedupe", SCRIPT)
assert _spec and _spec.loader
dd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dd)


def _window_rows(conn, open_at, close_at):
    return conn.execute(
        "SELECT id, title FROM mock_events WHERE open_at=? AND close_at=? ORDER BY id", (open_at, close_at)
    ).fetchall()


def test_ensure_weekly_event_concurrent_first_requests_insert_once(client, monkeypatch):
    mock_event.init_mock_event_db()
    open_at, close_at = mock_event._saturday_window(time.time())
    conn = db.get_conn()
    conn.execute("DELETE FROM mock_events WHERE open_at=? AND close_at=?", (open_at, close_at))
    conn.commit()
    conn.close()

    n = 8
    gate = threading.Barrier(n)

    def slow_pick(_conn):
        gate.wait(timeout=5)     # 所有线程都过了无锁存在性检查后才继续
        time.sleep(0.05)
        return 1

    monkeypatch.setattr(mock_event, "_pick_paper_id", slow_pick)
    errs: list[BaseException] = []

    def run():
        try:
            mock_event.ensure_weekly_event()
        except BaseException as e:
            errs.append(e)

    ts = [threading.Thread(target=run) for _ in range(n)]
    for t in ts:
        t.start()
    for t in ts:
        t.join(timeout=10)
    assert not errs, errs

    conn = db.get_conn()
    rows = _window_rows(conn, open_at, close_at)
    assert len(rows) == 1, rows
    idx = {r[1] for r in conn.execute("PRAGMA index_list(mock_events)")}
    assert mock_event.WINDOW_INDEX in idx
    conn.close()


def test_admin_create_duplicate_window_409(client, monkeypatch):
    monkeypatch.setattr(deps, "ADMIN_TOKEN", "t0ken")
    mock_event.init_mock_event_db()
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    pid = conn.execute("SELECT id FROM exam_papers ORDER BY id LIMIT 1").fetchone()
    conn.close()
    if not pid:
        pid = [db.create_mock_paper(n=5, duration_min=10)]
    body = {"title": "R419 撞窗口", "paper_id": pid[0], "open_at": 1_900_000_000, "close_at": 1_900_003_600,
            "series": "r419-test"}
    hdr = {"X-Admin-Token": "t0ken"}
    r1 = client.post("/api/admin/mock/events", json=body, headers=hdr)
    assert r1.status_code == 200, r1.text
    r2 = client.post("/api/admin/mock/events", json=body, headers=hdr)
    assert r2.status_code == 409, r2.text
    conn = db.get_conn()
    conn.execute("DELETE FROM mock_events WHERE series='r419-test'")
    conn.commit()
    conn.close()


def _tmp_db(tmp_path):
    p = str(tmp_path / "d.db")
    conn = sqlite3.connect(p)
    conn.executescript(
        """CREATE TABLE mock_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, series TEXT,
             paper_id INTEGER NOT NULL, open_at REAL NOT NULL, close_at REAL NOT NULL, created_at REAL NOT NULL);
           CREATE TABLE mock_event_entries (event_id INTEGER NOT NULL, uid TEXT NOT NULL, registered_at REAL,
             attempt_id INTEGER, score REAL, rank INTEGER, nickname TEXT, PRIMARY KEY (event_id, uid));"""
    )
    rows = [
        (1, "全站模考大赛 第1期", "weekly", 81, 100.0, 200.0, 90.0),
        (3, "全站模考大赛 第2期", "weekly", 98, 300.0, 400.0, 290.0),
        (8, "全站模考大赛 第5期", "weekly", 95, 500.0, 600.0, 490.0),
        (9, "全站模考大赛 第5期", "weekly", 83, 500.0, 600.0, 490.1),
        (10, "全站模考大赛 第5期", "weekly", 112, 500.0, 600.0, 490.2),
        (11, "全站模考大赛 第5期", "weekly", 88, 500.0, 600.0, 490.3),
    ]
    conn.executemany("INSERT INTO mock_events VALUES (?,?,?,?,?,?,?)", rows)
    conn.execute("INSERT INTO mock_event_entries (event_id, uid, registered_at, attempt_id) VALUES (3,'u15',295,0)")
    conn.commit()
    return conn


def test_dedupe_script_keeps_entry_row_apply_restore(tmp_path):
    conn = _tmp_db(tmp_path)
    # 组内有登记的行优先保留：给 10 加一条登记
    conn.execute("INSERT INTO mock_event_entries (event_id, uid, registered_at, attempt_id) VALUES (10,'ux',505,0)")
    conn.commit()
    hit = dd.scan(conn)
    assert hit["keep"] == [10] and [r["id"] for r in hit["delete"]] == [8, 9, 11] and hit["skipped"] == 0
    plan = dd.renumber_plan(conn, {8, 9, 11})
    assert plan == [{"id": 10, "old": "全站模考大赛 第5期", "new": "全站模考大赛 第3期"}]
    # dry-run 零写入
    assert conn.execute("SELECT COUNT(*) FROM mock_events").fetchone()[0] == 6

    rec = str(tmp_path / "rec.json")
    dd.apply(conn, hit, plan, rec)
    assert conn.execute("SELECT id, title FROM mock_events ORDER BY id").fetchall() == [
        (1, "全站模考大赛 第1期"), (3, "全站模考大赛 第2期"), (10, "全站模考大赛 第3期")]
    assert conn.execute("SELECT COUNT(*) FROM mock_event_entries").fetchone()[0] == 2
    # 唯一索引已建：再插同窗口报错
    try:
        conn.execute("INSERT INTO mock_events VALUES (99,'x','weekly',1,500.0,600.0,1)")
        raise AssertionError("唯一索引未生效")
    except sqlite3.IntegrityError:
        conn.rollback()
    # 幂等
    assert dd.scan(conn)["delete"] == []

    dd.restore(conn, rec)
    assert conn.execute("SELECT id, title, paper_id FROM mock_events ORDER BY id").fetchall() == [
        (1, "全站模考大赛 第1期", 81), (3, "全站模考大赛 第2期", 98), (8, "全站模考大赛 第5期", 95),
        (9, "全站模考大赛 第5期", 83), (10, "全站模考大赛 第5期", 112), (11, "全站模考大赛 第5期", 88)]
    assert "idx_mock_events_window" not in {r[1] for r in conn.execute("PRAGMA index_list(mock_events)")}
    conn.close()


def test_dedupe_script_skips_group_with_two_entry_rows(tmp_path):
    conn = _tmp_db(tmp_path)
    conn.executemany("INSERT INTO mock_event_entries (event_id, uid, registered_at, attempt_id) VALUES (?,?,?,?)",
                     [(8, "ua", 505, 0), (9, "ub", 506, 0)])
    conn.commit()
    hit = dd.scan(conn)
    assert hit["skipped"] == 1 and hit["delete"] == []
    conn.close()


def test_dedupe_script_default_keeps_min_id_no_renumber(tmp_path):
    conn = _tmp_db(tmp_path)
    hit = dd.scan(conn)
    assert hit["keep"] == [8] and [r["id"] for r in hit["delete"]] == [9, 10, 11]
    dd.apply(conn, hit, [], str(tmp_path / "rec.json"))
    assert conn.execute("SELECT id, title FROM mock_events ORDER BY id").fetchall() == [
        (1, "全站模考大赛 第1期"), (3, "全站模考大赛 第2期"), (8, "全站模考大赛 第5期")]
    conn.close()
