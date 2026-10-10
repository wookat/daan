"""R429：每日一练成绩探针打标（daily_set_entries.probe）——「N 人完成 / 排行榜 / 击败 X% / 名次」只算真人，
本人成绩对本人始终可见；scripts/one-off/r429_daily_set_probe_backfill.py 按库内证据回填历史行 probe=1 可还原。"""
import importlib.util
import os
import sqlite3
import time

from app import db

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "one-off", "r429_daily_set_probe_backfill.py")
_spec = importlib.util.spec_from_file_location("r429_backfill", SCRIPT)
assert _spec and _spec.loader
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)

PROBE = {"X-Kg-Probe": "1"}
UIDS = ["r429-real-a", "r429-real-b", "r429-probe-a", "r429-probe-b"]


def _reset() -> None:
    conn = db.get_conn()
    db._ensure_daily_set(conn)
    conn.execute("DELETE FROM daily_set_entries WHERE day=?", (db.cn_day(),))
    conn.commit()
    conn.close()


def _rows():
    conn = db.get_conn()
    got = {r["uid"]: r["probe"] for r in conn.execute("SELECT uid, probe FROM daily_set_entries WHERE day=?", (db.cn_day(),))}
    conn.close()
    return got


def _submit(client, uid, right, headers=None):
    r = client.post(
        "/api/daily_set/submit",
        json={"uid": uid, "date": db.cn_day(), "right": right, "total": 10, "secs": 60, "nickname": uid},
        headers=headers or {},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_submit_writes_probe_flag_and_pools_exclude_probe(client):
    _reset()
    p = _submit(client, "r429-probe-a", 10, PROBE)
    # 探针是今天第一个提交者：对自己 participants=1（本人可见），无人可比
    assert p["participants"] == 1 and p["beat_pct"] is None and p["my_rank"] == 1
    assert _rows() == {"r429-probe-a": 1}
    # 公开口径（无 uid）：探针不算人
    assert client.get("/api/daily_set").json()["stats"] == {"participants": 0, "avg_right": None}
    assert client.get("/api/daily_set/board").json()["items"] == []

    a = _submit(client, "r429-real-a", 7)
    assert _rows()["r429-real-a"] == 0
    # 真人看到的池里没有满分探针：自己是第 1 名、1 人完成
    assert a["participants"] == 1 and a["my_rank"] == 1 and a["beat_pct"] is None
    b = _submit(client, "r429-real-b", 3)
    assert b["participants"] == 2 and b["my_rank"] == 2 and b["beat_pct"] == 0
    stats = client.get("/api/daily_set").json()["stats"]
    assert stats == {"participants": 2, "avg_right": 5.0}
    board = client.get("/api/daily_set/board").json()["items"]
    assert [(r["name"], r["right"]) for r in board] == [("r429-real-a", 7), ("r429-real-b", 3)]
    # 带 uid 的榜：真人看不到探针；探针看得到自己（并入）
    board_real = client.get("/api/daily_set/board", params={"uid": "r429-real-a"}).json()["items"]
    assert [r["name"] for r in board_real] == ["r429-real-a", "r429-real-b"]
    board_probe = client.get("/api/daily_set/board", params={"uid": "r429-probe-a"}).json()["items"]
    assert [r["name"] for r in board_probe] == ["r429-probe-a", "r429-real-a", "r429-real-b"]
    # 第二个探针：池 = 真人 + 本人，不含另一探针
    p2 = _submit(client, "r429-probe-b", 5, PROBE)
    assert p2["participants"] == 3 and p2["my_rank"] == 2 and p2["beat_pct"] == 50
    _reset()


def test_seo_daily_page_counts_real_only(client):
    _reset()
    _submit(client, "r429-probe-a", 9, PROBE)
    html = client.get("/tiku/daily/").text
    assert "来做今天第 1 位完成者" in html and "今日排行榜" not in html
    _submit(client, "r429-real-a", 6)
    html = client.get("/tiku/daily/").text
    assert "今天已有 1 人完成" in html and "r429-real-a · 答对 6/10" in html and "r429-probe-a" not in html
    _reset()


def test_backfill_script_uses_in_db_evidence_and_restores(tmp_path):
    p = tmp_path / "ds.db"
    conn = sqlite3.connect(str(p))
    conn.execute(
        "CREATE TABLE daily_set_entries (day TEXT NOT NULL, uid TEXT NOT NULL, right INTEGER NOT NULL,"
        " total INTEGER NOT NULL, secs REAL, created_at REAL NOT NULL, nickname TEXT, PRIMARY KEY (day, uid))"
    )
    conn.execute("CREATE TABLE answer_log (id INTEGER PRIMARY KEY, uid TEXT, probe INTEGER)")
    now = time.time()
    entries = [
        ("2026-09-06", "umtpnhrwbzwprmwhv", 3),  # 同 uid answer_log 全 probe=1 → 标
        ("2026-09-06", "test-w9-daily", 8),  # 内部命名 → 标
        ("2026-09-06", "umsrealuser000001", 6),  # answer_log 有 probe=0 → 不动
        ("2026-09-05", "umsunknownnull001", 5),  # answer_log 只有 NULL → 不动
        ("2026-09-05", "umsnolog000000001", 4),  # 无 answer_log → 不动
    ]
    for day, uid, right in entries:
        conn.execute(
            "INSERT INTO daily_set_entries (day, uid, right, total, secs, created_at) VALUES (?,?,?,?,?,?)",
            (day, uid, right, 10, 50.0, now),
        )
    for uid, probe in [
        ("umtpnhrwbzwprmwhv", 1), ("umtpnhrwbzwprmwhv", 1),
        ("umsrealuser000001", 1), ("umsrealuser000001", 0),
        ("umsunknownnull001", None),
    ]:
        conn.execute("INSERT INTO answer_log (uid, probe) VALUES (?,?)", (uid, probe))
    conn.commit()
    keys = rb.scan(conn)  # dry-run 不加列
    assert "probe" not in {r[1] for r in conn.execute("PRAGMA table_info(daily_set_entries)")}
    assert keys == [("2026-09-06", "umtpnhrwbzwprmwhv"), ("2026-09-06", "test-w9-daily")]
    rec = str(tmp_path / "rec.json")
    rb.apply(conn, keys, rec)
    got = dict(conn.execute("SELECT uid, probe FROM daily_set_entries").fetchall())
    assert got == {
        "umtpnhrwbzwprmwhv": 1, "test-w9-daily": 1,
        "umsrealuser000001": None, "umsunknownnull001": None, "umsnolog000000001": None,
    }
    assert rb.scan(conn) == []
    rb.restore(conn, rec)
    assert all(v is None for v in dict(conn.execute("SELECT uid, probe FROM daily_set_entries").fetchall()).values())
    conn.close()
