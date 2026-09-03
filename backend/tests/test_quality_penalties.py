"""R348 质量打分三类内容自证缺陷扣分 + sanitize_hs 剥离口径。"""
import json

from app import quality

_OPTS = json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False)
_HS = "第一步：由题干可知总量为 120。第二步：代入选项排除 B、C。因此故选 A。" * 3
_NOTE = "（通用解法，该题型花生方法不在库中）"


def _row(**kw) -> dict:
    base = {
        "module": "shuliang",
        "question": "某单位有职工 120 人，其中男职工占 60%，问女职工有多少人？",
        "options": _OPTS,
        "answer": "A",
        "explanation": "120×40%=48，故选 A。",
        "hs_explanation": _HS,
        "source": "national",
        "is_real": 1,
        "exam_year": 2023,
        "exam_region": "国考",
        "hs_down": 0,
        "hs_up": 0,
    }
    base.update(kw)
    return base


def test_hs_selfcheck_words_penalty():
    base = quality.score_question(_row())
    for w in quality.HS_SELFCHECK_WORDS:
        got = quality.score_question(_row(hs_explanation=_HS + w + "数据与选项矛盾。"))
        assert base - got == quality.PENALTY_HS_SELFCHECK, w


def test_hs_pipeline_note_penalty_incl_mid_sentence_variant():
    base = quality.score_question(_row())
    tail = quality.score_question(_row(hs_explanation=_HS + _NOTE))
    mid = quality.score_question(_row(hs_explanation="此题" + _NOTE + "按整体法：" + _HS))
    assert base - tail == quality.PENALTY_HS_PIPELINE_NOTE
    assert base - mid == quality.PENALTY_HS_PIPELINE_NOTE
    assert quality.score_question(_row(hs_explanation=_HS + "通用解法不在库中")) == base  # 无括注不扣


def test_pseudo_zh_penalty_only_yanyu_and_threshold():
    machine = "低空的翅膀载着通达的便，凸着灯形走样的丑，摇着晨光的岸，此处应填入？"
    assert quality.pseudo_zh_hits(machine) >= quality.PSEUDO_ZH_MIN_HITS
    base = quality.score_question(_row(module="yanyu"))
    hit = quality.score_question(_row(module="yanyu", question=machine))
    assert base - hit == quality.PENALTY_PSEUDO_ZH
    # 题干 + 选项合并计数
    opts = json.dumps({"A": "沿着河的边", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False)
    two_in_q = "低空的翅膀载着通达的便，凸着灯形走样的丑。填入横线处最恰当的一项是？"
    assert quality.pseudo_zh_hits(two_in_q) == 2
    assert quality.score_question(_row(module="yanyu", question=two_in_q)) == base
    assert base - quality.score_question(_row(module="yanyu", question=two_in_q, options=opts)) == quality.PENALTY_PSEUDO_ZH
    # 非 yanyu 不扣
    assert quality.score_question(_row(module="shuliang", question=machine)) == quality.score_question(_row())
    # 正常言语题干不命中
    normal = "依次填入画横线部分最恰当的一项是：他沿着熟悉的小路走着，想着明天的安排。"
    assert quality.pseudo_zh_hits(normal) < quality.PSEUDO_ZH_MIN_HITS


def test_sanitize_hs():
    assert quality.sanitize_hs(None) == ""
    assert quality.sanitize_hs("  ") == ""
    assert quality.sanitize_hs(_HS + "SKIP:数据与选项矛盾。") is None
    assert quality.sanitize_hs("官方解析有误，" + _HS) is None
    assert quality.sanitize_hs(_HS + _NOTE) == _HS
    assert quality.sanitize_hs(_HS + "\n\n" + _NOTE + "\n") == _HS
    assert quality.sanitize_hs("此题" + _NOTE + "按整体法：" + _HS) == "此题按整体法：" + _HS
    assert quality.sanitize_hs("a  （通用解法，花生方法不在库中）  b") == "a b"
    clean = quality.sanitize_hs(_HS + _NOTE)
    assert clean is not None and not quality.HS_PIPELINE_NOTE_RE.search(clean)
    assert quality.sanitize_hs(_HS) == _HS  # 无括注原样
