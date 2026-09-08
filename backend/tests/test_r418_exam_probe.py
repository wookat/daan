"""R418：模考场次探针打标（exam_attempts.probe）——同卷人数/均分、排行榜/击败比例/模块均值、比赛分数池只算真人；
scripts/r418_probe_backfill_test_uids.py 对 test-* 历史行回填 probe=1 可还原。"""
import importlib.util
import json
import os
import sqlite3

from app import db
from app.mock_event import _score_pool

from .conftest import seed_questions

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r418_probe_backfill_test_uids.py")
_spec = importlib.util.spec_from_file_location("r418_backfill", SCRIPT)
assert _spec and _spec.loader
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)

PROBE = {"X-Kg-Probe": "1"}


def _seed_paper(title: str, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2022, "北京", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _cleanup(uids: list[str]) -> None:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    db._ensure_exam_progress(conn)
    db._ensure_answer_log(conn)
    for u in uids:
        for t in ("exam_attempts", "exam_progress", "answer_log", "mistakes", "growth_events"):
            conn.execute(f"DELETE FROM {t} WHERE uid=?", (u,))
    conn.commit()
    conn.close()


def _submit(client, uid: str, pid: int, picks: dict, headers: dict | None = None) -> int:
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}, headers=headers or {}).json()["attempt_id"]
    r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": picks}, headers=headers or {})
    assert r.status_code == 200, r.text
    return aid


def test_exam_attempt_probe_excluded_from_cross_user_aggregates(client):
    qs = seed_questions()[:5]
    pid = _seed_paper("R418 探针口径卷", [q for q in qs])
    real, probe_uid = "r418-real-anon", "test-r418-probe"
    more_real = [f"r418-real-anon-{i}" for i in range(4)]
    _cleanup([real, probe_uid, *more_real])
    try:
        # 真人（无探针头）满分交卷；探针（显式头）交白卷两次
        aid_real = _submit(client, real, pid, {str(i + 1): "A" for i in range(5)})
        aid_probe = _submit(client, probe_uid, pid, {}, headers=PROBE)
        _submit(client, probe_uid, pid, {}, headers=PROBE)
        conn = db.get_conn()
        rows = conn.execute("SELECT uid, probe FROM exam_attempts WHERE paper_id=? ORDER BY id", (pid,)).fetchall()
        conn.close()
        assert [(r["uid"], r["probe"]) for r in rows] == [(real, 0), (probe_uid, 1), (probe_uid, 1)]

        # 真人视角：同卷只有自己一人，排行榜/击败比例不含探针
        rk = client.get(f"/api/exam/rank/{aid_real}?uid={real}").json()
        assert rk["total"] == 1 and rk["rank"] == 1 and rk["beaten_pct"] == 100
        assert [b["me"] for b in rk["board"]] == [True]
        # 探针视角：本人始终在池内，但真人之外没有别的探针进池
        rk2 = client.get(f"/api/exam/rank/{aid_probe}?uid={probe_uid}").json()
        assert rk2["total"] == 2 and rk2["rank"] == 2 and rk2["beaten_pct"] == 0
        assert sorted(b["me"] for b in rk2["board"]) == [False, True]

        # 卷库卡片「X 人考过 · 均分」与同卷社会证明、比赛分数池同口径
        social = db.exam_paper_social(pid)
        assert social["n"] == 1
        conn = db.get_conn()
        pool = _score_pool(conn, {"paper_id": pid})
        conn.close()
        assert pool["n"] == 1
        # 卷库列表 ≥5 真人才透出（W10-A）：凑满 5 真人后 takers=5，探针不计入（否则为 6）
        for u in more_real:
            _submit(client, u, pid, {"1": "A"})
        db._papers_cache.clear()
        papers = {p["id"]: p for p in client.get("/api/exam/papers?uid=" + real).json()["items"]}
        assert papers[pid]["takers"] == 5
    finally:
        _cleanup([real, probe_uid, *more_real])


def _tmp_db(tmp_path):
    p = tmp_path / "r418.db"
    conn = sqlite3.connect(p)
    conn.executescript(
        "CREATE TABLE answer_log (id INTEGER PRIMARY KEY, uid TEXT, probe INTEGER);"
        "CREATE TABLE growth_events (id INTEGER PRIMARY KEY, uid TEXT, probe INTEGER);"
        "CREATE TABLE exam_attempts (id INTEGER PRIMARY KEY, uid TEXT, probe INTEGER);"
    )
    conn.executemany("INSERT INTO answer_log (uid, probe) VALUES (?,?)",
                     [("test-w1-mp", None), ("test-w1-mp", 1), ("umsxyz", None), ("u6", 0), ("test-r375", None)])
    conn.executemany("INSERT INTO growth_events (uid, probe) VALUES (?,?)", [("test-w4-mp", None), ("umsabc", None)])
    conn.executemany("INSERT INTO exam_attempts (uid, probe) VALUES (?,?)", [("test-w4-mp", None), ("u6", None)])
    conn.commit()
    return p, conn


def test_backfill_script_dry_run_apply_restore(tmp_path):
    _, conn = _tmp_db(tmp_path)
    hit = rb.scan(conn, "test-%")
    assert hit == {"answer_log": [1, 5], "growth_events": [1], "exam_attempts": [1]}
    # dry-run 零写入
    assert conn.execute("SELECT COUNT(*) FROM answer_log WHERE probe=1").fetchone()[0] == 1

    rec = str(tmp_path / "rec.json")
    rb.apply(conn, hit, rec)
    assert conn.execute("SELECT id, probe FROM answer_log ORDER BY id").fetchall() == [
        (1, 1), (2, 1), (3, None), (4, 0), (5, 1)]
    assert conn.execute("SELECT probe FROM exam_attempts ORDER BY id").fetchall() == [(1,), (None,)]
    assert conn.execute("SELECT probe FROM growth_events ORDER BY id").fetchall() == [(1,), (None,)]
    # 幂等：再扫无命中
    assert rb.scan(conn, "test-%") == {"answer_log": [], "growth_events": [], "exam_attempts": []}

    rb.restore(conn, rec)
    assert conn.execute("SELECT id, probe FROM answer_log ORDER BY id").fetchall() == [
        (1, None), (2, 1), (3, None), (4, 0), (5, None)]
    assert conn.execute("SELECT probe FROM exam_attempts ORDER BY id").fetchall() == [(None,), (None,)]
    conn.close()
