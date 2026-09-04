"""R362：/api/paper_questions 补可选 pid——按卷练习题集对齐卷面（fail-open 回落 src）。"""
from app import db
from tests.test_paper_practiced import _log_answers
from tests.test_paper_psource import _seed_paper, _seed_src_questions


def test_pid_uses_paper_qids_in_order(client):
    qids = _seed_src_questions("2024pid顺序卷", 30)
    subset = [qids[5], qids[2], qids[20]] + qids[8:28]
    pid = _seed_paper("pid 顺序测试卷", subset)
    d = client.get(f"/api/paper_questions?src=2024pid顺序卷&pid={pid}").json()
    assert [q["id"] for q in d["items"]] == subset


def test_pid_excludes_disabled(client):
    qids = _seed_src_questions("2024pid禁用卷", 25)
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (qids[0],))
    conn.commit()
    conn.close()
    pid = _seed_paper("pid 禁用测试卷", qids)
    d = client.get(f"/api/paper_questions?src=2024pid禁用卷&pid={pid}").json()
    assert [q["id"] for q in d["items"]] == qids[1:]


def test_pid_invalid_falls_back_to_src(client):
    qids = _seed_src_questions("2024pid回落卷", 25)
    d = client.get("/api/paper_questions?src=2024pid回落卷&pid=999999").json()
    assert sorted(q["id"] for q in d["items"]) == sorted(qids)
    d0 = client.get("/api/paper_questions?src=2024pid回落卷&pid=0").json()
    assert sorted(q["id"] for q in d0["items"]) == sorted(qids)


def test_pid_with_uid_marks_done(client):
    uid = "u-r362-a"
    qids = _seed_src_questions("2024pid标记卷", 25)
    pid = _seed_paper("pid 标记测试卷", qids)
    _log_answers(uid, qids[:4])
    d = client.get(f"/api/paper_questions?src=2024pid标记卷&pid={pid}&uid={uid}").json()
    by_id = {q["id"]: q for q in d["items"]}
    assert all(by_id[i]["done"] is True for i in qids[:4])
    assert all(by_id[i]["done"] is False for i in qids[4:])


def test_pid_scopes_out_same_source_extras(client):
    """同 source 超集不进会话：题集严格等于卷面交集。"""
    qids = _seed_src_questions("2024pid超集卷", 40)
    pid = _seed_paper("pid 超集测试卷", qids[:22])
    d = client.get(f"/api/paper_questions?src=2024pid超集卷&pid={pid}").json()
    assert [q["id"] for q in d["items"]] == qids[:22]
