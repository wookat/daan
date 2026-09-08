"""R532：GET /api/paper/{code}?uid= 回包 submitted_pages——该 uid 对该卷已判过分的页（手动录入整卷记为 page 0，扫描答题卡为 1..P），
每页 first_at/last_at/n（不同作答次数）。无 uid 或从未判分（表未建 / 无行）为 []；只读、不建表、uid 隔离。"""
from app import db
from tests.conftest import seed_questions


def _table_exists():
    c = db.get_conn()
    ok = c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='paper_submits'").fetchone()
    c.close()
    return bool(ok)


def test_paper_info_submitted_pages_read_only_and_isolated(client):
    qids = seed_questions(3, ("yanyu", "panduan"))[:3]
    db.save_paper_export("R532SUB", qids, "R532 卷")
    uid = "r532-u"
    # 表未建：查询不建表、回 []
    assert not _table_exists() or db.paper_submitted_pages(uid, "R532SUB") == []
    info0 = client.get(f"/api/paper/R532SUB?uid={uid}").json()
    assert info0["submitted_pages"] == []
    assert client.get("/api/paper/R532SUB").json()["submitted_pages"] == []

    body = {"uid": uid, "code": "R532SUB", "picks": {"1": "A", "2": "B", "3": "C"}}
    assert client.post("/api/paper_answers", json=body).json()["saved"] is True
    info1 = client.get(f"/api/paper/R532SUB?uid={uid}").json()
    assert [e["page"] for e in info1["submitted_pages"]] == [0]
    e = info1["submitted_pages"][0]
    assert e["n"] == 1 and e["first_at"] == e["last_at"] > 0

    # 完全相同 → dup，n 不增；改一题 → 新作答，n=2、last_at ≥ first_at
    dup = client.post("/api/paper_answers", json=body).json()
    assert dup["dup"] is True and dup["dup_at"] == e["first_at"]  # 结果 sheet dup_at 与录入层 first_at 同一 created_at
    assert client.get(f"/api/paper/R532SUB?uid={uid}").json()["submitted_pages"][0]["n"] == 1
    body2 = {**body, "picks": {"1": "D", "2": "B", "3": "C"}}
    assert client.post("/api/paper_answers", json=body2).json()["saved"] is True
    e2 = client.get(f"/api/paper/R532SUB?uid={uid}").json()["submitted_pages"][0]
    assert e2["n"] == 2 and e2["last_at"] >= e2["first_at"] == e["first_at"]

    # uid 隔离 / 无 uid 不透出 / 未判过的卷 []
    assert client.get("/api/paper/R532SUB?uid=someone-else").json()["submitted_pages"] == []
    assert client.get("/api/paper/R532SUB").json()["submitted_pages"] == []
    db.save_paper_export("R532NEW", qids, "R532 新卷")
    assert client.get(f"/api/paper/R532NEW?uid={uid}").json()["submitted_pages"] == []


def test_submitted_pages_multi_page_scan(client, monkeypatch):
    qids = seed_questions(60, ("ziliao", "shuliang"))[:60]
    db.save_paper_export("R532P60", qids, "R532 两页卷")
    uid = "r532-scan"
    answers = {q["id"]: q["answer"] for q in db.questions_by_ids(qids)}
    monkeypatch.setattr("app.exam_api.omr.recognize", lambda raw: {"code": "R532P60", "page": 2, "picks": {0: answers[qids[50]]}})
    r = client.post("/api/scan_sheet", data={"uid": uid}, files={"image": ("s.png", b"fake", "image/png")}).json()
    assert r["page"] == 2 and r["saved"] is True
    sp = client.get(f"/api/paper/R532P60?uid={uid}").json()["submitted_pages"]
    assert [(e["page"], e["n"]) for e in sp] == [(2, 1)]
    # 手动录入整卷（page 0）与扫描页并存、按 page 升序
    picks = {str(i + 1): answers[qids[i]] for i in range(60)}
    assert client.post("/api/paper_answers", json={"uid": uid, "code": "R532P60", "picks": picks}).json()["saved"] is True
    sp2 = client.get(f"/api/paper/R532P60?uid={uid}").json()["submitted_pages"]
    assert [(e["page"], e["n"]) for e in sp2] == [(0, 1), (2, 1)]
