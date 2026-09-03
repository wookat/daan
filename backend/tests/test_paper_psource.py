"""R357：卷库契约补 psource——按卷练习入口的 source 派生（fail-closed）。"""
import json

from app import db


def _seed_src_questions(source: str, n: int, is_real: int = 1) -> list[int]:
    conn = db.get_conn()
    ids = []
    for i in range(n):
        cur = conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer,"
            " explanation, source, is_real, disabled) VALUES (?,?,?,?,?,?,?,?,0)",
            (
                "yanyu",
                "单选题",
                f"psource 测试题干 {source}-{i}：以下说法正确的是？",
                json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
                "A",
                "测试解析：选 A。",
                source,
                is_real,
            ),
        )
        ids.append(cur.lastrowid)
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


def test_psource_dominant_source_when_enough(client):
    qids = _seed_src_questions("2024浙江psource测试卷", 20)
    pid = _seed_paper("psource 充足测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["psource"] == "2024浙江psource测试卷"


def test_psource_none_below_min(client):
    qids = _seed_src_questions("2024不足psource测试卷", 5)
    pid = _seed_paper("psource 不足测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["psource"] is None


def test_psource_ignores_non_real(client):
    qids = _seed_src_questions("2024非真题psource测试卷", 20, is_real=0)
    pid = _seed_paper("psource 非真题测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["psource"] is None


def test_dominant_paper_source_pure():
    src = {i: "A卷" for i in range(1, 25)}
    src.update({i: "B卷" for i in range(25, 30)})
    assert db._dominant_paper_source(list(range(1, 30)), src) == "A卷"
    assert db._dominant_paper_source(list(range(25, 30)), src) is None
    assert db._dominant_paper_source([99, 100], {}) is None
    assert db._dominant_paper_source([], {}) is None
