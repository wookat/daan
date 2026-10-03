"""B4：省份卷型模板 + 薄弱加权组卷（/api/exam/templates、/api/exam/start template_id/weak_boost）。"""
import json
import time

from app import db, paper_templates
from tests.conftest import seed_questions

PFX = "test-tpl-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_exam_tables(conn)
    conn.execute("DELETE FROM answer_log WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM exam_attempts WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM questions WHERE question LIKE 'tpl-%'")
    conn.execute("DELETE FROM exam_papers WHERE title LIKE 'tpl-%'")
    conn.commit()
    conn.close()


def _seed_tagged(mod: str, n: int, tag3: str | None):
    """往 questions 插 n 道带/不带 tag3 的题，返回 id 列表。"""
    conn = db.get_conn()
    ids = []
    for i in range(n):
        stem = f"tpl-{mod}-{tag3 or 'gen'}-{i} 测试题干"
        conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer, tag3,"
            " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,?,1,0)",
            (mod, "单选题", stem, json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"},
             ensure_ascii=False), "A", tag3, "解析"),
        )
        ids.append(conn.execute("SELECT id FROM questions WHERE question=?", (stem,)).fetchone()["id"])
    conn.commit()
    conn.close()
    return ids


def _answer_log(uid: str, qid: int, correct: int, n: int):
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    for _ in range(n):
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs)"
            " VALUES (?,?,?,?,?,?)",
            (uid, time.time(), qid, "ziliao", correct, 30),
        )
    conn.commit()
    conn.close()


def test_templates_endpoint_lists_options(client):
    r = client.get("/api/exam/templates")
    assert r.status_code == 200
    items = {i["id"]: i for i in r.json()["items"]}
    assert set(items) == set(paper_templates.TEMPLATES)
    assert items["jiangsu-a"]["n"] == 135 and items["jiangsu-a"]["duration_min"] == 120


def test_start_with_template_builds_right_distribution(client):
    _cleanup()
    seed_questions(60)  # 300 题池，足够任意模板抽满
    uid = PFX + "js"
    r = client.post("/api/exam/start", json={"uid": uid, "template_id": "jiangsu-a"})
    assert r.status_code == 200
    d = r.json()
    assert d["paper"]["duration_min"] == 120
    assert len(d["items"]) == 135
    per = {}
    for it in d["items"]:
        per[it["module"]] = per.get(it["module"], 0) + 1
    assert per == paper_templates.TEMPLATES["jiangsu-a"]["counts"]
    _cleanup()


def test_start_template_unknown_400(client):
    r = client.post("/api/exam/start", json={"uid": PFX + "bad", "template_id": "mars"})
    assert r.status_code == 400


def test_weak_boost_raises_weak_tag3_share(client):
    _cleanup()
    uid = PFX + "weak"
    # 资料分析池：8 道弱考点题 + 52 道普通题；弱考点答 4 题错 3 → acc 0.25 < 0.6
    weak_ids = _seed_tagged("ziliao", 8, "WEAKZ")
    _seed_tagged("ziliao", 52, None)
    seed_questions(60, modules=("shuliang", "yanyu", "panduan", "changshi"))
    for i, qid in enumerate(weak_ids):
        _answer_log(uid, qid, 1 if i == 0 else 0, 4)  # n=4 答对 1 → acc 0.25
    assert "WEAKZ" in db.weak_tag3s(uid)

    r = client.post("/api/exam/start", json={
        "uid": uid, "template_id": "guokao", "weak_boost": True})
    assert r.status_code == 200
    ziliao_qids = [it["id"] for it in r.json()["items"] if it["module"] == "ziliao"]
    conn = db.get_conn()
    marks = ",".join("?" * len(ziliao_qids))
    n_weak = conn.execute(
        f"SELECT COUNT(*) c FROM questions WHERE id IN ({marks}) AND tag3='WEAKZ'",
        ziliao_qids).fetchone()["c"]
    conn.close()
    # 不加权时弱题期望占比 8/60≈13%；加权后 8 道弱题全被优先抽中 → 8/20=40%
    assert n_weak == 8
    assert n_weak / len(ziliao_qids) >= 0.3
    _cleanup()


def test_weak_boost_without_weak_history_falls_back(client):
    _cleanup()
    seed_questions(60)
    uid = PFX + "noans"
    r = client.post("/api/exam/start", json={
        "uid": uid, "template_id": "guangdong", "weak_boost": True})
    assert r.status_code == 200
    assert len(r.json()["items"]) == 100
    _cleanup()
