"""账号体系 v1：手机号+密码注册/登录，Bearer token 鉴权，匿名数据归并。

短信验证码本期为预留桩（接口带 code 字段但不校验），见 SmsProvider。
"""
import hashlib
import hmac
import re
import secrets
import time

import httpx
from fastapi import APIRouter, Header, HTTPException, Request

from . import db

router = APIRouter(prefix="/api/auth")

TOKEN_TTL = 90 * 86400
PBKDF2_ITERS = 200_000

_PHONE_RE = re.compile(r"^1\d{10}$")


class SmsProvider:
    """短信验证码 provider 抽象（预留桩）。

    TODO: 接入真实短信服务（阿里云/腾讯云 SMS），实现 send(phone) 与 verify(phone, code)。
    本期 verify 恒通过，注册接口的 code 字段仅占位。
    """

    def send(self, phone: str) -> None:  # pragma: no cover - 预留
        raise NotImplementedError

    def verify(self, phone: str, code: str | None) -> bool:
        return True


sms_provider = SmsProvider()


# ---------- 密码哈希（pbkdf2，无额外依赖） ----------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERS)
    return f"pbkdf2${PBKDF2_ITERS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, expect = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(dk.hex(), expect)
    except (ValueError, AttributeError):
        return False


# ---------- 简单内存限速 ----------

def client_ip(request: Request) -> str:
    """真实客户端 IP：边缘代理透传的 X-Kg-Ip 优先（origin 域拒绝直连，头可信），回退 socket 对端。"""
    return request.headers.get("x-kg-ip") or (request.client.host if request.client else "anon")


_RATE: dict[str, list[float]] = {}


def rate_limit(key: str, limit: int = 10, window: int = 300):
    now = time.time()
    hits = [t for t in _RATE.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "操作过于频繁，请稍后再试")
    hits.append(now)
    _RATE[key] = hits


# ---------- 表结构 ----------

def init_auth_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nickname TEXT,
            created_at REAL NOT NULL,
            last_login REAL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS auth_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tok_user ON auth_tokens(user_id)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS merged_anon (
            user_id INTEGER NOT NULL,
            anon_uid TEXT NOT NULL,
            merged_at REAL NOT NULL,
            PRIMARY KEY (user_id, anon_uid)
        )"""
    )
    conn.commit()
    conn.close()


def user_uid(user_id: int) -> str:
    """登录用户的稳定 uid，与现有按 uid 隔离的数据兼容。"""
    return f"u{user_id}"


def _mask_phone(phone: str) -> str:
    return phone[:3] + "****" + phone[-4:] if len(phone) == 11 else phone


def _user_payload(row) -> dict:
    phone = str(row["phone"])
    is_wx = phone.startswith("wx:")
    is_za = phone.startswith("za:")  # Zalize 统一账号占位，不回显邮箱
    nick = str(row["nickname"] or "").strip()[:20]
    if nick.lower() in ("null", "undefined"):
        nick = ""
    default_nick = "微信考友" if is_wx else "Zalize 考友" if is_za else "考友" + phone[-4:]
    return {
        "id": row["id"],
        "uid": user_uid(row["id"]),
        "phone": None if is_wx or is_za else _mask_phone(phone),
        "nickname": nick or default_nick,
        "created_at": row["created_at"],
    }


def _issue_token(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    conn.execute(
        "INSERT INTO auth_tokens (token, user_id, created_at, expires_at) VALUES (?,?,?,?)",
        (token, user_id, now, now + TOKEN_TTL),
    )
    conn.execute("UPDATE users SET last_login=? WHERE id=?", (now, user_id))
    return token


_REVOKED_CACHE: dict[str, tuple[float, float]] = {}
_REVOKED_CACHE_TTL = 60.0


def _central_revoked_before(email: str) -> float:
    """中心「退出全部设备」时间戳（秒）；进程内缓存 60s，中心不可达时 fail-open。"""
    now = time.time()
    hit = _REVOKED_CACHE.get(email)
    if hit and now - hit[1] < _REVOKED_CACHE_TTL:
        return hit[0]
    try:
        r = httpx.get(
            "https://account.zalize.com/api/revoked-before",
            params={"email": email},
            timeout=5,
        )
        value = float((r.json() or {}).get("revokedBefore") or 0) / 1000.0 if r.status_code == 200 else 0.0
    except Exception:
        value = 0.0
    _REVOKED_CACHE[email] = (value, now)
    return value


def get_user_by_token(authorization: str | None):
    """Bearer token -> user 行；无效返回 None。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    if not token:
        return None
    conn = db.get_conn()
    row = conn.execute(
        """SELECT u.*, t.created_at AS token_created_at FROM auth_tokens t JOIN users u ON u.id=t.user_id
           WHERE t.token=? AND t.expires_at>?""",
        (token, time.time()),
    ).fetchone()
    if row:
        binding = conn.execute(
            "SELECT email FROM zalize_bindings WHERE user_id=?", (row["id"],)
        ).fetchone() if _has_bindings_table(conn) else None
        if binding and row["token_created_at"] < _central_revoked_before(binding["email"]):
            conn.execute("DELETE FROM auth_tokens WHERE token=?", (token,))
            conn.commit()
            conn.close()
            return None
    conn.close()
    return row


def _has_bindings_table(conn) -> bool:
    return bool(
        conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='zalize_bindings'"
        ).fetchone()
    )


_ACCOUNT_UID_RE = re.compile(r"^u\d+$")


def is_account_uid(uid: str | None) -> bool:
    """账号态 uid（u<id>，可被枚举），区别于随机匿名 uid。"""
    return bool(uid) and bool(_ACCOUNT_UID_RE.match(uid))


def owns_uid(uid: str, authorization: str | None) -> bool:
    """请求方是否有权以该 uid 读写数据：匿名随机 uid 放行，账号 uid 需本人 token。"""
    if not is_account_uid(uid):
        return True
    row = get_user_by_token(authorization)
    return bool(row) and user_uid(row["id"]) == uid


def require_user(authorization: str | None):
    row = get_user_by_token(authorization)
    if not row:
        raise HTTPException(401, "未登录或登录已过期")
    return row


# ---------- 接口 ----------

@router.post("/register")
def api_register(body: dict, request: Request):
    phone = str(body.get("phone") or "").strip()
    password = str(body.get("password") or "")
    code = body.get("code")  # 短信验证码：本期预留，不校验
    nickname = str(body.get("nickname") or "").strip()[:20] or None
    if not _PHONE_RE.match(phone):
        raise HTTPException(400, "手机号格式不正确")
    if len(password) < 6 or len(password) > 64:
        raise HTTPException(400, "密码长度需为 6-64 位")
    rate_limit(f"reg:{client_ip(request)}", 10, 3600)
    if not sms_provider.verify(phone, code):  # TODO: 接入短信后启用真实校验
        raise HTTPException(400, "验证码错误")
    conn = db.get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (phone, password_hash, nickname, created_at) VALUES (?,?,?,?)",
            (phone, hash_password(password), nickname, time.time()),
        )
    except Exception:
        conn.close()
        raise HTTPException(409, "该手机号已注册，请直接登录") from None
    uid = cur.lastrowid
    token = _issue_token(conn, uid)
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return {"token": token, "user": _user_payload(row)}


@router.post("/login")
def api_login(body: dict, request: Request):
    phone = str(body.get("phone") or "").strip()
    password = str(body.get("password") or "")
    rate_limit(f"login:{client_ip(request)}:{phone}", 10, 300)
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        conn.close()
        raise HTTPException(401, "手机号或密码错误")
    token = _issue_token(conn, row["id"])
    conn.commit()
    conn.close()
    return {"token": token, "user": _user_payload(row)}


@router.post("/wxlogin")
def api_wxlogin(body: dict, request: Request):
    """微信小程序一键登录：wx.login code -> openid -> 找到/创建账号并发 token。"""
    import os

    import httpx

    code = str(body.get("code") or "").strip()
    nickname = str(body.get("nickname") or "").strip()[:20] or None
    if not code:
        raise HTTPException(400, "缺少微信登录 code")
    appid = os.environ.get("WX_MINIAPP_APPID", "wx01f2f29cfe51baba")
    secret = os.environ.get("WX_MINIAPP_SECRET", "")
    if not secret:
        raise HTTPException(503, "微信登录暂未开通（服务端未配置小程序密钥）")
    rate_limit(f"wxlogin:{client_ip(request)}", 20, 300)
    try:
        r = httpx.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": appid,
                "secret": secret,
                "js_code": code,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        data = r.json()
    except Exception:
        raise HTTPException(502, "微信登录服务暂不可用，请稍后再试") from None
    openid = data.get("openid")
    if not openid:
        raise HTTPException(401, f"微信登录失败：{data.get('errmsg') or '无效 code'}")
    conn = db.get_conn()
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
    placeholder = f"wx:{openid}"
    row = conn.execute("SELECT * FROM users WHERE phone=?", (placeholder,)).fetchone()
    if not row:
        cur = conn.execute(
            "INSERT INTO users (phone, password_hash, nickname, created_at) VALUES (?,?,?,?)",
            (placeholder, hash_password(secrets.token_urlsafe(24)), nickname or "微信考友", time.time()),
        )
        row = conn.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    token = _issue_token(conn, row["id"])
    conn.commit()
    conn.close()
    return {"token": token, "user": _user_payload(row)}


@router.post("/logout")
def api_logout(authorization: str | None = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        conn = db.get_conn()
        conn.execute("DELETE FROM auth_tokens WHERE token=?", (authorization[7:].strip(),))
        conn.commit()
        conn.close()
    return {"ok": True}


@router.get("/me")
def api_me(authorization: str | None = Header(None)):
    row = require_user(authorization)
    return {"user": _user_payload(row)}


# 各 uid 数据表：uid 直接可改列的表 + 有 (uid,...) 主键需去重的表
_UID_TABLES = ["answer_log", "mistakes", "shenlun_answers", "review_log", "exam_attempts"]
_UID_PK_TABLES = ["shenlun_mat_favs", "shenlun_qfavs", "user_state", "question_favs", "question_notes", "fav_folders", "comment_likes", "user_profile", "reminder_prefs", "reinforce_log"]


@router.post("/merge_anon")
def api_merge_anon(body: dict, authorization: str | None = Header(None)):
    """把匿名 uid 的数据归并到当前账号 uid。幂等：重复调用不翻倍。"""
    row = require_user(authorization)
    anon = str(body.get("anon_uid") or "").strip()[:64]
    target = user_uid(row["id"])
    if not anon or anon == target:
        return {"ok": True, "merged": {}, "skipped": True}
    if re.fullmatch(r"u\d+", anon):
        raise HTTPException(400, "无效的匿名 uid")
    conn = db.get_conn()
    # 确保相关表/列存在（兼容空库）
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    db._ensure_shenlun_answers(conn)
    db._ensure_mat_favs(conn)
    db._ensure_qfavs(conn)
    db._ensure_user_state(conn)
    db._ensure_review_log(conn)
    db._ensure_exam_tables(conn)
    db._ensure_user_profile(conn)
    db._ensure_reminder_prefs(conn)
    db._ensure_reinforce_log(conn)
    merged: dict[str, int] = {}
    for t in _UID_TABLES:
        cur = conn.execute(f"UPDATE {t} SET uid=? WHERE uid=?", (target, anon))
        merged[t] = cur.rowcount
    for t in _UID_PK_TABLES:
        cur = conn.execute(f"UPDATE OR IGNORE {t} SET uid=? WHERE uid=?", (target, anon))
        merged[t] = cur.rowcount
        conn.execute(f"DELETE FROM {t} WHERE uid=?", (anon,))
    conn.execute(
        "INSERT OR IGNORE INTO merged_anon (user_id, anon_uid, merged_at) VALUES (?,?,?)",
        (row["id"], anon, time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "uid": target, "merged": merged}
