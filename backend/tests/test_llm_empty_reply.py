"""LLM HTTP 200 但 content 为空（推理模型把 max_tokens 全耗在 reasoning、finish_reason=length）：
chat_fast 备用端点空回复须回退主通道；主通道也空则抛错让调用方 502，不能以 200 返回空 analysis。
R399：备用端点 content 非空但 finish_reason=length（正文被截断）同样回退主通道；主通道截断正文照常返回（不为可用正文制造 502）；
错题分析/教练建议两个生成类路由改走主通道优先（chat），不再 rescue 优先。"""
import asyncio

import pytest

from app import llm


class _Resp:
    status_code = 200

    def __init__(self, content, finish=None):
        self._content = content
        self._finish = finish or ("length" if not content else "stop")

    def raise_for_status(self):
        return None

    def json(self):
        return {
            "choices": [
                {
                    "finish_reason": self._finish,
                    "message": {"role": "assistant", "content": self._content, "reasoning_content": "……"},
                }
            ]
        }


def _client(by_host: dict, calls: list[str]):
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
                    return content if isinstance(content, _Resp) else _Resp(content)
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


def test_chat_fast_truncated_rescue_falls_back_to_main(monkeypatch, _endpoints):
    """生产 R398 实录：rescue 正文 126 字止于「## 薄弱点诊断\n1」，finish_reason=length —— 不能当成功返给前端。"""
    calls: list[str] = []
    truncated = _Resp("## 错题画像\n……\n\n## 薄弱点诊断\n1", finish="length")
    monkeypatch.setattr(
        llm.httpx, "AsyncClient", _client({"http://rescue.test": truncated, "http://main.test": "## 错题画像 完整"}, calls)
    )
    out = asyncio.run(llm.chat_fast([{"role": "user", "content": "hi"}], max_tokens=900))
    assert out == "## 错题画像 完整"
    assert [u.split("/v1")[0] for u in calls] == ["http://rescue.test", "http://main.test"]


def test_chat_main_truncated_content_returned_as_is(monkeypatch, _endpoints):
    calls: list[str] = []
    monkeypatch.setattr(
        llm.httpx, "AsyncClient", _client({"http://main.test": _Resp("半截正文", finish="length")}, calls)
    )
    assert asyncio.run(llm.chat([{"role": "user", "content": "hi"}])) == "半截正文"
    assert len(calls) == 1


def test_truncated_reply_is_empty_reply_subclass():
    assert issubclass(llm.TruncatedReply, llm.EmptyReply)


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

    async def _not_used(*a, **k):
        raise AssertionError("错题分析不应再走 rescue 优先的 chat_fast")

    monkeypatch.setattr(llm, "chat", _empty)
    monkeypatch.setattr(llm, "chat_fast", _not_used)
    try:
        r = client.post("/api/mistakes/analysis", json={"uid": uid})
        assert r.status_code == 502
        assert r.json()["detail"] == "AI 未返回内容，请稍后再试"
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
        conn.commit()
        conn.close()
