"""R348 质量打分三类内容自证缺陷扣分 + sanitize_hs 剥离口径；W2 汉字间空格 / hs 元句清洗。"""
import json

from app import quality

_OPTS = json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False)
_HS = "第一步：由题干可知总量为 120。第二步：代入选项排除 B、C。因此故选 A。" * 3
_NOTE = "（通用解法，该题型花生方法不在库中）"
_META = "该解法是花生十三体系中此类题型的标准套路，考场可直接套用。"


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


def test_normalize_cjk_spaces_strips_between_cjk_only():
    f = quality.normalize_cjk_spaces
    assert f(None) == ""
    assert f("諛眉 攬衢 ——拉的演 变") == "諛眉攬衢——拉的演变"
    assert f("月上中天，________在 夜色中的蛙们。") == "月上中天，________在夜色中的蛙们。"
    assert f("缥　缈轻盈，　这大概  只是") == "缥缈轻盈，这大概只是"  # 全角/连续空格，中文标点两侧
    # 数字、字母两侧空格保留
    keep = "1 天有 86400 秒，公元前 2000 年，从 3 月下旬到 10 月上旬，选 A 项，x 与 y 成正比"
    assert f(keep) == keep
    assert f("选 A 项 或 B 项") == "选 A 项或 B 项"
    assert f("太阳系中的（ ）上却 是事实，【　】处填") == "太阳系中的（ ）上却是事实，【　】处填"  # 填空占位保留
    assert f("没有空格的题干。") == "没有空格的题干。"


def test_normalize_options_only_when_changed():
    dirty = json.dumps({"A": "蛰伏 客似云来", "B": "隐匿 车水马龙", "C": "选 3 个"}, ensure_ascii=False)
    out = quality.normalize_options(dirty)
    assert out is not None
    assert json.loads(out) == {"A": "蛰伏客似云来", "B": "隐匿车水马龙", "C": "选 3 个"}
    assert quality.normalize_options(_OPTS) is None
    assert quality.normalize_options(None) is None
    assert quality.normalize_options("not json") is None


def test_hs_meta_re_matches_family_not_content():
    assert quality.HS_META_RE.fullmatch(_META)
    for v in (
        "本方法为花生十三方法中这类题的常规套路，可直接套用！",
        "此思路属于花生十三体系中的标准套路。",
        "该解法是花生十三体系内此类题型的通法，考场上可直接套用",
    ):
        assert quality.HS_META_RE.search(v), v
    for v in (
        "直接套用公式即可，不要误用邻边相乘。",
        "此类题在考场上应先识别题型、再套用对应公式快速求解。",
        "用花生十三的十字交叉法：设混合后浓度为 x。",
        "花生十三强调先看问题再找数据。",
    ):
        assert not quality.HS_META_RE.search(v), v


def test_sanitize_hs_strips_meta_keeps_body():
    assert quality.sanitize_hs(_HS + _META) == _HS
    assert quality.sanitize_hs(_HS + "\n\n" + _META + "\n") == _HS
    assert quality.sanitize_hs(_META + " " + _HS) == _HS
    mid = quality.sanitize_hs("第一步，识别题型。" + _META + " 第二步，代入。\n\n" + _META + "\n直接套用公式即可。")
    assert mid == "第一步，识别题型。第二步，代入。\n\n直接套用公式即可。"
    assert quality.sanitize_hs(_META) == ""
    assert quality.sanitize_hs(_META + "SKIP:数据矛盾") is None  # 自检失败优先
    assert quality.sanitize_hs("用花生十三的十字交叉法：" + _HS) == "用花生十三的十字交叉法：" + _HS
