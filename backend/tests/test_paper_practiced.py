"""R359：卷库契约补 practiced——按卷练习进度（answer_log ∩ 卷内活跃题，fail-closed）。"""
import time

from app import db
from tests.test_paper_psource import _seed_paper, _seed_src_questions


def _log_answers(uid: str, qids: list[int]):
    conn = db.get_conn()
    for qid in qids:
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs)"
            " VALUES (?,?,?,?,1,10)",
            (uid, time.time(), qid, "yanyu"),
        )
    conn.commit()
    conn.close()


def test_practiced_zero_without_uid(client):
    qids = _seed_src_questions("2024practiced无uid卷", 20)
    pid = _seed_paper("practiced 无uid测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["practiced"] == 0


def test_practiced_counts_intersection(client):
    uid = "u-r359-a"
    qids = _seed_src_questions("2024practiced交集卷", 20)
    pid = _seed_paper("practiced 交集测试卷", qids)
    _log_answers(uid, qids[:7])
    _log_answers(uid, qids[:3])  # 重复作答只按去重题数计
    _log_answers(uid, [999999])  # 非本卷题不计
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["practiced"] == 7
    assert p["n"] == 20


def test_practiced_not_cross_paper(client):
    uid = "u-r359-b"
    qids_a = _seed_src_questions("2024practiced卷A", 20)
    qids_b = _seed_src_questions("2024practiced卷B", 20)
    pid_a = _seed_paper("practiced 卷A", qids_a)
    pid_b = _seed_paper("practiced 卷B", qids_b)
    _log_answers(uid, qids_a[:5])
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    by_id = {x["id"]: x for x in d["items"]}
    assert by_id[pid_a]["practiced"] == 5
    assert by_id[pid_b]["practiced"] == 0


def test_practiced_excludes_disabled(client):
    uid = "u-r359-c"
    qids = _seed_src_questions("2024practiced禁用卷", 20)
    pid = _seed_paper("practiced 禁用测试卷", qids)
    _log_answers(uid, qids[:4])
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (qids[0],))
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    d = client.get(f"/api/exam/papers?kind=zhenti&uid={uid}").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["n"] == 19
    assert p["practiced"] == 3
