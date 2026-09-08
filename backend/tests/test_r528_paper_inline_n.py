"""R528：导出卷内无 id 的内联题（时政/手录）数 inline_n 落 paper_exports，并随
paper/{code}、paper_answers、scan_sheet 回包——录入层/结果层能说明「卷有 N+M 题、只判 N 题」。"""
from app import db, exam_api
from tests.conftest import seed_questions

SZ_ITEM = {"id": None, "module": "时政", "question": "R528：某会议的说法正确的是\nA.甲 B.乙 C.丙 D.丁", "options": {}, "answer": "C"}


def _row(code):
    conn = db.get_conn()
    r = conn.execute("SELECT * FROM paper_exports WHERE code=?", (code,)).fetchone()
    conn.close()
    return dict(r) if r else None


def test_save_and_get_paper_export_round_trips_inline_n():
    qids = seed_questions(2, ("ziliao",))[:2]
    db.save_paper_export("R528MIX1", qids, "R528 混合卷", inline_n=2)
    db.save_paper_export("R528ORD1", qids, "R528 普通卷")
    assert db.get_paper_export("R528MIX1")["inline_n"] == 2
    assert db.get_paper_export("R528ORD1")["inline_n"] == 0


def test_legacy_paper_exports_without_column_reads_zero_then_migrates():
    conn = db.get_conn()
    conn.execute("DROP TABLE IF EXISTS paper_exports")
    conn.execute(
        "CREATE TABLE paper_exports (code TEXT PRIMARY KEY, created_at REAL NOT NULL, title TEXT, question_ids TEXT NOT NULL)"
    )
    conn.execute("INSERT INTO paper_exports VALUES ('R528OLD1', 1.0, '旧卷', '[1,2]')")
    conn.commit()
    conn.close()
    old = db.get_paper_export("R528OLD1")
    assert old["question_ids"] == [1, 2] and old["inline_n"] == 0
    db.save_paper_export("R528NEW1", [3], "新卷", inline_n=1)
    conn = db.get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(paper_exports)")}
    conn.close()
    assert "inline_n" in cols
    assert db.get_paper_export("R528OLD1")["inline_n"] == 0
    assert db.get_paper_export("R528NEW1")["inline_n"] == 1
    # 列已存在时再加列不应报错（幂等）
    conn = db.get_conn()
    assert db.add_column_if_missing(conn, "paper_exports", "inline_n", "INTEGER DEFAULT 0") is False
    conn.close()


def test_export_pdf_records_inline_n_and_paper_info_returns_it(client):
    qids = seed_questions(2, ("changshi",))[:2]
    r = client.post("/api/export/pdf", json={"uid": "r528-anon", "title": "R528 混合", "question_ids": qids, "items": [SZ_ITEM]})
    assert r.status_code == 200
    code = r.headers["X-Paper-Code"]
    row = _row(code)
    assert row["inline_n"] == 1 and len(db.get_paper_export(code)["question_ids"]) == 2
    info = client.get(f"/api/paper/{code}").json()
    assert info["n"] == 2 and info["inline_n"] == 1
    # 纯普通卷 inline_n = 0
    r2 = client.post("/api/export/pdf", json={"uid": "r528-anon", "question_ids": qids})
    assert client.get(f"/api/paper/{r2.headers['X-Paper-Code']}").json()["inline_n"] == 0


def test_paper_answers_and_scan_sheet_carry_inline_n(client, monkeypatch):
    qids = seed_questions(2, ("shuliang",))[:2]
    db.save_paper_export("R528SCN1", qids, "R528 扫描卷", inline_n=3)
    r = client.post("/api/paper_answers", json={"code": "R528SCN1", "uid": "r528-anon", "picks": {"1": "A", "2": "B"}})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2 and body["inline_n"] == 3 and [i["no"] for i in body["items"]] == [1, 2]

    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R528SCN1", "page": 1, "picks": {0: "A", 1: "A"}})
    r = client.post("/api/scan_sheet", data={"uid": "r528-anon"}, files={"image": ("s.png", b"fake", "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2 and body["correct"] == 2 and body["inline_n"] == 3 and body["page"] == 1
