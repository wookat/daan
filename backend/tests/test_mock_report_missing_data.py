"""模考赛后报告成绩数据缺失路径：attempt/paper 悬挂时返回 404 而非 500。"""
import asyncio
import time

import httpx
import pytest

from app import db, llm
from app.mock_event import init_mock_event_db


def test_report_dangling_attempt_returns_404(client):
    init_mock_event_db()
    now = time.time()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO mock_events (title, series, paper_id, open_at, close_at, created_at)"
        " VALUES (?,?,?,?,?,?)",
        ("回归测试赛", "weekly", 999999, now - 7200, now - 3600, now - 7200),
    )
    event_id = cur.lastrowid
    conn.execute(
        "INSERT INTO mock_event_entries (event_id, uid, registered_at, attempt_id, score)"
        " VALUES (?,?,?,?,?)",
        (event_id, "kg_test_dangling", now - 7000, 999999, 55.0),
    )
    conn.commit()
    conn.close()

    r = client.get(f"/api/mock/events/{event_id}/report", params={"uid": "kg_test_dangling"})
    assert r.status_code == 404
    assert "成绩数据缺失" in r.json().get("detail", "")


def test_llm_chat_5xx_raises_not_none(monkeypatch):
    class _Resp:
        status_code = 503

        def raise_for_status(self):
            raise httpx.HTTPStatusError("503", request=None, response=None)  # type: ignore[arg-type]

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return _Resp()

    async def _no_sleep(_secs):
        return None

    monkeypatch.setattr(llm.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(llm.asyncio, "sleep", _no_sleep)
    monkeypatch.setattr(llm, "TEXT_BASE_URL", "http://llm.test")
    monkeypatch.setattr(llm, "TEXT_API_KEY", "test-key")

    with pytest.raises((httpx.HTTPStatusError, RuntimeError)):
        asyncio.run(llm.chat([{"role": "user", "content": "hi"}]))
