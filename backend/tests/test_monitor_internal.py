"""R392：转发中心监控（zalize-monitor）的 js/5xx 上报带 internal 标记——探针/内部走查触发的不计入告警。"""
import pytest
from fastapi.routing import APIRoute

from app import auth, monitor
from app import main as app_main

REAL_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"


@pytest.fixture
def captured(monkeypatch):
    calls: list[dict] = []

    def fake_report(kind, message, stack=None, url=None, ua=None, status=None, internal=False):
        calls.append(monitor.build_payload(kind, message, stack=stack, url=url, ua=ua,
                                           status=status, internal=internal))

    monkeypatch.setattr(app_main.monitor, "report", fake_report)
    return calls


def test_build_payload_carries_internal_flag_and_truncates():
    p = monitor.build_payload("js", "x" * 5000, stack="s" * 5000, url="u" * 900, ua="a" * 400,
                              internal=True)
    assert p["site"] == "kaogong" and p["kind"] == "js" and p["internal"] is True
    assert len(p["message"]) == 2000 and len(p["stack"]) == 2000
    assert len(p["url"]) == 500 and len(p["ua"]) == 300
    assert monitor.build_payload("5xx", "", status=502)["internal"] is False
    assert monitor.build_payload("5xx", "", status=502)["message"] == "(no message)"


def test_js_report_marks_probe_internal_three_paths(client, captured, monkeypatch):
    monkeypatch.setattr(auth, "PROBE_NETS", auth.parse_cidrs("140.232.64.0/24"))
    body = {"message": "vue:chunk-timeout: Async component timed out after 20000ms.",
            "stack": "Error: x", "url": "https://kaogong.zalize.com/#/pkgA/exam/list"}
    # 真人：边缘透传公网 IP + 真人 UA
    r = client.post("/api/monitor/report", json=body,
                    headers={"X-Kg-Ip": "39.158.40.85", "X-Kg-Ua": REAL_UA})
    assert r.status_code == 200 and captured[-1]["internal"] is False
    assert captured[-1]["ua"] == REAL_UA and captured[-1]["kind"] == "js"
    # 探针网段（sendBeacon 不带 X-Kg-Probe，靠 IP 主路）
    client.post("/api/monitor/report", json=body,
                headers={"X-Kg-Ip": "140.232.64.4", "X-Kg-Ua": REAL_UA})
    assert captured[-1]["internal"] is True
    # 显式头
    client.post("/api/monitor/report", json=body,
                headers={"X-Kg-Ip": "39.158.40.85", "X-Kg-Ua": REAL_UA, "X-Kg-Probe": "1"})
    assert captured[-1]["internal"] is True
    # 自动化 UA
    client.post("/api/monitor/report", json=body,
                headers={"X-Kg-Ip": "39.158.40.85", "X-Kg-Ua": "python-requests/2.32"})
    assert captured[-1]["internal"] is True
    assert len(captured) == 4


def test_js_report_rejects_bad_json(client, captured):
    r = client.post("/api/monitor/report", content=b"not json",
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    r = client.post("/api/monitor/report", json=[1, 2])
    assert r.status_code == 400
    assert captured == []


def test_5xx_report_marks_probe_internal(client, captured, monkeypatch):
    monkeypatch.setattr(auth, "PROBE_NETS", auth.parse_cidrs("140.232.64.0/24"))

    def _boom():
        raise RuntimeError("r392 boom")

    # 应用尾部有兜底路由，临时路由需插到最前
    app_main.app.router.routes.insert(0, APIRoute("/api/_test_r392_boom", _boom, methods=["GET"]))
    try:
        with pytest.raises(RuntimeError):
            client.get("/api/_test_r392_boom", headers={"X-Kg-Ip": "140.232.64.4", "X-Kg-Ua": REAL_UA})
        assert captured[-1]["kind"] == "5xx" and captured[-1]["status"] == 500
        assert captured[-1]["message"].startswith("RuntimeError: r392 boom")
        assert captured[-1]["internal"] is True
        with pytest.raises(RuntimeError):
            client.get("/api/_test_r392_boom", headers={"X-Kg-Ip": "39.158.40.85", "X-Kg-Ua": REAL_UA})
        assert captured[-1]["internal"] is False
    finally:
        app_main.app.router.routes[:] = [
            r for r in app_main.app.router.routes if getattr(r, "path", "") != "/api/_test_r392_boom"
        ]
