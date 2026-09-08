"""R427：PK 对局探针打标（pk_matches.probe）——随机匹配池按同类配对、周榜只算真人（本人对局始终可见）；
scripts/r427_pk_probe_backfill.py 对内部走查 uid 历史行回填 probe=1 可还原。"""
import importlib.util
import json
import os
import sqlite3
import time

from app import db

from .conftest import seed_questions

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r427_pk_probe_backfill.py")
_spec = importlib.util.spec_from_file_location("r427_backfill", SCRIPT)
assert _spec and _spec.loader
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)

PROBE = {"X-Kg-Probe": "1"}
UIDS = ["r427-real-a", "r427-real-b", "r427-probe-a", "r427-probe-b", "r427-real-c"]


def _reset() -> None:
    conn = db.get_conn()
    for u in UIDS:
        conn.execute("DELETE FROM pk_matches WHERE creator_uid=? OR opponent_uid=?", (u, u))
    conn.commit()
    conn.close()


def _row(code: str):
    conn = db.get_conn()
    m = conn.execute("SELECT * FROM pk_matches WHERE code=?", (code,)).fetchone()
    conn.close()
    return m


def _all_right(client, code: str, uid: str, headers=None, right=True) -> dict:
    m = _row(code)
    qids = json.loads(m["question_ids"])
    conn = db.get_conn()
    ans = {q["id"]: q["answer"] for q in db.questions_by_ids(qids)}
    conn.close()
    items = [{"question_id": q, "answer": ans[q] if right else "Z", "ms": 1000} for q in qids]
    r = client.post("/api/pk/submit", json={"uid": uid, "code": code, "items": items}, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()["match"]


def test_probe_written_on_create_and_join(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    real = client.post("/api/pk/create", json={"uid": "r427-real-a", "module": "yanyu"}).json()["code"]
    assert _row(real)["probe"] == 0
    probe = client.post("/api/pk/create", json={"uid": "r427-probe-a", "module": "yanyu"}, headers=PROBE).json()["code"]
    assert _row(probe)["probe"] == 1
    # 真人局被探针加入 → 任一方探针即 probe=1
    client.post("/api/pk/join", json={"uid": "r427-probe-b", "code": real}, headers=PROBE)
    assert _row(real)["probe"] == 1
    _reset()


def test_random_match_pools_are_segregated(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    # 探针发起并交卷 → 等待池里只有探针局
    pc = client.post("/api/pk/create", json={"uid": "r427-probe-a", "module": "yanyu"}, headers=PROBE).json()["code"]
    _all_right(client, pc, "r427-probe-a", PROBE)
    r = client.post("/api/pk/random_match", json={"uid": "r427-real-a", "module": "yanyu"}).json()
    assert r["matched"] is False, "真人不应被配给探针幽灵局"
    assert r["code"] != pc
    _all_right(client, r["code"], "r427-real-a")
    # 探针随机匹配只吃探针局，不消耗真人的等待局
    r2 = client.post("/api/pk/random_match", json={"uid": "r427-probe-b", "module": "yanyu"}, headers=PROBE).json()
    assert r2["matched"] is True and r2["code"] == pc
    # 真人随机匹配接到真人局
    r3 = client.post("/api/pk/random_match", json={"uid": "r427-real-b", "module": "yanyu"}).json()
    assert r3["matched"] is True and r3["code"] == r["code"]
    _reset()


def test_leaderboard_counts_real_only_but_shows_own(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    # 探针对局：probe-a 胜
    pc = client.post("/api/pk/create", json={"uid": "r427-probe-a", "module": "yanyu"}, headers=PROBE).json()["code"]
    _all_right(client, pc, "r427-probe-a", PROBE)
    client.post("/api/pk/join", json={"uid": "r427-probe-b", "code": pc}, headers=PROBE)
    m = _all_right(client, pc, "r427-probe-b", PROBE, right=False)
    assert m["status"] == "finished" and m["winner"] == "creator"
    # 真人对局：real-a 胜
    rc = client.post("/api/pk/create", json={"uid": "r427-real-a", "module": "yanyu"}).json()["code"]
    _all_right(client, rc, "r427-real-a")
    client.post("/api/pk/join", json={"uid": "r427-real-b", "code": rc})
    _all_right(client, rc, "r427-real-b", right=False)
    lb = client.get("/api/pk/leaderboard", params={"uid": "r427-real-c"}).json()
    names = {e["uid"] for e in lb["items"]}
    assert db.display_alias("r427-real-a", None) in names and lb["my_rank"] is None
    assert all(not e["uid"].startswith("r427-p") for e in lb["items"]), lb
    # 探针看自己：本人对局计入
    lb2 = client.get("/api/pk/leaderboard", params={"uid": "r427-probe-a"}).json()
    assert lb2["my_rank"] is not None and lb2["my_wins"] == 1
    _reset()


def test_backfill_script_marks_internal_uids_and_restores(tmp_path):
    p = tmp_path / "pk.db"
    conn = sqlite3.connect(str(p))
    conn.execute(
        "CREATE TABLE pk_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, module TEXT,"
        " question_ids TEXT, creator_uid TEXT, opponent_uid TEXT, status TEXT, created_at REAL)"
    )
    rows = [
        ("A1", "test-w1-mp", "test-w1-mp2"),
        ("A2", "r10-pk-a", None),
        ("A3", "devin-test-p3-a", "devin-test-p3-b"),
        ("A4", "umsfewv3hvyk7elno", "opponentuid12345"),
        ("A5", "umtfgf4enaas2o9aw", "umtfgmbmnabeipwah"),
        ("A6", "r8b-check", None),
        ("A7", "umsrgwyi2n1m67dwh", None),
    ]
    for code, cu, ou in rows:
        conn.execute(
            "INSERT INTO pk_matches (code, question_ids, creator_uid, opponent_uid, status, created_at)"
            " VALUES (?,?,?,?,?,?)", (code, "[]", cu, ou, "waiting", time.time()),
        )
    conn.commit()
    ids = rb.scan(conn)  # dry-run 不加列
    assert "probe" not in {r[1] for r in conn.execute("PRAGMA table_info(pk_matches)")}
    assert ids == [1, 2, 3, 4, 6]
    rec = str(tmp_path / "rec.json")
    rb.apply(conn, ids, rec)
    got = dict(conn.execute("SELECT code, probe FROM pk_matches").fetchall())
    assert got == {"A1": 1, "A2": 1, "A3": 1, "A4": 1, "A5": None, "A6": 1, "A7": None}
    assert rb.scan(conn) == []
    rb.restore(conn, rec)
    assert all(v is None for v in dict(conn.execute("SELECT code, probe FROM pk_matches").fetchall()).values())
    conn.close()
