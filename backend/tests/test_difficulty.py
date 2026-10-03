"""B3：难度分档纯函数 + questions 序列化带 difficulty + mastery/map 两新键。"""
import time

from app import db, difficulty
from tests.conftest import seed_questions

PFX = "test-diff-"


def test_band_thresholds():
    assert difficulty.band(95, 1000) == 1
    assert difficulty.band(80, 1000) == 1
    assert difficulty.band(79, 1000) == 2
    assert difficulty.band(60, 100) == 2
    assert difficulty.band(41, 50) == 3
    assert difficulty.band(20, 50) == 4
    assert difficulty.band(3, 500) == 5
    # 样本不足 / 无数据 → 待校准
    assert difficulty.band(50, 5) is None
    assert difficulty.band(50, None) is None
    assert difficulty.band(None, 500) is None


def test_questions_by_ids_emits_difficulty():
    (q,) = seed_questions(1, ("ziliao",))[:1]
    conn = db.get_conn()
    conn.execute("UPDATE questions SET attempt_count=500, correct_ratio=10 WHERE id=?", (q,))
    conn.commit()
    conn.close()
    row = next(x for x in db.questions_by_ids([q]) if x["id"] == q)
    assert row["difficulty"] == 5 and row["difficulty_label"] == "高难"


def test_mastery_map_by_difficulty_and_by_secs(client):
    uid = PFX + "map"
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("DELETE FROM answer_log WHERE uid LIKE ?", (PFX + "%",))
    qids = seed_questions(4, ("ziliao",))
    # 两题标成「高难」（正确率10）、两题标成「基础」（正确率95）
    conn.execute("UPDATE questions SET attempt_count=400, correct_ratio=10 WHERE id IN (?,?)", (qids[0], qids[1]))
    conn.execute("UPDATE questions SET attempt_count=400, correct_ratio=95 WHERE id IN (?,?)", (qids[2], qids[3]))
    for i, q in enumerate(qids):
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, submodule, correct, secs) VALUES (?,?,?,?,?,?,?)",
            (uid, time.time() + i, q, "ziliao", "比重", 1 if i >= 2 else 0, 30 + i * 10),
        )
    conn.commit()
    conn.close()
    r = client.get(f"/api/mastery/map?uid={uid}").json()
    bands = {b["band"]: b for b in r["by_difficulty"]}
    assert bands[1]["n"] == 2 and bands[1]["acc"] == 1.0
    assert bands[5]["n"] == 2 and bands[5]["acc"] == 0.0
    assert r["by_secs"]["n_correct"] + r["by_secs"]["n_wrong"] == 4
    assert r["by_secs"]["correct_avg"] > 0 and r["by_secs"]["wrong_avg"] > 0
    conn = db.get_conn()
    conn.execute("DELETE FROM answer_log WHERE uid=?", (uid,))
    conn.commit()
    conn.close()
