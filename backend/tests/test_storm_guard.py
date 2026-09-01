"""R182 错误风暴防护：guard 纯逻辑 + 中间件集成。"""
from fastapi.testclient import TestClient

from app.main import app
from app.storm_guard import ErrorStormGuard


def test_guard_threshold_and_window():
    g = ErrorStormGuard(threshold=3, window=60.0)
    for i in range(3):
        assert not g.blocked("1.2.3.4", float(i))
        g.record("1.2.3.4", 404, float(i))
    assert g.blocked("1.2.3.4", 3.0)
    # 窗口滑出后自动解除
    assert not g.blocked("1.2.3.4", 100.0)
    # 2xx / 429（限速响应）不计数，4xx 计数
    g2 = ErrorStormGuard(threshold=1)
    g2.record("a", 200, 0.0)
    g2.record("a", 429, 0.0)
    assert not g2.blocked("a", 0.0)
    g2.record("a", 404, 0.0)
    assert g2.blocked("a", 0.0)


def test_guard_ip_isolation_and_lru():
    g = ErrorStormGuard(threshold=1, max_ips=2)
    g.record("a", 404, 0.0)
    assert g.blocked("a", 0.0)
    assert not g.blocked("b", 0.0)
    # 超 max_ips 淘汰最旧
    g.record("b", 404, 1.0)
    g.record("c", 404, 2.0)
    assert not g.blocked("a", 2.0)
    assert g.blocked("c", 2.0)


def test_middleware_429_and_health_exempt():
    from app import main as m

    orig = m._storm_guard
    m._storm_guard = ErrorStormGuard(threshold=3, window=60.0)
    try:
        c = TestClient(app)
        h = {"X-Kg-Ip": "9.9.9.9"}
        for _ in range(3):
            assert c.get("/api/exam/report/999999999?uid=x", headers=h).status_code == 404
        r = c.get("/api/stats", headers=h)
        assert r.status_code == 429
        assert r.headers.get("retry-after") == "60"
        assert "请求过于频繁" in r.json()["detail"]
        # 健康检查豁免；其他 IP 不受影响
        assert c.get("/api/health", headers=h).status_code == 200
        assert c.get("/api/stats", headers={"X-Kg-Ip": "8.8.8.8"}).status_code == 200
    finally:
        m._storm_guard = orig
