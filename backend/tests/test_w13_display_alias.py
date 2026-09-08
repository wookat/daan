"""W13-B1：榜单展示名统一 db.display_alias（考友XXXX）/ uid 清洗入口 db.clean_uid / exam submit picks 形状守卫。"""
import json
import time

from app import db, mock_event, pk, report, social, team

from .conftest import seed_questions


def test_display_alias_nickname_first_then_stable_hash():
    assert db.display_alias("test-w13-a", "  小明冲刺2026  ") == "小明冲刺2026"
    assert len(db.display_alias("test-w13-a", "长" * 30)) == 20
    for blank in (None, "", "   ", "null", "Undefined"):
        a = db.display_alias("test-w13-a", blank)
        assert a.startswith("考友") and len(a) == 6 and a[2:] == a[2:].upper()
        assert "test-w13" not in a
    assert db.display_alias("test-w13-a", None) == db.display_alias("test-w13-a", "")
    assert db.display_alias("test-w13-a", None) != db.display_alias("test-w13-b", None)
    assert mock_event._alias is db.display_alias


def test_clean_uid_normalizes_and_modules_delegate():
    assert db.clean_uid("  test-w13-x \n") == "test-w13-x"
    assert db.clean_uid(None) == "" and db.clean_uid("   ") == ""
    assert len(db.clean_uid("u" * 100)) == 64
    for mod in (team, pk, social, mock_event, report):
        assert mod._clean_uid("  test-w13-y ") == "test-w13-y"


def test_daily_set_board_alias(client):
    day = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600 - 86400))
    db.daily_set_submit(day, "test-w13-ds-anon", 8, 10, 90.0)
    board = db.daily_set_board(day, uid="test-w13-ds-anon")
    me = [r for r in board if r["name"] == db.display_alias("test-w13-ds-anon", None)]
    assert len(me) == 1 and me[0]["right"] == 8
    assert all("test-w13" not in r["name"] and "***" not in r["name"] for r in board)
    conn = db.get_conn()
    conn.execute("DELETE FROM daily_set_entries WHERE uid LIKE 'test-w13-%'")
    conn.commit()
    conn.close()


def _seed_paper(qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("W13 picks 守卫测试卷", "zhenti", 2023, "江苏", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def test_exam_submit_rejects_non_dict_picks(client):
    qids = seed_questions()[:5]
    pid = _seed_paper(qids)
    uid = "test-w13-submit"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    for bad in ([], ["A", "B"], "AB", 3):
        r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": bad})
        assert r.status_code == 400, (bad, r.status_code, r.text)
    r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}, "secs": [1, 2]})
    assert r.status_code == 400
    # 未被误判交卷：合法请求仍可提交（空对象 / 缺省 secs 仍合法）
    r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    assert r.status_code == 200 and r.json()["answered"] == 1, r.text
    aid2 = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid2, "picks": {}})
    assert r.status_code == 200 and r.json()["answered"] == 0, r.text
    conn = db.get_conn()
    rows = conn.execute("SELECT source FROM answer_log WHERE uid=?", (uid,)).fetchall()
    assert rows and all(r["source"] == "exam" for r in rows)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_papers WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    db._papers_cache.clear()
