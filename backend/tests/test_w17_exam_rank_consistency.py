"""W17-B1：/api/exam/rank 顶部「排名 R/N」与同卷榜单「（我）」行序号同出一份有序列表——
同分并列、本次非本人最高分时不再两套口径。"""
import time

from .test_exam_rank_board import _attempt, _cleanup, _seed_paper


def _rank(client, aid: int, uid: str) -> dict:
    d = client.get(f"/api/exam/rank/{aid}?uid={uid}").json()
    me_rows = [r for r in d["board"] if r["me"]]
    assert len(me_rows) == 1
    return {**d, "me_row": me_rows[0]}


def test_tied_score_top_rank_matches_board_row(client):
    pid = _seed_paper("W17 同分并列卷")
    now = time.time()
    _attempt(pid, "test-w17-rank-tie-a", 80.0, now - 40)
    _attempt(pid, "test-w17-rank-tie-b", 60.0, now - 30)
    my = _attempt(pid, "test-w17-rank-tie-me", 60.0, now - 20)
    _attempt(pid, "test-w17-rank-tie-c", 40.0, now - 10)
    try:
        d = _rank(client, my, "test-w17-rank-tie-me")
        assert d["me_row"]["rank"] == d["rank"] == 3  # 同分：先交卷者在前，顶部与榜单同一序号
        assert d["me_row"]["score"] == d["score"] == 60.0
        assert d["total"] == 4 and d["beaten_pct"] == 25
        assert [r["rank"] for r in d["board"]] == [1, 2, 3, 4]
    finally:
        _cleanup(pid)


def test_lower_retake_uses_this_attempt_in_top_and_board(client):
    pid = _seed_paper("W17 重考低分卷")
    now = time.time()
    _attempt(pid, "test-w17-rank-re-a", 90.0, now - 50)
    _attempt(pid, "test-w17-rank-re-b", 70.0, now - 40)
    _attempt(pid, "test-w17-rank-re-c", 30.0, now - 30)
    uid = "test-w17-rank-re-me"
    first = _attempt(pid, uid, 95.0, now - 20)
    second = _attempt(pid, uid, 50.0, now - 10)
    try:
        d = _rank(client, second, uid)
        # 本次 50 分：顶部与「我」行都按 50 分排第 3，不再顶部按 50 分/榜单按历史最高 95 分
        assert d["score"] == 50.0 and d["me_row"]["score"] == 50.0
        assert d["rank"] == d["me_row"]["rank"] == 3
        assert d["total"] == 4 and d["beaten_pct"] == 25
        assert [r["score"] for r in d["board"]] == [90.0, 70.0, 50.0, 30.0]
        # 查看高分那次：同一口径下应为第 1
        d1 = _rank(client, first, uid)
        assert d1["rank"] == d1["me_row"]["rank"] == 1 and d1["me_row"]["score"] == 95.0
    finally:
        _cleanup(pid)


def test_me_outside_top10_rank_consistent_with_position(client):
    pid = _seed_paper("W17 榜外排名卷")
    now = time.time()
    for i in range(11):
        _attempt(pid, f"test-w17-rank-out-{i:02d}", 90.0 - i, now - 100 + i)
    uid = "test-w17-rank-out-me"
    _attempt(pid, uid, 99.0, now - 5)
    my = _attempt(pid, uid, 1.0, now)
    try:
        d = client.get(f"/api/exam/rank/{my}?uid={uid}").json()
        assert len(d["board"]) == 10 and not any(r["me"] for r in d["board"])
        assert d["rank"] == 12 and d["total"] == 12 and d["beaten_pct"] == 0
    finally:
        _cleanup(pid)
