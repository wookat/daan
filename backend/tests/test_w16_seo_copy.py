"""W16-C1：SEO 题页文案与相似题——description 句读截断、真题/练习分支、相似题走 quality.split_family 同族互斥。"""
import json
import re

from app import db, quality
from app.seo import pages

_OPTS = json.dumps({"A": "21", "B": "22", "C": "23", "D": "24"}, ensure_ascii=False)


def test_snippet_prefers_punctuation_break_and_collapses_whitespace():
    short = "甲乙丙三人\n共有 12 本书"
    assert pages._snippet(short, 60) == "甲乙丙三人 共有 12 本书"
    long = "某单位有甲、乙、丙三个部门，甲部门有 30 人，乙部门比甲部门多 20%，丙部门人数是甲乙两部门之和的一半，问全单位共有多少人？"
    out = pages._snippet(long, 40)
    assert out.endswith("…") and len(out) <= 41
    assert out[:-1] == "某单位有甲、乙、丙三个部门，甲部门有 30 人，乙部门比甲部门多 20%"
    # 前一半内没有句读时退回硬截，不能把 description 缩成两个字
    assert pages._snippet("一二三四五六七八九十一二三四五六七八九十", 10) == "一二三四五六七八九十…"


def test_question_description_branches():
    real = {"exam_year": 2023, "exam_region": "国考", "submodule": "数学运算", "is_real": 1, "question": "甲乙丙三人共有 12 本书。"}
    d = pages._question_description(real, "数量关系", "和差倍比")
    assert d.startswith("数量关系·数学运算（2023年国考真题）：甲乙丙三人共有 12 本书。")
    assert "考点“和差倍比”" in d and d.endswith("答案与解析在页内，点选项即可作答。")
    practice = {"exam_year": None, "exam_region": None, "submodule": None, "is_real": 0, "question": "题干"}
    assert pages._question_description(practice, "常识判断", None) == "常识判断练习题：题干 答案与解析在页内，点选项即可作答。"


def test_split_family_keeps_first_and_reports_dropped_in_order():
    fam = [{"id": i, "module": "shuliang", "source": "manual", "question": f"甲乙丙三人共有 {n} 本书", "options": _OPTS}
           for i, n in enumerate((12, 13, 14))]
    other = {"id": 9, "module": "shuliang", "source": "manual", "question": "某商品打八折后售价 80 元", "options": json.dumps({"A": "1", "B": "2"})}
    kept, dropped = quality.split_family(fam + [other])
    assert [q["id"] for q in kept] == [0, 9]
    assert [q["id"] for q in dropped] == [1, 2]
    no_opts = [{"id": i, "module": "changshi", "source": "manual", "question": "同题干无选项", "options": "{}"} for i in range(3)]
    assert quality.split_family(no_opts) == (no_opts, [])


def _insert(conn, mod: str, sub: str, tag3: str | None, question: str, options: str = _OPTS) -> int:
    cur = conn.execute(
        "INSERT INTO questions (module, submodule, tag3, question_type, question, options, answer, explanation, is_real, disabled)"
        " VALUES (?,?,?,?,?,?,?,?,0,0)",
        (mod, sub, tag3, "单选题", question, options, "A", "解析。"),
    )
    return cur.lastrowid


def test_similar_questions_exclude_self_family_and_dedupe_candidates(client):
    conn = db.get_conn()
    tag = "w16-sim-tag"
    me = _insert(conn, "shuliang", "w16-sub", tag, "甲乙丙三人共有 12 本书")
    clone_of_me = _insert(conn, "shuliang", "w16-sub", tag, "甲乙丙三人共有 13 本书")
    a1 = _insert(conn, "shuliang", "w16-sub", tag, "某商品打八折后售价 80 元", json.dumps({"A": "1", "B": "2"}))
    a2 = _insert(conn, "shuliang", "w16-sub", tag, "某商品打九折后售价 90 元", json.dumps({"A": "1", "B": "2"}))
    b = _insert(conn, "shuliang", "w16-sub", tag, "一项工程甲单独做 10 天完成", json.dumps({"A": "5", "B": "6"}))
    disabled = _insert(conn, "shuliang", "w16-sub", tag, "已下架的题不该出现", json.dumps({"A": "7", "B": "8"}))
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (disabled,))
    conn.commit()
    r = conn.execute("SELECT id, module, submodule, tag3, question, options, material_hash, source FROM questions WHERE id=?", (me,)).fetchone()
    sim = pages._similar_questions(conn, r, me, limit=2)
    ids = [s["id"] for s in sim]
    assert me not in ids and disabled not in ids
    # 本题的克隆与候选内部同族（a1/a2）都只留首见：候选 b、a2（id 倒序首见）先于回填项
    assert ids == [b, a2]
    sim_all = pages._similar_questions(conn, r, me, limit=8)
    ids_all = [s["id"] for s in sim_all]
    assert ids_all[:2] == [b, a2] and set(ids_all) == {b, a2, a1, clone_of_me}
    conn.close()

    html = client.get(f"/tiku/q/{me}").text
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    assert m and m.group(1).startswith("数量关系·w16-sub练习题：甲乙丙三人共有 12 本书 ")
    assert html.count('class="cta cta-w"') == 1
