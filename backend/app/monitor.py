"""集中式错误监控上报（审计 P1-7）：前端 JS 未捕获错误与后端 5xx 转发中心收集器 zalize-monitor。

上报为 fire-and-forget 后台线程，未配置 MONITOR_URL/MONITOR_KEY 时静默跳过，绝不影响主请求链路。
`internal=True`（探针/内部走查触发）随载荷送到中心：入库可查但不计入告警。
"""
import os
import threading

import httpx

MONITOR_URL = os.environ.get("MONITOR_URL", "")
MONITOR_KEY = os.environ.get("MONITOR_KEY", "")
SITE = "kaogong"
_MAX_LEN = 2000


def report(kind: str, message: str, stack: str | None = None,
           url: str | None = None, ua: str | None = None,
           status: int | None = None, internal: bool = False) -> None:
    if not MONITOR_URL or not MONITOR_KEY:
        return

    payload = build_payload(kind, message, stack=stack, url=url, ua=ua,
                            status=status, internal=internal)

    def _send() -> None:
        try:
            httpx.post(f"{MONITOR_URL}/ingest", json=payload,
                       headers={"X-Monitor-Key": MONITOR_KEY}, timeout=5)
        except Exception:
            pass

    threading.Thread(target=_send, daemon=True).start()


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
