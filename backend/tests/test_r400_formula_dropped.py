"""R400 公式丢失解析判定 / PDF 页脚剥离 / 脚本 --garbled、--strip-footers 与按 reason 还原。样本均取自生产实读片段。"""
import importlib.util
import json
import os
import sqlite3

from app import quality

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r396_explanation_quarantine.py")
_spec = importlib.util.spec_from_file_location("r396_quarantine_r400", SCRIPT)
assert _spec and _spec.loader
rq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rq)

# 生产 265240 形态：公式被整段抠掉只剩骨架
_E_SKELETON = "第一步，本题考查几何问题。第二步，设正方形边长为，根据公式：；。可得：，解得。因此，选择C选项。"
# 生产 261638 形态：数量题只是多打一个句号，正文完整
_E_TYPO_QUANT = "第一步，本题考查行程问题，属于相遇追及类。。第二步，赋值狗的速度为1，人的速度为4，车的速度为16。追上需要510÷3＝170秒。因此，选择B选项。"
# 生产 332660 形态：文字题 OCR 错字 + 「，，」，可读
_E_TYPO_TEXT = "C 项正确, 汽车的前窗相当于一块平面镜，车内的人就会呈现在前窗上，，呈现一个等大的虚像。故正确答案为 D。"
_E_COLON_TEXT = "第一步，看提问方式，本题属于选是题。第二步，找关键信息。①：。②自动进行的反应。因此，选择 A 选项。"
_E_YANYU_BLANK = "第一空，「碰撞、、融合」为并列结构，填入词语需与「融合」构成递进。故正确答案为B。"
_E_PA_ENUM = "第一步，观察特征。图形均由、、组成，考查数量类。第二步，逐一分析。故正确答案为 C。"


def test_formula_dropped_by_module():
    assert quality.formula_dropped({"module": "shuliang", "explanation": _E_SKELETON}) == "colon"
    assert quality.formula_dropped({"module": "shuliang", "explanation": _E_TYPO_QUANT}) is None
    assert quality.formula_dropped({"module": "shuliang", "explanation": "……则所求项为。因此选 B。"}) == "quant"
    assert quality.formula_dropped({"module": "ziliao", "explanation": "增长率为，，解得 12%。"}) == "quant"
    assert quality.formula_dropped({"module": "changshi", "explanation": _E_TYPO_TEXT}) is None
    assert quality.formula_dropped({"module": "changshi", "explanation": _E_COLON_TEXT}) == "colon"
    assert quality.formula_dropped({"module": "yanyu", "explanation": _E_YANYU_BLANK}) is None
    assert quality.formula_dropped({"module": "panduan", "explanation": _E_PA_ENUM}) == "enum"
    assert quality.formula_dropped({"module": "panduan", "explanation": "找到定义关键词:。关键词为“提取佣金”。"}) is None  # 半角冒号不算
    assert quality.formula_dropped({"module": "shuliang", "explanation": None}) is None


def test_strip_page_footers_only_removes_footer_fragments():
    assert quality.strip_page_footers("如下图：第47页共64页第二步，分析。") == "如下图：第二步，分析。"
    assert quality.strip_page_footers("如图所示第 22 页共 36 页42 人参加") == "如图所示42 人参加"
    assert quality.strip_page_footers("这些图 -10- 2018年北京市公务员录用考试《行测》真题片是") == "这些图片是"
    assert quality.strip_page_footers("边长为 4 -8- 2017年国考真题卷（副省级）") == "边长为 4"
    assert quality.strip_page_footers("故正确答案为 B。 -8- 2018 年 421 联考《行测》真题（福建卷）") == "故正确答案为 B。"
    opts = json.dumps({"A": "12", "B": "9", "C": "7.5", "D": "6 - 10 - 2018年北京市公务员录用考试《行测》真题"}, ensure_ascii=False)
    assert json.loads(quality.strip_page_footers(opts))["D"] == "6"
    # 正文里的页码/负数/年份不受影响
    for keep in ("前十页页码为 84—93，共 10 页", "数列 -3，-2，2019年比2018年增长", "第 3 页", "2018年真题共 40 题", ""):
        assert quality.strip_page_footers(keep) == keep
    assert quality.strip_page_footers(None) == ""


def _db(tmp_path):
    p = tmp_path / "q.db"
    conn = sqlite3.connect(p)
    conn.executescript(
        "CREATE TABLE questions (id INTEGER PRIMARY KEY, module TEXT, question TEXT, options TEXT, explanation TEXT, "
        "hs_explanation TEXT, disabled INTEGER DEFAULT 0, is_real INTEGER DEFAULT 1, updated_at REAL);"
        "CREATE TABLE mistakes (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER, explanation TEXT, uid TEXT);"
        "CREATE TABLE explanation_quarantine (question_id INTEGER PRIMARY KEY, explanation TEXT NOT NULL, fit REAL, "
        "block TEXT, reason TEXT, created_at REAL);"
    )
    opts = json.dumps({"A": "1", "B": "2", "C": "3", "D": "4"}, ensure_ascii=False)
    opts_foot = json.dumps({"A": "628", "B": "961", "C": "986", "D": "1014 - 8 - 2020年新疆公务员考试《行测》真题"}, ensure_ascii=False)
    conn.executemany(
        "INSERT INTO questions VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (1, "shuliang", "正方形题", opts, _E_SKELETON, "hs 几何", 0, 1, 1.0),
            (2, "shuliang", "行程题", opts, _E_TYPO_QUANT, "hs 行程", 0, 1, 1.0),
            (3, "changshi", "常识题", opts, _E_TYPO_TEXT, "hs 常识", 0, 1, 1.0),
            (4, "panduan", "图推题", opts_foot, "如下图：第47页共64页第二步，分析。", "hs 图推", 0, 1, 1.0),
            (5, "yanyu", "言语题", opts, "文段开篇……对应B 项。 故正确答案为B。文段开篇提出问题……故正确答案为C。", "hs 言语", 0, 1, 1.0),
            (6, "shuliang", "非真题", opts, _E_SKELETON, None, 0, 0, 1.0),
        ],
    )
    conn.execute("INSERT INTO explanation_quarantine VALUES (9, '串题解析', 0.01, '9-9', ?, 1.0)", (rq.REASON,))
    conn.execute("INSERT INTO questions VALUES (9, 'shuliang', 'r396 题', ?, NULL, 'hs9', 0, 1, 1.0)", (opts,))
    conn.executemany("INSERT INTO mistakes (question_id, explanation, uid) VALUES (?,?,?)", [(1, _E_SKELETON, "u1"), (2, _E_TYPO_QUANT, "u1")])
    conn.commit()
    conn.row_factory = sqlite3.Row
    return conn, str(p)


def test_garbled_select_apply_and_reason_scoped_restore(tmp_path):
    conn, _ = _db(tmp_path)
    t = rq.select_garbled(conn, keep=set(), extra={5})
    assert [(x["id"], x["block"], x["skip"]) for x in t] == [(1, "garbled:colon", None), (5, "garbled:extra", None)]
    t = rq.select_garbled(conn, keep={1}, extra={5})
    assert [(x["id"], x["skip"]) for x in t] == [(1, "keep"), (5, None)]

    rq.apply(conn, rq.select_garbled(conn, set(), {5}), rq.REASON_GARBLED)
    q = {r["id"]: r["explanation"] for r in conn.execute("SELECT id, explanation FROM questions")}
    assert q[1] is None and q[5] is None and q[2] == _E_TYPO_QUANT and q[3] == _E_TYPO_TEXT and q[6] == _E_SKELETON
    qr = {r["question_id"]: r["reason"] for r in conn.execute("SELECT question_id, reason FROM explanation_quarantine")}
    assert qr == {1: rq.REASON_GARBLED, 5: rq.REASON_GARBLED, 9: rq.REASON}
    m = {r["question_id"]: r["explanation"] for r in conn.execute("SELECT question_id, explanation FROM mistakes")}
    assert m[1] == "hs 几何" and m[2] == _E_TYPO_QUANT

    rq.restore(conn, rq.REASON_GARBLED)  # 只还原 r400，r396 隔离行不动
    q = {r["id"]: r["explanation"] for r in conn.execute("SELECT id, explanation FROM questions")}
    assert q[1] == _E_SKELETON and q[5].startswith("文段开篇") and q[9] is None
    assert [r[0] for r in conn.execute("SELECT question_id FROM explanation_quarantine")] == [9]


def test_strip_footers_apply_and_restore(tmp_path):
    conn, _ = _db(tmp_path)
    rows = rq.select_footers(conn)
    assert [(x["id"], x["field"]) for x in rows] == [(4, "explanation"), (4, "options")]
    rq.apply_footers(conn, rows)
    r = conn.execute("SELECT explanation, options FROM questions WHERE id=4").fetchone()
    assert r["explanation"] == "如下图：第二步，分析。" and json.loads(r["options"])["D"] == "1014"
    assert rq.select_footers(conn) == []  # 幂等
    conn.execute("UPDATE questions SET explanation='人工重写' WHERE id=4")
    conn.commit()
    rq.restore_footers(conn)
    r = conn.execute("SELECT explanation, options FROM questions WHERE id=4").fetchone()
    assert r["explanation"] == "人工重写"  # 已被人工改过 → 不覆盖
    assert json.loads(r["options"])["D"] == "1014 - 8 - 2020年新疆公务员考试《行测》真题"
    assert conn.execute("SELECT COUNT(*) FROM text_footer_fix").fetchone()[0] == 0


def test_cli_garbled_and_footers_dry_run_write_nothing(tmp_path, capsys):
    import sys
    conn, path = _db(tmp_path)
    conn.close()
    argv = sys.argv
    try:
        sys.argv = ["x", "--db", path, "--garbled", "--extra", "5"]
        rq.main()
        sys.argv = ["x", "--db", path, "--strip-footers"]
        rq.main()
    finally:
        sys.argv = argv
    out = capsys.readouterr().out
    assert "targets: 2" in out and "footer fixes: 2 (1 options)" in out and out.count("dry-run only") == 2
    c = sqlite3.connect(path)
    assert c.execute("SELECT COUNT(*) FROM questions WHERE explanation IS NULL").fetchone()[0] == 1  # 只有原来的 9
    assert c.execute("SELECT name FROM sqlite_master WHERE name='text_footer_fix'").fetchone() is None
