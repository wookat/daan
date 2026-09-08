"""R529：多页答题卡（PER_PAGE=50 分页）——scan_sheet 只判上传那一页，回包透出整卷答题卡页数 pages，
paper/{code} 同样带 pages；页数公式与 pdf_export 出卡同一 omr.sheet_pages()。"""
from app import db, exam_api, omr
from tests.conftest import seed_questions


def test_sheet_pages_formula_matches_per_page():
    assert omr.PER_PAGE == 50
    assert omr.sheet_pages(0) == 1
    assert omr.sheet_pages(1) == 1
    assert omr.sheet_pages(50) == 1
    assert omr.sheet_pages(51) == 2
    assert omr.sheet_pages(60) == 2
    assert omr.sheet_pages(100) == 2
    assert omr.sheet_pages(101) == 3


def test_paper_info_and_scan_sheet_return_pages(client, monkeypatch):
    qids = seed_questions(12, ("ziliao", "shuliang", "yanyu", "panduan", "changshi"))[:60]
    assert len(qids) == 60
    db.save_paper_export("R529P60", qids, "R529 六十题卷")
    info = client.get("/api/paper/R529P60").json()
    assert info["n"] == 60 and info["pages"] == 2

    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R529P60", "page": 1, "picks": {0: "A", 1: "B"}})
    body = client.post("/api/scan_sheet", data={"uid": "r529-anon"}, files={"image": ("s.png", b"fake", "image/png")}).json()
    assert body["page"] == 1 and body["pages"] == 2 and body["total"] == 50
    assert [i["no"] for i in body["items"]][:2] == [1, 2] and body["items"][-1]["no"] == 50

    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R529P60", "page": 2, "picks": {0: "A"}})
    body = client.post("/api/scan_sheet", data={"uid": "r529-anon"}, files={"image": ("s.png", b"fake", "image/png")}).json()
    assert body["page"] == 2 and body["pages"] == 2 and body["total"] == 10
    assert [i["no"] for i in body["items"]] == list(range(51, 61))
    assert body["answered"] == 1 and body["items"][0]["question_id"] == qids[50]

    # 单页卷 pages=1（既有形态不变）
    db.save_paper_export("R529P3", qids[:3], "R529 三题卷")
    assert client.get("/api/paper/R529P3").json()["pages"] == 1
    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R529P3", "page": 1, "picks": {}})
    body = client.post("/api/scan_sheet", data={"uid": "r529-anon"}, files={"image": ("s.png", b"fake", "image/png")}).json()
    assert body["pages"] == 1 and body["total"] == 3
