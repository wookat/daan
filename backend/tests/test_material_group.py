import json

from app import db

from .conftest import seed_questions


def _seed_group(n=3, h="mh-test-group"):
    conn = db.get_conn()
    ids = []
    for i in range(n):
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer,"
            " explanation, is_real, disabled, material_hash) VALUES (?,?,?,?,?,?,1,0,?)",
            (
                "ziliao",
                "单选题",
                f"同材料组测试题 {i}：根据材料，下列说法正确的是？",
                json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
                "A",
                "测试解析：选 A。",
                h,
            ),
        )
        if cur.lastrowid:
            ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def test_material_group_section_rendered(client):
    ids = _seed_group()
    r = client.get(f"/tiku/q/{ids[0]}")
    assert r.status_code == 200
    assert f"同材料题组（共 {len(ids)} 题）" in r.text
    assert "<b>本题</b>" in r.text
    for other in ids[1:]:
        assert f'href="/tiku/q/{other}"' in r.text


def test_no_group_section_without_material_hash(client):
    seed_questions()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer,"
        " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,1,0)",
        (
            "ziliao",
            "单选题",
            "无材料组测试题：以下说法正确的是？",
            json.dumps({"A": "甲", "B": "乙"}, ensure_ascii=False),
            "A",
            "测试解析：选 A。",
        ),
    )
    qid = cur.lastrowid
    conn.commit()
    conn.close()
    r = client.get(f"/tiku/q/{qid}")
    assert r.status_code == 200
    assert "同材料题组" not in r.text
