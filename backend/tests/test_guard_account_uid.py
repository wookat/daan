"""R348-B1 账号 uid 归属守卫：Content-Type 大小写/缺失/text/plain 与 multipart scan_sheet 路径均 403。"""
import json

import pytest

from app import auth as auth_mod
from app import db, omr, push_api

ACCOUNT_UID = "u999999"
ANON_UID = "test-w1-guard-anon"
DENIED = "无权访问该账号数据，请重新登录"


def _mistake_count(uid: str) -> int:
    conn = db.get_conn()
    db._ensure_mistake_uid(conn)
    try:
        return conn.execute("SELECT COUNT(*) FROM mistakes WHERE uid=?", (uid,)).fetchone()[0]
    finally:
        conn.close()


def _cleanup(uid: str):
    conn = db.get_conn()
    conn.execute("DELETE FROM mistakes WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def _mistake_body(uid: str, tag: str = "") -> bytes:
    return json.dumps(
        {"uid": uid, "question_text": f"守卫测试题{tag}", "user_answer": "A", "correct_answer": "B"}
    ).encode()


@pytest.mark.parametrize(
    "headers",
    [
        {"Content-Type": "application/JSON"},
        {"Content-Type": "Application/Json; charset=utf-8"},
        {"Content-Type": "text/plain"},
        {},
    ],
    ids=["upper-json", "mixed-json-charset", "text-plain", "no-content-type"],
)
def test_json_body_account_uid_without_token_403(client, headers):
    before = _mistake_count(ACCOUNT_UID)
    r = client.post("/api/mistakes", content=_mistake_body(ACCOUNT_UID), headers=headers)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == DENIED
    assert _mistake_count(ACCOUNT_UID) == before


def test_query_account_uid_without_token_403(client):
    r = client.post(f"/api/review/1?uid={ACCOUNT_UID}", json={"correct": True})
    assert r.status_code == 403
    assert r.json()["detail"] == DENIED


def test_anon_uid_json_paths_unaffected(client):
    try:
        for i, ct in enumerate(("application/json", "application/JSON", "Application/Json; charset=utf-8")):
            r = client.post("/api/mistakes", content=_mistake_body(ANON_UID, str(i)), headers={"Content-Type": ct})
            assert r.status_code == 200, r.text
            assert r.json()["id"]
        assert _mistake_count(ANON_UID) == 3
        # 缺 Content-Type 由端点自身决定（422），守卫不应拦成 403/500
        r = client.post("/api/mistakes", content=_mistake_body(ANON_UID, "x"), headers={})
        assert r.status_code != 403 and r.status_code < 500, r.text
    finally:
        _cleanup(ANON_UID)


def test_multipart_scan_sheet_account_uid_without_token_403(client, monkeypatch):
    def _boom(_raw):
        raise AssertionError("OMR 不应在守卫拒绝后执行")

    monkeypatch.setattr(omr, "recognize", _boom)
    before = _mistake_count(ACCOUNT_UID)
    r = client.post(
        "/api/scan_sheet",
        data={"uid": ACCOUNT_UID},
        files={"image": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == DENIED
    assert _mistake_count(ACCOUNT_UID) == before


def test_multipart_scan_sheet_anon_uid_passes_guard(client, monkeypatch):
    def _bad_image(_raw):
        raise ValueError("识别失败")

    monkeypatch.setattr(omr, "recognize", _bad_image)
    r = client.post(
        "/api/scan_sheet",
        data={"uid": ANON_UID},
        files={"image": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == "识别失败"


def _register(client, phone: str) -> tuple[str, str]:
    r = client.post("/api/auth/register", json={"phone": phone, "password": "pw123456", "code": "000000"})
    assert r.status_code == 200, r.text
    return r.json()["token"], f"u{r.json()['user']['id']}"


def test_account_uid_with_own_token_passes_all_paths(client, monkeypatch):
    token, uid = _register(client, "13900000348")
    auth = {"Authorization": f"Bearer {token}"}
    try:
        for i, ct in enumerate(("application/json", "application/JSON")):
            r = client.post("/api/mistakes", content=_mistake_body(uid, str(i)), headers={**auth, "Content-Type": ct})
            assert r.status_code == 200, r.text
        assert _mistake_count(uid) == 2

        monkeypatch.setattr(omr, "recognize", lambda _raw: (_ for _ in ()).throw(ValueError("识别失败")))
        r = client.post(
            "/api/scan_sheet",
            data={"uid": uid},
            files={"image": ("a.png", b"fake", "image/png")},
            headers=auth,
        )
        assert r.status_code == 422, r.text

        r = client.post("/api/mistakes", content=_mistake_body(uid), headers={"Authorization": "Bearer nope"})
        assert r.status_code == 403
    finally:
        _cleanup(uid)


def test_malformed_json_body_is_not_treated_as_account_uid(client):
    r = client.post("/api/mistakes", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code != 403
    assert r.status_code < 500


# ---- R519：JSON body 里 uid 为非字符串（数字/数组/对象）时守卫不得 500（生产 09-08 01:30Z 5 条 Traceback）----
@pytest.mark.parametrize("bad_uid", [1, ["u1"], {"u": 1}, True], ids=["int", "list", "dict", "bool"])
def test_non_string_uid_in_json_body_is_400_not_500(client, bad_uid):
    assert auth_mod.is_account_uid(bad_uid) is False
    body = json.dumps({"uid": bad_uid, "question_text": "x", "user_answer": "A", "correct_answer": "B"}).encode()
    for path in ("/api/mistakes", "/api/answer_log", "/api/team/create"):
        r = client.post(path, content=body, headers={"Content-Type": "application/json"})
        assert r.status_code == 400, (path, r.text)
        assert r.json()["detail"] == "uid 格式错误"


def test_null_uid_in_json_body_left_to_endpoint(client):
    assert auth_mod.is_account_uid(None) is False
    r = client.post("/api/mistakes", json={"uid": None, "question_text": "x"}, headers={"Content-Type": "application/json"})
    assert r.status_code != 403 and r.status_code < 500, r.text


# ---- W9-A：push/subscribe 是 R348-B1 后唯一绕过守卫的 JSON 端点（表单 Content-Type 不经中间件解析）----
_PUSH_ENDPOINT = "https://push.example.test/w9-guard"


def _push_sub(uid: str) -> dict:
    return {"uid": uid, "sub": {"endpoint": _PUSH_ENDPOINT, "keys": {"p256dh": "k", "auth": "a"}}}


def _push_rows(uid: str) -> int:
    conn = db.get_conn()
    push_api._ensure_table(conn)
    try:
        return conn.execute("SELECT COUNT(*) FROM push_subs WHERE uid=?", (uid,)).fetchone()[0]
    finally:
        conn.close()


def _push_cleanup():
    conn = db.get_conn()
    conn.execute("DELETE FROM push_subs WHERE endpoint=?", (_PUSH_ENDPOINT,))
    conn.commit()
    conn.close()


def _vapid_on(monkeypatch):
    monkeypatch.setattr(push_api, "VAPID_PRIVATE", "test-private")
    monkeypatch.setattr(push_api, "VAPID_PUBLIC", "test-public")


def test_push_subscribe_form_content_type_account_uid_rejected(client, monkeypatch):
    _vapid_on(monkeypatch)
    before = _push_rows(ACCOUNT_UID)
    r = client.post(
        "/api/push/subscribe",
        content=json.dumps(_push_sub(ACCOUNT_UID)).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code in (403, 422), r.text
    assert _push_rows(ACCOUNT_UID) == before
    r = client.post("/api/push/subscribe", json=_push_sub(ACCOUNT_UID))
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == DENIED
    assert _push_rows(ACCOUNT_UID) == before


def test_push_subscribe_handler_checks_ownership_itself(monkeypatch):
    """端点自身兜底（不依赖中间件解析出 uid）。"""
    from fastapi import HTTPException

    _vapid_on(monkeypatch)
    with pytest.raises(HTTPException) as ei:
        push_api.push_subscribe(_push_sub(ACCOUNT_UID), None)
    assert ei.value.status_code == 403 and ei.value.detail == DENIED


def test_push_subscribe_own_token_json_200_then_unsubscribe(client, monkeypatch):
    _vapid_on(monkeypatch)
    token, uid = _register(client, "13900000349")
    try:
        r = client.post("/api/push/subscribe", json=_push_sub(uid), headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        assert _push_rows(uid) == 1
        r = client.post("/api/push/unsubscribe", json={"endpoint": _PUSH_ENDPOINT})
        assert r.status_code == 200, r.text
        assert _push_rows(uid) == 0
        r = client.post(
            "/api/push/unsubscribe",
            content=json.dumps({"endpoint": _PUSH_ENDPOINT}).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert r.status_code == 422, r.text
    finally:
        _push_cleanup()


def test_push_subscribe_anon_uid_unaffected(client, monkeypatch):
    _vapid_on(monkeypatch)
    try:
        r = client.post("/api/push/subscribe", json=_push_sub(ANON_UID))
        assert r.status_code == 200, r.text
        assert _push_rows(ANON_UID) == 1
    finally:
        _push_cleanup()
