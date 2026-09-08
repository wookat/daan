"""W14-C1：题库分发互斥——quality.family_key 三分支 + qbank_api 过采去重回填（零 schema、不下架）。"""
import json

from app import db, qbank_api, quality

PFX = "W14FAM"
_OPTS = json.dumps({"A": "21", "B": "22", "C": "23", "D": "24"}, ensure_ascii=False)
_SUB = "w14-family-sub"


def _row(**kw) -> dict:
    base = {"module": "shuliang", "question": "甲乙丙三人共有 12 本书", "options": _OPTS, "source": "manual"}
    base.update(kw)
    return base


def test_family_key_material_hash_branch():
    assert quality.family_key(_row(module="ziliao", material_hash="abc123")) == "mh:abc123"
    # 非 ziliao 不走 material_hash；占位 '-' 与空值都落到后续分支
    assert quality.family_key(_row(module="shuliang", material_hash="abc123")).startswith("ck:")
    assert quality.family_key(_row(module="ziliao", material_hash="-", options="{}")) is None


def test_family_key_synthetic_family_branch():
    stem = "2024 年某省 GDP 同比增长 28%（2023 年为 1000 亿元）。问题：下列正确的是？"
    row = _row(module="ziliao", question=stem, source="original", material_hash=None)
    key = quality.family_key(row)
    assert key is not None and key.startswith("fam:")
    assert key == "fam:" + quality.synthetic_family_key(row)


def test_family_key_clone_branch_normalizes_numbers():
    a = quality.family_key(_row(question="甲乙丙三人共有 12 本书，甲比乙多 3 本"))
    b = quality.family_key(_row(question="甲乙丙三人共有 20 本书，甲比乙多 5 本"))
    assert a is not None and a.startswith("ck:")
    assert a == b


def test_family_key_none_without_options():
    assert quality.family_key(_row(options="{}")) is None
    assert quality.family_key(_row(options=None)) is None
    assert quality.family_key(_row(options={"A": "", "B": " "})) is None


def test_dedupe_family_keeps_first_and_backfills():
    fam = [_row(question=f"甲乙丙三人共有 {n} 本书", id=i) for i, n in enumerate((12, 13, 14, 15, 16))]
    out = qbank_api._dedupe_family(fam, 3)
    assert [q["id"] for q in out] == [0, 1, 2]  # 首见题放行，其余同族按原序回填到 3
    mixed = fam[:2] + [_row(id=9, question="某商品打八折后售价 80 元", options=json.dumps({"A": "1", "B": "2"}))]
    out = qbank_api._dedupe_family(mixed, 2)
    assert [q["id"] for q in out] == [0, 9]  # 非同族题优先于回填的克隆题


def test_dedupe_family_near_clone_and_no_options():
    a = _row(id=1, question="甲、乙、丙三人各借了一本书，甲说：是乙借的；乙说：不是我借的，共 3 本")
    b = _row(id=2, question="甲、乙、丙三人各借了一支笔，甲说：是乙借的；乙说：不是我借的，共 3 支")
    assert quality.family_key(a) != quality.family_key(b)  # 精确键不同
    assert [q["id"] for q in qbank_api._dedupe_family([a, b], 5)] == [1, 2]
    assert [q["id"] for q in qbank_api._dedupe_family([a, b, _row(id=3, question="无关题 1")], 2)] == [1, 3]
    no_opts = [_row(id=i, question="同题干无选项", options="{}") for i in range(4)]
    assert [q["id"] for q in qbank_api._dedupe_family(no_opts, 4)] == [0, 1, 2, 3]


def _seed(n_family: int, n_other: int, hs_family: bool, hs_other: bool, tag: str = "") -> list[int]:
    conn = db.get_conn()
    ids = []
    for i in range(n_family):
        cur = conn.execute(
            "INSERT INTO questions (module, submodule, question_type, question, options, answer, explanation,"
            " hs_explanation, has_hs, is_real, disabled) VALUES (?,?,?,?,?,?,?,?,?,1,0)",
            ("shuliang", _SUB, "单选题", f"{PFX} 甲乙丙三人共有 {10 + i} 本书，甲比乙多 {i + 1} 本，乙有几本？",
             _OPTS, "A", "略", "花生讲解" if hs_family else None, 1 if hs_family else 0),
        )
        ids.append(cur.lastrowid)
    for i in range(n_other):
        cur = conn.execute(
            "INSERT INTO questions (module, submodule, question_type, question, options, answer, explanation,"
            " hs_explanation, has_hs, is_real, disabled) VALUES (?,?,?,?,?,?,?,?,?,1,0)",
            ("shuliang", _SUB, "单选题", f"{PFX}{tag} 独立题 {i}：{'一二三四五六七八九十'[i % 10] * (i + 3)}问多少？",
             json.dumps({"A": f"{i}", "B": f"{i + 1}", "C": f"{i + 2}", "D": f"{i + 3}"}), "A", "略",
             "花生讲解" if hs_other else None, 1 if hs_other else 0),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    db._pick_invalidate("shuliang", _SUB, None, None, None)
    return ids


def _cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM questions WHERE submodule=?", (_SUB,))
    conn.commit()
    conn.close()
    db._pick_invalidate("shuliang", _SUB, None, None, None)


def test_api_questions_group_has_no_family_dup(client):
    _cleanup()
    _seed(5, 6, hs_family=True, hs_other=True)
    try:
        for _ in range(10):
            r = client.get("/api/questions", params={"module": "shuliang", "submodule": _SUB, "limit": 3})
            assert r.status_code == 200
            items = r.json()["items"]
            assert len(items) == 3
            keys = [quality.family_key(q) for q in items]
            assert len(set(keys)) == 3, keys
            assert "counts" in r.json()
    finally:
        _cleanup()


def test_api_questions_backfills_when_only_family_left(client):
    _cleanup()
    _seed(5, 0, hs_family=True, hs_other=True)
    try:
        r = client.get("/api/questions", params={"module": "shuliang", "submodule": _SUB, "limit": 3})
        items = r.json()["items"]
        assert len(items) == 3  # 只剩同族题时按原序回填，题量不缩水
        assert len({q["id"] for q in items}) == 3
    finally:
        _cleanup()


def test_api_questions_keeps_has_hs_priority(client):
    _cleanup()
    try:
        _seed(4, 4, hs_family=True, hs_other=True)
        _seed(0, 8, hs_family=False, hs_other=False, tag="无讲解")
        for _ in range(8):
            items = client.get(
                "/api/questions", params={"module": "shuliang", "submodule": _SUB, "limit": 5}
            ).json()["items"]
            assert len(items) == 5
            assert all(q["has_hs"] for q in items), [(q["id"], q["has_hs"]) for q in items]
            assert len({quality.family_key(q) for q in items}) == 5
    finally:
        _cleanup()


def test_reinforce_and_grouped_paths_untouched(client, monkeypatch):
    fam = [_row(id=i, question=f"甲乙丙三人共有 {n} 本书") for i, n in enumerate((12, 13, 14))]
    calls = []
    monkeypatch.setattr(db, "reinforce_questions", lambda *a, **k: (calls.append("reinforce"), fam)[1])
    monkeypatch.setattr(db, "grouped_ziliao_questions", lambda *a, **k: (calls.append("grouped"), fam)[1])
    monkeypatch.setattr(db, "random_questions", lambda *a, **k: (calls.append("random"), fam)[1])
    r = client.get("/api/questions", params={"mode": "reinforce", "uid": "test-w14-u1", "module": "shuliang", "limit": 3})
    assert [q["id"] for q in r.json()["items"]] == [0, 1, 2]
    r = client.get("/api/questions", params={"module": "ziliao", "grouped": 1, "limit": 3})
    assert [q["id"] for q in r.json()["items"]] == [0, 1, 2]
    assert calls == ["reinforce", "grouped"]
