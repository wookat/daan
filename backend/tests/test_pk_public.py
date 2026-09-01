from .conftest import seed_pk


def test_pk_result_finished_public_fields_only(client):
    seed_pk("TSTAPI1", status="finished", creator_score=120, opponent_score=90)
    r = client.get("/api/pk/result/TSTAPI1")
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == "TSTAPI1"
    assert body["creator"] == {
        "role": "creator", "name": "测试甲", "score": 120, "correct": 4, "time_ms": 60000,
    }
    assert body["opponent"]["name"] == "测试乙"
    assert body["n_questions"] == 5
    # 不泄露 uid / 逐题答案
    flat = str(body)
    assert "utestcreator" not in flat and "answers" not in flat


def test_pk_result_waiting_404(client):
    seed_pk("TSTAPIW", status="waiting")
    assert client.get("/api/pk/result/TSTAPIW").status_code == 404


def test_pk_result_unknown_404(client):
    assert client.get("/api/pk/result/NOPE42").status_code == 404
