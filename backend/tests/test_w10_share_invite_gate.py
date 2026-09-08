"""W10-A：分享落地页「一键加入小队」CTA 服务端门控——分享者本人与已在队者不再收到 team_invite。"""
from .conftest import seed_questions


def _setup(client, tag: str):
    qid = seed_questions()[0]
    sharer = f"test-w10-sharer-{tag}"
    team = client.post("/api/team/create", json={"uid": sharer, "name": f"W10 小队 {tag}"}).json()["team"]
    sid = client.post("/api/share/create", json={"uid": sharer, "question_id": qid}).json()["sid"]
    return sharer, team, sid


def test_share_detail_invite_gate(client):
    sharer, team, sid = _setup(client, "d")
    invite = client.get(f"/api/share/{sid}?uid=test-w10-outsider-d").json()["team_invite"]
    assert invite and invite["code"] == team["invite_code"] and invite["n_members"] == 1
    assert client.get(f"/api/share/{sid}").json()["team_invite"]["code"] == team["invite_code"]
    assert client.get(f"/api/share/{sid}?uid={sharer}").json()["team_invite"] is None
    member = "test-w10-member-d"
    assert client.post("/api/team/join", json={"uid": member, "code": team["invite_code"]}).status_code == 200
    assert client.get(f"/api/share/{sid}?uid={member}").json()["team_invite"] is None
    assert client.get(f"/api/share/{sid}?uid=test-w10-outsider-d").json()["team_invite"]["n_members"] == 2


def test_share_answer_invite_gate(client):
    _sharer, team, sid = _setup(client, "a")
    member = "test-w10-member-a"
    client.post("/api/team/join", json={"uid": member, "code": team["invite_code"]})
    r = client.post(f"/api/share/{sid}/answer", json={"uid": member, "picked": "A"})
    assert r.status_code == 200 and r.json()["team_invite"] is None
    r = client.post(f"/api/share/{sid}/answer", json={"uid": "test-w10-outsider-a", "picked": "B"})
    assert r.status_code == 200 and r.json()["team_invite"]["code"] == team["invite_code"]
