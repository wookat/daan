"""R545：错题本题型二级聚合——生产实测：同为「排列组合与概率」组的错题按来源细题型「排列组合 / 概率问题」平级拆开、互不包含。

错题联查题库 submodule 经 taxonomy 别名归一为 type_group；/api/mistakes/redo?sub= 按题型组（组名 + aliases）重练。"""
import json

from app import db, taxonomy

PFX = "test-r545-tg-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    conn.execute("DELETE FROM mistakes WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM questions WHERE question LIKE 'R545 %'")
    conn.commit()
    conn.close()


def _question(module, qtype, submodule, stem):
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO questions (module, question_type, submodule, question, options, answer, explanation, is_real, disabled)"
        " VALUES (?,?,?,?,?,?,?,1,0)",
        (module, qtype, submodule, stem, json.dumps({"A": "1", "B": "2", "C": "3", "D": "4"}), "A", "解析"),
    )
    qid = conn.execute("SELECT id FROM questions WHERE question=?", (stem,)).fetchone()["id"]
    conn.commit()
    conn.close()
    return qid


def _mistake(client, uid, qid, module, qtype, stem):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": module, "question_type": qtype,
        "question_text": stem, "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_taxonomy_group_name_and_submodules():
    assert taxonomy.group_name("shuliang", "排列组合与概率") == "排列组合与概率"
    assert taxonomy.group_name("shuliang", "不定方程") == "计算问题"
    assert taxonomy.group_name("panduan", "逻辑推理") == "逻辑判断"
    assert taxonomy.group_name("shuliang", "自定义小类") == "自定义小类"
    assert taxonomy.group_name("shuliang", None) is None
    assert taxonomy.group_name("shuliang", "  ") is None
    assert "不定方程" in taxonomy.group_submodules("shuliang", "计算问题")
    assert "计算问题" in taxonomy.group_submodules("shuliang", "计算问题")
    assert taxonomy.group_submodules("shuliang", "未知组") == ["未知组"]
    assert taxonomy.group_submodules("shuliang", "") == []


def test_mistakes_carry_type_group(client):
    _cleanup()
    uid = PFX + "list"
    q1 = _question("shuliang", "排列组合", "排列组合与概率", "R545 节目编排题")
    q2 = _question("shuliang", "概率问题", "排列组合与概率", "R545 报刊分配题")
    q3 = _question("shuliang", "不定方程", "不定方程", "R545 不定方程题")
    _mistake(client, uid, q1, "shuliang", "排列组合", "R545 节目编排题")
    _mistake(client, uid, q2, "shuliang", "概率问题", "R545 报刊分配题")
    _mistake(client, uid, q3, "shuliang", "不定方程", "R545 不定方程题")
    r = client.post("/api/mistakes", json={
        "uid": uid, "module": "shuliang", "question_type": "手录题型",
        "question_text": "R545 手录题", "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    items = client.get(f"/api/mistakes?uid={uid}").json()["items"]
    by = {m["question_text"]: m for m in items}
    assert by["R545 节目编排题"]["type_group"] == "排列组合与概率"
    assert by["R545 报刊分配题"]["type_group"] == "排列组合与概率"
    assert by["R545 不定方程题"]["type_group"] == "计算问题"
    assert by["R545 不定方程题"]["question_type"] == "不定方程"
    assert by["R545 手录题"]["type_group"] is None
    _cleanup()


def test_redo_by_type_group_covers_fine_types(client):
    _cleanup()
    uid = PFX + "redo"
    q1 = _question("shuliang", "排列组合", "排列组合与概率", "R545 节目编排题")
    q2 = _question("shuliang", "概率问题", "排列组合与概率", "R545 报刊分配题")
    q3 = _question("shuliang", "不定方程", "不定方程", "R545 不定方程题")
    _mistake(client, uid, q1, "shuliang", "排列组合", "R545 节目编排题")
    _mistake(client, uid, q2, "shuliang", "概率问题", "R545 报刊分配题")
    _mistake(client, uid, q3, "shuliang", "不定方程", "R545 不定方程题")

    r = client.get(f"/api/mistakes/redo?uid={uid}&sub=排列组合与概率")
    assert r.status_code == 200
    assert sorted(x["id"] for x in r.json()["items"]) == sorted([q1, q2])

    r = client.get(f"/api/mistakes/redo?uid={uid}&module=shuliang&sub=计算问题")
    assert [x["id"] for x in r.json()["items"]] == [q3]

    r = client.get(f"/api/mistakes/redo?uid={uid}&sub=排列组合与概率&qtype=概率问题")
    assert [x["id"] for x in r.json()["items"]] == [q2]

    r = client.get(f"/api/mistakes/redo?uid={uid}&qtype=排列组合")
    assert [x["id"] for x in r.json()["items"]] == [q1]

    assert client.get(f"/api/mistakes/redo?uid={uid}&sub=不存在的组").json()["items"] == []
    assert client.get(f"/api/mistakes/redo?uid={uid}&sub=").status_code == 400
    assert client.get(f"/api/mistakes/redo?uid={uid}&sub=" + "x" * 41).status_code == 400
    _cleanup()
