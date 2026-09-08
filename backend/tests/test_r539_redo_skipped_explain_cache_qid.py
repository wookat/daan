"""R539：两处「服务端知道、客户端不知道」的契约缺口。
① /api/mistakes/redo 无 mids 路径（错题本入口卡「开始重练」）对手录 / 题已下线 / 题干对不回时政库的行 fail-closed 跳过，
   此前回包只有 items，前端只能在 0 题时提示，部分匹配时用户不知道少了题 → 回包加 skipped（本次加载口径，去重行不计）。
② /api/explain/stream 原文 key 缓存命中分支 meta0 不回 qid（非缓存分支回、save_explain_cache 也落了 qid）→ 补齐：
   落库 qid 优先，其次请求带的深链 question_id，都没有回 None（客户端按 askQid(m.qid) || 本地 保留）。"""
import json

from app import ai_api, db

from .conftest import seed_questions
from .test_r421_explain_linked_thinking import _linked_text, _sse

UID = "test-r539-redo-skipped"
SZ_Q = "R539 测试时政题干：下列关于某项工作的表述正确的是？"


def _mistake(text: str, qid: int | None, module: str = "changshi") -> int:
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    cur = conn.execute(
        "INSERT INTO mistakes (question_text, uid, question_id, module, question_type, correct_answer, mastered, created_at)"
        " VALUES (?,?,?,?,?,?,0,strftime('%s','now'))",
        (text, UID, qid, module, "单选", "A"),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def _seed_sz() -> int:
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shizheng_questions (date, question, options, answer, explanation, source_note, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("2026-09-08", SZ_Q, json.dumps({"A": "甲", "B": "乙"}, ensure_ascii=False), "A", "解析", "测试"),
    )
    conn.commit()
    sid = conn.execute("SELECT id FROM shizheng_questions WHERE question=?", (SZ_Q,)).fetchone()["id"]
    conn.close()
    return sid


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (UID,))
    conn.execute("DELETE FROM shizheng_questions WHERE question=?", (SZ_Q,))
    conn.commit()
    conn.close()


def _qtext(qid: int) -> str:
    conn = db.get_conn()
    t = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()["question"]
    conn.close()
    return t


# ---------- ① redo skipped ----------

def test_redo_partial_match_reports_skipped(client):
    qids = seed_questions()
    sid = _seed_sz()
    m_ok = _mistake(_qtext(qids[0]), qids[0])
    m_manual = _mistake("R539 手录题，题库里不存在\nA.甲 B.乙", None)
    m_sz = _mistake(SZ_Q + "\nA.甲 B.乙", None, "时政")
    m_manual2 = _mistake("R539 另一道手录题\nA.甲 B.乙", None)
    r = client.get(f"/api/mistakes/redo?uid={UID}&limit=10")
    assert r.status_code == 200
    d = r.json()
    assert set(d) == {"items", "skipped"}
    assert sorted((q["mistake_id"], q["id"], bool(q.get("_sz"))) for q in d["items"]) == sorted([(m_ok, qids[0], False), (m_sz, sid, True)])
    assert d["skipped"] == 2
    # mids 路径同一口径（前端 redoSel 沿用勾选数 − 回包数，两者应相等）
    d2 = client.get(f"/api/mistakes/redo?uid={UID}&limit=25&mids={m_ok},{m_manual},{m_manual2}").json()
    assert [q["mistake_id"] for q in d2["items"]] == [m_ok] and d2["skipped"] == 2
    _cleanup()


def test_redo_all_matched_and_none_matched():
    qids = seed_questions()
    m1 = _mistake(_qtext(qids[0]), qids[0])
    m2 = _mistake(_qtext(qids[1]), qids[1])
    d = db.mistakes_redo(uid=UID)
    assert sorted(q["mistake_id"] for q in d["items"]) == sorted([m1, m2]) and d["skipped"] == 0
    _cleanup()
    _mistake("R539 只有手录题\nA.甲", None)
    d = db.mistakes_redo(uid=UID)
    assert d == {"items": [], "skipped": 1}
    _cleanup()


def test_redo_skipped_counts_disabled_qid_row_not_duplicate_text():
    qids = seed_questions()
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (qids[2],))
    conn.commit()
    conn.close()
    try:
        # 有 qid 但题已下线，且题干在题库对不回 → 跳过计 1
        _mistake("R539 已下线题的旧题干\nA.甲", qids[2])
        # 同题干重复两行：第二行按去重 continue，不算 skipped
        _mistake("R539 重复手录题\nA.甲", None)
        _mistake("R539 重复手录题\nA.甲", None)
        d = db.mistakes_redo(uid=UID)
        assert d["items"] == [] and d["skipped"] == 2
    finally:
        conn = db.get_conn()
        conn.execute("UPDATE questions SET disabled=0 WHERE id=?", (qids[2],))
        conn.commit()
        conn.close()
        _cleanup()


def test_redo_skipped_is_uid_isolated_and_stops_at_limit():
    qids = seed_questions()
    _mistake(_qtext(qids[0]), qids[0])
    other = db.get_conn()
    db._ensure_mistake_uid(other)
    other.execute(
        "INSERT INTO mistakes (question_text, uid, question_id, module, mastered, created_at) VALUES (?,?,?,?,0,strftime('%s','now'))",
        ("R539 别人的手录题\nA.甲", UID + "-other", None, "changshi"),
    )
    other.commit()
    other.close()
    try:
        d = db.mistakes_redo(uid=UID)
        assert len(d["items"]) == 1 and d["skipped"] == 0
        # limit=1 取够即停：排在后面（next_review 更晚）的手录行没扫到，不计入 skipped（本次加载口径）
        m_late = _mistake("R539 排在后面的手录题\nA.甲", None)
        conn = db.get_conn()
        conn.execute("UPDATE mistakes SET next_review=strftime('%s','now')+86400 WHERE id=?", (m_late,))
        conn.commit()
        conn.close()
        d1 = db.mistakes_redo(uid=UID, limit=1)
        assert len(d1["items"]) == 1 and d1["skipped"] == 0
        d10 = db.mistakes_redo(uid=UID, limit=10)
        assert len(d10["items"]) == 1 and d10["skipped"] == 1
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM mistakes WHERE uid=?", (UID + "-other",))
        conn.commit()
        conn.close()
        _cleanup()


def test_redo_questions_wrapper_keeps_list_contract():
    qids = seed_questions()
    m = _mistake(_qtext(qids[0]), qids[0])
    items = db.mistakes_redo_questions(uid=UID)
    assert isinstance(items, list) and [q["mistake_id"] for q in items] == [m]
    _cleanup()


# ---------- ② explain cache hit qid ----------

def test_cached_qid_prefers_row_then_request_then_none():
    assert ai_api._cached_qid({"qid": 12}, None) == 12
    assert ai_api._cached_qid({"qid": 12}, 7) == 12
    assert ai_api._cached_qid({"qid": None}, 7) == 7
    assert ai_api._cached_qid({}, 7) == 7
    assert ai_api._cached_qid({"qid": 0}, 0) is None
    assert ai_api._cached_qid({"qid": -3}, -1) is None
    assert ai_api._cached_qid({"qid": "12"}, None) is None
    assert ai_api._cached_qid({}, None) is None


def test_stream_cache_hit_meta_carries_qid(client, monkeypatch):
    qid = seed_questions()[0]
    text = _linked_text(qid)
    hit = {"module": "ziliao", "question_type": "单选题", "question_text": text.strip(), "user_answer": "B", "explanation": "缓存正文", "qid": qid}
    monkeypatch.setattr(db, "get_explain_cache", lambda k: dict(hit))

    async def _boom(*a, **k):
        raise AssertionError("缓存命中不应识题")

    monkeypatch.setattr(ai_api.engine, "extract_question", _boom)
    # 粘贴原文、无深链 qid：以落库 qid 回
    evs = _sse(client.post("/api/explain/stream", data={"text": text}).text)
    assert [e for e, _ in evs] == ["meta", "message", "done"]
    meta = evs[0][1]
    assert meta["cached"] is True and meta["qid"] == qid and meta["module_name"] == ai_api.kb.MODULES["ziliao"]["name"]
    assert evs[1][1] == {"d": "缓存正文"}
    # 深链带 qid 且落库 qid 与之不同：以落库为准（缓存行是按原文 key 命中的同一题）
    evs = _sse(client.post("/api/explain/stream", data={"text": text, "question_id": str(qid + 100000)}).text)
    assert evs[0][1]["qid"] == qid


def test_stream_cache_hit_without_row_qid_uses_request_or_none(client, monkeypatch):
    qid = seed_questions()[0]
    text = _linked_text(qid)
    legacy = {"module": "ziliao", "question_type": "单选题", "question_text": text.strip(), "user_answer": None, "explanation": "R421 前落库无 qid", "qid": None}
    monkeypatch.setattr(db, "get_explain_cache", lambda k: dict(legacy))
    meta = _sse(client.post("/api/explain/stream", data={"text": text, "question_id": str(qid)}).text)[0][1]
    assert meta["cached"] is True and meta["qid"] == qid
    meta = _sse(client.post("/api/explain/stream", data={"text": text}).text)[0][1]
    assert meta["cached"] is True and meta["qid"] is None
    meta = _sse(client.post("/api/explain/stream", data={"text": text, "question_id": "0"}).text)[0][1]
    assert "qid" in meta and meta["qid"] is None
