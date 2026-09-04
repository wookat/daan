"""R348-B1 写接口畸形数字参数 → 400（此前裸 int() 抛 500）；W2 全局 ValueError/TypeError → 400 兜底。"""
import pytest
from fastapi import HTTPException

from app import db, interview
from app.deps import as_int

from .conftest import seed_questions, seed_share

BAD = "参数格式错误"


def test_as_int_semantics():
    assert as_int(None) == 0
    assert as_int("") == 0
    assert as_int(None, 7) == 7
    assert as_int("12") == 12
    assert as_int(3.9) == 3
    for v in ("abc", "1.5", [1], {"a": 1}):
        with pytest.raises(HTTPException) as ei:
            as_int(v)
        assert ei.value.status_code == 400
        assert ei.value.detail == BAD


@pytest.mark.parametrize(
    "body",
    [
        {"n": "abc"},
        {"n": 10, "correct": "x"},
        {"n": 10, "correct": 5, "secs": [1]},
        {"n": 10, "secs": "1.5"},
    ],
)
def test_practice_result_bad_numbers_400(client, body):
    r = client.post("/api/practice_result", json={"module": "yanyu", **body})
    assert r.status_code == 400, r.text
    assert r.json()["detail"] in (BAD, "无效题量")


def test_practice_result_valid_still_200(client):
    r = client.post("/api/practice_result", json={"module": "yanyu", "n": "10", "correct": 7, "secs": 300})
    assert r.status_code == 200, r.text
    assert "percentile" in r.json() or r.json()


def test_share_answer_bad_secs_400_and_no_partial_write(client):
    qid = seed_questions(1, ("yanyu",))[0]
    seed_share("w1intsid", qid)
    uid = "test-w1-int-share"
    r = client.post("/api/share/w1intsid/answer", json={"uid": uid, "picked": "A", "secs": "abc"})
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == BAD
    conn = db.get_conn()
    try:
        n = conn.execute(
            "SELECT COUNT(*) FROM shared_answers WHERE uid=?", (uid,)
        ).fetchone()[0]
    finally:
        conn.close()
    assert n == 0
    r = client.post("/api/share/w1intsid/answer", json={"uid": uid, "picked": "A", "secs": 12})
    assert r.status_code == 200, r.text
    conn = db.get_conn()
    conn.execute("DELETE FROM shared_answers WHERE uid=?", (uid,))
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def test_interview_bad_numbers_400(client):
    uid = "test-w1-int-itv"
    r = client.post("/api/interview/answer/stream", json={"uid": uid, "question_id": "abc", "answer": "x" * 30})
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == BAD
    qid = interview.bank()["questions"][0]["id"]
    r = client.post(
        "/api/interview/answer/stream",
        json={"uid": uid, "question_id": qid, "answer": "x" * 30, "duration_sec": "abc"},
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"] == BAD
    r = client.post("/api/interview/answer/stream", json={"uid": uid, "question_id": 0, "answer": "x" * 30})
    assert r.status_code == 404


@pytest.mark.parametrize("ids", [["abc"], [1, "1.5"], [None], [[1]]])
def test_export_pdf_bad_ids_400_json(client, ids):
    """exam_api 裸 int() 由 main._bad_param_handler 兜底：JSON 400 而非 500。"""
    r = client.post("/api/export/pdf", json={"uid": "test-w2-export", "question_ids": ids})
    assert r.status_code == 400, r.text
    assert r.json() == {"detail": BAD}


def test_export_pdf_valid_ids_not_400(client):
    qid = seed_questions(1, ("yanyu",))[0]
    r = client.post("/api/export/pdf", json={"uid": "test-w2-export", "question_ids": [str(qid)]})
    assert r.status_code != 400, r.text


def test_save_mistake_bad_question_id_400_no_text_write(client):
    uid = "test-w2-mist-bad"
    for bad in ("abc", "1.5", [1], {"a": 1}):
        r = client.post("/api/mistakes", json={"uid": uid, "question_id": bad, "question_text": "畸形 id 题干"})
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == BAD
    conn = db.get_conn()
    try:
        n = conn.execute("SELECT COUNT(*) FROM mistakes WHERE uid=?", (uid,)).fetchone()[0]
    finally:
        conn.close()
    assert n == 0


def test_save_mistake_question_id_normalized_to_integer(client):
    """字符串数字 → INTEGER 落库；空/0 → NULL，库中不出现 TEXT 型 question_id。"""
    qid = seed_questions(1, ("shuliang",))[0]
    uid = "test-w2-mist-norm"
    r = client.post("/api/mistakes", json={"uid": uid, "question_id": str(qid), "question_text": "w2 题干 A"})
    assert r.status_code == 200, r.text
    r = client.post("/api/mistakes", json={"uid": uid, "question_id": "", "question_text": "w2 题干 B"})
    assert r.status_code == 200, r.text
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT question_id, typeof(question_id) t FROM mistakes WHERE uid=? ORDER BY id", (uid,)
        ).fetchall()
        assert [(r["question_id"], r["t"]) for r in rows] == [(qid, "integer"), (None, "null")]
        assert conn.execute("SELECT COUNT(*) FROM mistakes WHERE typeof(question_id)='text'").fetchone()[0] == 0
        conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
        conn.commit()
    finally:
        conn.close()


def test_bad_param_handler_only_masks_api_paths():
    """非 /api 路径（SEO 页等）的 ValueError 原样抛出保留 500 语义；/api 路径返 JSON 400。"""
    import asyncio

    from starlette.requests import Request

    from app.main import _bad_param_handler

    def req(path: str) -> Request:
        return Request({"type": "http", "method": "GET", "path": path, "headers": [], "query_string": b""})

    resp = asyncio.run(_bad_param_handler(req("/api/x"), TypeError("x")))
    assert resp.status_code == 400 and resp.body == b'{"detail":"' + BAD.encode() + b'"}'
    with pytest.raises(ValueError):
        asyncio.run(_bad_param_handler(req("/tiku/q/1"), ValueError("x")))
