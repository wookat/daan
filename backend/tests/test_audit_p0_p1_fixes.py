"""全栈代码审查 P0/P1 修复专项回归测试（安全、并发、统计、监控、备份、Push、SEO）。"""
import json
import time

import pytest

from app import db
from app.api import admin as admin_api
from app.api import auth as auth_mod
from app.api import push as push_api
from app.api import study as study_api
from app.db import analytics
from app.seo import common as seo_common
from app.services import interview as interview_svc
from app.services import monitor as monitor_svc
from tests.conftest import seed_questions


def _register(client, phone: str) -> tuple[str, str]:
    r = client.post("/api/auth/register", json={"phone": phone, "password": "pw123456", "code": "000000"})
    assert r.status_code == 200, r.text
    return r.json()["token"], f"u{r.json()['user']['id']}"


# ---- P0-1: guard_account_uid 不再被 query uid 短路，同时校验 query + body ----
def test_guard_query_uid_cannot_bypass_body_account_uid(client):
    token, own_uid = _register(client, "13900099001")
    victim_uid = "u999998"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 攻击者传自己的 ?uid=own_uid 试图短路跳过 body 中的他人账号 uid
    r = client.post(
        f"/api/mistakes?uid={own_uid}",
        json={"uid": victim_uid, "question_text": "bypass test", "user_answer": "A", "correct_answer": "B"},
        headers=headers,
    )
    assert r.status_code == 403, r.text

    # 匿名 ?uid=anon 也不能短路跳过 body 中的账号 uid
    r2 = client.post(
        "/api/mistakes?uid=test-anon-bypass",
        json={"uid": victim_uid, "question_text": "bypass test 2", "user_answer": "A", "correct_answer": "B"},
    )
    assert r2.status_code == 403, r2.text

    # 两个非空 uid 不一致时拒绝 400
    r3 = client.post(
        "/api/mistakes?uid=test-anon-a",
        json={"uid": "test-anon-b", "question_text": "mismatch test", "user_answer": "A", "correct_answer": "B"},
    )
    assert r3.status_code == 400, r3.text
    assert "一致" in r3.json()["detail"]


# ---- P1-B1: CORSMiddleware 位于最外层，OPTIONS 预检及 403 响应均含 CORS 头 ----
def test_cors_outermost_preflight_and_403_include_acao(client):
    origin = "https://localhost"
    r_opt = client.options(
        "/api/mistakes?uid=u999999",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    assert r_opt.status_code == 200, r_opt.text
    assert r_opt.headers.get("access-control-allow-origin") == origin

    r_403 = client.post(
        "/api/mistakes",
        json={"uid": "u999999", "question_text": "x", "user_answer": "A", "correct_answer": "B"},
        headers={"Origin": origin},
    )
    assert r_403.status_code == 403
    assert r_403.headers.get("access-control-allow-origin") == origin


# ---- P0-2: 面试 3 个 AI 点评端点补齐 ACCESS_CODE 鉴权 ----
def test_interview_endpoints_require_access_code(client, monkeypatch):
    monkeypatch.setattr(interview_svc, "check_access", lambda code: _raise_401() if code != "valid-code" else None)

    for path, body in (
        ("/api/interview/answer", {"uid": "test-iv-1", "question_id": 1, "answer": "回答"}),
        ("/api/interview/answer/stream", {"uid": "test-iv-1", "question_id": 1, "answer": "回答"}),
        ("/api/interview/sessions/1/review/stream", {"uid": "test-iv-1"}),
    ):
        r = client.post(path, json=body)
        assert r.status_code == 401, (path, r.status_code, r.text)


def _raise_401():
    from fastapi import HTTPException
    raise HTTPException(401, "访问码错误，请重试")


# ---- P0-3: SEO JSON-LD 防 </script> 闭合注入 ----
def test_seo_jsonld_escapes_script_breakout():
    payload = {"name": "</script><script>alert('xss')&1</script>"}
    raw = seo_common._safe_jsonld(payload)
    assert "</script>" not in raw.lower()
    assert "<" not in raw and ">" not in raw and "&" not in raw
    assert json.loads(raw) == payload


# ---- P0-4: Web Push SSRF 防护、4KB 大小上限、不跨网络持锁 ----
@pytest.mark.parametrize(
    "bad_ep",
    [
        "http://push.example.com/sub",
        "https://127.0.0.1/sub",
        "https://localhost/sub",
        "https://169.254.169.254/latest/meta-data",
        "https://10.0.0.1/sub",
        "https://internal.local/sub",
        "https://svc.internal/sub",
    ],
)
def test_push_subscribe_blocks_ssrf_endpoints(client, monkeypatch, bad_ep):
    monkeypatch.setattr(push_api, "VAPID_PRIVATE", "test-priv")
    monkeypatch.setattr(push_api, "VAPID_PUBLIC", "test-pub")
    r = client.post(
        "/api/push/subscribe",
        json={"uid": "test-push-ssrf", "sub": {"endpoint": bad_ep, "keys": {"p256dh": "k", "auth": "a"}}},
    )
    assert r.status_code == 400, (bad_ep, r.status_code, r.text)


def test_push_subscribe_rejects_oversized_payload(client, monkeypatch):
    monkeypatch.setattr(push_api, "VAPID_PRIVATE", "test-priv")
    monkeypatch.setattr(push_api, "VAPID_PUBLIC", "test-pub")
    huge = {"endpoint": "https://push.example.test/ok", "keys": {"p256dh": "x" * 4500, "auth": "a"}}
    r = client.post("/api/push/subscribe", json={"uid": "test-push-big", "sub": huge})
    assert r.status_code == 400, r.text


def test_push_send_daily_commits_410_cleanup_outside_network_lock(monkeypatch):
    import sys
    import types

    monkeypatch.setattr(push_api, "VAPID_PRIVATE", "test-priv")
    monkeypatch.setattr(push_api, "VAPID_PUBLIC", "test-pub")
    uid = "test-push-410-uid"
    ep = "https://push.example.test/gone-410"
    conn = db.get_conn()
    push_api._ensure_table(conn)
    conn.execute(
        "INSERT OR REPLACE INTO push_subs (endpoint, uid, sub_json, created_at) VALUES (?, ?, ?, ?)",
        (ep, uid, json.dumps({"endpoint": ep, "keys": {"p256dh": "k", "auth": "a"}}), time.time()),
    )
    conn.commit()
    conn.close()

    class _FakeResp:
        status_code = 410

    class _FakeWPE(Exception):
        def __init__(self):
            self.response = _FakeResp()

    fake_mod = types.ModuleType("pywebpush")
    fake_mod.WebPushException = _FakeWPE
    fake_mod.webpush = lambda **_kw: (_ for _ in ()).throw(_FakeWPE())
    monkeypatch.setitem(sys.modules, "pywebpush", fake_mod)
    monkeypatch.setattr(push_api, "_validate_push_endpoint", lambda url, resolve_dns=False: url)

    try:
        push_api._send_daily(only_endpoint=ep)
        conn = db.get_conn()
        cnt = conn.execute("SELECT COUNT(*) FROM push_subs WHERE endpoint=?", (ep,)).fetchone()[0]
        conn.close()
        assert cnt == 0
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM push_subs WHERE endpoint=?", (ep,))
        conn.commit()
        conn.close()


# ---- P1-B4: Analytics UTC+8 自然日、渗透率 SQL 列名、days 缓存隔离 ----
def test_analytics_day_utc8_and_penetration_and_cache_key(client, monkeypatch):
    # 2026-01-01 16:30:00 UTC == 2026-01-02 00:30:00 UTC+8
    import calendar
    ts = calendar.timegm((2026, 1, 1, 16, 30, 0, 0, 0, 0))
    assert analytics._day(ts) == "2026-01-02"

    # 插入一条真实用户 PK / 组队成员 / 错题记录，确保渗透率查询不报 SQL 错且计数 > 0
    now = time.time()
    conn = db.get_conn()
    analytics.init_analytics_db()
    db._ensure_mistake_uid(conn)
    uid = "test_an_pen_1"
    conn.execute(
        "INSERT INTO growth_events (uid, event, source, ref, created_at, probe) VALUES (?,?,?,?,?,0)",
        (uid, "boot", "h5", "", now),
    )
    conn.execute(
        "INSERT OR IGNORE INTO pk_matches (code, module, question_ids, creator_uid, creator_name, status, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        ("ANPEN001", "yanyu", "[1]", uid, "测试", "waiting", now),
    )
    conn.execute(
        "INSERT OR IGNORE INTO teams (invite_code, name, creator_uid, created_at) VALUES (?,?,?,?)",
        ("ANTM0001", "分析队", uid, now),
    )
    tid = conn.execute("SELECT id FROM teams WHERE invite_code='ANTM0001'").fetchone()["id"]
    conn.execute(
        "INSERT OR IGNORE INTO team_members (team_id, uid, nickname, joined_at) VALUES (?,?,?,?)",
        (tid, uid, "测试", now),
    )
    conn.execute(
        "INSERT INTO mistakes (uid, question_text, user_answer, correct_answer, created_at) VALUES (?,?,?,?,?)",
        (uid, "分析渗透错题", "A", "B", now),
    )
    conn.commit()
    conn.close()

    res = analytics.usage_overview(days=7)
    pen = {item["name"]: item["users"] for item in res["penetration"]}
    assert pen["PK 对战"] >= 1
    assert pen["组队成员"] >= 1
    assert pen["错题本"] >= 1

    # 验证 admin analytics 缓存键包含 days（7 天与 30 天互不串用）
    monkeypatch.setattr(admin_api, "check_admin", lambda _tok: None)
    db._ADMIN_CACHE.clear()
    r7 = client.get("/api/admin/analytics/usage?days=7")
    r30 = client.get("/api/admin/analytics/usage?days=30")
    assert r7.status_code == 200 and r30.status_code == 200
    assert r7.json()["days"] == 7
    assert r30.json()["days"] == 30


# ---- P1-B5: /api/monitor/report 16KB 体积限制 + 有界队列上报 ----
def test_monitor_report_size_cap_and_bounded_queue(client, monkeypatch):
    r = client.post(
        "/api/monitor/report",
        content=b"{" + b'"message":"' + b"a" * 17000 + b'"}',
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413, r.text

    sent = []
    monkeypatch.setattr(monitor_svc, "MONITOR_URL", "https://monitor.example.test")
    monkeypatch.setattr(monitor_svc, "MONITOR_KEY", "k")
    monkeypatch.setattr(monitor_svc.httpx, "post", lambda url, **kw: sent.append((url, kw)))
    monitor_svc.report("frontend", "queue-test-msg")
    monitor_svc._Q.join()
    assert any(kw["json"]["message"] == "queue-test-msg" for _, kw in sent)


# ---- P1-B3: 模考交卷原子占位防双提交 ----
def test_exam_submit_atomic_claim_blocks_double_submit(client):
    qids = seed_questions(per_module=2, modules=("yanyu",))
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        ("防双提交测试卷", "zhenti", 2025, "国考", json.dumps(qids), 30, time.time()),
    )
    pid = cur.lastrowid
    conn.commit()
    conn.close()
    db._papers_cache.clear()

    uid = "test-exam-double-1"
    aid = db.start_exam_attempt(uid, pid, question_ids=qids)
    claimed = db.claim_exam_attempt(aid)
    assert claimed is not None
    # 已被占位的记录第二次占位必须返回 None
    assert db.claim_exam_attempt(aid) is None
    # 解锁后可正常提交一次，二次交卷 400
    db.unclaim_exam_attempt(aid, claimed)
    r1 = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    assert r1.status_code == 200, r1.text
    r2 = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    assert r2.status_code == 400, r2.text


# ---- P1-B6: 云备份大小上限、短码防猜测、GET 限流 ----
def test_backup_size_cap_custom_code_and_get_rate_limit(client):
    # 超过 500KB 拒绝 400
    r_big = client.post("/api/backup", json={"data": {"blob": "x" * 510_000}})
    assert r_big.status_code == 400, r_big.text

    # 过短自定义码不被采用，改为 8 位随机码
    r_short = client.post("/api/backup", json={"code": "1234", "data": {"ok": 1}})
    assert r_short.status_code == 200, r_short.text
    code = r_short.json()["code"]
    assert code != "1234" and len(code) == 8

    # 合法 8-16 位大写字母/数字自定义码允许保存
    r_ok = client.post("/api/backup", json={"code": "ABCD1234", "data": {"ok": 2}})
    assert r_ok.status_code == 200 and r_ok.json()["code"] == "ABCD1234"

    # GET /api/backup 超过 20 次触发 429 限流
    with auth_mod._RATE_LOCK:
        auth_mod._RATE.clear()
    statuses = [client.get("/api/backup?code=NOEXIST1").status_code for _ in range(22)]
    assert 429 in statuses, statuses
    # 清理限流表避免影响后续用例
    with auth_mod._RATE_LOCK:
        auth_mod._RATE.clear()
    assert study_api is not None
