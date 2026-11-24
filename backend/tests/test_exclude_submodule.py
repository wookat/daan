"""内测反馈 #56：数量关系随机练习与计划排除数字推理。"""
import json
import time

from app import db
from app.services import plan


PFX = "test-excl-sz-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    for t in ("user_profile", "answer_log", "mistakes"):
        conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM questions WHERE source = ?", (PFX,))
    conn.commit()
    conn.close()
    with db._pick_lock:
        db._pick_cache.clear()


def _seed_shuliang():
    conn = db.get_conn()
    conn.execute("DELETE FROM questions WHERE source = ?", (PFX,))
    rows = []
    for sub, count in (("数字推理", 8), ("计算问题", 8)):
        for i in range(count):
            rows.append((
                "shuliang",
                sub,
                "单选题",
                f"{PFX}{sub}-{i}",
                json.dumps({"A": "1", "B": "2", "C": "3", "D": "4"}, ensure_ascii=False),
                "A",
                "解析",
                1 if i % 2 == 0 else 0,
                0,
                PFX,
            ))
    conn.executemany(
        "INSERT INTO questions (module, submodule, question_type, question, options, answer, explanation, is_real, disabled, source)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        rows,
    )
    conn.commit()
    conn.close()
    with db._pick_lock:
        db._pick_cache.clear()


def test_exclude_sub_random_and_explicit_override(client):
    _cleanup()
    _seed_shuliang()
    try:
        r = client.get("/api/questions", params={"module": "shuliang", "limit": 20, "exclude_sub": "数字推理"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert items and all(q.get("submodule") != "数字推理" for q in items)

        # 显式选中数字推理子题型时不应被 exclude_sub 屏蔽
        r2 = client.get(
            "/api/questions",
            params={"module": "shuliang", "submodule": "数字推理", "limit": 5, "exclude_sub": "数字推理"},
        )
        assert r2.status_code == 200
        items2 = r2.json()["items"]
        assert len(items2) == 5 and all(q.get("submodule") == "数字推理" for q in items2)

        # 混合模块抽题同样遵循 exclude_sub
        r3 = client.get("/api/questions", params={"limit": 30, "exclude_sub": "数字推理"})
        assert r3.status_code == 200
        assert all(q.get("submodule") != "数字推理" for q in r3.json()["items"])
    finally:
        _cleanup()


def test_exclude_sub_adaptive_and_due_mix(client):
    _cleanup()
    _seed_shuliang()
    uid = PFX + "u1"
    try:
        conn = db.get_conn()
        sz_ids = [
            r["id"]
            for r in conn.execute("SELECT id FROM questions WHERE source=? AND submodule='数字推理' ORDER BY id", (PFX,))
        ]
        now = time.time()
        for qid in sz_ids[:5]:
            conn.execute(
                "INSERT INTO answer_log (uid, created_at, question_id, module, submodule, correct, secs) VALUES (?,?,?,?,?,?,?)",
                (uid, now - 3600, qid, "shuliang", "数字推理", 0, 10),
            )
        conn.execute(
            "INSERT INTO mistakes (uid, created_at, question_id, module, question_type, question_text, user_answer, correct_answer, mastered, next_review)"
            " VALUES (?,?,?,?,?,?,?,?,0,?)",
            (uid, now - 86400, sz_ids[0], "shuliang", "数字推理", "t", "B", "A", now - 60),
        )
        conn.commit()
        conn.close()

        # adaptive 模式下同样排除数字推理（含主查与 fallback）
        items_ad = db.random_questions(
            "shuliang", 20, uid=uid, adaptive=True, exclude_subs=("数字推理",)
        )
        assert items_ad and all(q.get("submodule") != "数字推理" for q in items_ad)

        # mix_due=1 时到期错题也不应把数字推理混入随机题组
        r = client.get(
            "/api/questions",
            params={"module": "shuliang", "limit": 10, "uid": uid, "mix_due": 1, "exclude_sub": "数字推理"},
        )
        assert r.status_code == 200
        assert all(q.get("submodule") != "数字推理" for q in r.json()["items"])

        # exclude_shuzituili=1 时今日计划与昨日推荐跳过数字推理
        client.post(
            "/api/profile",
            json={"uid": uid, "exam_type": "省考", "daily_minutes": 60, "exclude_shuzituili": 1},
        )
        bundle = client.get(f"/api/home_bundle?uid={uid}").json()
        assert bundle["profile"]["exclude_shuzituili"] == 1
        assert all(w.get("submodule") != "数字推理" for w in bundle["plan"]["weak"])
        assert all(t.get("submodule") != "数字推理" for t in bundle["plan_today"]["tasks"])
    finally:
        _cleanup()
