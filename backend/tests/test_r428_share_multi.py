"""R428 分享作答多选题：picked 归一判分（此前 upper()[:2] 截断 → 3–4 字母多选题必判错）+ 详情回 multi 标记。"""
import json

from app import db

from .conftest import seed_questions, seed_share


def _seed_multi(answer: str) -> int:
    conn = db.get_conn()
    stem = f"R428 多选测试题 {answer}：下列说法正确的有？"
    conn.execute(
        "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer,"
        " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,1,0)",
        ("changshi", "多选题", stem,
         json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
         answer, "测试解析。"),
    )
    qid = conn.execute("SELECT id FROM questions WHERE question=?", (stem,)).fetchone()["id"]
    conn.commit()
    conn.close()
    return qid


def _cleanup(uids):
    conn = db.get_conn()
    for u in uids:
        conn.execute("DELETE FROM shared_answers WHERE uid=?", (u,))
        conn.execute("DELETE FROM answer_log WHERE uid=?", (u,))
    conn.commit()
    conn.close()


def test_share_detail_multi_flag(client):
    single = seed_questions(1, ("yanyu",))[0]
    multi = _seed_multi("ABD")
    seed_share("r428single", single)
    seed_share("r428multi0", multi)
    r = client.get("/api/share/r428single")
    assert r.status_code == 200, r.text
    assert r.json()["question"]["multi"] is False
    assert "answer" not in r.json()["question"]
    r = client.get("/api/share/r428multi0")
    assert r.status_code == 200, r.text
    assert r.json()["question"]["multi"] is True
    assert "answer" not in r.json()["question"]


def test_share_answer_multi_normalized_and_graded(client):
    qid = _seed_multi("ABD")
    seed_share("r428multi1", qid)
    uids = [f"test-r428-share-{i}" for i in range(4)]
    try:
        # 乱序/小写/重复字母 → 归一为 ABD 判对，落库为归一后的字符串
        r = client.post("/api/share/r428multi1/answer", json={"uid": uids[0], "picked": "dba", "secs": 5})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is True
        assert r.json()["answer"] == "ABD"
        # 漏选一项 → 错
        r = client.post("/api/share/r428multi1/answer", json={"uid": uids[1], "picked": "AB", "secs": 5})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is False
        # 多选一项 → 错（此前 [:2] 会把 ABCD 截成 AB）
        r = client.post("/api/share/r428multi1/answer", json={"uid": uids[2], "picked": "ABCD", "secs": 5})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is False
        # 非字母 → 400
        r = client.post("/api/share/r428multi1/answer", json={"uid": uids[3], "picked": "12", "secs": 5})
        assert r.status_code == 400, r.text
        conn = db.get_conn()
        try:
            rows = conn.execute(
                "SELECT uid, picked, correct FROM shared_answers WHERE uid IN (?,?,?) ORDER BY uid",
                uids[:3],
            ).fetchall()
            assert [(x["picked"], x["correct"]) for x in rows] == [("ABD", 1), ("AB", 0), ("ABCD", 0)]
            logs = conn.execute(
                "SELECT uid, picked, correct FROM answer_log WHERE uid IN (?,?,?) AND source='share' ORDER BY uid",
                uids[:3],
            ).fetchall()
            assert [(x["picked"], x["correct"]) for x in logs] == [("ABD", 1), ("AB", 0), ("ABCD", 0)]
        finally:
            conn.close()
        # 作答者再看详情：my_answer 带完整多字母
        r = client.get("/api/share/r428multi1", params={"uid": uids[0]})
        assert r.json()["my_answer"] == {"picked": "ABD", "correct": True}
    finally:
        _cleanup(uids)


def test_share_answer_single_choice_unchanged(client):
    qid = seed_questions(1, ("panduan",))[0]
    seed_share("r428single1", qid)
    uids = ["test-r428-single-0", "test-r428-single-1"]
    try:
        r = client.post("/api/share/r428single1/answer", json={"uid": uids[0], "picked": " a ", "secs": 3})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is True
        r = client.post("/api/share/r428single1/answer", json={"uid": uids[1], "picked": "B", "secs": 3})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is False
    finally:
        _cleanup(uids)
