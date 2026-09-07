"""W9-A：async 端点/中间件内的阻塞调用（owns_uid 可能 httpx.get、OMR 为 CPU）走线程池，
全新库 init_db 后 questions.correct_ratio 必然存在（adaptive random_questions 不再 no such column）。"""
import os
import sqlite3
import tempfile
import threading
import time

import pytest

from app import auth, db, exam_api, omr

ANON_UID = "test-w9-async-anon"
PNG = ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")


def test_scan_sheet_recognize_runs_off_event_loop(client, monkeypatch):
    seen: dict[str, int] = {}
    real_rl = exam_api.rl

    def _rl(*a, **kw):  # 在 async 处理函数内同步调用 → 记录事件循环线程
        seen["loop"] = threading.get_ident()
        return real_rl(*a, **kw)

    def _recognize(_raw):
        seen["omr"] = threading.get_ident()
        raise ValueError("识别失败")

    monkeypatch.setattr(exam_api, "rl", _rl)
    monkeypatch.setattr(omr, "recognize", _recognize)
    r = client.post("/api/scan_sheet", data={"uid": ANON_UID}, files={"image": PNG})
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == "识别失败"
    assert seen["omr"] != seen["loop"]


def test_guard_owns_uid_runs_off_event_loop(client, monkeypatch):
    seen: dict[str, int] = {}
    real_is_account = auth.is_account_uid

    def _is_account(uid):  # 中间件内同步调用 → 事件循环线程
        seen["loop"] = threading.get_ident()
        return real_is_account(uid)

    def _owns(uid, authorization):
        seen["owns"] = threading.get_ident()
        return False

    monkeypatch.setattr(auth, "is_account_uid", _is_account)
    monkeypatch.setattr(auth, "owns_uid", _owns)
    r = client.post("/api/mistakes", json={"uid": "u999999", "question_text": "x"})
    assert r.status_code == 403, r.text
    assert seen["owns"] != seen["loop"]


def _run_in_fresh_thread(fn):
    """db.get_conn 为线程本地连接：新线程 + 临时 DB_PATH 即得到一个全新库。"""
    out: dict = {}

    def _t():
        try:
            out["v"] = fn()
        except BaseException as e:
            out["e"] = e

    t = threading.Thread(target=_t)
    t.start()
    t.join(60)
    if "e" in out:
        raise out["e"]
    return out["v"]


@pytest.fixture
def fresh_db(monkeypatch):
    d = tempfile.mkdtemp(prefix="kg-w9-fresh-")
    path = os.path.join(d, "fresh.db")
    monkeypatch.setattr(db, "DB_PATH", path)
    yield path


def test_fresh_db_has_correct_ratio_and_adaptive_pick_works(fresh_db):
    uid = "test-w9-adaptive"

    def _scenario():
        db.init_db()
        conn = db.get_conn()
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
        assert {"correct_ratio", "attempt_count", "most_wrong"} <= cols
        assert conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_q_reinforce'"
        ).fetchone()
        qids = []
        for i in range(8):
            conn.execute(
                "INSERT INTO questions (module, question_type, question, options, answer, explanation, is_real, disabled)"
                " VALUES ('yanyu','单选题',?,?,?,?,1,0)",
                (f"W9 全新库题干 {i}", '{"A":"甲","B":"乙","C":"丙","D":"丁"}', "A", "故选 A。"),
            )
            qids.append(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
        db._ensure_answer_log(conn)
        for qid in qids[:5]:  # 累计 ≥5 条作答才进入 adaptive 排序分支
            conn.execute(
                "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs) VALUES (?,?,?,?,?,?)",
                (uid, time.time(), qid, "yanyu", 1, 10),
            )
        conn.commit()
        conn.close()
        # 修复前：全新库无 correct_ratio 列 → sqlite3.OperationalError: no such column（接口层 500）
        items = db.random_questions("yanyu", 3, uid=uid, adaptive=True)
        assert len(items) == 3
        return True

    assert _run_in_fresh_thread(_scenario)
    raw = sqlite3.connect(fresh_db)
    assert "correct_ratio" in {r[1] for r in raw.execute("PRAGMA table_info(questions)")}
    raw.close()
