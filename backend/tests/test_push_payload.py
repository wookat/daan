"""R324：每日推送个性化 payload 构造分支。"""

from app.push_api import build_push_payload

DAY = "2026-08-29"


def test_daily_only():
    p = build_push_payload(DAY, daily_done=False, due_n=0)
    assert p is not None
    assert p["title"] == "每日一练已更新"
    assert DAY in p["body"]
    assert p["url"] == "/app/#/pages/practice/practice?daily=1&src=push"


def test_daily_plus_due():
    p = build_push_payload(DAY, daily_done=False, due_n=3)
    assert p is not None
    assert p["title"] == "今日学习提醒"
    assert "3 道错题" in p["body"] and DAY in p["body"]
    assert p["url"] == "/app/#/pages/practice/practice?daily=1&src=push"


def test_review_only():
    p = build_push_payload(DAY, daily_done=True, due_n=7)
    assert p is not None
    assert p["title"] == "错题复习提醒"
    assert "7 道错题" in p["body"]
    assert p["url"] == "/app/#/pages/book/book?review=1&src=push"


def test_done_and_no_due_skips():
    assert build_push_payload(DAY, daily_done=True, due_n=0) is None


def test_invalid_due_treated_as_zero():
    assert build_push_payload(DAY, daily_done=True, due_n=-2) is None
    p = build_push_payload(DAY, daily_done=False, due_n=True)
    assert p is not None and p["title"] == "每日一练已更新"
