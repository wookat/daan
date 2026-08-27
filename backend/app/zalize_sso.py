"""Zalize 统一账号（account.zalize.com）SSO 接入：JWT/JWKS 离线验签 + 可选绑定。

流程：浏览器带 .zalize.com 中心站 Cookie 访问本站（CF Pages 代理原样转发 Cookie），
后端用该 Cookie 向中心站换取短命 JWT（EdDSA/Ed25519），再用 JWKS 公钥本地验签，
按邮箱找到/创建本地账号并签发本站 Bearer token。原手机号+密码登录不受影响。
"""
import secrets
import time

import httpx
import jwt as pyjwt
from fastapi import APIRouter, Header, HTTPException

from . import db
from .auth import _issue_token, _user_payload, hash_password, require_user

router = APIRouter(prefix="/api/auth")

ACCOUNT_ORIGIN = "https://account.zalize.com"
JWT_ISSUER = ACCOUNT_ORIGIN
JWT_AUDIENCE = "zalize"
_JWKS_TTL = 3600

_jwks_cache: dict = {"client": None, "at": 0.0}


def _jwks_client():
    now = time.time()
    if _jwks_cache["client"] is None or now - _jwks_cache["at"] > _JWKS_TTL:
        _jwks_cache["client"] = pyjwt.PyJWKClient(f"{ACCOUNT_ORIGIN}/api/auth/jwks", cache_keys=True)
        _jwks_cache["at"] = now
    return _jwks_cache["client"]


def _init_binding_table(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS zalize_bindings (
            email TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at REAL NOT NULL
        )"""
    )


def _central_email(cookie: str | None) -> str:
    """中心站 Cookie -> 换 JWT -> JWKS 本地验签 -> email。失败抛 HTTPException。"""
    if not cookie or "better-auth.session_token" not in cookie:
        raise HTTPException(401, "未登录 Zalize 统一账号")
    try:
        r = httpx.get(f"{ACCOUNT_ORIGIN}/api/auth/token", headers={"cookie": cookie}, timeout=8)
    except Exception:
        raise HTTPException(502, "统一账号服务暂不可用，请稍后再试") from None
    if r.status_code != 200:
        raise HTTPException(401, "未登录 Zalize 统一账号")
    token = (r.json() or {}).get("token")
    if not token:
        raise HTTPException(401, "未登录 Zalize 统一账号")
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = pyjwt.decode(
            token, key.key, algorithms=["EdDSA"], audience=JWT_AUDIENCE, issuer=JWT_ISSUER
        )
    except Exception:
        raise HTTPException(401, "统一账号凭证校验失败") from None
    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(401, "统一账号凭证缺少邮箱")
    return email


@router.post("/sso")
def api_sso(cookie: str | None = Header(None)):
    """Zalize 统一账号登录：已绑定/曾 SSO 的邮箱命中原账号，否则创建新账号。"""
    email = _central_email(cookie)
    conn = db.get_conn()
    _init_binding_table(conn)
    row = None
    b = conn.execute("SELECT user_id FROM zalize_bindings WHERE email=?", (email,)).fetchone()
    if b:
        row = conn.execute("SELECT * FROM users WHERE id=?", (b["user_id"],)).fetchone()
    if not row:
        nickname = "考友" + email.split("@")[0][:8]
        cur = conn.execute(
            "INSERT INTO users (phone, password_hash, nickname, created_at) VALUES (?,?,?,?)",
            (f"za:{email}", hash_password(secrets.token_urlsafe(24)), nickname, time.time()),
        )
        conn.execute(
            "INSERT OR REPLACE INTO zalize_bindings (email, user_id, created_at) VALUES (?,?,?)",
            (email, cur.lastrowid, time.time()),
        )
        row = conn.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    token = _issue_token(conn, row["id"])
    conn.commit()
    conn.close()
    return {"token": token, "user": _user_payload(row)}


@router.post("/bind-zalize")
def api_bind_zalize(cookie: str | None = Header(None), authorization: str | None = Header(None)):
    """把 Zalize 统一账号绑定到当前已登录的手机号账号（可选绑定，幂等）。"""
    user = require_user(authorization)
    email = _central_email(cookie)
    conn = db.get_conn()
    _init_binding_table(conn)
    b = conn.execute("SELECT user_id FROM zalize_bindings WHERE email=?", (email,)).fetchone()
    if b and b["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(409, "该 Zalize 账号已绑定其他账号")
    conn.execute(
        "INSERT OR REPLACE INTO zalize_bindings (email, user_id, created_at) VALUES (?,?,?)",
        (email, user["id"], time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "email": email}
