import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
TEAM_PY = BACKEND / "app" / "team.py"
FRONTEND_SRC = REPO / "frontend-uni" / "src"


def _whitelist():
    src = TEAM_PY.read_text(encoding="utf-8")
    block = src.split("if event not in {", 1)[1].split("}", 1)[0]
    return set(re.findall(r'"([a-z_]+)"', block))


def _frontend_events():
    events = set()
    for p in FRONTEND_SRC.rglob("*.vue"):
        events |= set(re.findall(r"trackEvent\('([a-z_]+)'", p.read_text(encoding="utf-8")))
    for p in FRONTEND_SRC.rglob("*.js"):
        events |= set(re.findall(r"trackEvent\('([a-z_]+)'", p.read_text(encoding="utf-8")))
    return events


def test_frontend_track_events_all_whitelisted():
    missing = _frontend_events() - _whitelist()
    assert not missing, f"前端在发但 /api/track 白名单缺失（会静默 400 丢埋点）：{sorted(missing)}"


def test_r347_events_accepted(client):
    from app import db

    for ev in ("review_similar_auto", "review_similar_click", "review_reason_tag", "share_poster"):
        r = client.post("/api/track", json={"event": ev, "uid": f"utesttrack_{ev}"})
        assert r.status_code == 200
        conn = db.get_conn()
        row = conn.execute(
            "SELECT event FROM growth_events WHERE uid=?", (f"utesttrack_{ev}",)
        ).fetchone()
        conn.close()
        assert row and row[0] == ev
