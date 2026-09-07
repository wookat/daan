"""R500：卷库契约补 mods——卷内活跃题按行测五模块计数（回忆版卷缺资料分析等如实外显）。"""
import json

from app import db
from tests.test_paper_psource import _seed_paper


def _seed_mod_questions(tag: str, mods: list[str], disabled_last: bool = False) -> list[int]:
    conn = db.get_conn()
    ids = []
    for i, m in enumerate(mods):
        cur = conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer,"
            " explanation, source, is_real, disabled) VALUES (?,?,?,?,?,?,?,?,?)",
            (
                m,
                "单选题",
                f"mods 测试题干 {tag}-{i}：以下说法正确的是？",
                json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
                "A",
                "测试解析：选 A。",
                "2025年mods测试卷",
                1,
                1 if (disabled_last and i == len(mods) - 1) else 0,
            ),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def test_mods_counts_active_questions_by_module(client):
    qids = _seed_mod_questions("full", ["changshi"] * 3 + ["yanyu"] * 2 + ["panduan"] * 2 + ["ziliao"])
    pid = _seed_paper("mods 齐全测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["mods"] == {"changshi": 3, "yanyu": 2, "panduan": 2, "ziliao": 1}
    assert list(p["mods"]) == ["changshi", "yanyu", "panduan", "ziliao"]  # 标准模块顺序、0 模块不出现


def test_mods_skips_disabled_and_unknown_modules(client):
    qids = _seed_mod_questions("miss", ["yanyu"] * 5 + ["mianshi"] + ["ziliao"], disabled_last=True)
    pid = _seed_paper("mods 缺项测试卷", qids)
    d = client.get("/api/exam/papers?kind=zhenti").json()
    p = {x["id"]: x for x in d["items"]}[pid]
    assert p["n"] == 6  # 下线的资料题不计
    assert p["mods"] == {"yanyu": 5}  # 非行测模块 / 下线题不计


def test_paper_module_counts_pure():
    mod_by_qid = {1: "ziliao", 2: "changshi", 3: "changshi", 9: "yanyu"}
    assert db._paper_module_counts([3, 1, 2, 4], mod_by_qid) == {"changshi": 2, "ziliao": 1}
    assert db._paper_module_counts([], mod_by_qid) == {}
