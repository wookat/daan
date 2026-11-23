"""SSE 中继：把 llm.chat_stream(with_thinking=True) 的产出转成事件行。

推理模型 reasoning 阶段客户端本无任何信号（R421 讲解、R423 面试点评均实测 20–40 s 空白），
这里在正文之前每 ≥tick_sec 发一条 `event: thinking {secs, chars}`（只有秒数与推理字数、不含推理文本），
长时间无任何输出（含识题阶段）每 ≥KEEPALIVE_SEC 发一条 `: ping` 注释帧保活（防 Cloudflare 100s 524），
正文增量按 `data: {"d": ...}` 原样透传并累积到 sink。
"""

import asyncio
import json
import time

from app.services import llm

THINKING_TICK_SEC = 1.0
KEEPALIVE_SEC = 15.0
KEEPALIVE_COMMENT = ": ping\n\n"


def thinking_event(secs: float, chars: int) -> str:
    return "event: thinking\ndata: " + json.dumps({"secs": round(secs), "chars": chars}) + "\n\n"


def data_event(delta: str) -> str:
    return "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"


async def pump_keepalive(coro, out_box: list, interval: float | None = None):
    """等待协程完成期间定时发出 `: ping` 保活帧，防 Cloudflare 100s 代理 524 超时；结果写入 out_box[0]。"""
    if interval is None:
        interval = KEEPALIVE_SEC
    task = asyncio.create_task(coro)
    try:
        while not task.done():
            done, _ = await asyncio.wait({task}, timeout=interval)
            if not done:
                yield KEEPALIVE_COMMENT
        out_box.append(await task)
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except BaseException:
                pass


async def relay(agen, sink: list[str], tick_sec: float | None = None, keepalive_sec: float | None = None):
    if tick_sec is None:
        tick_sec = THINKING_TICK_SEC
    if keepalive_sec is None:
        keepalive_sec = KEEPALIVE_SEC
    t0 = time.monotonic()
    last_tick = t0
    nxt: asyncio.Task | None = None
    try:
        while True:
            if nxt is None:
                nxt = asyncio.create_task(agen.__anext__())
            done, _ = await asyncio.wait({nxt}, timeout=keepalive_sec)
            if not done:
                yield KEEPALIVE_COMMENT
                continue
            try:
                delta = nxt.result()
            except StopAsyncIteration:
                nxt = None
                break
            nxt = None
            if isinstance(delta, llm.Thinking):
                now = time.monotonic()
                if now - last_tick >= tick_sec:
                    last_tick = now
                    yield thinking_event(now - t0, delta.chars)
                continue
            sink.append(delta)
            yield data_event(delta)
    finally:
        if nxt is not None and not nxt.done():
            nxt.cancel()
            try:
                await nxt
            except BaseException:
                pass
        if hasattr(agen, "aclose"):
            try:
                await agen.aclose()
            except Exception:
                pass
