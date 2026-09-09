"""W17-C1：plan.today_plan 专项练习副标四档快照（样本见 docs/iter/workflow/w17c-content-human.md S63–S74）。"""
from app import plan


def test_practice_sub_low_acc_names_metric_once():
    # 生产 S65/S66/S70/S71：title 已是「专项练习：xx 题」，副标不再「正确率偏低，最近正确率 14%」两现指标名
    assert plan._practice_sub("正确率偏低", 0.14) == "最近正确率只有 14%"
    assert plan._practice_sub("正确率偏低", 0.0) == "最近正确率只有 0%"


def test_practice_sub_other_reasons_keep_reason_prefix():
    assert plan._practice_sub("近期退步", 0.62) == "近期退步，最近正确率 62%"
    assert plan._practice_sub("久未练习", 0.8) == "久未练习，最近正确率 80%"
    assert plan._practice_sub("巩固提升", 0.905) == "巩固提升，最近正确率 90%"


def test_review_sub_unchanged_snapshot():
    # 生产 S63/S68：事实句，本轮判定不改，锁住防回归
    assert plan._review_sub(0, 82) == "到期的都复习完了，今天新错的 82 道想练随时练"
    assert plan._review_sub(0, 0) == "到期的都复习完了"
    assert plan._review_sub(6, 0) == "还有 6 道到期"
