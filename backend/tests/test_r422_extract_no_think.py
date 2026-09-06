"""R422：文字识题（extract_question 无图路径）关闭推理模型 thinking 阶段。
生产实测（容器内直连网关，4 题）：现行 chat_fast→rescue kimi-k3 8.6–18.4 s（reasoning_tokens 171–513）；
主文本通道 deepseek-v4-pro 带 `thinking:{type:disabled}` 2.4–3.3 s、reasoning_tokens 0、模块 4/4 一致；
kimi-k3 不识别关闭字段（reasoning_tokens 仍 259–420）。故 think=False 时改为主文本通道优先、请求体带关闭字段，
主通道 5xx/配额不足仍由 chat() 回落备用端点；其余 chat_fast 调用方（追问/申论批改/面试评分）与含图识题不变。"""
import asyncio
import json

import pytest

from app import engine, llm


class _Resp:
    status_code = 200

    def __init__(self, content, status=200):
        self._content = content
        self.status_code = status

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": self._content}}]}


def _client(by_host: dict, calls: list[tuple[str, dict]]):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, *a, json=None, **k):
            calls.append((url, json))
            for host, content in by_host.items():
                if url.startswith(host):
                    return content if isinstance(content, _Resp) else _Resp(content)
            raise AssertionError(url)

    return _Client


@pytest.fixture
def _endpoints(monkeypatch):
    monkeypatch.setattr(llm, "RESCUE_BASE_URL", "http://rescue.test")
    monkeypatch.setattr(llm, "RESCUE_API_KEY", "k")
    monkeypatch.setattr(llm, "RESCUE_MODEL", "kimi")
    monkeypatch.setattr(llm, "TEXT_BASE_URL", "http://main.test")
    monkeypatch.setattr(llm, "TEXT_API_KEY", "k")
    monkeypatch.setattr(llm, "TEXT_MODEL", "ds-pro")
    monkeypatch.setattr(llm, "FALLBACK_MODEL", "ds-pro")


def test_body_no_think_adds_disable_field():
    b = llm._body("m", [{"role": "user", "content": "x"}], 0.2, 100, think=False)
    assert b["thinking"] == {"type": "disabled"}
    assert llm._body("m", [], 0.2, 100)["model"] == "m"
    assert "thinking" not in llm._body("m", [], 0.2, 100)


def test_chat_fast_default_still_rescue_first_without_disable(_endpoints, monkeypatch):
    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(llm.httpx, "AsyncClient", _client({"http://rescue.test": "ok"}, calls))
    out = asyncio.run(llm.chat_fast([{"role": "user", "content": "追问"}]))
    assert out == "ok"
    assert [u for u, _ in calls] == ["http://rescue.test/v1/chat/completions"]
    assert "thinking" not in calls[0][1]


def test_chat_fast_no_think_goes_main_text_channel_with_disable(_endpoints, monkeypatch):
    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(llm.httpx, "AsyncClient", _client({"http://main.test": "ok"}, calls))
    out = asyncio.run(llm.chat_fast([{"role": "user", "content": "识题"}], think=False))
    assert out == "ok"
    assert [u for u, _ in calls] == ["http://main.test/v1/chat/completions"]
    body = calls[0][1]
    assert body["model"] == "ds-pro"
    assert body["thinking"] == {"type": "disabled"}


def test_chat_no_think_main_5xx_falls_back_to_rescue_with_same_flag(_endpoints, monkeypatch):
    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(llm.asyncio, "sleep", _nosleep)
    monkeypatch.setattr(
        llm.httpx,
        "AsyncClient",
        _client({"http://main.test": _Resp("", status=503), "http://rescue.test": "rescued"}, calls),
    )
    out = asyncio.run(llm.chat([{"role": "user", "content": "识题"}], think=False))
    assert out == "rescued"
    hosts = [u.split("/v1")[0] for u, _ in calls]
    assert hosts[-1] == "http://rescue.test"
    assert all(b["thinking"] == {"type": "disabled"} for _, b in calls)


async def _nosleep(_s):
    return None


def test_extract_question_text_uses_no_think_image_keeps_think(monkeypatch):
    seen: list[dict] = []

    async def fake_chat_json(messages, fast=False, **kw):
        seen.append({"fast": fast, **kw, "has_image": llm._has_image(messages)})
        return {"question_text": "q", "module": "yanyu"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    asyncio.run(engine.extract_question(None, None, "某题干……"))
    asyncio.run(engine.extract_question("aGk=", "image/png", None))
    assert seen[0]["fast"] is True and seen[0]["think"] is False and seen[0]["has_image"] is False
    assert seen[1]["fast"] is False and seen[1]["think"] is True and seen[1]["has_image"] is True


def test_chat_json_passes_think_through(_endpoints, monkeypatch):
    calls: list[tuple[str, dict]] = []
    payload = json.dumps({"question_text": "q", "module": "shuliang"}, ensure_ascii=False)
    monkeypatch.setattr(llm.httpx, "AsyncClient", _client({"http://main.test": payload}, calls))
    data = asyncio.run(llm.chat_json([{"role": "user", "content": "x"}], fast=True, max_tokens=2000, think=False))
    assert data["module"] == "shuliang"
    assert calls[0][1]["max_tokens"] == 2000 and calls[0][1]["thinking"] == {"type": "disabled"}
