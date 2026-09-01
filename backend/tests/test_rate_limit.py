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
