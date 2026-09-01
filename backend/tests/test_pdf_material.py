"""PDF 导出资料分析同材料切分/去重（R147）与聚组（R148）。"""
from app.pdf_export import _mat_key, _split_material, build_paper_pdf, group_by_material

MAT = "2023年全国规模以上工业企业实现利润总额76858亿元，比上年下降2.3%。" * 4
Q1 = MAT + "问题：2023年利润总额约为多少？"
Q2 = MAT + "问题:2022年利润总额约为多少？"


def test_split_material_fullwidth_sep():
    sp = _split_material(Q1)
    assert sp is not None
    mat, stem = sp
    assert mat == MAT
    assert stem.startswith("问题：")


def test_split_material_halfwidth_sep():
    sp = _split_material(Q2)
    assert sp is not None
    assert sp[1].startswith("问题:")


def test_split_material_keeps_ziliao_prefix():
    sp = _split_material("【资料】" + Q1)
    assert sp is not None
    assert sp[0].startswith("【资料】")


def test_split_material_short_material_returns_none():
    assert _split_material("短材料。问题：多少？") is None


def test_split_material_no_separator_returns_none():
    assert _split_material(MAT) is None
    assert _split_material("") is None


def test_mat_key_ignores_whitespace():
    assert _mat_key(MAT + " \n") == _mat_key(MAT)


def test_build_paper_pdf_same_material_group():
    qs = [
        {"id": 1, "module": "ziliao", "question": Q1, "options": {"A": "1", "B": "2"}, "answer": "A"},
        {"id": 2, "module": "ziliao", "question": Q2, "options": {"A": "1", "B": "2"}, "answer": "B"},
    ]
    data = build_paper_pdf("测试卷", qs, paper_code="ABC123", answer_sheet=False)
    assert data[:5] == b"%PDF-"
    assert len(data) > 1000


MAT2 = "2024年某省粮食总产量3506万吨，比上年增长3.1%，其中夏粮1200万吨。" * 4
Q3 = MAT2 + "问题：夏粮占比约为多少？"
Q4 = MAT2 + "问题：2023年总产量约为多少？"


def test_group_by_material_interleaved():
    a1 = {"id": 1, "module": "ziliao", "question": Q1}
    b1 = {"id": 2, "module": "ziliao", "question": Q3}
    a2 = {"id": 3, "module": "ziliao", "question": Q2}
    b2 = {"id": 4, "module": "ziliao", "question": Q4}
    out = group_by_material([a1, b1, a2, b2])
    assert [q["id"] for q in out] == [1, 3, 2, 4]


def test_group_by_material_prefers_material_hash():
    a1 = {"id": 1, "module": "ziliao", "question": "短题面A", "material_hash": "h1"}
    b1 = {"id": 2, "module": "ziliao", "question": "短题面B", "material_hash": "h2"}
    a2 = {"id": 3, "module": "ziliao", "question": "短题面C", "material_hash": "h1"}
    out = group_by_material([a1, b1, a2])
    assert [q["id"] for q in out] == [1, 3, 2]


def test_group_by_material_keeps_non_ziliao_order():
    qs = [
        {"id": 1, "module": "yanyu", "question": Q1},
        {"id": 2, "module": "ziliao", "question": Q1},
        {"id": 3, "module": "changshi", "question": Q1},
        {"id": 4, "module": "ziliao", "question": Q2},
    ]
    out = group_by_material(qs)
    assert [q["id"] for q in out] == [1, 2, 4, 3]


def test_group_by_material_unparseable_keeps_position():
    qs = [
        {"id": 1, "module": "ziliao", "question": "短材料。问题：多少？"},
        {"id": 2, "module": "ziliao", "question": Q1},
        {"id": 3, "module": "ziliao", "question": "无分隔材料"},
    ]
    out = group_by_material(qs)
    assert [q["id"] for q in out] == [1, 2, 3]
