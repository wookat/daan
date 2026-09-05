"""LLM 客户端：OpenAI 兼容中转，支持图片（base64）与文本。"""
import asyncio
import json
import logging
import os

import httpx

log = logging.getLogger("kg.llm")

BASE_URL = os.environ.get("LLM_BASE_URL", "").rstrip("/")
API_KEY = os.environ.get("LLM_API_KEY", "")
MODEL = os.environ.get("LLM_MODEL", "gpt-5.5")

# 纯文本请求可走单独的文本模型（如 deepseek）；含图请求始终走视觉模型。
TEXT_BASE_URL = os.environ.get("LLM_TEXT_BASE_URL", "").rstrip("/") or BASE_URL
TEXT_API_KEY = os.environ.get("LLM_TEXT_API_KEY", "") or API_KEY
TEXT_MODEL = os.environ.get("LLM_TEXT_MODEL", "") or MODEL

# 主模型不可用（5xx）时的后备模型（同一中继）
FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL", "gpt-5.5")

# 中继整体不可用（额度耗尽 402/403/429 或持续 5xx）时，纯文本请求的备用端点
RESCUE_BASE_URL = os.environ.get("LLM_RESCUE_BASE_URL", "").rstrip("/")
RESCUE_API_KEY = os.environ.get("LLM_RESCUE_API_KEY", "")
RESCUE_MODEL = os.environ.get("LLM_RESCUE_MODEL", "deepseek-chat")

_QUOTA_CODES = (402, 403, 429)


def _rescue_ok(messages: list) -> bool:
    return bool(RESCUE_BASE_URL and RESCUE_API_KEY) and not _has_image(messages)

TIMEOUT = httpx.Timeout(float(os.environ.get("LLM_TIMEOUT", "180")), connect=15.0)


def _has_image(messages: list) -> bool:
    for m in messages:
        c = m.get("content")
        if isinstance(c, list) and any(p.get("type") == "image_url" for p in c):
            return True
    return False


class EmptyReply(RuntimeError):
    """HTTP 200 但 content 为空（如推理模型把 max_tokens 全耗在 reasoning 上、finish_reason=length）。"""


class TruncatedReply(EmptyReply):
    """HTTP 200、content 非空但 finish_reason=length：推理模型 reasoning 吃掉大半预算后正文被截断。"""


def _content(data: dict, reject_truncated: bool = False) -> str:
    choice = data["choices"][0]
    text = choice["message"].get("content") or ""
    if not text.strip():
        raise EmptyReply("AI 未返回内容，请稍后再试")
    if choice.get("finish_reason") == "length":
        if reject_truncated:
            raise TruncatedReply(f"AI 回复被截断（{len(text)} 字）")
        log.warning("[llm] finish_reason=length, content %d chars returned as-is", len(text))
    return text


def _require_configured(base: str, key: str) -> None:
    """未配置 LLM 时立即失败，让调用方友好降级，而不是等待连接超时拖长响应。"""
    if not base or not key:
        raise RuntimeError("AI 服务未配置")


def _endpoint(messages: list) -> tuple[str, str, str]:
    if _has_image(messages):
        return BASE_URL, API_KEY, MODEL
    return TEXT_BASE_URL, TEXT_API_KEY, TEXT_MODEL


async def chat(messages: list, temperature: float = 0.2, max_tokens: int = 4000) -> str:
    base, key, model = _endpoint(messages)
    if (not base or not key) and _rescue_ok(messages):
        base, key, model = RESCUE_BASE_URL, RESCUE_API_KEY, RESCUE_MODEL
    _require_configured(base, key)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(3):
            resp = await client.post(
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            if resp.status_code >= 500 and attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            if resp.status_code >= 500 and FALLBACK_MODEL and model != FALLBACK_MODEL:
                resp = await client.post(
                    f"{base}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": FALLBACK_MODEL,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
            if (resp.status_code in _QUOTA_CODES or resp.status_code >= 500) and _rescue_ok(messages):
                resp = await client.post(
                    f"{RESCUE_BASE_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {RESCUE_API_KEY}"},
                    json={
                        "model": RESCUE_MODEL,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
            resp.raise_for_status()
            return _content(resp.json())
    raise RuntimeError("LLM 请求重试耗尽")


async def chat_stream(messages: list, temperature: float = 0.2, max_tokens: int = 4000):
    """逐段产出模型输出文本。"""
    base, key, model = _endpoint(messages)
    tries = []
    if base and key:
        tries.append((base, key, model))
        if FALLBACK_MODEL and FALLBACK_MODEL != model:
            tries.append((base, key, FALLBACK_MODEL))
    if _rescue_ok(messages):
        tries.append((RESCUE_BASE_URL, RESCUE_API_KEY, RESCUE_MODEL))
    if not tries:
        _require_configured(base, key)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for i, (b, k, m) in enumerate(tries):
            async with client.stream(
                "POST",
                f"{b}/v1/chat/completions",
                headers={"Authorization": f"Bearer {k}"},
                json={
                    "model": m,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                },
            ) as resp:
                if (resp.status_code >= 500 or resp.status_code in _QUOTA_CODES) and i < len(tries) - 1:
                    continue
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        delta = json.loads(payload)["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta
            return


async def chat_fast(messages: list, temperature: float = 0.2, max_tokens: int = 2000) -> str:
    """轻量任务（分类/抽取）优先走无排队的备用端点，失败时回退主通道。"""
    if _rescue_ok(messages):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(
                    f"{RESCUE_BASE_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {RESCUE_API_KEY}"},
                    json={
                        "model": RESCUE_MODEL,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                resp.raise_for_status()
                return _content(resp.json(), reject_truncated=True)
        except (httpx.HTTPError, KeyError, IndexError, ValueError, EmptyReply) as e:
            log.warning("[llm] rescue %s failed (%s: %s), fallback to %s", RESCUE_MODEL, type(e).__name__, e, TEXT_MODEL)
    return await chat(messages, temperature=temperature, max_tokens=max_tokens)


def image_content(image_b64: str, mime: str, text: str) -> list:
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
    ]


async def chat_json(messages: list, fast: bool = False, **kw) -> dict:
    raw = await (chat_fast(messages, **kw) if fast else chat(messages, **kw))
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
