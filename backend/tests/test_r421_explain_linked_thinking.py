"""R421：AI 讲解首字前长空白的两段根因——
① 题库题也要过一次识题 LLM（生产 12.7–14.8 s）才发 meta；
② 主通道为推理模型，reasoning_content 被 chat_stream 丢弃，正文首字前 ~42 s 客户端无任何信号。
修：/api/explain/stream 带 question_id 且题面对得上 → 直接用题库模块/题型/答案（跳过识题 LLM，题库答案入提示）；
reasoning 阶段每 ≥1 s 发 `event: thinking`；对不上 qid 一律 fail-closed 回原路径。"""
import asyncio
import json

import pytest

from app import ai_api, db, engine, kb, llm

from .conftest import seed_questions


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


def _linked_text(qid: int) -> str:
    conn = db.get_conn()
    row = conn.execute("SELECT question, options FROM questions WHERE id=?", (qid,)).fetchone()
    conn.close()
    opts = json.loads(row["options"])
    return row["question"] + "\n" + " ".join(f"{k}.{v}" for k, v in opts.items())


# ---------- engine.extract_from_qbank ----------

def test_extract_from_qbank_hits_when_stem_matches():
    q = {"id": 7, "module": "shuliang", "question_type": "数量关系-经济利润", "question": "一台全自动咖啡机打八折销售，利润为进价的60%，求原价？",
         "options": {"A": "250", "B": "240"}, "answer": "a", "disabled": 0}
    ex = engine.extract_from_qbank(q, "一台全自动咖啡机打八折销售， 利润为进价的60%，求原价？\nA.250 B.240")
    assert ex and ex["module"] == "shuliang" and ex["question_type"] == "数量关系-经济利润"
    assert ex["known_answer"] == "A" and ex["qid"] == 7
    assert ex["question_text"].startswith("一台全自动咖啡机")


def test_extract_from_qbank_fail_closed():
    q = {"id": 7, "module": "shuliang", "question": "一台全自动咖啡机打八折销售，利润为进价的60%，求原价？", "answer": "A"}
    assert engine.extract_from_qbank(q, "完全不同的一道题：甲乙两地相距 120 公里，求速度？ A.1 B.2") is None
    assert engine.extract_from_qbank(None, "x") is None
    assert engine.extract_from_qbank(q, "") is None
    assert engine.extract_from_qbank({**q, "module": "unknown"}, q["question"]) is None
    assert engine.extract_from_qbank({**q, "question": "短"}, "短") is None


def test_extract_from_qbank_disabled_row_keeps_type_but_no_answer():
    q = {"id": 7, "module": "shuliang", "submodule": "经济利润", "question": "一台全自动咖啡机打八折销售，利润为进价的60%，求原价？", "answer": "A", "disabled": 1}
    ex = engine.extract_from_qbank(q, q["question"])
    assert ex and ex["known_answer"] is None and ex["question_type"] == "数量关系-经济利润"


def test_known_answer_enters_prompt_marked_answer_untouched():
    msgs = engine._explain_messages({"module": "shuliang", "question_text": "题", "question_type": "t", "known_answer": "C"}, "B")
    assert "题库标准答案：C" in msgs[1]["content"] and "我选了：B" in msgs[1]["content"]
    msgs2 = engine._explain_messages({"module": "shuliang", "question_text": "题", "question_type": "t"}, None)
    assert "题库标准答案" not in msgs2[1]["content"]


# ---------- llm.chat_stream(with_thinking) ----------

class _StreamResp:
    status_code = 200

    def __init__(self, lines):
        self._lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for ln in self._lines:
            yield ln


def _stream_client(lines):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def stream(self, *a, **k):
            return _StreamResp(lines)

    return _Client


_LINES = [
    'data: {"choices":[{"delta":{"role":"assistant","content":null,"reasoning_content":"先看"}}]}',
    'data: {"choices":[{"delta":{"reasoning_content":"利润率"}}]}',
    "",
    'data: {"choices":[{"delta":{"content":"【答案】"}}]}',
    'data: {"choices":[{"delta":{"content":"A"},"finish_reason":"stop"}]}',
    "data: [DONE]",
]


@pytest.fixture
def _main_only(monkeypatch):
    monkeypatch.setattr(llm, "TEXT_BASE_URL", "http://main.test")
    monkeypatch.setattr(llm, "TEXT_API_KEY", "k")
    monkeypatch.setattr(llm, "RESCUE_BASE_URL", "")
    monkeypatch.setattr(llm, "RESCUE_API_KEY", "")


def test_chat_stream_default_drops_reasoning(monkeypatch, _main_only):
    monkeypatch.setattr(llm.httpx, "AsyncClient", _stream_client(_LINES))

    async def run():
        return [d async for d in llm.chat_stream([{"role": "user", "content": "q"}])]

    assert asyncio.run(run()) == ["【答案】", "A"]


def test_chat_stream_with_thinking_yields_progress_before_content(monkeypatch, _main_only):
    monkeypatch.setattr(llm.httpx, "AsyncClient", _stream_client(_LINES))

    async def run():
        return [d async for d in llm.chat_stream([{"role": "user", "content": "q"}], with_thinking=True)]

    out = asyncio.run(run())
    kinds = [("T", d.chars) if isinstance(d, llm.Thinking) else d for d in out]
    assert kinds == [("T", 2), ("T", 5), "【答案】", "A"]


# ---------- /api/explain/stream ----------

def _fake_stream(items):
    def _explain_stream(extracted, user_answer=None, with_thinking=False):
        async def gen():
            for it in items:
                if isinstance(it, llm.Thinking) and not with_thinking:
                    continue
                yield it
        return gen()
    return _explain_stream


def test_stream_linked_qid_skips_extract_and_emits_thinking(client, monkeypatch):
    qid = seed_questions()[0]
    text = _linked_text(qid)
    calls = []

    async def _no_extract(*a, **k):
        calls.append(a)
        raise AssertionError("题库直通不应调用识题 LLM")

    seen = {}

    def _explain_stream(extracted, user_answer=None, with_thinking=False):
        seen["extracted"] = extracted
        seen["ua"] = user_answer
        async def gen():
            yield llm.Thinking(3)
            yield llm.Thinking(9)
            yield "【答案】A｜【方法】排除｜【一句话】直接看甲"
        return gen()

    monkeypatch.setattr(engine, "extract_question", _no_extract)
    monkeypatch.setattr(engine, "explain_stream", _explain_stream)
    monkeypatch.setattr(ai_api, "THINKING_TICK_SEC", 0.0)
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda *a, **k: None)

    r = client.post("/api/explain/stream", data={"text": text, "user_answer": "B", "question_id": str(qid)})
    assert r.status_code == 200
    evs = _sse(r.text)
    kinds = [e for e, _ in evs]
    assert kinds == ["meta", "thinking", "thinking", "message", "done"]
    meta = evs[0][1]
    assert meta["module"] == "ziliao" and meta["module_name"] == kb.MODULES["ziliao"]["name"]
    assert meta["question_type"] == "单选题" and meta["qid"] == qid and meta["cached"] is False
    assert meta["question_text"] == text.strip()
    assert [d["chars"] for _, d in evs[1:3]] == [3, 9] and all("secs" in d for _, d in evs[1:3])
    assert seen["extracted"]["known_answer"] == "A" and seen["ua"] == "B"
    assert calls == []


def test_stream_wrong_qid_falls_back_to_extract(client, monkeypatch):
    qids = seed_questions()
    other_text = _linked_text(qids[1])
    used = {}

    async def _extract(image_b64, mime, text):
        used["text"] = text
        return {"question_text": text, "module": "yanyu", "question_type": "言语-主旨", "user_answer": None}

    monkeypatch.setattr(engine, "extract_question", _extract)
    monkeypatch.setattr(engine, "explain_stream", _fake_stream(["正文"]))
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda *a, **k: None)

    # qid 指向另一题：题干对不上 → 回识题路径，不用题库答案
    r = client.post("/api/explain/stream", data={"text": other_text, "question_id": str(qids[0])})
    evs = _sse(r.text)
    assert used["text"] == other_text
    assert evs[0][0] == "meta" and evs[0][1]["module"] == "yanyu" and evs[0][1]["qid"] is None
    assert [e for e, _ in evs] == ["meta", "message", "done"]

    # 不存在的 qid 同样回退
    used.clear()
    r = client.post("/api/explain/stream", data={"text": other_text, "question_id": "999999999"})
    assert used["text"] == other_text and r.status_code == 200


def test_stream_without_qid_unchanged(client, monkeypatch):
    qid = seed_questions()[0]
    text = _linked_text(qid)
    used = {}

    async def _extract(image_b64, mime, text):
        used["n"] = used.get("n", 0) + 1
        return {"question_text": text, "module": "ziliao", "question_type": "x", "user_answer": None}

    monkeypatch.setattr(engine, "extract_question", _extract)
    monkeypatch.setattr(engine, "explain_stream", _fake_stream([llm.Thinking(1), "正文"]))
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda *a, **k: None)
    monkeypatch.setattr(ai_api, "THINKING_TICK_SEC", 0.0)
    r = client.post("/api/explain/stream", data={"text": text})
    evs = _sse(r.text)
    assert used["n"] == 1
    assert [e for e, _ in evs] == ["meta", "thinking", "message", "done"]


def test_thinking_tick_throttled(client, monkeypatch):
    qid = seed_questions()[0]
    text = _linked_text(qid)
    monkeypatch.setattr(engine, "explain_stream", _fake_stream([llm.Thinking(i) for i in range(1, 50)] + ["正文"]))
    monkeypatch.setattr(db, "get_explain_cache", lambda k: None)
    monkeypatch.setattr(db, "save_explain_cache", lambda *a, **k: None)
    monkeypatch.setattr(ai_api, "THINKING_TICK_SEC", 3600.0)
    r = client.post("/api/explain/stream", data={"text": text, "question_id": str(qid)})
    kinds = [e for e, _ in _sse(r.text)]
    assert kinds.count("thinking") == 0 and kinds == ["meta", "message", "done"]
