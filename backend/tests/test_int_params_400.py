"""R348-B1 写接口畸形数字参数 → 400（此前裸 int() 抛 500）。"""
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
