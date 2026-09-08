"""W11-C：hs 讲解内部自相矛盾（比对句字母 / 选项引文贴错字母）扣分 + SEO 题页原解析被 hs 包含时不复读。"""
import json

from app import db, quality

_OPTS = json.dumps({"A": "长烟市", "B": "浊酒省", "C": "千嶂市", "D": "落日省"}, ensure_ascii=False)
_FILL_OPTS = json.dumps({"A": "集中；贩卖", "B": "随意；抹去", "C": "粗略；重塑", "D": "逐一；存续"}, ensure_ascii=False)


def _row(**kw) -> dict:
    base = {
        "module": "ziliao",
        "question": "2024年，四地发电量情况如下，问同比增长量最大的地区是？",
        "options": _OPTS,
        "answer": "D",
        "explanation": "落日省增长量=5931.1×15%/(1+15%)≈773.6亿千瓦时，最大。",
        "hs_explanation": "增长量比较：逐个估算，落日省≈773.6 最大。确认答案为D。",
        "source": "original",
        "is_real": 0,
        "exam_year": None,
        "exam_region": None,
        "hs_down": 0,
        "hs_up": 0,
    }
    base.update(kw)
    return base


def test_letter_inconsistent_only_when_match_letter_differs_from_conclusion():
    f = quality.hs_letter_inconsistent
    assert f("……落日省最大。计算结果与选项A一致，确认答案为D。") == ("A", "D")
    assert f("……计算结果与选项D一致，确认答案为D。") is None
    assert f("……结果与选项 B 项一致，故选 B。") is None
    assert f("……计算结果与选项A一致。") is None  # 无结论句不判
    assert f("") is None and f(None) is None


def test_option_quote_mislabel_requires_exact_other_option_text():
    row = _row(options=_FILL_OPTS)
    hs = "用语境分析法。B项“随意；抹去”、C项“粗略；重塑”、D项“集中；贩卖”均与文段语境相悖。确认答案为D。"
    assert quality.option_quote_mislabel(row, hs) == [("D", "A")]
    # 引文与本项一致 / 转述缩写（不与任何其他项全等）不报
    assert quality.option_quote_mislabel(row, "A项“集中；贩卖”不当，D项“逐一；存续”当选。") == []
    assert quality.option_quote_mislabel(_row(), "D项“常温运输存储”是对原文的概括。") == []
    assert quality.option_quote_mislabel(_row(options="{}"), "D项“集中；贩卖”") == []


def test_hs_self_conflict_penalty():
    base = quality.score_question(_row())
    letter = quality.score_question(_row(hs_explanation="落日省最大。计算结果与选项A一致，确认答案为D。"))
    fill_hs = "B项“随意；抹去”、{}项“集中；贩卖”均相悖，逐一排除。确认答案为D。"
    quote_ok = quality.score_question(_row(options=_FILL_OPTS, hs_explanation=fill_hs.format("A")))
    quote = quality.score_question(_row(options=_FILL_OPTS, hs_explanation=fill_hs.format("D")))
    assert quality.hs_self_conflict(_row()) is None
    assert base - letter == quality.PENALTY_ANSWER_CONFLICT
    assert quote_ok - quote == quality.PENALTY_ANSWER_CONFLICT
    # 与 answer_letter_conflict 同一档，二者同时命中不叠加
    hs_bad = "落日省最大。计算结果与选项A一致，确认答案为D。"
    one = quality.score_question(_row(hs_explanation=hs_bad, explanation=_row()["explanation"] + "故选 D。"))
    both = quality.score_question(_row(hs_explanation=hs_bad, explanation=_row()["explanation"] + "故选 C。"))
    assert one == both


def _seed(tag: str, explanation: str, hs: str) -> int:
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer, explanation, hs_explanation,"
        " is_real, disabled) VALUES (?,?,?,?,?,?,?,0,0)",
        ("ziliao", "单选题", f"SEO 复读测试题 {tag}：下列说法错误的是？", _OPTS, "D", explanation, hs),
    )
    qid = cur.lastrowid
    conn.commit()
    conn.close()
    return qid


def test_tiku_question_skips_duplicated_raw_explanation(client):
    exp = "匠人讲师增速12.5%<体验增速20%，D错误。A项合计0.16；B项45/1.125=40；C项0.048/0.16=3/10。"
    covered = _seed("covered", exp, "综合分析题，先易后难。" + exp + "确认答案为D。")
    r = client.get(f"/tiku/q/{covered}")
    assert r.status_code == 200
    assert "花生十三方法解析" in r.text and "原解析" not in r.text

    distinct = _seed("distinct", exp, "综合分析题，先易后难，先验证计算量小的选项：D 增速比较即出。确认答案为D。")
    r = client.get(f"/tiku/q/{distinct}")
    assert "原解析" in r.text

    short = _seed("short", "D错误。", "综合分析题。D错误。确认答案为D。")  # <20 字的短解析不算被包含
    assert "原解析" in client.get(f"/tiku/q/{short}").text
