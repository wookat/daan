"""全站正确率 → 难度分档（B3：难度全站校准）。

questions.correct_ratio 是全站口径的整数百分率（0-100）。
分档 1（最易）…5（最难）；样本不足或缺数据 → None（前端显示「待校准」）。
纯函数、无 I/O；前端如有同款逻辑应保持同一组阈值。
"""
from __future__ import annotations

# 至少要有这么多人答过，分档才有统计意义
MIN_ATTEMPTS = 30

# (下界含, 档位)：correct_ratio >= bound → band
_BOUNDS = ((80, 1), (60, 2), (40, 3), (20, 4), (0, 5))

BAND_LABELS = {1: "基础", 2: "较易", 3: "中等", 4: "偏难", 5: "高难"}


def band(correct_ratio: float | None, attempt_count: int | None) -> int | None:
    if attempt_count is None or attempt_count < MIN_ATTEMPTS:
        return None
    if correct_ratio is None:
        return None
    r = float(correct_ratio)
    for bound, b in _BOUNDS:
        if r >= bound:
            return b
    return 5


def label(b: int | None) -> str | None:
    return BAND_LABELS.get(b) if b else None
