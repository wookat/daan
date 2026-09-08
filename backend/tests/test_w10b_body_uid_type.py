"""W10b：JSON body 里 uid 非字符串（数字/数组/对象）统一 400，而不是在账号 uid 守卫中间件里 TypeError 500。

生产回归（W10，rev de94fde）实测 POST /api/mistakes、/api/answer_log、/api/team/create 三处 500；
根因在 guard_account_uid：中间件不经过 app 的 ValueError/TypeError 处理器。
"""
import pytest

from app import auth

from .conftest import seed_questions

_BAD_UIDS = [123, ["test-w10b"], {"a": 1}, True]


@pytest.mark.parametrize("bad", _BAD_UIDS)
def test_mistakes_non_string_uid_is_400(client, bad):
    qid = seed_questions()[0]
    r = client.post("/api/mistakes", json={"uid": bad, "question_id": qid, "module": "changshi"})
    assert r.status_code == 400 and r.json()["detail"] == "参数格式错误"


@pytest.mark.parametrize("bad", _BAD_UIDS)
def test_answer_log_non_string_uid_is_400(client, bad):
    r = client.post("/api/answer_log", json={"uid": bad, "items": [{"question_id": 1, "picked": "A", "correct": False}]})
    assert r.status_code == 400


@pytest.mark.parametrize("bad", _BAD_UIDS)
def test_team_create_non_string_uid_is_400(client, bad):
    r = client.post("/api/team/create", json={"uid": bad, "name": "w10b"})
    assert r.status_code == 400


def test_string_uid_still_writes_after_bad_ones(client):
    qid = seed_questions()[0]
    client.post("/api/mistakes", json={"uid": ["x"], "question_id": qid, "module": "changshi"})
    r = client.post("/api/mistakes", json={"uid": "test-w10b-ok", "question_id": qid, "module": "changshi"})
    assert r.status_code == 200 and r.json()["id"]
    rows = client.get("/api/mistakes", params={"uid": "test-w10b-ok"}).json()["items"]
    assert len(rows) == 1
    for m in rows:
        assert client.delete(f"/api/mistakes/{m['id']}", params={"uid": "test-w10b-ok"}).status_code == 200


def test_account_uid_guard_still_applies_to_string_uid(client):
    r = client.post("/api/mistakes", json={"uid": "u1", "module": "changshi", "question_text": "x"})
    assert r.status_code == 403


def test_is_account_uid_type_safe():
    assert auth.is_account_uid("u12") is True
    assert auth.is_account_uid("abc") is False
    assert auth.is_account_uid(None) is False
    assert auth.is_account_uid(12) is False  # type: ignore[arg-type]
    assert auth.is_account_uid(["u1"]) is False  # type: ignore[arg-type]
