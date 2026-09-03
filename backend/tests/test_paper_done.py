"""R360：/api/paper_questions 契约补逐题 done——按卷练习「只练剩余」（fail-closed）。"""
from tests.test_paper_practiced import _log_answers
from tests.test_paper_psource import _seed_src_questions


def test_done_absent_without_uid(client):
    _seed_src_questions("2024done无uid卷", 25)
    d = client.get("/api/paper_questions?src=2024done无uid卷").json()
    assert len(d["items"]) == 25
    assert all("done" not in q for q in d["items"])


def test_done_marks_answered_dedup(client):
    uid = "u-r360-a"
    qids = _seed_src_questions("2024done标记卷", 25)
    _log_answers(uid, qids[:6])
    _log_answers(uid, qids[:2])  # 重复作答不改变标记
    d = client.get(f"/api/paper_questions?src=2024done标记卷&uid={uid}").json()
    by_id = {q["id"]: q for q in d["items"]}
    assert all(by_id[i]["done"] is True for i in qids[:6])
    assert all(by_id[i]["done"] is False for i in qids[6:])


def test_done_not_cross_paper(client):
    uid = "u-r360-b"
    qids_a = _seed_src_questions("2024done卷A", 25)
    _seed_src_questions("2024done卷B", 25)
    _log_answers(uid, qids_a[:5])
    d = client.get(f"/api/paper_questions?src=2024done卷B&uid={uid}").json()
    assert all(q["done"] is False for q in d["items"])


def test_done_fresh_uid_all_false(client):
    _seed_src_questions("2024done零态卷", 25)
    d = client.get("/api/paper_questions?src=2024done零态卷&uid=u-r360-fresh").json()
    assert all(q["done"] is False for q in d["items"])
