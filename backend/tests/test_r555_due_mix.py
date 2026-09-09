"""R555：普通练习混入到期错题（/api/questions?mix_due=1）。

random_questions 排除本 uid 答过的所有题，普通练习永远抽不到自己的错题 → 服务端「答对曾错题连带推进复习
（via=answer）」在普通练习里结构性不可达；mix_due=1 时把 ≤2 道到期错题均匀插进新题组，answer_log 答对后按
既有路径推进。仅普通练习（无 real/year/region/tag3/adaptive）且显式 mix_due 才混，其他调用方零变化。"""
import time

from app import db
from app.qbank_api import due_mix_slots, interleave_due
from tests.conftest import seed_questions

PFX = "test-r555-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    db._ensure_answer_log(conn)
    db._ensure_review_log(conn)
    for t in ("mistakes", "answer_log", "review_log"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mistake(client, uid, qid, module="ziliao"):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": module, "question_type": "单选题",
        "question_text": f"R555 题干 {qid}", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def _set(mid, **cols):
    conn = db.get_conn()
    conn.execute(f"UPDATE mistakes SET {', '.join(k + '=?' for k in cols)} WHERE id=?", (*cols.values(), mid))
    conn.commit()
    conn.close()


def _answered(uid, qid, ago_s: float):
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs) VALUES (?,?,?,?,?,?)",
        (uid, time.time() - ago_s, qid, "ziliao", 0, 5),
    )
    conn.commit()
    conn.close()


def _draw(client, uid, **params):
    r = client.get("/api/questions", params={"limit": 10, "uid": uid, **params})
    assert r.status_code == 200
    return r.json()["items"]


# ---------- 纯函数 ----------

def test_due_mix_slots_caps():
    assert [due_mix_slots(n) for n in (1, 4, 5, 9, 10, 15, 20, 50)] == [0, 0, 1, 1, 2, 2, 2, 2]


def test_interleave_positions_and_size():
    fresh = [{"id": i} for i in range(1, 11)]
    due = [{"id": 101}, {"id": 102}]
    out = interleave_due(fresh, due, 10)
    assert len(out) == 10
    assert [q["id"] for q in out].index(101) == 4 and [q["id"] for q in out].index(102) == 7
    assert out[0]["id"] == 1  # 首题仍是新题
    assert [q["id"] for q in out if q["id"] < 100] == [1, 2, 3, 4, 5, 6, 7, 8]  # 新题顺序不变、只截掉末 2 道
    assert interleave_due(fresh, [], 10) == fresh
    # 新题不足：错题只补空位不顶新题
    assert [q["id"] for q in interleave_due(fresh[:3], due, 10)] == [1, 2, 101, 3, 102]
    assert len(interleave_due([], due, 1)) == 1


# ---------- 接口 ----------

def test_mix_due_inserts_due_mistake_and_marks_it(client):
    _cleanup()
    uid = PFX + "mix"
    seed_questions(12, ("ziliao",))
    conn = db.get_conn()
    qids = [r["id"] for r in conn.execute("SELECT id FROM questions WHERE module='ziliao' AND disabled=0 ORDER BY id LIMIT 12")]
    conn.close()
    mid = _mistake(client, uid, qids[0])
    _answered(uid, qids[0], ago_s=3 * 86400)  # 3 天前答错并入错题本，本会话未碰过

    plain = _draw(client, uid, module="ziliao")
    assert all(q["id"] != qids[0] for q in plain), "不带 mix_due 时保持原口径：答过的题不再出"
    assert all("due_mid" not in q for q in plain)

    mixed = _draw(client, uid, module="ziliao", mix_due=1)
    hit = [q for q in mixed if q.get("due_mid")]
    assert len(hit) == 1 and hit[0]["id"] == qids[0] and hit[0]["due_mid"] == mid and hit[0]["due_streak"] == 0
    assert len(mixed) <= 10 and len({q["id"] for q in mixed}) == len(mixed)
    assert mixed[0]["id"] != qids[0]
    assert mixed.index(hit[0]) == 5  # 1 道到期错题居中（ceil(10/2)）

    # 答对该题 → answer_log 服务端连带推进复习（via=answer），之后不再到期、不再混入
    r = client.post("/api/answer_log", json={"uid": uid, "items": [
        {"question_id": qids[0], "module": "ziliao", "correct": True, "secs": 4, "picked": "A"},
    ]})
    assert r.status_code == 200 and [x["mistake_id"] for x in r.json()["reviewed"]] == [mid]
    conn = db.get_conn()
    via = [r["via"] for r in conn.execute("SELECT via FROM review_log WHERE mistake_id=?", (mid,))]
    conn.close()
    assert via == ["answer"]
    assert not [q for q in _draw(client, uid, module="ziliao", mix_due=1) if q.get("due_mid")]


def test_mix_due_skips_same_session_and_filters(client):
    _cleanup()
    uid = PFX + "skip"
    seed_questions(12, ("ziliao", "yanyu"))
    conn = db.get_conn()
    zl = [r["id"] for r in conn.execute("SELECT id FROM questions WHERE module='ziliao' AND disabled=0 ORDER BY id LIMIT 3")]
    yy = [r["id"] for r in conn.execute("SELECT id FROM questions WHERE module='yanyu' AND disabled=0 ORDER BY id LIMIT 1")]
    conn.close()
    m_recent = _mistake(client, uid, zl[0])
    _answered(uid, zl[0], ago_s=60)  # 刚在本组答错：不立刻重出（R553 错题重练负责）
    m_old = _mistake(client, uid, zl[1])
    _answered(uid, zl[1], ago_s=2 * 86400)
    m_future = _mistake(client, uid, zl[2])
    _answered(uid, zl[2], ago_s=2 * 86400)
    _set(m_future, next_review=time.time() + 86400)  # 明天才到期
    m_yy = _mistake(client, uid, yy[0], module="yanyu")
    _answered(uid, yy[0], ago_s=2 * 86400)

    mids = sorted(q["due_mid"] for q in _draw(client, uid, module="ziliao", mix_due=1) if q.get("due_mid"))
    assert mids == [m_old], (m_recent, m_old, m_future, m_yy, mids)
    # 不限模块：跨模块到期错题都可混入（上限 2）
    mids = sorted(q["due_mid"] for q in _draw(client, uid, mix_due=1) if q.get("due_mid"))
    assert mids == sorted([m_old, m_yy])
    # 已掌握不混
    _set(m_old, mastered=1)
    assert [q["due_mid"] for q in _draw(client, uid, module="ziliao", mix_due=1) if q.get("due_mid")] == []
    # 真题/考点/自适应筛选与无 uid 一律不混
    _set(m_old, mastered=0)
    for extra in ({"real": 1}, {"tag3": "ZL-01"}, {"adaptive": 1}):
        assert not [q for q in _draw(client, uid, module="ziliao", mix_due=1, **extra) if q.get("due_mid")], extra
    r = client.get("/api/questions", params={"limit": 10, "mix_due": 1, "module": "ziliao"})
    assert r.status_code == 200 and not [q for q in r.json()["items"] if q.get("due_mid")]
    # 中场预取下一组：当组未答完的到期题尚无 answer_log，靠 exclude=当组题 id 不再混入；非法 token 忽略
    assert [q["due_mid"] for q in _draw(client, uid, module="ziliao", mix_due=1) if q.get("due_mid")] == [m_old]
    ex = _draw(client, uid, module="ziliao", mix_due=1, exclude=f"{zl[1]},abc,,-1")
    assert not [q for q in ex if q.get("due_mid")] and all(q["id"] != zl[1] for q in ex)
    assert len(ex) <= 10 and len({q["id"] for q in ex}) == len(ex)


def test_mix_due_wrong_again_resets_streak_not_duplicate(client):
    _cleanup()
    uid = PFX + "wrong"
    seed_questions(6, ("ziliao",))
    conn = db.get_conn()
    qid = conn.execute("SELECT id FROM questions WHERE module='ziliao' AND disabled=0 ORDER BY id LIMIT 1").fetchone()["id"]
    conn.close()
    mid = _mistake(client, uid, qid)
    _set(mid, review_streak=2, next_review=time.time() - 10)
    _answered(uid, qid, ago_s=2 * 86400)
    hit = [q for q in _draw(client, uid, module="ziliao", mix_due=1) if q.get("due_mid")]
    assert hit and hit[0]["due_streak"] == 2
    # 再答错：客户端照常 POST /api/mistakes → 同题去重 times+1、连对清零，不产生第二条错题
    assert _mistake(client, uid, qid) == mid
    conn = db.get_conn()
    row = dict(conn.execute("SELECT times, review_streak FROM mistakes WHERE id=?", (mid,)).fetchone())
    n = conn.execute("SELECT COUNT(*) n FROM mistakes WHERE uid=? AND question_id=?", (uid, qid)).fetchone()["n"]
    conn.close()
    assert (row["times"], row["review_streak"], n) == (2, 0, 1)
