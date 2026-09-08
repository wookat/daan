"""R521：时政错题（question_id 置空、题号属 shizheng_questions）此前在 /api/mistakes/redo 里永远匹配不回原题——
「重练所选/重练本页」对时政行静默丢弃、全时政勾选整体报「未能匹配到题库原题」。现按题干首行回 shizheng_questions，
返回项与 shizheng_daily 同形态并带 _sz；行测行走原路径不变、匹配不到的仍跳过。"""
import json

from app import db

from .conftest import seed_questions

UID = "test-r521-sz-redo"
SZ_Q = "R521 测试时政题干：下列关于某次会议的说法正确的是？"
SZ_OPTS = {"A": "甲", "B": "乙", "C": "丙", "D": "丁"}


def _seed_sz() -> int:
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shizheng_questions (date, question, options, answer, explanation, source_note, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("2026-09-01", SZ_Q, json.dumps(SZ_OPTS, ensure_ascii=False), "B", "测试解析", "新华社"),
    )
    conn.commit()
    sid = conn.execute("SELECT id FROM shizheng_questions WHERE question=?", (SZ_Q,)).fetchone()["id"]
    conn.close()
    return sid


def _mistake(text: str, qid: int | None) -> int:
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    cur = conn.execute(
        "INSERT INTO mistakes (question_text, uid, question_id, module, question_type, correct_answer, mastered, created_at)"
        " VALUES (?,?,?,?,?,?,0,strftime('%s','now'))",
        (text, UID, qid, "时政" if qid is None else "changshi", "单选", "B"),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (UID,))
    conn.execute("DELETE FROM shizheng_questions WHERE question=?", (SZ_Q,))
    conn.commit()
    conn.close()


def test_shizheng_mistake_redo_by_head(client):
    sid = _seed_sz()
    opt_text = " ".join(f"{k}.{v}" for k, v in SZ_OPTS.items())
    mid = _mistake(SZ_Q + "\n" + opt_text, None)
    d = client.get(f"/api/mistakes/redo?uid={UID}&mids={mid}").json()
    assert len(d["items"]) == 1
    it = d["items"][0]
    assert it["mistake_id"] == mid
    assert it["id"] == sid and it["_sz"] is True
    assert it["module"] == "时政" and it["question_type"] == "单选"
    assert it["question"] == SZ_Q and it["options"] == SZ_OPTS and it["answer"] == "B"
    assert "【出处】新华社" in it["explanation"]
    _cleanup()


def test_mixed_selection_keeps_both_kinds(client):
    _seed_sz()
    qid = seed_questions()[0]
    conn = db.get_conn()
    qtext = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()["question"]
    conn.close()
    m_xc = _mistake(qtext, qid)
    m_sz = _mistake(SZ_Q + "\nA.甲 B.乙 C.丙 D.丁", None)
    m_gone = _mistake("R521 已不在任何题库的手录题\nA.x B.y", None)
    d = client.get(f"/api/mistakes/redo?uid={UID}&mids={m_xc},{m_sz},{m_gone}").json()
    by_mid = {q["mistake_id"]: q for q in d["items"]}
    assert set(by_mid) == {m_xc, m_sz}
    assert by_mid[m_xc]["id"] == qid and "_sz" not in by_mid[m_xc]
    assert by_mid[m_sz]["_sz"] is True
    _cleanup()


def test_module_filter_shizheng(client):
    _seed_sz()
    m_sz = _mistake(SZ_Q + "\nA.甲 B.乙 C.丙 D.丁", None)
    d = client.get(f"/api/mistakes/redo?uid={UID}&module=时政").json()
    assert [q["mistake_id"] for q in d["items"]] == [m_sz]
    _cleanup()
