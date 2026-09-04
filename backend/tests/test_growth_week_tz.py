"""W3-A：成长曲线周键按北京时间切周（与 checkin/heatmap 同口径），周一 00:00-08:00 CST 的作答不再归入上周。"""
from datetime import datetime, timedelta, timezone

from app import db

UID = "test-w3-growth-wk"
CST = timezone(timedelta(hours=8))


def _seed(ts: float, correct: int = 1):
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute(
        "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs) VALUES (?,?,?,?,?,?)",
        (UID, ts, 1, "yanyu", correct, 10),
    )
    conn.commit()
    conn.close()


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    conn.execute("DELETE FROM answer_log WHERE uid=?", (UID,))
    conn.commit()
    conn.close()


def test_monday_early_morning_cst_belongs_to_current_week(monkeypatch):
    """2026-08-31（周一）01:00 CST = 08-30（周日）17:00 UTC：UTC 口径落上周（2026-34），北京时间落本周（2026-35）。"""
    monday = datetime(2026, 8, 31, 1, 0, tzinfo=CST)
    ts = monday.timestamp()
    assert datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%W") == "2026-34"
    _cleanup()
    try:
        _seed(ts)
        monkeypatch.setattr(db.time, "time", lambda: ts + 3 * 86400)
        weeks = db.growth_stats(UID)["weeks"]
        assert [w["week"] for w in weeks] == ["2026-35"]
        assert weeks[0]["n"] == 1 and weeks[0]["modules"] == {"yanyu": {"n": 1, "c": 1}}
    finally:
        _cleanup()


def test_growth_endpoint_week_key_matches_cst(client):
    """最近一个周一 01:00 CST 的作答，/api/growth 周键与该周一北京时间 %Y-%W 一致，且与 UTC 键不同。"""
    now_cst = datetime.now(CST)
    monday = (now_cst - timedelta(days=now_cst.weekday())).replace(hour=1, minute=0, second=0, microsecond=0)
    if monday > now_cst:
        monday -= timedelta(days=7)
    ts = monday.timestamp()
    expected = monday.strftime("%Y-%W")
    assert datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%W") != expected
    _cleanup()
    try:
        _seed(ts, correct=0)
        r = client.get(f"/api/growth?uid={UID}")
        assert r.status_code == 200
        weeks = r.json()["weeks"]
        assert [w["week"] for w in weeks] == [expected]
        assert weeks[0] == {"week": expected, "n": 1, "c": 0, "modules": {"yanyu": {"n": 1, "c": 0}}}
    finally:
        _cleanup()
