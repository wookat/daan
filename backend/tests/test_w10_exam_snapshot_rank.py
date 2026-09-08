"""W10-A：模考 attempt 题序快照（卷内题事后禁用不错位判分）+ 迷你模考排名池按 kind=mock 全体场次。"""
import json

from app import db

from .conftest import seed_questions

_ANSWERS = ["A", "B", "C", "D", "A", "B"]


def _seed_slot_questions() -> list[int]:
    conn = db.get_conn()
    ids = []
    for i, ans in enumerate(_ANSWERS):
        text = f"W10 快照测试题 {i}：以下说法正确的是？"
        conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer,"
            " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,1,0)",
            ("yanyu", "单选题", text, json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}), ans, "解析"),
        )
        conn.execute("UPDATE questions SET disabled=0 WHERE question=?", (text,))
        ids.append(conn.execute("SELECT id FROM questions WHERE question=?", (text,)).fetchone()["id"])
    conn.commit()
    conn.close()
    return ids


def _seed_paper(title: str, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", 2024, "浙江", json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def _set_disabled(qid: int, v: int):
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=? WHERE id=?", (v, qid))
    conn.commit()
    conn.close()


def test_report_grades_by_snapshot_after_question_disabled(client):
    qids = _seed_slot_questions()
    pid = _seed_paper("W10 题序快照卷", qids)
    uid = "test-w10-snap"
    r = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid})
    assert r.status_code == 200, r.text
    aid = r.json()["attempt_id"]
    assert [i["id"] for i in r.json()["items"]] == qids
    assert db.get_exam_attempt(aid)["question_ids"] == qids
    picks = {str(i + 1): a for i, a in enumerate(_ANSWERS)}
    r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": picks})
    assert r.status_code == 200, r.text
    assert r.json()["score"] == 100.0 and r.json()["correct"] == 6
    _set_disabled(qids[1], 1)
    try:
        rep = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
        items = rep["items"]
        assert [i["question_id"] for i in items] == qids
        assert [i["no"] for i in items] == [1, 2, 3, 4, 5, 6]
        assert all(i["correct"] for i in items), [(i["no"], i["picked"], i["answer"]) for i in items]
        assert rep["weak_tags"] == []
        # 老 attempt（无快照）回退当前活跃列表：仍可出报告，题数随活跃题变化
        conn = db.get_conn()
        conn.execute("UPDATE exam_attempts SET question_ids=NULL WHERE id=?", (aid,))
        conn.commit()
        conn.close()
        assert db.get_exam_attempt(aid)["question_ids"] == []
        legacy = client.get(f"/api/exam/report/{aid}?uid={uid}").json()
        assert [i["question_id"] for i in legacy["items"]] == [q for q in qids if q != qids[1]]
    finally:
        _set_disabled(qids[1], 0)


def test_snapshot_used_for_submit_when_question_disabled_mid_exam(client):
    qids = _seed_slot_questions()
    pid = _seed_paper("W10 考中禁题卷", qids)
    uid = "test-w10-snap2"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    _set_disabled(qids[1], 1)
    try:
        picks = {str(i + 1): a for i, a in enumerate(_ANSWERS)}
        r = client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": picks})
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 6 and r.json()["correct"] == 6
    finally:
        _set_disabled(qids[1], 0)


def _wrong_pick(answer) -> str:
    return next(ch for ch in "ABCD" if ch not in db.normalize_answer(answer))


def test_mini_mock_rank_pool_spans_all_mock_papers(client):
    seed_questions()
    uids = ["test-w10-rank-a", "test-w10-rank-b"]
    aids = {}
    for u in uids:
        r = client.post("/api/exam/start", json={"uid": u, "mini": 1})
        assert r.status_code == 200, r.text
        aid, items = r.json()["attempt_id"], r.json()["items"]
        assert r.json()["paper"]["kind"] == "mock"
        # 随机卷答案不可预知：a 按题库答案全对、b 全错，排名与卷面无关
        answers = {q["id"]: q["answer"] for q in db.questions_by_ids([i["id"] for i in items])}
        picks = {
            str(i + 1): (db.normalize_answer(answers[it["id"]]) if u == uids[0] else _wrong_pick(answers[it["id"]]))
            for i, it in enumerate(items)
        }
        assert client.post("/api/exam/submit", json={"uid": u, "attempt_id": aid, "picks": picks}).status_code == 200
        aids[u] = aid
    pids = {db.get_exam_attempt(a)["paper_id"] for a in aids.values()}
    assert len(pids) == 2  # 每场随机新卷，旧口径按 paper_id 只能得到 1/1
    rank = client.get(f"/api/exam/rank/{aids[uids[0]]}?uid={uids[0]}").json()
    assert rank["total"] >= 2 and rank["rank"] == 1
    assert any(b["me"] for b in rank["board"]) and len(rank["board"]) >= 2
    rank_b = client.get(f"/api/exam/rank/{aids[uids[1]]}?uid={uids[1]}").json()
    assert rank_b["total"] == rank["total"] and rank_b["rank"] >= 2


def test_zhenti_rank_pool_still_per_paper(client):
    qids = _seed_slot_questions()
    pid = _seed_paper("W10 真题池隔离卷", qids)
    other = _seed_paper("W10 真题池隔离卷 B", qids)
    uid = "test-w10-rank-z"
    aid = client.post("/api/exam/start", json={"uid": uid, "paper_id": pid}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": uid, "attempt_id": aid, "picks": {"1": "A"}})
    aid2 = client.post("/api/exam/start", json={"uid": "test-w10-rank-z2", "paper_id": other}).json()["attempt_id"]
    client.post("/api/exam/submit", json={"uid": "test-w10-rank-z2", "attempt_id": aid2, "picks": {"1": "A"}})
    rank = client.get(f"/api/exam/rank/{aid}?uid={uid}").json()
    assert rank["total"] == 1
