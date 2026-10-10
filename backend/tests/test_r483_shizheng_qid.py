"""R483：时政题号属于 shizheng_questions，与 questions.id 只是数字撞号——写入侧置空 question_id，
按题号的统计 / 去重 / 复习推进不再算到同号行测题上；scripts/one-off/r483_shizheng_qid_null.py 回填历史行可还原。"""
import importlib.util
import json
import os
import sqlite3
import time

from app import db

from .conftest import seed_questions

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "one-off", "r483_shizheng_qid_null.py")
_spec = importlib.util.spec_from_file_location("r483_backfill", SCRIPT)
assert _spec and _spec.loader
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)

UID = "r483-sz-uid"


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (UID,))
    conn.execute("DELETE FROM mistakes WHERE uid=?", (UID,))
    conn.commit()
    conn.close()


def _q(sql, args=()):
    conn = db.get_conn()
    rows = [dict(r) for r in conn.execute(sql, args)]
    conn.close()
    return rows


def test_foreign_module_qid_rule():
    assert db.foreign_module_qid("时政", 48)
    assert not db.foreign_module_qid("ziliao", 48)
    assert not db.foreign_module_qid(None, 48)  # 无模块：仍信题号（questions 表回查）
    assert not db.foreign_module_qid("", 48)
    assert not db.foreign_module_qid("时政", None)


def test_answer_log_shizheng_qid_dropped_and_no_cross_advance(client):
    _cleanup()
    qid = seed_questions(1)[0]
    try:
        # 本 uid 有一条同号的行测错题（未掌握）
        mid = db.save_mistake({
            "uid": UID, "question_id": qid, "module": "ziliao", "question_type": "单选",
            "question_text": "行测题干", "user_answer": "B", "correct_answer": "A", "explanation": "x",
        })
        before = _q("SELECT review_streak, next_review FROM mistakes WHERE id=?", (mid,))[0]
        r = client.post("/api/answer_log", json={
            "uid": UID,
            "items": [
                {"qid": qid, "module": "时政", "submodule": None, "correct": True, "secs": 3, "picked": "A"},
                {"qid": qid, "module": "ziliao", "correct": False, "secs": 2, "picked": "B"},
            ],
        })
        assert r.status_code == 200
        rows = _q("SELECT module, question_id, correct FROM answer_log WHERE uid=? ORDER BY id", (UID,))
        assert rows[0]["module"] == "时政" and rows[0]["question_id"] is None
        assert rows[1]["module"] == "ziliao" and rows[1]["question_id"] == qid
        # 时政答对不得推进同号行测错题的 SRS
        after = _q("SELECT review_streak, next_review FROM mistakes WHERE id=?", (mid,))[0]
        assert after == before
        assert r.json().get("reviewed", []) == []
    finally:
        _cleanup()


def test_save_mistake_shizheng_qid_dropped_and_not_deduped_against_hangce(client):
    _cleanup()
    qid = seed_questions(1)[0]
    try:
        mid_hc = db.save_mistake({
            "uid": UID, "question_id": qid, "module": "ziliao", "question_type": "单选",
            "question_text": "行测题干", "user_answer": "B", "correct_answer": "A", "explanation": "x",
        })
        r = client.post("/api/mistakes", json={
            "uid": UID, "question_id": qid, "module": "时政", "question_type": "单选",
            "question_text": "时政题干\nA.甲 B.乙", "user_answer": "B", "correct_answer": "A", "explanation": "y",
        })
        assert r.status_code == 200
        mid_sz = r.json()["id"]
        assert mid_sz != mid_hc
        rows = {m["id"]: m for m in _q("SELECT id, module, question_id, times FROM mistakes WHERE uid=?", (UID,))}
        assert rows[mid_sz]["question_id"] is None
        assert rows[mid_hc]["question_id"] == qid and (rows[mid_hc]["times"] or 1) == 1
        # 读取侧：时政错题不再套上行测题选项
        lst = client.get(f"/api/mistakes?uid={UID}").json()["items"]
        sz = next(m for m in lst if m["id"] == mid_sz)
        assert not sz.get("options") and sz["question_text"].startswith("时政题干")
    finally:
        _cleanup()


def test_backfill_script_nulls_shizheng_qids_and_restores(tmp_path):
    p = tmp_path / "sz.db"
    conn = sqlite3.connect(p)
    conn.execute("CREATE TABLE answer_log (id INTEGER PRIMARY KEY, uid TEXT, created_at REAL, question_id INTEGER, module TEXT)")
    conn.execute("CREATE TABLE mistakes (id INTEGER PRIMARY KEY, uid TEXT, created_at REAL, question_id INTEGER, module TEXT)")
    now = time.time()
    conn.executemany(
        "INSERT INTO answer_log (uid, created_at, question_id, module) VALUES (?,?,?,?)",
        [("u1", now, 48, "时政"), ("u1", now, 48, "ziliao"), ("u2", now, None, "时政"), ("u2", now, 11168, "时政")],
    )
    conn.executemany(
        "INSERT INTO mistakes (uid, created_at, question_id, module) VALUES (?,?,?,?)",
        [("u1", now, 109, "时政"), ("u1", now, 109, "panduan"), ("u3", now, None, "时政")],
    )
    conn.commit()
    hits = rb.scan(conn)
    assert hits == {"answer_log": {1: 48, 4: 11168}, "mistakes": {1: 109}}
    rec = str(tmp_path / "rec.json")
    rb.apply(conn, hits, rec)
    assert conn.execute("SELECT COUNT(*) FROM answer_log WHERE module='时政' AND question_id IS NOT NULL").fetchone()[0] == 0
    assert conn.execute("SELECT question_id FROM answer_log WHERE id=2").fetchone()[0] == 48  # 行测行不动
    assert conn.execute("SELECT question_id FROM mistakes WHERE id=2").fetchone()[0] == 109
    assert rb.scan(conn) == {"answer_log": {}, "mistakes": {}}
    with open(rec, encoding="utf-8") as f:
        assert json.load(f)["rows"]["mistakes"] == {"1": 109}
    rb.restore(conn, rec)
    assert conn.execute("SELECT question_id FROM answer_log WHERE id IN (1,4) ORDER BY id").fetchall() == [(48,), (11168,)]
    assert conn.execute("SELECT question_id FROM mistakes WHERE id=1").fetchone()[0] == 109
