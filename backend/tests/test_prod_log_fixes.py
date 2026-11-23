"""线上日志异常排查回归：SSE 15s 保活防 524、SEO 真题列表分页 /tiku/papers/page/{n} 301 重定向。"""
import asyncio
import json

from app.api import ai as ai_api
from app.services import engine, sse


def test_explain_stream_emits_keepalive_during_slow_extract_and_llm(client, monkeypatch):
    async def _slow_extract(image_b64, mime, text):
        await asyncio.sleep(0.06)
        return {"question_text": text, "module": "yanyu", "question_type": "言语-主旨", "user_answer": None}

    def _slow_explain_stream(extracted, user_answer=None, with_thinking=False):
        async def gen():
            await asyncio.sleep(0.06)
            yield "【答案】A｜【方法】中心理解｜【一句话】选 A"
        return gen()

    monkeypatch.setattr(sse, "KEEPALIVE_SEC", 0.02)
    monkeypatch.setattr(engine, "extract_question", _slow_extract)
    monkeypatch.setattr(engine, "explain_stream", _slow_explain_stream)
    monkeypatch.setattr(ai_api, "THINKING_TICK_SEC", 0.0)
    monkeypatch.setattr("app.db.get_explain_cache", lambda k: None)
    monkeypatch.setattr("app.db.save_explain_cache", lambda *a, **k: None)

    r = client.post("/api/explain/stream", data={"text": "某一段需要慢速识题与解析的文字材料？"})
    assert r.status_code == 200
    assert ": ping\n\n" in r.text

    events = []
    for block in r.text.split("\n\n"):
        if not block.strip() or block.lstrip().startswith(":"):
            continue
        ev, data = "message", None
        for line in block.split("\n"):
            if line.startswith("event:"):
                ev = line[6:].strip()
            elif line.startswith("data:"):
                data = json.loads(line[5:].strip())
        if data is not None:
            events.append((ev, data))
    assert [e for e, _ in events] == ["meta", "message", "done"]


def test_tiku_papers_legacy_page_path_redirects_301(client):
    r2 = client.get("/tiku/papers/page/2", follow_redirects=False)
    assert r2.status_code == 301
    assert r2.headers["location"] == "/tiku/papers/?page=2"

    r2s = client.get("/tiku/papers/page/2/", follow_redirects=False)
    assert r2s.status_code == 301
    assert r2s.headers["location"] == "/tiku/papers/?page=2"

    r1 = client.get("/tiku/papers/page/1", follow_redirects=False)
    assert r1.status_code == 301
    assert r1.headers["location"] == "/tiku/papers/"
