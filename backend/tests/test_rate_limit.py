"""R186 高成本接口限速口径：X-Kg-Ip 识别 + IP 桶恒生效防 uid 轮换。"""
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import auth
from app.deps import client_ip, rl


def _req(headers: dict | None = None, client: tuple | None = ("10.0.0.1", 1234)) -> Request:
    hdr = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    scope = {"type": "http", "method": "POST", "path": "/", "headers": hdr, "client": client}
    return Request(scope)


@pytest.fixture(autouse=True)
def _clean_rate():
    auth._RATE.clear()
    yield
    auth._RATE.clear()


def test_client_ip_prefers_x_kg_ip():
    assert client_ip(_req({"X-Kg-Ip": "1.2.3.4"})) == "1.2.3.4"
    assert client_ip(_req()) == "10.0.0.1"
    assert client_ip(_req(client=None)) == "anon"


def test_rl_anonymous_per_ip():
    a = _req({"X-Kg-Ip": "1.1.1.1"})
    b = _req({"X-Kg-Ip": "2.2.2.2"})
    for _ in range(2):
        rl(a, "t1", 2, 60)
    with pytest.raises(HTTPException) as ei:
        rl(a, "t1", 2, 60)
    assert ei.value.status_code == 429
    # 其他 IP 不受影响（不再共享同一匿名桶）
    rl(b, "t1", 2, 60)


def test_rl_uid_rotation_capped_by_ip_bucket():
    r = _req({"X-Kg-Ip": "3.3.3.3"})
    # 轮换 uid 绕过 uid 桶，但 IP 桶（3×limit）封顶
    for i in range(6):
        rl(r, "t2", 2, 60, uid=f"u{i}")
    with pytest.raises(HTTPException):
        rl(r, "t2", 2, 60, uid="u-new")


def test_rl_uid_bucket_kept():
    r = _req({"X-Kg-Ip": "4.4.4.4"})
    for _ in range(2):
        rl(r, "t3", 2, 60, uid="same")
    with pytest.raises(HTTPException):
        rl(r, "t3", 2, 60, uid="same")


def test_interview_answer_uid_rotation_capped_by_ip_bucket():
    """R187：面试 LLM 端点接入 rl()，轮换 uid 由 IP 桶（3×20/600s）封顶。"""
    from app.interview import _validate

    r = _req({"X-Kg-Ip": "5.5.5.5"})
    for i in range(60):
        with pytest.raises(HTTPException) as ei:
            _validate(r, {"uid": f"u{i}", "question_id": 0})
        assert ei.value.status_code == 404  # 通过限速，止步题目查找
    with pytest.raises(HTTPException) as ei:
        _validate(r, {"uid": "u-new", "question_id": 0})
    assert ei.value.status_code == 429


def test_team_create_uid_rotation_capped_by_ip_bucket():
    """R188：UGC DB 写端点接入 rl()，轮换 uid 由 IP 桶（3×5/3600s）封顶，不再无限插行。"""
    from app.team import api_team_create

    r = _req({"X-Kg-Ip": "8.8.8.8"})
    for i in range(15):
        with pytest.raises(HTTPException) as ei:
            api_team_create({"uid": f"u{i}", "name": ""}, r)
        assert ei.value.status_code == 400  # 通过限速，止步小队名校验
    with pytest.raises(HTTPException) as ei:
        api_team_create({"uid": "u-new", "name": ""}, r)
    assert ei.value.status_code == 429


def test_auth_register_rate_per_real_ip():
    """R187：注册限速按 X-Kg-Ip 计数，不再全站共享固定代理 IP 桶。"""
    for _ in range(10):
        auth.rate_limit(f"reg:{auth.client_ip(_req({'X-Kg-Ip': '6.6.6.6'}))}", 10, 3600)
    with pytest.raises(HTTPException):
        auth.rate_limit(f"reg:{auth.client_ip(_req({'X-Kg-Ip': '6.6.6.6'}))}", 10, 3600)
    auth.rate_limit(f"reg:{auth.client_ip(_req({'X-Kg-Ip': '7.7.7.7'}))}", 10, 3600)


def test_answer_log_uid_rotation_capped_by_ip_bucket():
    """R189：零限速匿名写端点接入 rl()，answer_log 轮换 uid 由 IP 桶（3×120/3600s）封顶。"""
    from app.study_api import api_answer_log

    r = _req({"X-Kg-Ip": "9.9.9.9"})
    for i in range(360):
        with pytest.raises(HTTPException) as ei:
            api_answer_log({"uid": f"u{i}", "items": []}, r)
        assert ei.value.status_code == 400  # 通过限速，止步空 items 校验，不插行
    with pytest.raises(HTTPException) as ei:
        api_answer_log({"uid": "u-new", "items": []}, r)
    assert ei.value.status_code == 429


def test_rate_endpoint_per_ip_60_per_600s():
    """W3-A：/api/rate 匿名 IP 桶 60/600s，第 61 次 429；另一 IP 不受影响。"""
    from app.ai_api import api_rate

    a = _req({"X-Kg-Ip": "12.12.12.12"})
    for _ in range(60):
        with pytest.raises(HTTPException) as ei:
            api_rate({}, a)
        assert ei.value.status_code == 400  # 通过限速，止步缺 key/question_id 校验
    with pytest.raises(HTTPException) as ei:
        api_rate({}, a)
    assert ei.value.status_code == 429
    with pytest.raises(HTTPException) as ei:
        api_rate({}, _req({"X-Kg-Ip": "13.13.13.13"}))
    assert ei.value.status_code == 400


def test_rate_endpoint_http_429(client):
    """经 HTTP 栈：同 IP 连发 61 次，第 61 次 429（前 60 次业务 200）。"""
    hdr = {"X-Kg-Ip": "14.14.14.14"}
    for _ in range(60):
        r = client.post("/api/rate", json={"key": "w3-rate-key", "up": True}, headers=hdr)
        assert r.status_code == 200
    r = client.post("/api/rate", json={"key": "w3-rate-key", "up": True}, headers=hdr)
    assert r.status_code == 429


def test_report_anonymous_per_ip():
    """R189：/api/report 匿名按真实 IP 20/3600，另一 IP 不受影响。"""
    from app.study_api import api_report

    a = _req({"X-Kg-Ip": "10.10.10.10"})
    for _ in range(20):
        with pytest.raises(HTTPException) as ei:
            api_report({"reason": "bogus"}, a)
        assert ei.value.status_code == 400  # 通过限速，止步无效 reason 校验，不插行
    with pytest.raises(HTTPException) as ei:
        api_report({"reason": "bogus"}, a)
    assert ei.value.status_code == 429
    with pytest.raises(HTTPException) as ei:
        api_report({"reason": "bogus"}, _req({"X-Kg-Ip": "11.11.11.11"}))
    assert ei.value.status_code == 400
