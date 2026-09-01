"""跨域共享的门禁与工具：访问码/管理令牌/导入令牌校验、限速、AI 错误友好化、解析缓存键。"""
import hashlib
import hmac
import os

import httpx
from fastapi import HTTPException, Request

from . import auth

ACCESS_CODE = os.environ.get("ACCESS_CODE", "")
IMPORT_TOKEN = os.environ.get("IMPORT_TOKEN", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "") or IMPORT_TOKEN


def check_access(x_access_code: str | None):
    if ACCESS_CODE and x_access_code != ACCESS_CODE:
        raise HTTPException(401, "访问码错误")


def check_admin(x_admin_token: str | None):
    if not ADMIN_TOKEN:
        raise HTTPException(503, "服务端未配置管理令牌，请联系管理员")
    if not hmac.compare_digest(x_admin_token or "", ADMIN_TOKEN):
        # 令牌错误按全局失败计数限速，封顶暴力枚举速率（正确令牌不受影响）
        auth.rate_limit("admin_token_fail", 20, 300)
        raise HTTPException(401, "无效管理令牌")


def check_import_token(x_import_token: str | None):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")


client_ip = auth.client_ip


def rl(request: Request, bucket: str, limit: int, window: int, uid: str | None = None):
    """高成本接口（AI/OCR/导出/纠错）限速，防单机刷量。

    IP 桶恒生效（uid 为客户端自报，可轮换绕过 uid 桶；带 uid 时放宽 3 倍容忍 NAT 共享出口）；
    uid 桶在提供 uid 时叠加，保持原有按账号的精细口径。
    """
    ip = client_ip(request)
    who = (uid or "").strip()[:64]
    auth.rate_limit(f"{bucket}:ip:{ip}", limit * 3 if who else limit, window)
    if who:
        auth.rate_limit(f"{bucket}:{who}", limit, window)


def friendly_ai_err(e: Exception) -> str:
    if isinstance(e, httpx.HTTPStatusError):
        code = e.response.status_code
        if code in (402, 403, 429):
            return "AI 服务额度已用完，请稍后再试"
        return "AI 服务暂时不可用，请稍后再试"
    if isinstance(e, httpx.HTTPError):
        return "AI 服务连接失败，请稍后再试"
    return str(e)


def cache_key(question_text: str | None, user_answer: str | None) -> str:
    raw = (question_text or "").strip() + "\n||\n" + (user_answer or "").strip()
    return hashlib.sha256(raw.encode()).hexdigest()
