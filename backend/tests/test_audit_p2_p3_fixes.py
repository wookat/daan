"""全栈代码审查 P2/P3 修复专项回归测试。"""
import asyncio
import json
import sqlite3
import time
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import HTTPException

from app import db
from app.api import auth as auth_mod
from app.api import deps
from app.db import admin as db_admin
from app.db import reports as db_reports
from app.db import shenlun as db_shenlun
from app.seo import pages as seo_pages
from app.services import llm
from app.services import pk as pk_svc
from app.services import team as team_svc
from tests.conftest import seed_questions

ROOT = Path(__file__).resolve().parents[2]


# ---- P2-1: check_import_token 常数时间比较 + 失败限速 & friendly_ai_err 脱敏 ----
def test_check_import_token_rate_limit_and_friendly_ai_err(monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "secret-import-token-123")
    with auth_mod._RATE_LOCK:
        auth_mod._RATE.clear()
    try:
        # 正确 token 放行
        deps.check_import_token("secret-import-token-123")
        # 连续错 token 触发限速 429
        got_429 = False
        for _ in range(25):
            try:
                deps.check_import_token("wrong-token")
            except HTTPException as e:
                if e.status_code == 429:
                    got_429 = True
                    break
                assert e.status_code == 401
        assert got_429
    finally:
        with auth_mod._RATE_LOCK:
            auth_mod._RATE.clear()

    # friendly_ai_err 不再把原始内部异常文本拼到用户报错里
    msg = deps.friendly_ai_err(RuntimeError("sqlite3.OperationalError: secret_table_xyz"))
    assert "secret_table_xyz" not in msg
    assert "AI 服务" in msg


# ---- P2-4: 续考使用冻结的 attempt.question_ids ----
def test_exam_resume_uses_frozen_attempt_question_ids(client):
    qids = seed_questions(7, modules=("yanyu",))
    paper_id = db.upsert_exam_paper(
        title="冻结题序测试卷",
        kind="zhenti",
        year=2025,
        region="国考",
        question_ids=qids[:5],
        duration_min=30,
    )
    uid = "test-freeze-resume"
    r_start = client.post("/api/exam/start", json={"uid": uid, "paper_id": paper_id})
    assert r_start.status_code == 200, r_start.text
    attempt_id = r_start.json()["attempt_id"]
    orig_ids = [q["id"] for q in r_start.json()["items"]]
    assert orig_ids == qids[:5]

    # 保存作答进度
    r_prog = client.post(
        "/api/exam/progress",
        json={"uid": uid, "attempt_id": attempt_id, "picks": {str(orig_ids[0]): "A"}, "idx": 1},
    )
    assert r_prog.status_code == 200, r_prog.text

    # 模拟开考后卷面题库被修改（换成另一套题序）
    conn = db.get_conn()
    conn.execute("UPDATE exam_papers SET question_ids=? WHERE id=?", (json.dumps(qids[2:7]), paper_id))
    conn.commit()
    conn.close()

    # 续考必须按冻结在 attempt 上的原 5 题返回
    r_res = client.get(f"/api/exam/resume?uid={uid}")
    assert r_res.status_code == 200, r_res.text
    resumed_ids = [q["id"] for q in r_res.json()["items"]]
    assert resumed_ids == orig_ids


# ---- P2-5: LLM 空 choices、单行围栏 JSON 与 HTTPError 救援降级 ----
def test_llm_content_guard_single_line_json_and_rescue(monkeypatch):
    with pytest.raises(llm.EmptyReply):
        llm._content({"choices": []})
    with pytest.raises(llm.EmptyReply):
        llm._content({})

    # 单行围栏 JSON 不再 IndexError
    async def fake_chat(*_a, **_kw):
        return '```json {"ok": true, "n": 3} ```'

    with monkeypatch.context() as mp:
        mp.setattr(llm, "chat", fake_chat)
        assert asyncio.run(llm.chat_json([{"role": "user", "content": "hi"}])) == {"ok": True, "n": 3}

    # 普通模式遇到 httpx.HTTPError 时应回落 rescue 通道
    monkeypatch.setattr(llm, "TEXT_API_KEY", "main-key")
    monkeypatch.setattr(llm, "TEXT_BASE_URL", "https://main.example")
    monkeypatch.setattr(llm, "TEXT_MODEL", "main-model")
    monkeypatch.setattr(llm, "RESCUE_API_KEY", "rescue-key")
    monkeypatch.setattr(llm, "RESCUE_BASE_URL", "https://rescue.example")
    monkeypatch.setattr(llm, "RESCUE_MODEL", "deepseek-chat")
    monkeypatch.setenv("LLM_MAIN_ONLY", "0")

    calls = []

    class _FakeAsyncClient:
        def __init__(self, **_kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_exc):
            return False

        async def post(self, url, headers=None, json=None, **_kw):
            calls.append(url)
            if "main.example" in url:
                raise httpx.ReadTimeout("main timed out")
            resp = MagicMock()
            resp.status_code = 200
            resp.raise_for_status = lambda: None
            resp.json.return_value = {"choices": [{"message": {"content": "rescued ok"}}]}
            return resp

    monkeypatch.setattr(llm.httpx, "AsyncClient", _FakeAsyncClient)

    out = asyncio.run(llm.chat([{"role": "user", "content": "hello"}]))
    assert out == "rescued ok"
    assert any("main.example" in u for u in calls)
    assert any("rescue.example" in u for u in calls)


# ---- P2-8: 负数 limit / offset 下界钳制 ----
def test_negative_limit_and_offset_clamped(client):
    seed_questions(3, modules=("yanyu",))
    uid = "test-clamp-uid"
    # PK mine: limit=-1 不应全表返回，应被钳制为 0
    r_pk = client.get(f"/api/pk/mine?uid={uid}&limit=-1")
    assert r_pk.status_code == 200
    assert r_pk.json()["items"] == []

    # 面试历史: limit=-1 -> 空
    r_iv = client.get(f"/api/interview/history?uid={uid}&limit=-1")
    assert r_iv.status_code == 200
    assert r_iv.json()["items"] == []

    # 收藏 / 笔记: limit=-1 -> 空
    r_fav = client.get(f"/api/favs?uid={uid}&limit=-1")
    assert r_fav.status_code == 200
    assert r_fav.json()["items"] == []

    r_note = client.get(f"/api/notes?uid={uid}&limit=-1")
    assert r_note.status_code == 200
    assert r_note.json()["items"] == []

    # shenlun_hotspots 负数 offset 不再反向切片
    hot_neg = db_shenlun.shenlun_hotspots(offset=-5, limit=5)
    hot_zero = db_shenlun.shenlun_hotspots(offset=0, limit=5)
    assert hot_neg == hot_zero


# ---- P2-9: 错题掌握同步 mastery_state、后台改题同步 has_hs、治理统计不截断、secs 钳制 ----
def test_mistake_mastery_sync_admin_has_hs_and_secs_clamp():
    qids = seed_questions(2, modules=("yanyu",))
    uid = "test-state-sync"
    mid = db.save_mistake({
        "question_text": "状态同步测试题",
        "user_answer": "A",
        "correct_answer": "B",
        "uid": uid,
        "question_id": qids[0],
    })
    db.update_mistake(mid, {"mastered": 1}, uid=uid)
    conn = db.get_conn()
    row = conn.execute("SELECT mastered, mastery_state FROM mistakes WHERE id=?", (mid,)).fetchone()
    conn.close()
    assert row["mastered"] == 1
    assert row["mastery_state"] == "mastered"

    db.update_mistake(mid, {"mastered": 0}, uid=uid)
    conn = db.get_conn()
    row2 = conn.execute("SELECT mastered, mastery_state FROM mistakes WHERE id=?", (mid,)).fetchone()
    conn.close()
    assert row2["mastered"] == 0
    assert row2["mastery_state"] == "new"

    # 后台写 hs_explanation 必须同步 has_hs=1，清空则同步 has_hs=0
    assert db_admin.admin_update_question(qids[0], {"hs_explanation": "花生十三解析正文"})
    conn = db.get_conn()
    assert conn.execute("SELECT has_hs FROM questions WHERE id=?", (qids[0],)).fetchone()["has_hs"] == 1
    conn.close()

    assert db_admin.admin_update_question(qids[0], {"hs_explanation": ""})
    conn = db.get_conn()
    assert conn.execute("SELECT has_hs FROM questions WHERE id=?", (qids[0],)).fetchone()["has_hs"] == 0
    conn.close()

    # save_answer_log_detail 钳制 secs 到 [0, 7200]
    db.save_answer_log_detail(uid, [
        {"question_id": qids[0], "module": "yanyu", "correct": True, "secs": 999999},
        {"question_id": qids[1], "module": "yanyu", "correct": False, "secs": -50},
    ])
    conn = db.get_conn()
    secs_rows = [
        r["secs"]
        for r in conn.execute("SELECT secs FROM answer_log WHERE uid=? ORDER BY id ASC", (uid,)).fetchall()
    ]
    conn.close()
    assert secs_rows[-2:] == [7200, 0]


def test_governance_scan_does_not_truncate_dist_all_and_supports_refresh(client, monkeypatch):
    # 制造 105 道缺选项的坏题（超出 broken 的 100 条展示上限），验证 dist_all 完整统计 105 条
    conn = db.get_conn()
    for i in range(105):
        conn.execute(
            "INSERT INTO questions (module, question, options, answer) VALUES (?, ?, ?, ?)",
            ("yanyu", f"P2治理坏题样本{i}", "{}", "A"),
        )
    conn.commit()
    conn.close()

    res, _ = db_admin.governance_scan_state(refresh=True)
    assert len(res["broken"]) == 100
    assert sum(res["answer_dist"]["overall"].values()) >= 105

    # 管理接口支持 ?refresh=1 强制重扫
    monkeypatch.setattr(deps, "ADMIN_TOKEN", "adm-test-gov")
    r = client.get("/api/admin/governance?refresh=1", headers={"X-Admin-Token": "adm-test-gov"})
    assert r.status_code == 200
    assert sum(r.json()["answer_dist"]["overall"].values()) >= 105


# ---- P2-10: HEAD /api/share/{sid} 不递增 open_count ----
def test_head_share_detail_skips_open_count_write(client):
    qids = seed_questions(1, modules=("yanyu",))
    r_create = client.post("/api/share/create", json={"uid": "test-sharer", "question_id": qids[0], "nickname": "小王"})
    assert r_create.status_code == 200
    sid = r_create.json()["sid"]

    # 直接调用函数模拟 HEAD 请求，确认 open_count 不变
    class _FakeReq:
        method = "HEAD"

    team_svc.api_share_detail(sid, _FakeReq(), uid="visitor")
    conn = db.get_conn()
    cnt_after_head = conn.execute("SELECT open_count FROM shared_questions WHERE sid=?", (sid,)).fetchone()[0]
    conn.close()
    assert cnt_after_head == 0

    # GET 正常递增
    r_get = client.get(f"/api/share/{sid}?uid=visitor")
    assert r_get.status_code == 200
    conn = db.get_conn()
    cnt_after_get = conn.execute("SELECT open_count FROM shared_questions WHERE sid=?", (sid,)).fetchone()[0]
    conn.close()
    assert cnt_after_get == 1


# ---- P2-9/P3: PK 透传 option_imgs + SEO 渲染 option_imgs 与清理 title 下划线 ----
def test_pk_and_seo_option_imgs_and_title_cleanup(client):
    conn = db.get_conn()
    cur = conn.execute(
        """INSERT INTO questions (module, submodule, question, options, option_imgs, answer)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            "panduan",
            "图形推理",
            "填入问号处最恰当的是____",
            json.dumps({"A": "图A", "B": "图B"}),
            json.dumps({"A": "/qimg/a.png", "B": "/qimg/b.png"}),
            "A",
        ),
    )
    qid = cur.lastrowid
    conn.commit()
    conn.close()

    qs = pk_svc._sanitized_questions([qid])
    assert qs[0]["option_imgs"] == {"A": "/qimg/a.png", "B": "/qimg/b.png"}

    r = client.get(f"/tiku/q/{qid}")
    assert r.status_code == 200
    assert "/qimg/a.png" in r.text
    assert "____ " not in r.text.split("</title>")[0]
    assert seo_pages  # imported cleanly


# ---- P2-9: reports.py 使用 UTC+8 切日与格式化 ----
def test_reports_uses_utc_plus_8():
    # 在当天 UTC 15:50（北京时间 23:50）和 UTC 16:10（北京时间次日 00:10）各写一条作答，
    # 按 UTC 是同一天，按 UTC+8 必须是 2 个活跃日
    now = int(time.time())
    day_base = (now // 86400 - 1) * 86400
    t1 = day_base + 15 * 3600 + 50 * 60
    t2 = day_base + 16 * 3600 + 10 * 60
    uid = "real-utc8-check-user"
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("INSERT INTO answer_log (uid, module, correct, secs, created_at) VALUES (?, 'yanyu', 1, 15, ?)", (uid, t1))
    conn.execute("INSERT INTO answer_log (uid, module, correct, secs, created_at) VALUES (?, 'yanyu', 1, 15, ?)", (uid, t2))
    conn.commit()
    conn.close()

    rep = db_reports.real_user_report(days=10)
    me = next(x for x in rep["users"] if x["uid"] == uid)
    assert me["days_active"] == 2
    assert me["first"].endswith("23:50")
    assert me["last"].endswith("00:10")


# ---- P2 Infra: .dockerignore 与非 root entrypoint 就绪 ----
def test_docker_hardening_files_present():
    di = (ROOT / ".dockerignore").read_text(encoding="utf-8")
    assert "backend/app/fonts/Noto*.ttf" in di
    assert "backend/tests/" in di
    df = (ROOT / "deploy" / "Dockerfile.runtime").read_text(encoding="utf-8")
    assert "fonts-wqy-zenhei" not in df
    assert "entrypoint.sh" in df
    ep = (ROOT / "deploy" / "entrypoint.sh").read_text(encoding="utf-8")
    assert "setpriv --reuid=1000 --regid=1000" in ep
    dc = (ROOT / "deploy" / "docker-compose.yml").read_text(encoding="utf-8")
    assert "willfarrell/autoheal:latest" not in dc
    assert "willfarrell/autoheal:1.2.0" in dc


# ---- P2-11: _ensure_question_stat_cols 建立部分索引 ----
def test_question_stat_cols_creates_partial_index():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE questions (id INTEGER PRIMARY KEY, question TEXT)")
    db._ensure_question_stat_cols(conn)
    idxs = {r["name"] for r in conn.execute("PRAGMA index_list(questions)")}
    assert "idx_questions_attempt_count" in idxs
    conn.close()
