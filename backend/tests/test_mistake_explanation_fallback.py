"""错题快照 explanation 为空（练习路径 `q.explanation||''`、解析已隔离）时，列表/复习读取回落到题目的 hs_explanation（R396）。"""
from app import db

from .conftest import seed_questions


def _set_expl(qid: int, explanation, hs):
    conn = db.get_conn()
    conn.execute("UPDATE questions SET explanation=?, hs_explanation=? WHERE id=?", (explanation, hs, qid))
    conn.commit()
    conn.close()


def _post(client, uid, qid, explanation):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "ziliao",
        "question_text": f"测试题干 {qid}", "user_answer": "B", "correct_answer": "A",
        "explanation": explanation,
    })
    assert r.status_code == 200


def _cleanup(uid, qids):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    for qid in qids:
        conn.execute("UPDATE questions SET explanation='测试解析：选 A。', hs_explanation=NULL WHERE id=?", (qid,))
    conn.commit()
    conn.close()


def test_empty_snapshot_falls_back_to_hs_in_list_and_due(client):
    q_null, q_kept, q_none = seed_questions()[:3]
    _set_expl(q_null, None, "花生讲解：抓关键词。")
    _set_expl(q_kept, "官方解析：选 A。", "花生讲解：不该出现。")
    _set_expl(q_none, None, None)
    uid = "test-r396-fallback"
    _post(client, uid, q_null, "")
    _post(client, uid, q_kept, "官方解析：选 A。")
    _post(client, uid, q_none, "")
    by_q = {m["question_id"]: m for m in client.get(f"/api/mistakes?uid={uid}").json()["items"]}
    assert by_q[q_null]["explanation"] == "花生讲解：抓关键词。"
    assert by_q[q_kept]["explanation"] == "官方解析：选 A。"
    assert by_q[q_none]["explanation"] == ""
    assert "q_hs" not in by_q[q_kept] and "q_hs" not in by_q[q_null]
    due = {m["question_id"]: m for m in db.due_reviews(limit=50, uid=uid)}
    assert due[q_null]["explanation"] == "花生讲解：抓关键词。"
    assert due[q_kept]["explanation"] == "官方解析：选 A。"
    assert "q_hs" not in due[q_null]
    _cleanup(uid, [q_null, q_kept, q_none])


def test_save_mistake_writes_hs_into_empty_snapshot(client):
    """R400 写入侧：客户端传空解析且题目有 hs → 快照落库即为 hs（不再依赖读取侧回落）；非空快照原样保留。"""
    q_null, q_kept, q_none = seed_questions()[:3]
    _set_expl(q_null, None, "花生讲解：写入侧兜底。")
    _set_expl(q_kept, "官方解析：选 A。", "花生讲解：不该覆盖。")
    _set_expl(q_none, None, None)
    uid = "test-r400-write-fallback"
    _post(client, uid, q_null, "")
    _post(client, uid, q_kept, "官方解析：选 A。")
    _post(client, uid, q_none, "   ")
    conn = db.get_conn()
    raw = {r["question_id"]: r["explanation"] for r in conn.execute(
        "SELECT question_id, explanation FROM mistakes WHERE uid=?", (uid,)
    )}
    conn.close()
    assert raw[q_null] == "花生讲解：写入侧兜底。"
    assert raw[q_kept] == "官方解析：选 A。"
    assert raw[q_none] == "   "  # 无 hs 可回落 → 原值不动
    # 无 question_id 的手动录入不查库、原样落
    r = client.post("/api/mistakes", json={
        "uid": uid, "module": "yanyu", "question_text": "手动录入题干", "user_answer": "B", "correct_answer": "A", "explanation": "",
    })
    assert r.status_code == 200
    conn = db.get_conn()
    manual = conn.execute("SELECT explanation FROM mistakes WHERE id=?", (r.json()["id"],)).fetchone()[0]
    conn.close()
    assert manual == ""
    _cleanup(uid, [q_null, q_kept, q_none])
