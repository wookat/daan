"""集中式错误监控上报（审计 P1-7）：前端 JS 未捕获错误与后端 5xx 转发中心收集器 zalize-monitor。

上报经有界队列 + 单后台线程异步发送（防突发流量/5xx 风暴无限起线程），
未配置 MONITOR_URL/MONITOR_KEY 时静默跳过，绝不影响主请求链路。
`internal=True`（探针/内部走查触发）随载荷送到中心：入库可查但不计入告警。
"""
import os
import queue
import threading

import httpx

MONITOR_URL = os.environ.get("MONITOR_URL", "")
MONITOR_KEY = os.environ.get("MONITOR_KEY", "")
SITE = "kaogong"
_MAX_LEN = 2000
_QUEUE_MAX = 256

_Q: queue.Queue[tuple[str, str, dict]] = queue.Queue(maxsize=_QUEUE_MAX)
_WORKER: threading.Thread | None = None
_WORKER_LOCK = threading.Lock()


def _drain() -> None:
    while True:
        url, key, payload = _Q.get()
        try:
            httpx.post(f"{url}/ingest", json=payload, headers={"X-Monitor-Key": key}, timeout=5)
        except Exception:
            pass
        finally:
            _Q.task_done()


def _ensure_worker() -> None:
    global _WORKER
    if _WORKER is not None and _WORKER.is_alive():
        return
    with _WORKER_LOCK:
        if _WORKER is None or not _WORKER.is_alive():
            _WORKER = threading.Thread(target=_drain, daemon=True, name="monitor-sender")
            _WORKER.start()


def report(kind: str, message: str, stack: str | None = None,
           url: str | None = None, ua: str | None = None,
           status: int | None = None, internal: bool = False) -> None:
    if not MONITOR_URL or not MONITOR_KEY:
        return

    payload = build_payload(kind, message, stack=stack, url=url, ua=ua,
                            status=status, internal=internal)
    _ensure_worker()
    try:
        _Q.put_nowait((MONITOR_URL, MONITOR_KEY, payload))
    except queue.Full:
        pass


def build_payload(kind: str, message: str, stack: str | None = None,
                  url: str | None = None, ua: str | None = None,
                  status: int | None = None, internal: bool = False) -> dict:
    return {
        "site": SITE,
        "kind": kind,
        "message": (message or "(no message)")[:_MAX_LEN],
        "stack": stack[:_MAX_LEN] if stack else None,
        "url": url[:500] if url else None,
        "ua": ua[:300] if ua else None,
        "status": status,
        "internal": bool(internal),
    }
