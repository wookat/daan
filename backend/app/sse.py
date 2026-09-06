"""SSE 中继：把 llm.chat_stream(with_thinking=True) 的产出转成事件行。

推理模型 reasoning 阶段客户端本无任何信号（R421 讲解、R423 面试点评均实测 20–40 s 空白），
这里在正文之前每 ≥tick_sec 发一条 `event: thinking {secs, chars}`（只有秒数与推理字数、不含推理文本），
正文增量按 `data: {"d": ...}` 原样透传并累积到 sink。
"""

import json
import time

from . import llm

THINKING_TICK_SEC = 1.0


def thinking_event(secs: float, chars: int) -> str:
    return "event: thinking\ndata: " + json.dumps({"secs": round(secs), "chars": chars}) + "\n\n"


def data_event(delta: str) -> str:
    return "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"


async def relay(agen, sink: list[str], tick_sec: float | None = None):
    if tick_sec is None:
        tick_sec = THINKING_TICK_SEC
    t0 = time.monotonic()
    last_tick = t0
    async for delta in agen:
        if isinstance(delta, llm.Thinking):
            now = time.monotonic()
            if now - last_tick >= tick_sec:
                last_tick = now
                yield thinking_event(now - t0, delta.chars)
            continue
        sink.append(delta)
        yield data_event(delta)
