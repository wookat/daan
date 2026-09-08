"""R534：/api/mistakes/redo 对无 question_id 的错题行此前先跑 1–3 次 questions 的 LIKE 前缀扫（生产 10.9 万活跃行、
单次 3.3 s）、全部落空才回 shizheng_questions 等值查（0.9 ms）——而生产无 qid 行 28 条里 27 条就是时政题。
现改为无 qid 行先走 shizheng 索引等值查，未命中（真正的手录/遗留纯文本行）才回落 LIKE 扫；行测有 qid 行路径不变。"""
import json
import threading

from app import db

from .conftest import seed_questions

UID = "test-r534-sz-first"
SZ_Q = "R534 测试时政题干：下列关于某项政策的表述正确的是？"
SZ_OPTS = {"A": "甲", "B": "乙", "C": "丙", "D": "丁"}


def _seed_sz() -> int:
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shizheng_questions (date, question, options, answer, explanation, source_note, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("2026-09-02", SZ_Q, json.dumps(SZ_OPTS, ensure_ascii=False), "C", "测试解析", "新华社"),
    )
    conn.commit()
    sid = conn.execute("SELECT id FROM shizheng_questions WHERE question=?", (SZ_Q,)).fetchone()["id"]
    conn.close()
    return sid


def _mistake(text: str, qid: int | None, module: str) -> int:
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    cur = conn.execute(
        "INSERT INTO mistakes (question_text, uid, question_id, module, question_type, correct_answer, mastered, created_at)"
        " VALUES (?,?,?,?,?,?,0,strftime('%s','now'))",
        (text, UID, qid, module, "单选", "C"),
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


class _Trace:
    """收集 redo 一次调用里实际执行的 SQL（只挂测试线程的连接，避开 _warmup 等后台线程的噪声）。"""

    def __init__(self, monkeypatch):
        self.sql: list[str] = []
        real = db.get_conn
        tid = threading.get_ident()

        def patched(*a, **kw):
            conn = real(*a, **kw)
            if threading.get_ident() == tid:
                conn.set_trace_callback(self.sql.append)
            return conn

        monkeypatch.setattr(db, "get_conn", patched)

    def like_scans(self) -> list[str]:
        return [s for s in self.sql if "FROM questions" in s and "LIKE" in s]

    def sz_lookups(self) -> list[str]:
        return [s for s in self.sql if "FROM shizheng_questions" in s]


def test_shizheng_row_skips_questions_like_scan(monkeypatch):
    sid = _seed_sz()
    mid = _mistake(SZ_Q + "\nA.甲 B.乙 C.丙 D.丁", None, "时政")
    tr = _Trace(monkeypatch)
    items = db.mistakes_redo_questions(uid=UID, mids=[mid])
    assert [(q["mistake_id"], q["id"], q.get("_sz")) for q in items] == [(mid, sid, True)]
    assert tr.like_scans() == []
    assert len(tr.sz_lookups()) == 1
    _cleanup()


def test_legacy_text_row_still_falls_back_to_like(monkeypatch):
    _seed_sz()
    qid = seed_questions()[0]
    conn = db.get_conn()
    qtext = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()["question"]
    conn.close()
    m_legacy = _mistake(qtext, None, "changshi")
    m_gone = _mistake("R534 已不在任何题库的手录题\nA.x B.y", None, "changshi")
    tr = _Trace(monkeypatch)
    items = db.mistakes_redo_questions(uid=UID, mids=[m_legacy, m_gone])
    assert [(q["mistake_id"], q["id"]) for q in items] == [(m_legacy, qid)]
    assert "_sz" not in items[0]
    # 两行都先查了 shizheng（各 1 次等值查），未命中才 LIKE 扫；m_legacy 首扫即中（1 次），
    # m_gone 全文扫落空再扫首行%次行% / 首行% 共 3 次（R521 前的回落阶梯不动）
    assert len(tr.sz_lookups()) == 2
    assert len(tr.like_scans()) == 4
    _cleanup()


def test_qid_row_never_touches_shizheng(monkeypatch):
    qid = seed_questions()[0]
    conn = db.get_conn()
    qtext = conn.execute("SELECT question FROM questions WHERE id=?", (qid,)).fetchone()["question"]
    conn.close()
    mid = _mistake(qtext, qid, "changshi")
    tr = _Trace(monkeypatch)
    items = db.mistakes_redo_questions(uid=UID, mids=[mid])
    assert [(q["mistake_id"], q["id"]) for q in items] == [(mid, qid)]
    assert tr.sz_lookups() == [] and tr.like_scans() == []
    _cleanup()


def test_shizheng_lookup_uses_unique_index():
    # 等值查走 shizheng_questions.question 的 UNIQUE 自动索引（生产 0.9 ms），锁住不退化成全表扫
    conn = db.get_conn()
    plan = conn.execute("EXPLAIN QUERY PLAN SELECT * FROM shizheng_questions WHERE question=?", ("x",)).fetchall()
    conn.close()
    assert any("USING INDEX" in row[3] for row in plan), plan
