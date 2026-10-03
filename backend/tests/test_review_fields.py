"""B1：review_fields.parse_explain —— explain 六段式 markdown → 结构化字段的纯函数契约。"""
from app import review_fields as rf

FULL = """【答案】B｜【方法】赋值法｜【一句话】给总量赋最小公倍数即可秒杀
## 题型识别
工程问题·合作完工
## 方法与步骤
### 第1步：识别题型
工程总量 = 效率 × 时间
### 第2步：赋值
赋总量为 60
## 答案
B
## 快解技巧
直接赋总量为时间的最小公倍数，口算得效率比。
## 错项击破
- A：把效率比算反了
- C：忘了加第二队
- D：审题不清，看成了单独完成
## 易错点
注意「甲先做 2 天」不是全程。
## 错因分析
方法没问题，主要是审题不清，把"合作"看成了"单独"。
"""


def test_full_parse():
    r = rf.parse_explain(FULL)
    assert r["method"] == "赋值法"
    assert r["mistake_analysis"].startswith("方法没问题")
    assert "最小公倍数" in r["fastest_solution"]
    assert len(r["trap_items"]) == 3
    assert r["trap_items"][0].startswith("A：")
    assert "先做 2 天" in r["review_tip"]
    assert r["error_reason_tag"] == "粗心大意"


def test_missing_sections_are_none_not_raise():
    r = rf.parse_explain("## 答案\nB\n")
    assert r["mistake_analysis"] is None
    assert r["fastest_solution"] is None
    assert r["trap_items"] == []
    assert r["review_tip"] is None
    assert r["error_reason_tag"] is None
    assert r["method"] is None


def test_empty_and_garbage_input():
    for md in (None, "", "不是 markdown 也没有标题", "## \n## \n"):
        r = rf.parse_explain(md)
        assert r["mistake_analysis"] is None and r["trap_items"] == []


def test_heading_with_parenthetical_note():
    md = "## 错项击破（为什么错选 D）\n- D：概念不清，记混了公式\n## 易错点\n别忘开方"
    r = rf.parse_explain(md)
    assert r["trap_items"] == ["D：概念不清，记混了公式"]
    assert r["review_tip"] == "别忘开方"


def test_reason_classification_conservative():
    assert rf.classify_error_reason("概念不清，公式记混了") == "概念不清"
    assert rf.classify_error_reason("没掌握赋值法这个套路") == "方法不会"
    assert rf.classify_error_reason("今天天气不错") is None
    assert rf.classify_error_reason(None) is None


def test_trap_json_roundtrip():
    items = ["A：陷阱", "B：凑数"]
    assert rf.trap_list(rf.trap_json(items)) == items
    assert rf.trap_json([]) is None
    assert rf.trap_list(None) == []
    assert rf.trap_list("非 JSON 文本") == ["非 JSON 文本"]
