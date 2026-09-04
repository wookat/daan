"""W3-A：answer_log 条目 t（客户端作答时刻，秒或毫秒）在窗口内时作 created_at；离线补传不再全部落到补传时刻。"""
import time
from datetime import datetime, timedelta, timezone

import pytest

from app import db

UID = "test-w3-alog-ts"
NOW = 1_800_000_000.0


@pytest.mark.parametrize(
    "raw, expected",
    [
        (NOW - 3600, NOW - 3600),  # 秒
        ((NOW - 3600) * 1000, NOW - 3600),  # 毫秒
        (int((NOW - 86400) * 1000) + 7, NOW - 86400 + 0.007),  # 整数毫秒
        (NOW - 31 * 86400, NOW),  # 超过 30 天回退
        (NOW + 600, NOW),  # 未来超 5 分钟回退
        (NOW + 60, NOW + 60),  # 5 分钟内的时钟偏差接受
        (None, NOW),
        ("1700000000", NOW),  # 字符串不采用
        (True, NOW),
        (float("nan"), NOW),
        (float("inf"), NOW),
        (0, NOW),
    ],
)
def test_client_ts(raw, expected):
    assert db._client_ts(raw, NOW) == pytest.approx(expected, abs=1e-3)


def _rows():
    conn = db.get_conn()
    rows = [r["created_at"] for r in conn.execute("SELECT created_at FROM answer_log WHERE uid=? ORDER BY id", (UID,))]
    conn.close()
    return rows


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (UID,))
    conn.commit()
    conn.close()


def test_answer_log_uses_client_ts_and_falls_back(client):
    _cleanup()
    try:
        now = time.time()
        yday_ms = int((now - 86400) * 1000)
        r = client.post(
            "/api/answer_log",
            json={
                "uid": UID,
                "items": [
                    {"qid": 1, "module": "yanyu", "correct": 1, "t": yday_ms},
                    {"qid": 1, "module": "yanyu", "correct": 0, "t": now - 7200},
                    {"qid": 1, "module": "yanyu", "correct": 0, "t": now - 40 * 86400},
                    {"qid": 1, "module": "yanyu", "correct": 0},
                ],
            },
        )
        assert r.status_code == 200 and r.json()["saved"] == 4
        rows = _rows()
        assert rows[0] == pytest.approx(yday_ms / 1000, abs=1e-3)
        assert rows[1] == pytest.approx(now - 7200, abs=1e-3)
        assert rows[2] >= now and rows[3] >= now
        assert rows[2] == rows[3]

        cst = timezone(timedelta(hours=8))
        yday = (datetime.now(cst) - timedelta(days=1)).strftime("%Y-%m-%d")
        s = client.get(f"/api/checkin/summary?uid={UID}")
        assert s.status_code == 200
        assert s.json()["days"][yday] == {"n": 1, "correct": 1}
    finally:
        _cleanup()
