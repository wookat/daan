"""R367：卷卡 wrong（本卷最近一次答错题数）+ paper_questions 逐题 wrong——按卷「只练错题」入口（fail-closed）。"""
import time

from app import db
from tests.test_paper_psource import _seed_paper, _seed_src_questions


def _log(uid: str, qid: int, correct, at: float):
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs)"
        " VALUES (?,?,?,?,?,10)",
        (uid, at, qid, "yanyu", correct),
    )
    conn.commit()
    conn.close()


def test_wrong_zero_without_uid(client):
    qids = _seed_src_questions("2024wrong无uid卷", 20)
    pid = _seed_paper("wrong 无uid测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["wrong"] == 0
    q = client.get("/api/paper_questions?src=2024wrong无uid卷").json()
    assert all("wrong" not in x and "done" not in x for x in q["items"])


def test_wrong_latest_answer_semantics(client):
    uid = "u-r367-a"
    qids = _seed_src_questions("2024wrong口径卷", 20)
    pid = _seed_paper("wrong 口径测试卷", qids)
    t = time.time()
    _log(uid, qids[0], 0, t)          # 错 → 计
    _log(uid, qids[1], 0, t)          # 错后答对 → 不计
    _log(uid, qids[1], 1, t + 1)
    _log(uid, qids[2], 1, t)          # 对后答错 → 计
    _log(uid, qids[2], 0, t + 1)
    _log(uid, qids[3], 1, t)          # 对 → 不计
    _log(uid, qids[4], None, t)       # correct NULL → 不计（fail-closed）
    _log(uid, 999999, 0, t)           # 非本卷题不计
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["practiced"] == 5
    assert p["wrong"] == 2
    q = client.get(f"/api/paper_questions?src=2024wrong口径卷&pid={pid}&uid={uid}").json()
    by_id = {x["id"]: x for x in q["items"]}
    assert [by_id[i]["wrong"] for i in qids[:5]] == [True, False, True, False, False]
    assert all(by_id[i]["wrong"] is False and by_id[i]["done"] is False for i in qids[5:])


def test_wrong_not_cross_paper(client):
    uid = "u-r367-b"
    qids_a = _seed_src_questions("2024wrong卷A", 20)
    qids_b = _seed_src_questions("2024wrong卷B", 20)
    pid_a = _seed_paper("wrong 卷A", qids_a)
    pid_b = _seed_paper("wrong 卷B", qids_b)
    for i in qids_a[:3]:
        _log(uid, i, 0, time.time())
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    by_id = {x["id"]: x for x in d["items"]}
    assert by_id[pid_a]["wrong"] == 3
    assert by_id[pid_b]["wrong"] == 0


def test_wrong_excludes_disabled(client):
    uid = "u-r367-c"
    qids = _seed_src_questions("2024wrong禁用卷", 20)
    pid = _seed_paper("wrong 禁用测试卷", qids)
    for i in qids[:4]:
        _log(uid, i, 0, time.time())
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (qids[0],))
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["n"] == 19
    assert p["wrong"] == 3
