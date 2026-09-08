"""R544：题库 options 键序归一——历史题按导入 JSON 原样落库出现 A/D/B/C（生产 1046897 等 200 行），

多端均按键序枚举渲染，故落库统一字母升序：一次性迁移 + 导入/后台编辑路径同口径。"""
import json

from app import db


def test_options_json_sorts_letter_keys_only():
    assert json.loads(db.options_json({"A": "517", "D": "514", "B": "516", "C": "515"})) == {
        "A": "517",
        "B": "516",
        "C": "515",
        "D": "514",
    }
    assert list(json.loads(db.options_json({"A": "x", "D": "y", "B": "z", "C": "w"}))) == ["A", "B", "C", "D"]
    assert list(json.loads(db.options_json({"b": "2", "a": "1"}))) == ["b", "a"]
    assert list(json.loads(db.options_json({"AB": "2", "A": "1"}))) == ["AB", "A"]
    assert db.options_json(None) == "{}"
    assert db.options_json("bad") == "{}"


def test_import_questions_persists_sorted_options(client):
    stem = "R544 键序导入题 " + db.options_json.__name__
    r = db.import_questions(
        [
            {
                "module": "shuliang",
                "question_type": "单选题",
                "question": stem,
                "options": {"A": "517", "D": "514", "B": "516", "C": "515"},
                "answer": "A",
                "explanation": "略",
            }
        ],
        batch="r544test",
    )
    assert r["inserted"] == 1
    conn = db.get_conn()
    row = conn.execute("SELECT id, options FROM questions WHERE question=?", (stem,)).fetchone()
    assert list(json.loads(row["options"])) == ["A", "B", "C", "D"]
    conn.execute("DELETE FROM questions WHERE id=?", (row["id"],))
    conn.commit()
    conn.close()


def test_normalize_option_order_rewrites_legacy_rows_once():
    conn = db.get_conn()
    conn.execute("DELETE FROM seed_runs WHERE path='__option_order_v1'")
    raw = json.dumps({"A": "1", "D": "4", "B": "2", "C": "3"}, ensure_ascii=False)
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer) VALUES (?,?,?,?,?)",
        ("shuliang", "单选题", "R544 历史乱序题", raw, "A"),
    )
    qid = cur.lastrowid
    cur2 = conn.execute(
        "INSERT INTO shizheng_questions (date, question, options, answer, created_at) VALUES (?,?,?,?,?)",
        ("2026-09-08", "R544 时政乱序题", json.dumps({"C": "3", "A": "1"}), "A", 0),
    )
    sid = cur2.lastrowid
    conn.commit()

    fixed = db._normalize_option_order(conn)
    conn.commit()
    assert fixed >= 2
    q = conn.execute("SELECT options, answer FROM questions WHERE id=?", (qid,)).fetchone()
    assert list(json.loads(q["options"])) == ["A", "B", "C", "D"]
    assert json.loads(q["options"])["D"] == "4"
    assert q["answer"] == "A"
    s = conn.execute("SELECT options FROM shizheng_questions WHERE id=?", (sid,)).fetchone()
    assert list(json.loads(s["options"])) == ["A", "C"]

    assert db._normalize_option_order(conn) == 0
    conn.execute("DELETE FROM questions WHERE id=?", (qid,))
    conn.execute("DELETE FROM shizheng_questions WHERE id=?", (sid,))
    conn.commit()
    conn.close()
