"""R424：① 面试点评同题同答四变体直连上游对比（pro 开推理正文首字 52–62 s / 关推理 1.8–6.6 s，质量同级）
→ 两条点评流 + 非流式 /answer 走主通道 think=False（with_thinking 仍开，网关忽略关闭字段时进度不丢）。
② explain_cache 24 行「题目存疑」全是 `_suspect_reason` 的「题干 <8 汉字」死规则命中：数列 / 类比等短题干真题被误拦
→ 兜底只拦「无中文、无数据、无成套选项」；存疑固定文案不再写缓存（此前把误拦结果永久固化）。"""
import asyncio
import json

from app import ai_api, db, engine, interview, llm, sse

from .conftest import seed_questions

SUSPECT_INPUTS = [
    "",
    "测试",
    "1+1等于几",
    "j#@!kf 8s^&df ---===]][[ qqq zzz 000",
    "7f3q9z A. 1 B. 2 C. 3 D. 4",
    "q2w8ez7 A.1 B.2 C.3 D.4",
    "1+1等于几？A.1 B.2 C.3 D.4",
]
VALID_SHORT_INPUTS = [
    "3, 6, 12, 24, ( )？ A.36 B.48 C.42 D.30",
    "3,7,13,21,31,? A.41 B.43 C.45 D.47",
    "儿童：女童：未成年 A.房屋：卧室：住宅 B.水果：苹果：食物 C.动物：猫：宠物 D.学生：小学生：未成年",
    "1，4，9，16，（ ） A．20 B．25 C．30 D．36",
]


def test_suspect_heuristic_blocks_garbage_and_passes_short_real_questions():
    for t in SUSPECT_INPUTS:
        assert engine.is_suspect(t), t
    for t in VALID_SHORT_INPUTS:
        assert not engine.is_suspect(t), t
    assert not engine.is_suspect("战国屈原投江相传所在的河流是：")  # ≥8 汉字，无选项由模型判断（不变）
    assert engine.is_suspect("3, 6, 12, 24, ( )？")  # 数列无选项：仍兜底拦截


def test_explain_stream_short_circuits_only_for_suspect():
    async def collect(t):
        return [x async for x in engine.explain_stream({"question_text": t, "module": "shuliang"})]

    assert asyncio.run(collect("7f3q9z A. 1 B. 2 C. 3 D. 4")) == [engine._SUSPECT_TEXT]


def _sse(body: str):
    out = []
    for block in body.split("\n\n"):
        if not block.strip():
            continue
        ev, data = "message", None
        for line in block.split("\n"):
            if line.startswith("event:"):
                ev = line[6:].strip()
            elif line.startswith("data:"):
                data = json.loads(line[5:].strip())
        out.append((ev, data))
    return out


def test_suspect_verdict_not_cached_but_real_explanation_is(client, monkeypatch):
    saved: list[str] = []

    async def _extract(image_b64, mime, text):
        return {"question_text": text, "module": "shuliang", "question_type": "数量-数列", "user_answer": None}

    def _explain_stream(extracted, user_answer=None, with_thinking=False):
        async def gen():
            yield engine._SUSPECT_TEXT if engine.is_suspect(extracted["question_text"]) else "【答案】B｜【方法】倍数｜【一句话】×2"
        return gen()

    monkeypatch.setattr(engine, "extract_question", _extract)
    monkeypatch.setattr(engine, "explain_stream", _explain_stream)
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda key, meta, expl: saved.append(expl))
    monkeypatch.setattr(ai_api, "THINKING_TICK_SEC", 0.0)

    r = client.post("/api/explain/stream", data={"text": "7f3q9z A. 1 B. 2 C. 3 D. 4"})
    evs = _sse(r.text)
    assert r.status_code == 200 and evs[0][1]["module"] is None
    assert next(d for e, d in evs if e == "message")["d"] == engine._SUSPECT_TEXT
    assert saved == []

    r = client.post("/api/explain/stream", data={"text": "3, 6, 12, 24, ( )？ A.36 B.48 C.42 D.30"})
    evs = _sse(r.text)
    assert evs[0][1]["module"] == "shuliang" and evs[0][1]["module_name"]
    assert saved and all(s.startswith("【答案】B") for s in saved)  # key + raw_key 两条


def test_non_stream_explain_does_not_cache_suspect(client, monkeypatch):
    seed_questions()
    saved: list[str] = []

    async def _extract(image_b64, mime, text):
        return {"question_text": text, "module": "panduan", "question_type": None, "user_answer": None}

    monkeypatch.setattr(engine, "extract_question", _extract)
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda key, meta, expl: saved.append(expl))
    r = client.post("/api/explain", data={"text": "z9k3xw A. 1 B. 2 C. 3 D. 4"})
    assert r.status_code == 200 and r.json()["explanation"] == engine._SUSPECT_TEXT and r.json()["module"] is None
    assert saved == []


# ---------- 面试点评关推理 ----------

REVIEW = "## 逐段点评\n" + "> 引用\n\n✅ 好 ⚠️ 差\n" * 40


def test_review_streams_disable_thinking_but_keep_progress_events(client, monkeypatch):
    seen: list[dict] = []

    def _stream(messages, temperature=0.2, max_tokens=4000, with_thinking=False, think=True):
        seen.append({"think": think, "with_thinking": with_thinking, "max_tokens": max_tokens})

        async def gen():
            yield llm.Thinking(4)
            yield REVIEW
        return gen()

    async def fake_chat_json(messages, fast=False, **kw):
        return {"scores": {d: 6 for d in interview.DIMENSIONS}, "summary": "s"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    monkeypatch.setattr(llm, "chat_stream", _stream)
    monkeypatch.setattr(sse, "THINKING_TICK_SEC", 0.0)
    q = interview.bank()["questions"][0]
    r = client.post("/api/interview/answer/stream", json={"uid": "test-r424-itv", "question_id": q["id"], "answer": "x" * 40})
    assert r.status_code == 200
    assert [e for e, _ in _sse(r.text)] == ["meta", "thinking", "message", "done"]
    sid = interview._save_session("test-r424-itv", q, "x" * 40, 30, {d: 5 for d in interview.DIMENSIONS}, 50, "")
    assert client.post(f"/api/interview/sessions/{sid}/review/stream", json={"uid": "test-r424-itv"}).status_code == 200
    assert seen == [{"think": False, "with_thinking": True, "max_tokens": interview.REVIEW_MAX_TOKENS}] * 2


def test_non_stream_answer_disables_thinking(client, monkeypatch):
    seen = {}

    async def fake_chat_json(messages, fast=False, **kw):
        return {"scores": {d: 6 for d in interview.DIMENSIONS}, "summary": "s"}

    async def fake_chat(messages, temperature=0.2, max_tokens=4000, think=True):
        seen.update(think=think, max_tokens=max_tokens)
        return REVIEW

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    monkeypatch.setattr(llm, "chat", fake_chat)
    q = interview.bank()["questions"][0]
    r = client.post("/api/interview/answer", json={"uid": "test-r424-ns", "question_id": q["id"], "answer": "x" * 40})
    assert r.status_code == 200 and r.json()["review"] == REVIEW
    assert seen == {"think": False, "max_tokens": interview.REVIEW_MAX_TOKENS}


def test_chat_stream_think_false_sends_disable_field(monkeypatch):
    bodies: list[dict] = []

    class _Resp:
        status_code = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def raise_for_status(self):
            pass

        async def aiter_lines(self):
            yield "data: " + json.dumps({"choices": [{"delta": {"content": "正文"}, "finish_reason": "stop"}]})
            yield "data: [DONE]"

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def stream(self, method, url, headers=None, json=None):
            bodies.append(json)
            return _Resp()

    monkeypatch.setattr(llm.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(llm, "_endpoint", lambda m: ("http://x", "k", "m1"))
    monkeypatch.setattr(llm, "FALLBACK_MODEL", "")
    monkeypatch.setattr(llm, "_rescue_ok", lambda m: False)

    async def run(**kw):
        return [x async for x in llm.chat_stream([{"role": "user", "content": "q"}], **kw)]

    assert asyncio.run(run(think=False)) == ["正文"]
    assert asyncio.run(run()) == ["正文"]
    assert bodies[0]["thinking"] == {"type": "disabled"} and bodies[0]["stream"] is True
    assert "thinking" not in bodies[1]
