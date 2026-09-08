"""W14-B1：async 端点内的同步 SQLite 调用移入线程池。

get_conn 的 busy_timeout=30000：async 端点里直接调 db.* 遇他连接写锁会在事件循环线程上阻塞最长 30s，
期间全站所有请求（含 /api/health）一起冻结。本例在独立连接上 BEGIN IMMEDIATE 持写锁 3s，
同时让 POST /api/explain 走到落缓存（写），并发 5 次 GET /api/health 必须各自 <0.5s。
修前（db 调用在事件循环线程）该断言失败，修后通过。"""
import sqlite3
import threading
import time
import uuid

from fastapi.testclient import TestClient

from app import ai_api, db, engine
from app.main import app

HOLD_SEC = 3.0


def _hold_write_lock(acquired: threading.Event, secs: float):
    conn = sqlite3.connect(db.DB_PATH, timeout=30, isolation_level=None)
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("BEGIN IMMEDIATE")
    acquired.set()
    time.sleep(secs)
    conn.rollback()
    conn.close()


def _delete_cache(text: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM explain_cache WHERE question_text=?", (text,))
    conn.commit()
    conn.close()


def test_health_not_frozen_while_async_endpoint_waits_for_write_lock(monkeypatch):
    text = f"W14 线程池回归题干 {uuid.uuid4().hex}：以下说法正确的是？"

    async def _extract(_img, _mime, t):
        return {"question_text": t, "module": "yanyu", "question_type": "逻辑填空", "user_answer": None}

    async def _explain(_ex, _ua):
        return "解析：选 A。"

    monkeypatch.setattr(engine, "extract_question", _extract)
    monkeypatch.setattr(engine, "explain", _explain)
    monkeypatch.setattr(ai_api, "check_access", lambda *_a, **_k: None)
    monkeypatch.setattr(ai_api, "rl", lambda *_a, **_k: None)

    acquired = threading.Event()
    holder = threading.Thread(target=_hold_write_lock, args=(acquired, HOLD_SEC))
    res: dict = {}
    lat: list[float] = []
    try:
        # 上下文管理器内所有请求共用一个事件循环，等价于单进程 uvicorn
        with TestClient(app) as c:
            holder.start()
            assert acquired.wait(5)

            def _explain_req():
                t0 = time.monotonic()
                res["r"] = c.post("/api/explain", data={"text": text})
                res["dt"] = time.monotonic() - t0

            worker = threading.Thread(target=_explain_req)
            worker.start()
            time.sleep(0.3)  # 让 explain 走到 save_explain_cache 并卡在写锁上
            for _ in range(5):
                t0 = time.monotonic()
                r = c.get("/api/health")
                lat.append(time.monotonic() - t0)
                assert r.status_code == 200
            worker.join()
            holder.join()
    finally:
        _delete_cache(text)

    assert res["r"].status_code == 200, res["r"].text
    assert res["r"].json()["explanation"] == "解析：选 A。"
    assert res["dt"] >= HOLD_SEC - 0.5, res  # 写请求确实被写锁挡住
    assert max(lat) < 0.5, lat
