"""W12D-1 顺手：_RATE 过期键回收——login:/reg:<ip> 键随扫描 IP 无限增长，每 60s 丢弃超出最大窗口的键。"""
import pytest
from fastapi import HTTPException

from app import auth


@pytest.fixture(autouse=True)
def _clean_rate(monkeypatch):
    auth._RATE.clear()
    monkeypatch.setitem(auth._rate_sweep, "at", 0.0)
    monkeypatch.setitem(auth._rate_sweep, "window", 0)
    yield
    auth._RATE.clear()


def test_expired_keys_dropped_after_window(monkeypatch):
    t = 1_000_000.0
    monkeypatch.setattr(auth.time, "time", lambda: t)
    for i in range(50):
        auth.rate_limit(f"login:1.2.3.{i}:", 10, 300)
    assert len(auth._RATE) == 50

    t += 301
    auth.rate_limit("login:9.9.9.9:", 10, 300)
    assert set(auth._RATE) == {"login:9.9.9.9:"}


def test_sweep_throttled_and_keeps_live_keys(monkeypatch):
    t = 2_000_000.0
    monkeypatch.setattr(auth.time, "time", lambda: t)
    auth.rate_limit("reg:a", 10, 3600)
    t += 400
    auth.rate_limit("login:b:", 10, 300)
    # 10s 后再调：距上次 sweep 未满 60s，不扫；reg:a 仍在最大窗口 3600 内
    t += 10
    auth.rate_limit("login:c:", 10, 300)
    assert set(auth._RATE) == {"reg:a", "login:b:", "login:c:"}
    # 满 60s 后 sweep：以最大窗口 3600 为界，login:b:/login:c: 虽已过自身 300s 窗口仍保留，reg:a 未过期保留
    t += 60
    auth.rate_limit("login:d:", 10, 300)
    assert set(auth._RATE) == {"reg:a", "login:b:", "login:c:", "login:d:"}
    # 超过 3600s 后全部过期键回收
    t += 3601
    auth.rate_limit("login:e:", 10, 300)
    assert set(auth._RATE) == {"login:e:"}


def test_limit_semantics_unchanged(monkeypatch):
    t = 3_000_000.0
    monkeypatch.setattr(auth.time, "time", lambda: t)
    for _ in range(10):
        auth.rate_limit("reg:x", 10, 3600)
    with pytest.raises(HTTPException) as ei:
        auth.rate_limit("reg:x", 10, 3600)
    assert ei.value.status_code == 429
    t += 3601
    auth.rate_limit("reg:x", 10, 3600)
    assert len(auth._RATE["reg:x"]) == 1
