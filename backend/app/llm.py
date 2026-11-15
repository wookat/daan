"""LLM 客户端：OpenAI 兼容中转，支持图片（base64）与文本。"""
import asyncio
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from typing import Literal, overload

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
FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL", "")

# 中继整体不可用（额度耗尽 402/403/429 或持续 5xx）时的备用端点；
# 含图请求同样允许回落——要求备用模型支持视觉（当前生产配置 deepseek-flash 支持）
RESCUE_BASE_URL = os.environ.get("LLM_RESCUE_BASE_URL", "").rstrip("/")
RESCUE_API_KEY = os.environ.get("LLM_RESCUE_API_KEY", "")
RESCUE_MODEL = os.environ.get("LLM_RESCUE_MODEL", "deepseek-chat")

_QUOTA_CODES = (402, 403, 429)


def _rescue_ok(messages: list) -> bool:
    return bool(RESCUE_BASE_URL and RESCUE_API_KEY)

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


NO_THINK = {"thinking": {"type": "disabled"}}


def _body(model: str, messages: list, temperature: float, max_tokens: int, think: bool = True) -> dict:
    body = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if not think:
        body.update(NO_THINK)
    return body


def _endpoint(messages: list) -> tuple[str, str, str]:
    if _has_image(messages):
        return BASE_URL, API_KEY, MODEL
    return TEXT_BASE_URL, TEXT_API_KEY, TEXT_MODEL


async def chat(messages: list, temperature: float = 0.2, max_tokens: int = 4000, think: bool = True) -> str:
    """think=False：抽取/分类类任务关闭推理模型的 thinking 阶段（网关不识别该字段时无副作用）。"""
    base, key, model = _endpoint(messages)
    img = _has_image(messages)
    channel = "main" if img else "text"
    used_model = model
    if (not base or not key) and _rescue_ok(messages):
        base, key, model = RESCUE_BASE_URL, RESCUE_API_KEY, RESCUE_MODEL
        channel, used_model = "rescue", RESCUE_MODEL
    _require_configured(base, key)
    t0 = time.perf_counter()
    ok = False
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            for attempt in range(3):
                resp = await client.post(
                    f"{base}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json=_body(model, messages, temperature, max_tokens, think),
                )
                if resp.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                if resp.status_code >= 500 and FALLBACK_MODEL and model != FALLBACK_MODEL:
                    channel, used_model = "fallback", FALLBACK_MODEL
                    resp = await client.post(
                        f"{base}/v1/chat/completions",
                        headers={"Authorization": f"Bearer {key}"},
                        json=_body(FALLBACK_MODEL, messages, temperature, max_tokens, think),
                    )
                if (resp.status_code in _QUOTA_CODES or resp.status_code >= 500) and _rescue_ok(messages):
                    channel, used_model = "rescue", RESCUE_MODEL
                    log.warning("[llm] main %s status=%s, fallback to rescue %s", model, resp.status_code, RESCUE_MODEL)
                    resp = await client.post(
                        f"{RESCUE_BASE_URL}/v1/chat/completions",
                        headers={"Authorization": f"Bearer {RESCUE_API_KEY}"},
                        json=_body(RESCUE_MODEL, messages, temperature, max_tokens, think),
                    )
                resp.raise_for_status()
                try:
                    text = _content(resp.json())
                except EmptyReply:
                    # 主通道空回复（推理耗尽 max_tokens 等）按失败处理：
                    # 还有 rescue 时换端点重试一次，避免直接 502 打到用户
                    if not (_rescue_ok(messages) and channel != "rescue"):
                        raise
                    log.warning("[llm] %s empty reply, fallback to rescue %s", model, RESCUE_MODEL)
                    channel, used_model = "rescue", RESCUE_MODEL
                    resp = await client.post(
                        f"{RESCUE_BASE_URL}/v1/chat/completions",
                        headers={"Authorization": f"Bearer {RESCUE_API_KEY}"},
                        json=_body(RESCUE_MODEL, messages, temperature, max_tokens, think),
                    )
                    resp.raise_for_status()
                    text = _content(resp.json())
                ok = True
                return text
        raise RuntimeError("LLM 请求重试耗尽")
    finally:
        from .db_analytics import record_llm
        record_llm(channel, used_model, ok, (time.perf_counter() - t0) * 1000, img, False)


class Thinking:
    """推理模型 reasoning 阶段的进度标记（chat_stream(with_thinking=True) 时产出）：chars 为累计推理字数。"""

    __slots__ = ("chars",)

    def __init__(self, chars: int):
        self.chars = chars


@overload
def chat_stream(messages: list, temperature: float = ..., max_tokens: int = ..., with_thinking: Literal[False] = ..., think: bool = ...) -> AsyncIterator[str]: ...
@overload
def chat_stream(messages: list, temperature: float = ..., max_tokens: int = ..., *, with_thinking: bool, think: bool = ...) -> AsyncIterator["str | Thinking"]: ...


async def chat_stream(messages: list, temperature: float = 0.2, max_tokens: int = 4000, with_thinking: bool = False, think: bool = True):  # type: ignore[misc]
    """逐段产出模型输出文本。with_thinking=True 时在正文之前额外产出 Thinking 进度（推理模型 reasoning_content 不落正文，
    默认被丢弃，正文首字前调用方拿不到任何信号）。think=False 关闭推理阶段（网关不识别该字段时无副作用，
    此时 with_thinking=True 仍能把实际发生的 reasoning 透出为进度）。"""
    base, key, model = _endpoint(messages)
    img = _has_image(messages)
    tries = []
    if base and key:
        tries.append(("main" if img else "text", base, key, model))
        if FALLBACK_MODEL and FALLBACK_MODEL != model:
            tries.append(("fallback", base, key, FALLBACK_MODEL))
    if _rescue_ok(messages):
        tries.append(("rescue", RESCUE_BASE_URL, RESCUE_API_KEY, RESCUE_MODEL))
    if not tries:
        _require_configured(base, key)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for i, (ch, b, k, m) in enumerate(tries):
            t0 = time.perf_counter()
            attempt_ok = False
            try:
                async with client.stream(
                    "POST",
                    f"{b}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {k}"},
                    json={**_body(m, messages, temperature, max_tokens, think), "stream": True},
                ) as resp:
                    if (resp.status_code >= 500 or resp.status_code in _QUOTA_CODES) and i < len(tries) - 1:
                        continue
                    resp.raise_for_status()
                    thinking_chars = content_chars = 0
                    finish = None
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            choice = json.loads(payload)["choices"][0]
                            d = choice["delta"]
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                            continue
                        if not isinstance(d, dict):
                            continue
                        finish = choice.get("finish_reason") or finish
                        delta = d.get("content")
                        if delta:
                            content_chars += len(delta)
                            yield delta
                        elif with_thinking:
                            reasoning = d.get("reasoning_content") or d.get("reasoning")
                            if reasoning:
                                thinking_chars += len(reasoning)
                                yield Thinking(thinking_chars)
                    if finish == "length" or not content_chars:
                        log.warning(
                            "[llm] stream %s finish=%s content=%d reasoning_chars=%d max_tokens=%d",
                            m, finish, content_chars, thinking_chars, max_tokens,
                        )
                    attempt_ok = True
                    return
            finally:
                from .db_analytics import record_llm
                record_llm(ch, m, attempt_ok, (time.perf_counter() - t0) * 1000, img, True)


async def chat_fast(messages: list, temperature: float = 0.2, max_tokens: int = 2000, think: bool = True) -> str:
    """轻量任务（分类/抽取）：路由与 chat() 一致——主通道优先，备用端点仅在
    主通道 402/403/429 或 5xx 时接管（按成本优先调度：当前主通道单价远低于备用端点）。"""
    return await chat(messages, temperature=temperature, max_tokens=max_tokens, think=think)


def image_content(images, mime_or_text=None, text=None) -> list:
    """识题消息体：支持单图或多图。

    多图签名 image_content([(b64, mime), ...], text)；
    旧签名 image_content(b64, mime, text) 兼容保留。
    """
    if isinstance(images, str):
        images = [(images, mime_or_text or "image/jpeg")]
        text = text if text is not None else ""
    else:
        text = mime_or_text or ""
    return [{"type": "text", "text": text}] + [
        {"type": "image_url", "image_url": {"url": f"data:{m or 'image/jpeg'};base64,{b}"}}
        for b, m in images
    ]


async def chat_json(messages: list, fast: bool = False, **kw) -> dict:
    raw = await (chat_fast(messages, **kw) if fast else chat(messages, **kw))
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
