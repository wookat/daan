"""R414：多选题（answer 多字母）导入/管理归一 + 模考判分/报告按字母集比较。"""
import json

from app import db, deps
from app.exam_api import _grade

from .conftest import seed_questions


def test_normalize_answer():
    assert db.normalize_answer(" db ") == "BD"
    assert db.normalize_answer("BDB") == "BD"
    assert db.normalize_answer("a") == "A"
    assert db.normalize_answer("") == ""
    assert db.normalize_answer(None) == ""
    assert db.normalize_answer("A、C") == "AC"
    opts = {"A": "甲", "B": "乙", "C": "丙", "D": "丁"}
    assert db.normalize_answer("DB", opts) == "BD"
    assert db.normalize_answer("E", opts) == ""
    assert db.normalize_answer("AE", opts) == ""
    assert db.normalize_answer("", opts) == ""


def test_grade_single_and_multi():
    assert _grade("A", "A") == ("A", "A", "ok", True)
    assert _grade("b", "A") == ("B", "A", "ok", False)
    assert _grade("", "A") == ("", "A", "blank", False)
    assert _grade(None, "A") == ("", "A", "blank", False)
    # 单选题涂多个：multi，不记分
    assert _grade("AB", "A") == ("AB", "A", "multi", False)
    # 多选题：字母集完全一致才对，顺序无关；漏选/错选均为错
    assert _grade("DB", "BD") == ("BD", "BD", "ok", True)
    assert _grade("B", "BD") == ("B", "BD", "ok", False)
    assert _grade("ABD", "BD") == ("ABD", "BD", "ok", False)


def _seed_multi_question(answer: str = "BD") -> int:
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer, explanation, is_real, disabled)"
        " VALUES (?,?,?,?,?,?,1,0)",
        ("changshi", "多选题", "R414 多选测试题：以下属于甲的有？",
         json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False), answer, "选 BD。"),
    )
    qid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return qid


def _seed_paper(title: str, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2021, "北京", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def test_exam_multi_flow(client):
    qids = seed_questions()[:4]
    mq = _seed_multi_question("BD")
    pid = _seed_paper("R414 多选模考卷", qids + [mq])
    uid = "test-r414-multi"
    d = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()
    aid = d["attempt_id"]
    items = d["items"]
    assert [it["multi"] for it in items] == [False, False, False, False, True]
    assert all("answer" not in it for it in items)
    # 进度同步保留多字母且归一
    r = client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid, "picks": {str(mq): "DB"}, "idx": 4})
    assert r.status_code == 200
    assert client.get(f"/api/exam/resume?uid={uid}").json()["picks"] == {str(mq): "BD"}
    assert client.post("/api/exam/progress", json={"uid": uid, "attempt_id": aid,
                                                    "picks": {str(mq): "ABCDE"}}).status_code == 400
    # 交卷：第 5 题多选答 DB 判对；第 1 题单选涂 AB 视为 multi 不记分
    sub = client.post("/api/exam/submit", json={
        "uid": uid, "attempt_id": aid, "picks": {"1": "AB", "2": "A", "3": "B", "5": "DB"},
    }).json()
    by_no = {it["no"]: it for it in sub["items"]}
    assert by_no[5]["picked"] == "BD" and by_no[5]["answer"] == "BD" and by_no[5]["correct"] is True
    assert by_no[1]["status"] == "multi" and by_no[1]["correct"] is False
    assert sub["answered"] == 3 and sub["correct"] == 2
    rep = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
    ri = {it["no"]: it for it in rep["items"]}
    assert ri[5]["answer"] == "BD" and ri[5]["picked"] == "BD" and ri[5]["correct"] is True
    assert ri[3]["correct"] is False and ri[3]["mistake_id"]
    assert ri[1]["status"] == "multi" and ri[1]["mistake_id"] is None
    assert rep["answered"] == 3
    # 漏选进错题本，user_answer/correct_answer 均为多字母
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
    aid2 = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    sub2 = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid2, "picks": {"5": "B"}}).json()
    assert sub2["items"][4]["correct"] is False
    conn = db.get_conn()
    row = conn.execute("SELECT user_answer, correct_answer FROM mistakes WHERE uid=? AND question_id=?",
                       (uid, mq)).fetchone()
    assert tuple(row) == ("B", "BD")
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_papers WHERE id=?", (pid,))
    conn.execute("DELETE FROM questions WHERE id=?", (mq,))
    conn.commit()
    conn.close()
    db._papers_cache.clear()


def test_answer_log_keeps_multi_letter_picked(client):
    """R417：answer_log.picked 不再截成 2 个字母——多选错选 ABD 原样落库，易错项聚合/错题卡「历次作答」按完整字母集。"""
    qids = seed_questions()[:4]
    mq = _seed_multi_question("BD")
    pid = _seed_paper("R417 多选 picked 卷", qids + [mq])
    uid = "test-r417-picked"
    conn = db.get_conn()
    db._ensure_question_stat_cols(conn)
    conn.execute("DELETE FROM answer_log WHERE question_id=?", (mq,))
    conn.commit()
    conn.close()
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    sub = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"5": "DBA"}}).json()
    assert sub["items"][4]["picked"] == "ABD" and sub["items"][4]["correct"] is False
    # 练习页多选确认后同一接口上报（小写/乱序也归一）
    r = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": mq, "correct": False, "picked": "dca"}]})
    assert r.status_code == 200
    conn = db.get_conn()
    rows = conn.execute("SELECT picked FROM answer_log WHERE uid=? AND question_id=? ORDER BY id", (uid, mq)).fetchall()
    assert [r["picked"] for r in rows] == ["ABD", "ACD"]
    conn.execute("UPDATE answer_log SET probe=0 WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
    db.refresh_question_stats()
    conn = db.get_conn()
    row = conn.execute("SELECT attempt_count, most_wrong FROM questions WHERE id=?", (mq,)).fetchone()
    assert (row["attempt_count"], row["most_wrong"]) == (2, "ABD")
    att = db.question_attempts(uid, mq)
    assert sorted(a["picked"] for a in att) == ["ABD", "ACD"]
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_attempts WHERE uid=?", (uid,))
    conn.execute("DELETE FROM exam_papers WHERE id=?", (pid,))
    conn.execute("DELETE FROM questions WHERE id=?", (mq,))
    conn.commit()
    conn.close()
    db._papers_cache.clear()


def test_admin_patch_answer_normalized(client, monkeypatch):
    monkeypatch.setattr(deps, "ADMIN_TOKEN", "t0ken")
    h = {"X-Admin-Token": "t0ken"}
    mq = _seed_multi_question("BD")
    r = client.patch(f"/api/admin/questions/{mq}", json={"answer": " d b "}, headers=h)
    assert r.status_code == 200, r.text
    r = client.patch(f"/api/admin/questions/{mq}", json={"answer": "E"}, headers=h)
    assert r.status_code == 400
    r = client.patch(f"/api/admin/questions/{mq}",
                     json={"answer": "E", "options": {"A": "1", "E": "2"}}, headers=h)
    assert r.status_code == 200, r.text
    conn = db.get_conn()
    row = conn.execute("SELECT answer, options FROM questions WHERE id=?", (mq,)).fetchone()
    assert row["answer"] == "E" and json.loads(row["options"]) == {"A": "1", "E": "2"}
    conn.execute("DELETE FROM questions WHERE id=?", (mq,))
    conn.commit()
    conn.close()


def test_import_questions_normalizes_and_rejects():
    n = db.import_questions([
        {"module": "changshi", "question": "R414 导入归一 1", "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
         "answer": "d b", "explanation": "x"},
        {"module": "changshi", "question": "R414 导入归一 2", "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
         "answer": "E", "explanation": "x"},
    ])
    conn = db.get_conn()
    rows = conn.execute("SELECT question, answer FROM questions WHERE question LIKE 'R414 导入归一%'").fetchall()
    assert [tuple(r) for r in rows] == [("R414 导入归一 1", "BD")]
    conn.execute("DELETE FROM questions WHERE question LIKE 'R414 导入归一%'")
    conn.commit()
    conn.close()
    assert n["inserted"] == 1 and n["skipped"] == 1
