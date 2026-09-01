"""PK 随机匹配「无等待挑战 → 新建」分支与模考管理端门禁回归。"""
from .conftest import seed_questions


def test_pk_random_match_creates_when_no_waiting(client):
    seed_questions(per_module=12, modules=("yanyu",))
    r = client.post("/api/pk/random_match", json={"uid": "utestrnd1", "module": "yanyu"})
    assert r.status_code == 200
    body = r.json()
    assert body["matched"] is False
    assert body["code"] and len(body["questions"]) == 10


def test_mock_admin_endpoint_guarded_not_500(client):
    # 未配置/错误管理令牌应走 check_admin 门禁（401/503），而非 ImportError 500
    r = client.post("/api/admin/mock/events", json={}, headers={"X-Admin-Token": "wrong"})
    assert r.status_code in (401, 503)
