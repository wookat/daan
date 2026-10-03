"""B6：同类题难度四档——engine.similar_level_clause 映射 + /api/similar difficulty 校验。"""
from app import engine


def test_level_clause_mapping():
    assert engine.similar_level_clause("easier") == engine.SIMILAR_LEVELS["easier"]
    assert engine.similar_level_clause("combo") == engine.SIMILAR_LEVELS["combo"]
    # 未知/空档回落「难度相当」，旧客户端行为不变
    assert engine.similar_level_clause(None) == engine.SIMILAR_LEVELS["same"]
    assert engine.similar_level_clause("bogus") == engine.SIMILAR_LEVELS["same"]


def test_similar_prompt_includes_clause(monkeypatch):
    seen = {}

    async def fake_chat(msgs, **kw):
        seen["system"] = msgs[0]["content"]
        return "x"

    monkeypatch.setattr(engine.llm, "chat", fake_chat)
    import asyncio
    asyncio.run(engine.similar_question("题干", "题型", "harder"))
    assert engine.SIMILAR_LEVELS["harder"] in seen["system"]


def test_api_similar_rejects_bad_difficulty(client):
    # 校验分支在 LLM 调用之前：坏 difficulty 直接 400，不会触网
    r = client.post("/api/similar", json={"uid": "t", "question_text": "q", "difficulty": "ultra"})
    assert r.status_code == 400
