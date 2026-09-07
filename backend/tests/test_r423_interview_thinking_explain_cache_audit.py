"""R423：面试点评链路两段串行慢（打分走 rescue 推理模型 8–29 s；点评主通道 reasoning ~25 s 正文前零信号）
→ 打分 think=False 走主通道关推理；两条点评 SSE 补 `event: thinking {secs,chars}` 心跳（不含推理文本）。
另：explain_cache 记 qid；scripts/r423_explain_cache_answer_audit.py 讲解首行答案 vs 题库 answer 对账，只删 CONFLICT、可还原。"""
import asyncio
import importlib.util
import json
import os

from app import db, interview, llm, sse

from .conftest import seed_questions

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r423_explain_cache_answer_audit.py")
_spec = importlib.util.spec_from_file_location("r423_audit", SCRIPT)
assert _spec and _spec.loader
audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(audit)


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


def _fake_stream(items):
    def _stream(messages, temperature=0.2, max_tokens=4000, with_thinking=False, **kw):
        async def gen():
            for it in items:
                if isinstance(it, llm.Thinking) and not with_thinking:
                    continue
                yield it
        return gen()
    return _stream


REVIEW = "【总评】" + "点评正文。" * 80


def test_grade_uses_main_channel_without_thinking(monkeypatch):
    seen = {}

    async def fake_chat_json(messages, fast=False, **kw):
        seen.update(fast=fast, **kw)
        return {"scores": {d: 7 for d in interview.DIMENSIONS}, "summary": "ok"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    q = interview.bank()["questions"][0]
    scores, total, summary = asyncio.run(interview._grade(q, "x" * 30))
    assert seen["fast"] is True and seen["think"] is False
    assert total == 70 and summary == "ok"
    assert sum(scores.values()) == 35


def test_answer_stream_emits_thinking_before_review(client, monkeypatch):
    async def fake_chat_json(messages, fast=False, **kw):
        return {"scores": {d: 6 for d in interview.DIMENSIONS}, "summary": "总评"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    monkeypatch.setattr(llm, "chat_stream", _fake_stream([llm.Thinking(5), llm.Thinking(12), REVIEW[:10], REVIEW[10:]]))
    monkeypatch.setattr(sse, "THINKING_TICK_SEC", 0.0)
    qid = interview.bank()["questions"][0]["id"]
    r = client.post(
        "/api/interview/answer/stream",
        json={"uid": "test-r423-itv", "question_id": qid, "answer": "我认为" + "要分层处理、沟通协调、总结制度。" * 3},
    )
    assert r.status_code == 200
    evs = _sse(r.text)
    kinds = [e for e, _ in evs]
    assert kinds == ["meta", "thinking", "thinking", "message", "message", "done"]
    assert [d["chars"] for _, d in evs[1:3]] == [5, 12] and all("secs" in d for _, d in evs[1:3])
    sid = evs[0][1]["session_id"]
    assert evs[-1][1]["session_id"] == sid
    conn = db.get_conn()
    row = conn.execute("SELECT review FROM interview_sessions WHERE id=?", (sid,)).fetchone()
    conn.close()
    assert row["review"] == REVIEW  # 心跳不落正文


def test_review_regen_stream_emits_thinking(client, monkeypatch):
    q = interview.bank()["questions"][0]
    sid = interview._save_session("test-r423-regen", q, "x" * 40, 30, {d: 5 for d in interview.DIMENSIONS}, 50, "")
    monkeypatch.setattr(llm, "chat_stream", _fake_stream([llm.Thinking(3), REVIEW]))
    monkeypatch.setattr(sse, "THINKING_TICK_SEC", 0.0)
    r = client.post(f"/api/interview/sessions/{sid}/review/stream", json={"uid": "test-r423-regen"})
    assert r.status_code == 200
    kinds = [e for e, _ in _sse(r.text)]
    assert kinds == ["thinking", "message", "done"]
    conn = db.get_conn()
    assert conn.execute("SELECT review FROM interview_sessions WHERE id=?", (sid,)).fetchone()["review"] == REVIEW
    conn.close()


def test_review_streams_use_enlarged_token_budget(client, monkeypatch):
    seen: list[int] = []

    def _stream(messages, temperature=0.2, max_tokens=4000, with_thinking=False, **kw):
        seen.append(max_tokens)

        async def gen():
            yield REVIEW
        return gen()

    async def fake_chat_json(messages, fast=False, **kw):
        return {"scores": {d: 6 for d in interview.DIMENSIONS}, "summary": "s"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    monkeypatch.setattr(llm, "chat_stream", _stream)
    q = interview.bank()["questions"][0]
    r = client.post("/api/interview/answer/stream", json={"uid": "test-r423-tok", "question_id": q["id"], "answer": "x" * 40})
    assert r.status_code == 200
    sid = interview._save_session("test-r423-tok", q, "x" * 40, 30, {d: 5 for d in interview.DIMENSIONS}, 50, "")
    assert client.post(f"/api/interview/sessions/{sid}/review/stream", json={"uid": "test-r423-tok"}).status_code == 200
    assert seen == [interview.REVIEW_MAX_TOKENS] * 2 and interview.REVIEW_MAX_TOKENS >= 8000


class _FakeStreamResp:
    status_code = 200

    def __init__(self, lines):
        self._lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def raise_for_status(self):
        pass

    async def aiter_lines(self):
        for ln in self._lines:
            yield ln


def _chunk(delta, finish=None):
    return "data: " + json.dumps({"choices": [{"delta": delta, "finish_reason": finish}]})


def _run_stream(monkeypatch, lines):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def stream(self, *a, **k):
            return _FakeStreamResp(lines)

    monkeypatch.setattr(llm.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(llm, "_endpoint", lambda m: ("http://x", "k", "m1"))
    monkeypatch.setattr(llm, "FALLBACK_MODEL", "")
    monkeypatch.setattr(llm, "_rescue_ok", lambda m: False)

    async def collect():
        return [x async for x in llm.chat_stream([{"role": "user", "content": "q"}], with_thinking=True)]
    return [x.chars if isinstance(x, llm.Thinking) else x for x in asyncio.run(collect())]


def test_chat_stream_logs_when_reasoning_exhausts_budget(monkeypatch, caplog):
    lines = [_chunk({"reasoning_content": "想" * 30}), _chunk({"reasoning_content": "想" * 20}, "length"), "data: [DONE]"]
    with caplog.at_level("WARNING", logger="kg.llm"):
        out = _run_stream(monkeypatch, lines)
    assert out == [30, 50]
    assert any("finish=length content=0 reasoning_chars=50" in r.message for r in caplog.records)


def test_chat_stream_quiet_on_normal_completion(monkeypatch, caplog):
    lines = [_chunk({"reasoning_content": "想想"}), _chunk({"content": "正文"}), _chunk({}, "stop"), "data: [DONE]"]
    with caplog.at_level("WARNING", logger="kg.llm"):
        out = _run_stream(monkeypatch, lines)
    assert out == [2, "正文"]
    assert not [r for r in caplog.records if "[llm] stream" in r.message]


def test_thinking_tick_throttled(client, monkeypatch):
    async def fake_chat_json(messages, fast=False, **kw):
        return {"scores": {d: 6 for d in interview.DIMENSIONS}, "summary": "s"}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    monkeypatch.setattr(llm, "chat_stream", _fake_stream([llm.Thinking(i) for i in range(1, 40)] + [REVIEW]))
    monkeypatch.setattr(sse, "THINKING_TICK_SEC", 3600.0)
    qid = interview.bank()["questions"][0]["id"]
    r = client.post(
        "/api/interview/answer/stream",
        json={"uid": "test-r423-itv2", "question_id": qid, "answer": "x" * 40},
    )
    assert [e for e, _ in _sse(r.text)] == ["meta", "message", "done"]


def test_explain_cache_saves_qid_and_audit_deletes_only_conflicts(tmp_path):
    qids = seed_questions()
    conn = db.get_conn()
    q_ok, q_bad, q_dis = [dict(conn.execute("SELECT * FROM questions WHERE id=?", (i,)).fetchone()) for i in qids[:3]]
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (q_dis["id"],))
    conn.commit()
    conn.close()

    def save(key, q, first, qid=None, text=None):
        db.save_explain_cache(
            key,
            {"module": q["module"], "question_type": "单选题", "question_text": text or q["question"], "user_answer": "B", "qid": qid},
            f"【答案】{first}｜【方法】x\n正文",
        )

    save("r423-ok", q_ok, "A", qid=q_ok["id"])          # 首行 A == 题库 A
    save("r423-bad", q_bad, "D")                         # 按题干命中，首行 D != A → CONFLICT
    save("r423-dis", q_dis, "D", qid=q_dis["id"])        # 命中题 disabled → 不动
    save("r423-sus", q_ok, "题目存疑", text="没有选项的题面……")
    db.save_explain_cache("r423-nf", {"module": None, "question_text": "自由追问", "qid": "x"}, "追问回答无标记")
    db.save_explain_cache("r423-um", {"module": "yanyu", "question_text": "题库里没有的一道手输题目文字"}, "【答案】C｜x")

    conn = db.get_conn()
    assert conn.execute("SELECT qid FROM explain_cache WHERE key='r423-ok'").fetchone()[0] == q_ok["id"]
    assert conn.execute("SELECT qid FROM explain_cache WHERE key='r423-nf'").fetchone()[0] is None
    hit = audit.scan(conn, verbose=False)
    tags = {r["key"]: r["_tag"] for r in hit["rows"] if r["key"].startswith("r423-")}
    assert tags == {
        "r423-ok": "OK", "r423-bad": "CONFLICT", "r423-dis": "MATCH_DISABLED",
        "r423-sus": "SUSPECT", "r423-nf": "NO_FIRST", "r423-um": "UNMATCHED",
    }
    rec = str(tmp_path / "r423.json")
    assert audit.apply(conn, hit, rec) == 1
    keys = {r[0] for r in conn.execute("SELECT key FROM explain_cache WHERE key LIKE 'r423-%'")}
    assert "r423-bad" not in keys and len(keys) == 5
    # 再扫 0 CONFLICT；restore 原样回来（含 explanation/hits）
    assert audit.scan(conn, verbose=False)["stat"]["CONFLICT"] == 0
    assert audit.restore(conn, rec) == 1
    row = conn.execute("SELECT explanation, question_text FROM explain_cache WHERE key='r423-bad'").fetchone()
    assert row[0].startswith("【答案】D") and row[1] == q_bad["question"]
    assert audit.restore(conn, rec) == 0
    conn.execute("DELETE FROM explain_cache WHERE key LIKE 'r423-%'")
    conn.execute("UPDATE questions SET disabled=0 WHERE id=?", (q_dis["id"],))
    conn.commit()
    conn.close()


def test_first_answer_parser():
    assert audit.first_answer("【答案】B｜【方法】x") == "B"
    assert audit.first_answer("【答案】 bd\n…") == "BD"
    assert audit.first_answer("【答案】题目存疑｜缺选项") == "题目存疑"
    assert audit.first_answer("正文里才提到【答案】A") == "A"
    assert audit.first_answer("第二行才有\n【答案】A") is None
    assert audit.first_answer(None) is None
