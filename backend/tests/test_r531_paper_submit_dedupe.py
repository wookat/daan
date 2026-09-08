"""R531：同一 uid 对同一卷同一页提交完全相同的作答（重扫同一张答题卡 / 手动录入重复交卷）只落库一次：
answer_log 不翻倍、mistakes.times 不递增、已推进的复习进度（review_streak/next_review）不被打回；
回包 saved=False + dup=True + dup_at=首次时刻，items 仍照常返回。答案不同视为新一次作答；整卷模考不去重。"""
from app import db, exam_api
from tests.conftest import seed_questions


def _conn():
    c = db.get_conn()
    return c


def _state(uid):
    c = _conn()
    a = c.execute("SELECT COUNT(*) FROM answer_log WHERE uid=?", (uid,)).fetchone()[0]
    m = c.execute("SELECT question_id, times, review_streak, next_review FROM mistakes WHERE uid=? ORDER BY id", (uid,)).fetchall()
    c.close()
    return a, [tuple(r) for r in m]


def _scan(client, uid):
    return client.post("/api/scan_sheet", data={"uid": uid}, files={"image": ("s.png", b"fake", "image/png")}).json()


def test_scan_same_sheet_twice_records_once(client, monkeypatch):
    qids = seed_questions(3, ("ziliao", "shuliang"))[:3]
    db.save_paper_export("R531DUP", qids, "R531 去重卷")
    answers = {q["id"]: q["answer"] for q in db.questions_by_ids(qids)}
    wrong_pick = "A" if answers[qids[1]] != "A" else "B"
    picks = {0: answers[qids[0]], 1: wrong_pick, 2: answers[qids[2]]}
    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R531DUP", "page": 1, "picks": picks})
    uid = "r531-anon"

    first = _scan(client, uid)
    assert first["saved"] is True and first["dup"] is False and first["dup_at"] is None
    assert first["answered"] == 3 and first["correct"] == 2
    a1, m1 = _state(uid)
    assert a1 == 3 and len(m1) == 1 and m1[0][0] == qids[1] and m1[0][1] == 1

    # 复习答对两次推进 SRS
    mid = _conn().execute("SELECT id FROM mistakes WHERE uid=?", (uid,)).fetchone()[0]
    for _ in range(2):
        assert client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True}).status_code == 200
    _, m_rev = _state(uid)
    assert m_rev[0][2] == 2 and m_rev[0][3] is not None
    streak_before, next_before = m_rev[0][2], m_rev[0][3]

    second = _scan(client, uid)
    assert second["saved"] is False and second["dup"] is True
    assert abs(second["dup_at"] - first_ts(uid)) < 1e-6
    assert second["items"] == first["items"] and second["correct"] == 2 and second["page"] == 1
    a2, m2 = _state(uid)
    assert a2 == 3, "重扫同一张卡不得重复落 answer_log"
    assert m2[0][1] == 1 and m2[0][2] == streak_before and m2[0][3] == next_before, "复习进度不得被打回"

    # 同页答案不同 = 新一次作答，正常落库
    picks2 = dict(picks)
    picks2[0] = "D" if answers[qids[0]] != "D" else "C"
    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R531DUP", "page": 1, "picks": picks2})
    third = _scan(client, uid)
    assert third["saved"] is True and third["dup"] is False
    a3, m3 = _state(uid)
    assert a3 == 6 and len(m3) == 2


def first_ts(uid):
    c = _conn()
    t = c.execute("SELECT MIN(created_at) FROM paper_submits WHERE uid=?", (uid,)).fetchone()[0]
    c.close()
    return t


def test_manual_resubmit_same_picks_records_once(client):
    qids = seed_questions(3, ("yanyu", "panduan"))[:3]
    db.save_paper_export("R531MAN", qids, "R531 手录卷")
    uid = "r531-man"
    body = {"uid": uid, "code": "R531MAN", "picks": {"1": "A", "2": "B", "3": "C"}}
    r1 = client.post("/api/paper_answers", json=body).json()
    assert r1["saved"] is True and r1["dup"] is False
    n1 = _state(uid)[0]
    r2 = client.post("/api/paper_answers", json=body).json()
    assert r2["saved"] is False and r2["dup"] is True and r2["dup_at"]
    assert _state(uid)[0] == n1 == 3
    # 另一个 uid 提交相同答案不受影响
    r3 = client.post("/api/paper_answers", json={**body, "uid": uid + "b"}).json()
    assert r3["saved"] is True and r3["dup"] is False


def test_pages_are_independent_and_anon_without_uid_never_dup(client, monkeypatch):
    qids = seed_questions(12, ("ziliao", "shuliang", "yanyu", "panduan", "changshi"))[:60]
    db.save_paper_export("R531P60", qids, "R531 六十题卷")
    uid = "r531-pages"
    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R531P60", "page": 1, "picks": {0: "A"}})
    assert _scan(client, uid)["saved"] is True
    # 第 2 页同槽位同答案是另一页，不算重复
    monkeypatch.setattr(exam_api.omr, "recognize", lambda raw: {"code": "R531P60", "page": 2, "picks": {0: "A"}})
    p2 = _scan(client, uid)
    assert p2["saved"] is True and p2["dup"] is False and p2["page"] == 2
    # 无 uid：从不落库也从不标 dup
    anon = _scan(client, "")
    assert anon["saved"] is False and anon["dup"] is False and anon["dup_at"] is None


def test_picks_hash_ignores_order_and_normalizes():
    a = db.paper_picks_hash([{"question_id": 1, "picked": "A"}, {"question_id": 2, "picked": "bd"}])
    b = db.paper_picks_hash([{"question_id": 2, "picked": "DB"}, {"question_id": 1, "picked": "a"}])
    assert a == b
    assert a != db.paper_picks_hash([{"question_id": 1, "picked": "B"}, {"question_id": 2, "picked": "BD"}])
