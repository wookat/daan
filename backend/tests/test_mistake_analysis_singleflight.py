"""R475：/api/mistakes/analysis 同 uid 飞行中合并。

生产一手（09-06 21:41Z）：同一真实 uid 4 次并发 POST，每次独立打满 LLM（19.7–39.8 s）。
服务端按 uid 合并飞行中的请求共用一次 LLM 调用；结束即移除——成功不留短缓存、失败不缓存（R398 口径），
下一次请求重新调用；不同 uid 互不合并。"""
import asyncio

import pytest

from app import ai_api, db, llm


@pytest.fixture
def _mistake_uid(client):
    uid = "kg_test_sf_" + str(id(client))[-6:]
    db.save_mistake(
        {
            "uid": uid,
            "module": "yanyu",
            "question_type": "逻辑填空",
            "question_text": f"单飞回归题 {uid}",
            "user_answer": "A",
            "correct_answer": "B",
            "methods": [],
        }
    )
    yield uid
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


@pytest.fixture
def _no_gate(monkeypatch):
    monkeypatch.setattr(ai_api, "check_access", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_api, "rl", lambda *_a, **_k: None)


def _call(uid: str):
    return ai_api.api_mistake_analysis({"uid": uid}, None, None)  # type: ignore[arg-type]


async def _spin(n: int = 5):
    """让并发任务都跑到各自的 await（进入合并点 + 首个 LLM 协程开始执行）。"""
    for _ in range(n):
        await asyncio.sleep(0)


def test_concurrent_same_uid_share_one_llm_call(monkeypatch, _mistake_uid, _no_gate):
    calls: list[str] = []
    release = asyncio.Event()

    async def _slow(messages, **_k):
        calls.append(messages[0]["content"])
        await release.wait()
        return "## 错题画像\n共用结果"

    monkeypatch.setattr(llm, "chat", _slow)

    async def _run():
        t = [asyncio.ensure_future(_call(_mistake_uid)) for _ in range(4)]
        await _spin()
        assert len(calls) == 1, "4 个并发只应触发 1 次 LLM"
        assert _mistake_uid in ai_api._ANALYSIS_INFLIGHT
        release.set()
        res = await asyncio.gather(*t)
        assert [r["analysis"] for r in res] == ["## 错题画像\n共用结果"] * 4
        assert _mistake_uid not in ai_api._ANALYSIS_INFLIGHT
        # 结束后再请求：不缓存成功结果，重新调用 LLM
        again = await _call(_mistake_uid)
        assert again["analysis"] == "## 错题画像\n共用结果"
        assert len(calls) == 2

    asyncio.run(_run())


def test_failure_propagates_to_all_and_is_not_cached(monkeypatch, _mistake_uid, _no_gate):
    from fastapi import HTTPException

    n = {"calls": 0}
    release = asyncio.Event()

    async def _fail_then_ok(*_a, **_k):
        n["calls"] += 1
        await release.wait()
        if n["calls"] == 1:
            raise llm.EmptyReply("AI 未返回内容，请稍后再试")
        return "第二次成功"

    monkeypatch.setattr(llm, "chat", _fail_then_ok)

    async def _run():
        t = [asyncio.ensure_future(_call(_mistake_uid)) for _ in range(2)]
        await _spin()
        release.set()
        res = await asyncio.gather(*t, return_exceptions=True)
        assert all(isinstance(r, HTTPException) and r.status_code == 502 for r in res)
        assert n["calls"] == 1
        assert _mistake_uid not in ai_api._ANALYSIS_INFLIGHT
        ok = await _call(_mistake_uid)
        assert ok["analysis"] == "第二次成功"
        assert n["calls"] == 2

    asyncio.run(_run())


def test_different_uids_are_not_merged(monkeypatch, _mistake_uid, _no_gate):
    other = _mistake_uid + "_b"
    db.save_mistake(
        {
            "uid": other,
            "module": "shuliang",
            "question_type": "数字推理",
            "question_text": f"单飞回归题 {other}",
            "user_answer": "C",
            "correct_answer": "D",
            "methods": [],
        }
    )
    calls: list[str] = []
    release = asyncio.Event()

    async def _slow(messages, **_k):
        calls.append(messages[0]["content"])
        await release.wait()
        return "ok"

    monkeypatch.setattr(llm, "chat", _slow)
    try:

        async def _run():
            t = [asyncio.ensure_future(_call(_mistake_uid)), asyncio.ensure_future(_call(other))]
            await _spin()
            assert len(calls) == 2
            release.set()
            await asyncio.gather(*t)

        asyncio.run(_run())
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM mistakes WHERE uid=?", (other,))
        conn.commit()
        conn.close()
