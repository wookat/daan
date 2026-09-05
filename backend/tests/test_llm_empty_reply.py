"""LLM HTTP 200 但 content 为空（推理模型把 max_tokens 全耗在 reasoning、finish_reason=length）：
chat_fast 备用端点空回复须回退主通道；主通道也空则抛错让调用方 502，不能以 200 返回空 analysis。"""
import asyncio

import pytest

from app import llm


class _Resp:
    status_code = 200

    def __init__(self, content):
        self._content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {
            "choices": [
                {
                    "finish_reason": "length" if not self._content else "stop",
                    "message": {"role": "assistant", "content": self._content, "reasoning_content": "……"},
                }
            ]
        }


def _client(by_host: dict[str, str], calls: list[str]):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, *a, **k):
            calls.append(url)
            for host, content in by_host.items():
                if url.startswith(host):
                    return _Resp(content)
            raise AssertionError(url)

    return _Client


@pytest.fixture
def _endpoints(monkeypatch):
    monkeypatch.setattr(llm, "RESCUE_BASE_URL", "http://rescue.test")
    monkeypatch.setattr(llm, "RESCUE_API_KEY", "k")
    monkeypatch.setattr(llm, "TEXT_BASE_URL", "http://main.test")
    monkeypatch.setattr(llm, "TEXT_API_KEY", "k")


def test_chat_fast_empty_rescue_falls_back_to_main(monkeypatch, _endpoints):
    calls: list[str] = []
    monkeypatch.setattr(
        llm.httpx, "AsyncClient", _client({"http://rescue.test": "", "http://main.test": "## 错题画像 x"}, calls)
    )
    out = asyncio.run(llm.chat_fast([{"role": "user", "content": "hi"}], max_tokens=900))
    assert out == "## 错题画像 x"
    assert [u.split("/v1")[0] for u in calls] == ["http://rescue.test", "http://main.test"]


def test_chat_fast_rescue_content_used_when_present(monkeypatch, _endpoints):
    calls: list[str] = []
    monkeypatch.setattr(llm.httpx, "AsyncClient", _client({"http://rescue.test": "ok"}, calls))
    assert asyncio.run(llm.chat_fast([{"role": "user", "content": "hi"}])) == "ok"
    assert len(calls) == 1


def test_chat_empty_content_raises(monkeypatch, _endpoints):
    calls: list[str] = []
    monkeypatch.setattr(llm.httpx, "AsyncClient", _client({"http://main.test": "   \n"}, calls))
    with pytest.raises(llm.EmptyReply):
        asyncio.run(llm.chat([{"role": "user", "content": "hi"}]))


def test_mistake_analysis_empty_reply_is_502_not_200(client, monkeypatch):
    from app import db

    uid = "kg_test_empty_llm"
    db.save_mistake(
        {
            "uid": uid,
            "module": "yanyu",
            "question_type": "逻辑填空",
            "question_text": f"空回复回归题 {uid}",
            "user_answer": "A",
            "correct_answer": "B",
            "methods": [],
        }
    )

    async def _empty(*a, **k):
        raise llm.EmptyReply("AI 未返回内容，请稍后再试")

    monkeypatch.setattr(llm, "chat_fast", _empty)
    try:
        r = client.post("/api/mistakes/analysis", json={"uid": uid})
        assert r.status_code == 502
        assert r.json()["detail"] == "AI 未返回内容，请稍后再试"
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
        conn.commit()
        conn.close()
