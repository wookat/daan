"""LLM 客户端：OpenAI 兼容中转，支持图片（base64）与文本。"""
import asyncio
import json
import os

import httpx

BASE_URL = os.environ.get("LLM_BASE_URL", "").rstrip("/")
API_KEY = os.environ.get("LLM_API_KEY", "")
MODEL = os.environ.get("LLM_MODEL", "gpt-5.5")

# 纯文本请求可走单独的文本模型（如 deepseek）；含图请求始终走视觉模型。
TEXT_BASE_URL = os.environ.get("LLM_TEXT_BASE_URL", "").rstrip("/") or BASE_URL
TEXT_API_KEY = os.environ.get("LLM_TEXT_API_KEY", "") or API_KEY
TEXT_MODEL = os.environ.get("LLM_TEXT_MODEL", "") or MODEL

# 主模型不可用（5xx）时的后备模型（同一中继）
FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL", "gpt-5.5")

TIMEOUT = httpx.Timeout(180.0, connect=15.0)


def _has_image(messages: list) -> bool:
    for m in messages:
        c = m.get("content")
        if isinstance(c, list) and any(p.get("type") == "image_url" for p in c):
            return True
    return False


def _endpoint(messages: list) -> tuple[str, str, str]:
    if _has_image(messages):
        return BASE_URL, API_KEY, MODEL
    return TEXT_BASE_URL, TEXT_API_KEY, TEXT_MODEL


async def chat(messages: list, temperature: float = 0.2, max_tokens: int = 4000) -> str:
    base, key, model = _endpoint(messages)
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
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


async def chat_stream(messages: list, temperature: float = 0.2, max_tokens: int = 4000):
    """逐段产出模型输出文本。"""
    base, key, model = _endpoint(messages)
    models = [model] + ([FALLBACK_MODEL] if FALLBACK_MODEL and FALLBACK_MODEL != model else [])
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for i, m in enumerate(models):
            async with client.stream(
                "POST",
                f"{base}/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": m,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                },
            ) as resp:
                if resp.status_code >= 500 and i < len(models) - 1:
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


def image_content(image_b64: str, mime: str, text: str) -> list:
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
    ]


async def chat_json(messages: list, **kw) -> dict:
    raw = await chat(messages, **kw)
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
