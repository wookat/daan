"""邮箱注册/登录契约：email 字段进 users.phone 凭据列，payload 脱敏回显；旧 phone 路径不回归。"""

from tests.test_w11_merge_anon_coverage import _register as _register_phone  # noqa: F401  # 复用既有手机注册夹具


def test_email_register_and_login_roundtrip(client):
    email = "KaoYou@Test.dev"
    r = client.post("/api/auth/register", json={"email": email, "password": "pw123456", "nickname": "邮箱考友"})
    assert r.status_code == 200, r.text
    token, user = r.json()["token"], r.json()["user"]
    assert token
    # 邮箱凭据按手机号列存（小写归一），payload 脱敏回显、不脱敏不可用
    assert user["phone"] == "k***@test.dev"
    assert user["nickname"] == "邮箱考友"
    # 邮箱大小写不敏感：大写混合也能登录
    r2 = client.post("/api/auth/login", json={"email": "kaoyou@TEST.dev", "password": "pw123456"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["user"]["uid"] == user["uid"]


def test_email_register_rejects_malformed(client):
    for bad in ["not-an-email", "a@", "@x.com", "a b@c.com"]:
        r = client.post("/api/auth/register", json={"email": bad, "password": "pw123456"})
        assert r.status_code == 400, (bad, r.status_code)


def test_email_register_conflict_mentions_email(client):
    r = client.post("/api/auth/register", json={"email": "dup@test.dev", "password": "pw123456"})
    assert r.status_code == 200
    r2 = client.post("/api/auth/register", json={"email": "DUP@test.dev", "password": "pw123456"})
    assert r2.status_code == 409
    assert "邮箱" in r2.json()["detail"]


def test_email_login_wrong_password(client):
    client.post("/api/auth/register", json={"email": "wp@test.dev", "password": "pw123456"})
    r = client.post("/api/auth/login", json={"email": "wp@test.dev", "password": "wrongpw"})
    assert r.status_code == 401


def test_phone_register_still_works(client):
    token, uid = _register_phone(client, "13900000777")
    assert token and uid.startswith("u")


def test_default_nickname_uses_email_local_part(client):
    r = client.post("/api/auth/register", json={"email": "someone@test.dev", "password": "pw123456"})
    assert r.status_code == 200
    assert r.json()["user"]["nickname"] == "考友someone"
