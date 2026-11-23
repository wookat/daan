"""Performance & bundling regression tests (PRAGMAs, indexes, stats_bundle, bulk mistakes, /qimg cache, think=False)."""
import os
import sqlite3

from app import db
from app.api import qbank as qbank_api
from app.services import llm
from tests.conftest import seed_questions

PFX = "test-perf-"


def test_sqlite_pragmas_enabled():
    conn = db.get_conn()
    sync = conn.execute("PRAGMA synchronous").fetchone()[0]
    temp = conn.execute("PRAGMA temp_store").fetchone()[0]
    mode = str(conn.execute("PRAGMA journal_mode").fetchone()[0]).lower()
    conn.close()
    assert sync == 1  # NORMAL
    assert temp == 2  # MEMORY
    assert mode == "wal"


def test_perf_indexes_present_after_ensure():
    conn = db.get_conn()
    db.init_db()
    db._ensure_daily_set(conn)
    db._ensure_answer_log(conn)
    db._ensure_exam_tables(conn)
    conn.close()
    from app.services import social

    social.init_social_db()
    conn = db.get_conn()
    names = {
        r[0]
        for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
    }
    conn.close()
    for idx in (
        "idx_mist_uid_qid",
        "idx_mist_uid_due",
        "idx_al_created",
        "idx_q_mod_sub_id",
        "idx_sq_list",
        "idx_sm_type",
        "idx_ea_paper_sub",
        "idx_dse_uid_day",
        "idx_qc_plaza",
    ):
        assert idx in names, f"missing index {idx}"


def test_stats_bundle_matches_individual_endpoints(client):
    uid = PFX + "bundle"
    qids = seed_questions(2, modules=("ziliao", "yanyu"))
    client.post(
        "/api/answer_log",
        json={
            "uid": uid,
            "items": [
                {"qid": qids[0], "module": "ziliao", "correct": True, "secs": 15},
                {"qid": qids[1], "module": "yanyu", "correct": False, "secs": 25},
            ],
        },
    )
    client.post(
        "/api/mistakes",
        json={
            "uid": uid,
            "question_id": qids[1],
            "module": "yanyu",
            "question_type": "言语理解",
            "question_text": "stats bundle test question",
            "user_answer": "B",
            "correct_answer": "A",
        },
    )
    client.post("/api/profile", json={"uid": uid, "target_score": 76})

    b = client.get(f"/api/stats_bundle?uid={uid}")
    assert b.status_code == 200
    data = b.json()
    assert set(data) >= {
        "summary",
        "growth",
        "recommend",
        "due_total",
        "shenlun_stats",
        "mastery_cov",
        "exam_attempts",
        "target_score",
        "stats",
        "predict",
    }
    assert data["target_score"] == 76
    assert data["due_total"] == client.get(f"/api/review?uid={uid}").json()["total"]
    assert data["growth"]["total"] == client.get(f"/api/growth?uid={uid}").json()["total"]
    assert data["summary"]["total"] == client.get(f"/api/checkin/summary?uid={uid}").json()["total"]
    assert data["stats"] == client.get(f"/api/stats?uid={uid}").json()
    assert data["predict"] == client.get(f"/api/predict?uid={uid}").json()


def test_save_mistakes_bulk_and_manual_redo_skip():
    uid = PFX + "bulk"
    qids = seed_questions(2, modules=("changshi",))
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()

    mids = db.save_mistakes_bulk(
        [
            {
                "uid": uid,
                "question_id": qids[0],
                "module": "changshi",
                "question_type": "常识",
                "question_text": "bulk q1",
                "user_answer": "B",
                "correct_answer": "A",
            },
            {
                "uid": uid,
                "source": "manual",
                "module": "changshi",
                "question_type": "常识",
                "question_text": "perf-manual-unique-nonexistent\nA.1 B.2",
                "user_answer": "B",
                "correct_answer": "A",
            },
        ]
    )
    assert len(mids) == 2

    res = db.mistakes_redo(limit=10, uid=uid)
    assert len(res["items"]) == 1
    assert res["items"][0]["id"] == qids[0]
    assert res["skipped"] == 1


def test_announcement_cache_and_invalidation():
    aid = db.admin_create_announcement("Perf公告", "测试内容")
    first = db.active_announcement()
    assert first and first["title"] == "Perf公告"
    db.admin_set_announcement(aid, False)
    after = db.active_announcement()
    assert not after or after["id"] != aid


def test_qimg_immutable_cache_header(client):
    os.makedirs(qbank_api.QIMG_DIR, exist_ok=True)
    fname = "_test_perf_dummy.png"
    fpath = os.path.join(qbank_api.QIMG_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
    try:
        r = client.get(f"/qimg/{fname}")
        assert r.status_code == 200
        assert r.headers.get("cache-control") == "public, max-age=31536000, immutable"
    finally:
        if os.path.exists(fpath):
            os.remove(fpath)


def test_shenlun_grade_disables_thinking(client, monkeypatch):
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_questions (exam_year, exam_region, paper, qtype, material, question, reference, disabled) "
        "VALUES (2025, '国考', 'Perf测试卷', '概括', '测试给定资料内容。', '概括主要做法。', '参考答案要点', 0)"
    )
    conn.commit()
    qid = conn.execute("SELECT id FROM shenlun_questions WHERE paper='Perf测试卷'").fetchone()[0]
    conn.close()

    captured = {}

    async def fake_chat_fast(messages, **kwargs):
        captured.update(kwargs)
        return "【命中要点】1\n【参考得分】8/10"

    monkeypatch.setattr(llm, "chat_fast", fake_chat_fast)
    r = client.post(
        "/api/shenlun/grade",
        json={"qid": qid, "answer": "考生完整作答内容，至少二十个字以上以确保通过长度限制。", "uid": PFX + "sl"},
    )
    assert r.status_code == 200
    assert captured.get("think") is False


def test_alembic_0003_idempotent_upgrade(tmp_path):
    db_file = tmp_path / "mig.db"
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE mistakes (id INTEGER PRIMARY KEY, uid TEXT, mastered INTEGER, next_review REAL, created_at REAL, question_id INTEGER)")
    conn.commit()
    conn.close()

    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "mig0003",
        os.path.join(os.path.dirname(__file__), "..", "alembic", "versions", "0003_perf_indexes.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    assert mod.down_revision == "0002_answer_log_partial_idx"
    assert len(mod._INDEXES) == 10
