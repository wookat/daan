"""R396 解析/题干贴合度与错位连续块检测（解析串题取证口径）。"""
import json

from app import quality

_OPTS = json.dumps({"A": "83", "B": "84", "C": "126", "D": "252"}, ensure_ascii=False)
_Q_SKI = "滑雪和滑冰是冬奥会的两大项赛事，其中高山滑雪、自由式滑雪、单板滑雪、跳台滑雪、越野滑雪和北欧两项是滑雪大项中的6个分项，短道速滑、速度滑冰和花样滑冰是滑冰大项中的3个分项。从9个分项中选6项，滑雪滑冰各至少1项，有多少种选法？"
_E_OWN = "从9个分项中选6项，需滑雪、滑冰各至少1项。总组合数C(9,6)=84，排除滑冰0项（即全选滑雪6项）的1种情况，得83种。"
_E_OTHER = "第一步，本题考查时政常识。2021年11月，中国共产党第十九届中央委员会第六次全体会议审议通过了《中共中央关于党的百年奋斗重大成就和历史经验的决议》。因此，选择B选项。"


def _row(qid: int, explanation: str, question: str = _Q_SKI) -> dict:
    return {"id": qid, "question": question, "options": _OPTS, "explanation": explanation}


def test_fit_high_for_own_explanation_low_for_foreign():
    own = quality.explanation_fit(_row(1, _E_OWN))
    foreign = quality.explanation_fit(_row(1, _E_OTHER))
    assert own is not None and own >= quality.EXP_FIT_LOW
    assert foreign is not None and foreign < quality.EXP_FIT_LOW


def test_fit_none_when_explanation_too_short_or_only_boilerplate():
    assert quality.explanation_fit(_row(1, "")) is None
    assert quality.explanation_fit(_row(1, "因此选择B选项。")) is None
    assert quality.explanation_fit(_row(1, "解析 故选A")) is None


def test_fit_strips_explanation_head_label():
    plain = quality.explanation_fit(_row(1, _E_OWN))
    labeled = quality.explanation_fit(_row(1, "【解析】" + _E_OWN))
    assert plain == labeled


def test_misaligned_blocks_finds_contiguous_low_fit_run_only():
    rows = [_row(i, _E_OWN) for i in range(100, 110)]  # 正常段
    rows += [_row(i, _E_OTHER) for i in range(111, 119)]  # 8 行串题段（gap 1）
    rows += [_row(i, _E_OWN) for i in range(130, 140)]  # gap>3 另起一块，正常
    blocks = quality.misaligned_blocks(rows)
    assert [(b["lo"], b["hi"]) for b in blocks] == [(111, 118)]
    assert blocks[0]["rows"] == 8 and blocks[0]["low"] == 8 and blocks[0]["ratio"] == 1.0


def test_misaligned_blocks_tolerates_repaired_rows_inside_block():
    rows = [_row(i, _E_OTHER) for i in range(200, 210)]
    rows[3] = _row(203, _E_OWN)  # 块内 1 行已人工修好
    blocks = quality.misaligned_blocks(rows)
    assert len(blocks) == 1 and blocks[0]["low"] == 9 and blocks[0]["ratio"] == 0.9


def test_misaligned_blocks_respects_min_rows_and_ratio():
    assert quality.misaligned_blocks([_row(i, _E_OTHER) for i in range(1, 4)]) == []  # <4 行
    mixed = [_row(i, _E_OWN if i % 2 else _E_OTHER) for i in range(1, 11)]  # 50% < 60%
    assert quality.misaligned_blocks(mixed) == []
