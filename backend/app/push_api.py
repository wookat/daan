"""Web Push 每日一练提醒：VAPID 订阅管理 + 每日 08:00（中国时区）定时推送。

未配置 KG_VAPID_PRIVATE/KG_VAPID_PUBLIC 时全部接口降级（pubkey 返回空、订阅 503），
发送线程不启动，对零配置环境零影响。
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException

from . import auth, db

log = logging.getLogger("kg.push")
router = APIRouter(prefix="/api/push")

CN_TZ = timezone(timedelta(hours=8))
VAPID_PRIVATE = os.environ.get("KG_VAPID_PRIVATE", "")
VAPID_PUBLIC = os.environ.get("KG_VAPID_PUBLIC", "")
VAPID_SUB = os.environ.get("KG_VAPID_SUB", "mailto:support@zalize.com")
PUSH_HOUR = int(os.environ.get("KG_PUSH_HOUR", "8"))


def _ensure_table(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS push_subs (
            endpoint TEXT PRIMARY KEY,
            uid TEXT NOT NULL,
            sub_json TEXT NOT NULL,
            created_at REAL NOT NULL
        )"""
    )


@router.get("/pubkey")
def push_pubkey():
    return {"key": VAPID_PUBLIC}


@router.post("/subscribe")
def push_subscribe(body: dict, authorization: str | None = Header(default=None)):
    if not (VAPID_PRIVATE and VAPID_PUBLIC):
        raise HTTPException(503, "推送未配置")
    uid = (body.get("uid") or "").strip()[:64]
    if not auth.owns_uid(uid, authorization):
        raise HTTPException(403, "无权访问该账号数据，请重新登录")
    sub = body.get("sub") or {}
    endpoint = (sub.get("endpoint") or "").strip()
    if not uid or not endpoint.startswith("https://") or not sub.get("keys"):
        raise HTTPException(400, "参数不完整")
    conn = db.get_conn()
    _ensure_table(conn)
    conn.execute(
        "INSERT OR REPLACE INTO push_subs (endpoint, uid, sub_json, created_at) VALUES (?,?,?,?)",
        (endpoint[:1024], uid, json.dumps(sub)[:4096], time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/unsubscribe")
def push_unsubscribe(body: dict):
    endpoint = (body.get("endpoint") or "").strip()
    if not endpoint:
        raise HTTPException(400, "缺少 endpoint")
    conn = db.get_conn()
    _ensure_table(conn)
    conn.execute("DELETE FROM push_subs WHERE endpoint=?", (endpoint[:1024],))
    conn.commit()
    conn.close()
    return {"ok": True}


def build_push_payload(day: str, daily_done: bool, due_n: int) -> dict | None:
    """按用户状态构造推送内容：每日一练 / 每日+到期错题 / 仅错题复习 / 不打扰。"""
    n = due_n if isinstance(due_n, int) and not isinstance(due_n, bool) and due_n > 0 else 0
    if not daily_done:
        if n:
            return {
                "title": "今日学习提醒",
                "body": f"{day} 全站同题 10 题；另有 {n} 道错题今日到期",
                "url": "/app/#/pages/practice/practice?daily=1&src=push",
            }
        return {
            "title": "每日一练已更新",
            "body": f"{day} 全站同题 10 题，来试试今天能击败多少人",
            "url": "/app/#/pages/practice/practice?daily=1&src=push",
        }
    if n:
        return {
            "title": "错题复习提醒",
            "body": f"你有 {n} 道错题今日到期，趁热复习巩固",
            "url": "/app/#/pages/book/book?review=1&src=push",
        }
    return None


def _send_daily(only_endpoint: str | None = None):
    from pywebpush import WebPushException, webpush

    conn = db.get_conn()
    _ensure_table(conn)
    conn.execute("CREATE TABLE IF NOT EXISTS seo_meta (key TEXT PRIMARY KEY, value TEXT)")
    day = datetime.now(CN_TZ).strftime("%Y-%m-%d")
    done = {
        r[0]
        for r in conn.execute("SELECT uid FROM daily_set_entries WHERE day=?", (day,)).fetchall()
    }
    subs = conn.execute("SELECT endpoint, uid, sub_json FROM push_subs").fetchall()
    sent = gone = 0
    for endpoint, uid, sub_json in subs:
        if only_endpoint is not None and endpoint != only_endpoint:
            continue
        try:
            due_n = db.due_review_count(uid)
        except Exception:
            due_n = 0
        payload = build_push_payload(day, uid in done, due_n)
        if payload is None:
            continue
        try:
            webpush(
                subscription_info=json.loads(sub_json),
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=VAPID_PRIVATE,
                vapid_claims={"sub": VAPID_SUB},
                timeout=10,
            )
            sent += 1
        except WebPushException as e:
            code = getattr(e.response, "status_code", 0)
            if code in (404, 410):
                conn.execute("DELETE FROM push_subs WHERE endpoint=?", (endpoint,))
                gone += 1
            else:
                log.warning("push 发送失败 %s: %s", code, e)
        except Exception as e:
            log.warning("push 发送异常: %s", e)
    if only_endpoint is None:
        conn.execute(
            "INSERT INTO seo_meta (key, value) VALUES ('push_last_day', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (day,),
        )
    conn.commit()
    conn.close()
    log.info("push 日推完成 day=%s sent=%d gone=%d subs=%d", day, sent, gone, len(subs))


def _push_loop():
    while True:
        try:
            now = datetime.now(CN_TZ)
            day = now.strftime("%Y-%m-%d")
            if now.hour >= PUSH_HOUR:
                conn = db.get_conn()
                conn.execute("CREATE TABLE IF NOT EXISTS seo_meta (key TEXT PRIMARY KEY, value TEXT)")
                row = conn.execute("SELECT value FROM seo_meta WHERE key='push_last_day'").fetchone()
                conn.close()
                if not row or row[0] != day:
                    _send_daily()
        except Exception as e:
            log.warning("push loop 异常: %s", e)
        time.sleep(300)


def start_push_thread():
    if not (VAPID_PRIVATE and VAPID_PUBLIC):
        log.info("VAPID 未配置，push 发送线程不启动")
        return
    threading.Thread(target=_push_loop, daemon=True).start()
