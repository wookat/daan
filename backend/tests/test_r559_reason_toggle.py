"""R559：错因 chip 再点已选项取消——PATCH /api/mistakes/{mid} error_reason 收空串/None 清为 NULL（「未标注」），
非四档错因 400；既有四档改选与 mastered 路径不变。"""
from app import db

from .conftest import seed_questions


def _cleanup(uid: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def _reason(mid: int):
    conn = db.get_conn()
    row = conn.execute("SELECT error_reason FROM mistakes WHERE id=?", (mid,)).fetchone()
    conn.close()
    return row[0]


def _seed_mistake(client, uid: str) -> int:
    qid = seed_questions()[0]
    r = client.post(
        "/api/mistakes",
        json={"uid": uid, "question_id": qid, "module": "yanyu", "question_text": "q", "user_answer": "B", "correct_answer": "A"},
    )
    assert r.status_code == 200
    return r.json()["id"]


def test_patch_reason_clear_to_null(client):
    uid = "test-r559-clear"
    mid = _seed_mistake(client, uid)
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": "概念不清"}).status_code == 200
    assert _reason(mid) == "概念不清"
    # 再点已选项：客户端发空串 → NULL
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": ""}).status_code == 200
    assert _reason(mid) is None
    # None 同义
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": "方法不会"}).status_code == 200
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": None}).status_code == 200
    assert _reason(mid) is None
    # 清空后列表回读为未标注
    lst = client.get(f"/api/mistakes?uid={uid}").json()
    assert next(m for m in lst["items"] if m["id"] == mid)["error_reason"] is None
    _cleanup(uid)


def test_patch_reason_rejects_unknown(client):
    uid = "test-r559-bad"
    mid = _seed_mistake(client, uid)
    r = client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": "随便写"})
    assert r.status_code == 400
    assert _reason(mid) is None
    # 首尾空白容忍
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "error_reason": " 纯蒙的 "}).status_code == 200
    assert _reason(mid) == "纯蒙的"
    # 只改 mastered 不受错因校验影响
    assert client.patch(f"/api/mistakes/{mid}", json={"uid": uid, "mastered": True}).status_code == 200
    _cleanup(uid)
