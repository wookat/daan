"""R516：同考点强化 tag3 池不足时回退 submodule，二级题型名跨模块复用（生产「逻辑判断」散在 panduan/changshi/yanyu
等 15 个名字），带 module 才不会把别模块同名题补进「资料分析强化」；同时 (module,submodule) 走 idx_q_pick 前缀不再全表扫。"""
from app import db

PFX = "test-r516-"
SUB = "R516同名二级题型"


def _seed(module: str, n: int, tag3: str | None = None) -> list[int]:
    conn = db.get_conn()
    ids = []
    for i in range(n):
        cur = conn.execute(
            "INSERT INTO questions (module, submodule, tag3, question_type, question, options, answer,"
            " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,?,?,1,0)",
            (module, SUB, tag3, "单选题", f"{PFX}{module}-{i}", '{"A":"甲","B":"乙","C":"丙","D":"丁"}', "A", "略"),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def _cleanup():
    conn = db.get_conn()
    db._ensure_reinforce_log(conn)
    conn.execute("DELETE FROM questions WHERE question LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM reinforce_log WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def test_submodule_fallback_stays_in_module():
    _cleanup()
    try:
        own = _seed("ziliao", 2, tag3="ZL-R516-01")
        other = _seed("changshi", 6)  # 同名 submodule 别模块 6 道
        out = db.reinforce_questions(PFX + "u1", tag3="ZL-R516-01", module="ziliao", submodule=SUB, limit=5)
        ids = [q["id"] for q in out]
        assert set(own) <= set(ids)
        assert not set(other) & set(ids)
        assert {q["module"] for q in out} == {"ziliao"}  # 不足部分只由同模块（第三级回退）补
    finally:
        _cleanup()


def test_submodule_fallback_without_module_keeps_old_behaviour():
    _cleanup()
    try:
        a = _seed("ziliao", 1)
        b = _seed("changshi", 2)
        out = db.reinforce_questions(PFX + "u2", tag3=None, module=None, submodule=SUB, limit=5)
        assert {q["id"] for q in out} == set(a + b)
    finally:
        _cleanup()


def test_module_submodule_pick_uses_idx_q_pick_prefix():
    conn = db.get_conn()
    try:
        plan = " ".join(
            r["detail"] for r in conn.execute(
                "EXPLAIN QUERY PLAN SELECT id FROM questions INDEXED BY idx_q_pick"
                " WHERE module=? AND submodule=? AND disabled=0 AND id NOT IN (0) ORDER BY RANDOM() LIMIT 5",
                ("ziliao", SUB),
            )
        )
    finally:
        conn.close()
    assert "SEARCH" in plan and "idx_q_pick" in plan and "SCAN" not in plan
