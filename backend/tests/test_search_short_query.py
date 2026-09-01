"""短关键词搜索回归（R152）：1–2 字查询走单字分词 FTS，不再全表 LIKE 扫描。"""
from app import db, insights
from tests.conftest import seed_questions


def _backfill_all():
    while insights.fts_backfill() > 0:
        pass


def test_cjk_pad():
    assert insights._cjk_pad("隧道工程") == "隧 道 工 程"
    assert insights._cjk_pad("增长 率") == "增 长 率"
    assert insights._cjk_pad("") == ""


def test_short_query_hits_via_cjk_fts(client):
    seed_questions()
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer,"
        " explanation, is_real, disabled) VALUES ('changshi','单选题',"
        " '某隧道全长约 8 公里，下列说法正确的是？', '{}', 'A', '解析', 1, 0)"
    )
    conn.commit()
    conn.close()
    _backfill_all()
    r = client.get("/api/search", params={"q": "隧道", "type": "question"})
    assert r.status_code == 200
    items = r.json()["questions"]["items"]
    assert any("隧道" in it["question"] for it in items)


def test_short_query_fts_ready_and_indexed(client):
    seed_questions()
    _backfill_all()
    conn = db.get_conn()
    row = conn.execute("SELECT last_id FROM fts_sync WHERE k='questions_cjk'").fetchone()
    total_q = conn.execute("SELECT COALESCE(MAX(id),0) FROM questions").fetchone()[0]
    assert row and row["last_id"] >= total_q
    # 单字分词表 phrase MATCH 可命中种子题干
    hits = conn.execute(
        "SELECT rowid FROM question_fts_cjk WHERE question_fts_cjk MATCH ?",
        ('"题 干"',),
    ).fetchall()
    conn.close()
    assert hits


def test_long_query_still_uses_trigram(client):
    seed_questions()
    _backfill_all()
    r = client.get("/api/search", params={"q": "测试题干", "type": "question"})
    assert r.status_code == 200
    assert r.json()["questions"]["items"]
