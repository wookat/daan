"""R374：探针出口网段（KG_PROBE_CIDRS）流量入库侧打标，运营看板只算真人。"""
import ipaddress
import sqlite3
import time

import pytest

from app import auth, db
from tests.conftest import seed_questions

PFX = "test-r374-"


@pytest.fixture
def probe_nets(monkeypatch):
    monkeypatch.setattr(auth, "PROBE_NETS", auth.parse_cidrs("140.232.64.0/24, 10.9.8.7"))


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    for t in ("answer_log", "growth_events"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _col(table, uid, col="probe"):
    conn = db.get_conn()
    rows = [r[col] for r in conn.execute(f"SELECT {col} FROM {table} WHERE uid=?", (uid,))]
    conn.close()
    return rows


def test_parse_cidrs_skips_invalid_and_matches_range():
    nets = auth.parse_cidrs(" 140.232.64.0/24 ,bogus, 1.2.3.4 ,, 2001:db8::/32")
    assert nets == [
        ipaddress.ip_network("140.232.64.0/24"),
        ipaddress.ip_network("1.2.3.4/32"),
        ipaddress.ip_network("2001:db8::/32"),
    ]
    assert auth.ip_in_nets("140.232.64.5", nets)
    assert auth.ip_in_nets("140.232.64.2", nets)
    assert auth.ip_in_nets("1.2.3.4", nets)
    assert not auth.ip_in_nets("140.232.65.1", nets)
    assert not auth.ip_in_nets("anon", nets)
    assert not auth.ip_in_nets("", nets)


def test_empty_config_never_tags():
    assert auth.parse_cidrs("") == []
    assert not auth.ip_in_nets("140.232.64.5", [])


def test_track_tags_probe_by_x_kg_ip(client, probe_nets):
    _cleanup()
    r = client.post("/api/track", json={"event": "boot", "uid": PFX + "t1", "source": "h5"},
                    headers={"X-Kg-Ip": "140.232.64.3"})
    assert r.status_code == 200
    r = client.post("/api/track", json={"event": "boot", "uid": PFX + "t2", "source": "h5"},
                    headers={"X-Kg-Ip": "39.158.40.85"})
    assert r.status_code == 200
    assert _col("growth_events", PFX + "t1") == [1]
    assert _col("growth_events", PFX + "t2") == [0]


def test_answer_log_tags_probe_and_keeps_user_facing_semantics(client, probe_nets):
    _cleanup()
    q1, q2 = seed_questions(2, ("ziliao",))[:2]
    uid_p, uid_r = PFX + "a1", PFX + "a2"
    r = client.post("/api/answer_log", json={"uid": uid_p, "items": [{"qid": q1, "correct": True}, {"qid": q2, "correct": False}]},
                    headers={"X-Kg-Ip": "140.232.64.5"})
    assert r.status_code == 200 and r.json()["saved"] == 2
    r = client.post("/api/answer_log", json={"uid": uid_r, "items": [{"qid": q1, "correct": True}]},
                    headers={"X-Kg-Ip": "8.8.8.8"})
    assert r.status_code == 200 and r.json()["saved"] == 1
    assert _col("answer_log", uid_p) == [1, 1]
    assert _col("answer_log", uid_r) == [0]
    # 探针 uid 自己的练习记录不受影响（打标只影响运营口径）
    hist = db.practice_history(uid_p)
    assert len(hist) == 1 and hist[0]["n"] == 2 and hist[0]["correct"] == 1


def test_paper_answers_tags_probe(client, probe_nets):
    _cleanup()
    qids = seed_questions(2, ("ziliao",))[:2]
    db.save_paper_export("R374PRB", qids, "R374 探针卷")
    r = client.post("/api/paper_answers",
                    json={"code": "R374PRB", "uid": PFX + "paper", "picks": {"1": "A", "2": "B"}},
                    headers={"X-Kg-Ip": "140.232.64.5"})
    assert r.status_code == 200
    assert _col("answer_log", PFX + "paper") == [1, 1]


def test_answer_log_without_config_writes_zero(client):
    _cleanup()
    q1 = seed_questions(1, ("ziliao",))[0]
    r = client.post("/api/answer_log", json={"uid": PFX + "a0", "items": [{"qid": q1, "correct": True}]},
                    headers={"X-Kg-Ip": "140.232.64.5"})
    assert r.status_code == 200
    assert _col("answer_log", PFX + "a0") == [0]


def test_dashboard_excludes_probe_rows_and_reports_count(client, probe_nets):
    _cleanup()
    q1 = seed_questions(1, ("ziliao",))[0]
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("DELETE FROM answer_log")
    conn.commit()
    conn.close()
    for i in range(3):
        client.post("/api/answer_log", json={"uid": f"{PFX}p{i}", "items": [{"qid": q1, "correct": True}]},
                    headers={"X-Kg-Ip": "140.232.64.4"})
    client.post("/api/answer_log", json={"uid": PFX + "real", "items": [{"qid": q1, "correct": True}, {"qid": q1, "correct": False}]},
                headers={"X-Kg-Ip": "39.158.40.85"})
    d = db._admin_dashboard_uncached()
    assert d["today"]["active"] == 1
    assert d["today"]["answered"] == 2
    assert d["today"]["correct"] == 1
    assert d["today"]["new_users"] == 1
    assert d["today"]["probe_excluded"] == 3
    assert d["yesterday"]["probe_excluded"] == 0
    assert d["trend"] and d["trend"][-1]["answered"] == 2 and d["trend"][-1]["active"] == 1
    assert d["acc7"] == [{"module": "ziliao", "n": 2, "acc": 50.0}]
    _cleanup()


def test_dashboard_treats_legacy_null_probe_as_real(client):
    _cleanup()
    q1 = seed_questions(1, ("ziliao",))[0]
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("DELETE FROM answer_log")
    conn.execute(
        "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs, probe) VALUES (?,?,?,?,?,?,NULL)",
        (PFX + "legacy", time.time(), q1, "ziliao", 1, 0),
    )
    conn.commit()
    conn.close()
    d = db._admin_dashboard_uncached()
    assert d["today"]["active"] == 1 and d["today"]["answered"] == 1 and d["today"]["probe_excluded"] == 0
    _cleanup()


def test_add_column_tolerates_concurrent_duplicate():
    """两个连接各自看到列缺失后同时 ALTER：后到者的 duplicate column 不得抛 500。"""
    a = sqlite3.connect(":memory:")
    a.row_factory = sqlite3.Row
    a.execute("CREATE TABLE t (id INTEGER)")
    assert db.add_column_if_missing(a, "t", "probe", "INTEGER") is True
    assert db.add_column_if_missing(a, "t", "probe", "INTEGER") is False

    class _Racy:
        """PRAGMA 返回旧快照（无 probe 列），ALTER 走真实连接 → 必碰 duplicate column。"""

        def execute(self, sql, *args):
            if sql.startswith("PRAGMA"):
                return [{"name": "id"}]
            return a.execute(sql, *args)

    assert db.add_column_if_missing(_Racy(), "t", "probe", "INTEGER") is False
    with pytest.raises(sqlite3.OperationalError):
        db.add_column_if_missing(_Racy(), "nope", "probe", "INTEGER")


def test_probe_column_migration_idempotent():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_answer_log(conn)
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(answer_log)")}
    ge = {r["name"] for r in conn.execute("PRAGMA table_info(growth_events)")}
    conn.close()
    assert "probe" in cols and "probe" in ge
