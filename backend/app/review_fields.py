"""把 engine.explain 的六段式 markdown 解析为结构化字段（B1：AI 复盘结构化）。

EXPLAIN_SYSTEM 的输出合同（backend/app/engine.py）：
  首行  【答案】X｜【方法】名｜【一句话】…
  段落  ## 题型识别 / ## 方法与步骤（含 ### 第N步）/ ## 答案
        / ## 快解技巧 / ## 错项击破 / ## 易错点 / ## 错因分析
解析只做纯文本切分：任何 section 缺失 → 对应字段为 None，不抛异常（fail-open），
保证旧缓存、截断输出、手写解析也能安全过一遍。
"""
from __future__ import annotations

import json
import re

# 列名 → 可能出现的 section 标题（取前缀匹配，容忍「错项击破（为什么选 D）」这类括注）
_SECTION_ALIASES: dict[str, tuple[str, ...]] = {
    "mistake_analysis": ("错因分析", "错因"),
    "fastest_solution": ("快解技巧", "快速解法", "秒杀"),
    "trap_analysis": ("错项击破", "错项分析", "选项击破"),
    "review_tip": ("易错点", "易错提醒", "易错警示", "答案与易错点"),
}

_HEADING_RE = re.compile(r"^#{1,4}\s*(.+?)\s*$", re.MULTILINE)
_METHOD_RE = re.compile(r"【方法】\s*([^｜|\[\]【】\n]+)")

# 错因归类：复用前端 chips 词表（粗心大意/概念不清/方法不会/纯蒙的），
# 关键词命中多类时按优先级取第一个命中的类；无命中 → None（不强猜）。
_REASON_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("粗心大意", ("审题", "看错", "漏看", "漏掉", "忽略", "没注意", "大意", "粗心",
                  "算错", "计算错", "计算失误", "抄错", "笔误", "看反", "正负号")),
    ("概念不清", ("概念", "定义", "公式", "定理", "知识点", "遗忘", "混淆",
                  "不熟悉", "记忆", "词汇量", "固定搭配", "成语")),
    ("方法不会", ("方法", "思路", "不会", "没想到", "技巧", "套路", "模型",
                  "题型", "突破口", "切入点", "不知从何", "无从下手")),
    ("纯蒙的", ("蒙对", "瞎选", "猜的", "随便选")),
]


def _norm_heading(h: str) -> str:
    """去掉标题尾部的括注和编号：「错项击破（为什么错选 D）」→「错项击破」。"""
    h = re.sub(r"[（(].*$", "", h)
    h = re.sub(r"^第[0-9一二三四五六七八九十]+[步部分]\s*[:：]?", "", h)
    return h.strip()


def _section_map(md: str) -> dict[str, str]:
    """按 ## 标题切分全文 → {规范字段名: 段落文本}；未识别的标题忽略。"""
    heads = list(_HEADING_RE.finditer(md or ""))
    out: dict[str, str] = {}
    for i, m in enumerate(heads):
        name = _norm_heading(m.group(1))
        field = None
        for f, aliases in _SECTION_ALIASES.items():
            if name in aliases or any(name.startswith(a) for a in aliases):
                field = f
                break
        if not field or field in out:
            continue
        start = m.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(md)
        body = (md or "")[start:end].strip()
        if body:
            out[field] = body
    return out


def _bullets(text: str) -> list[str]:
    """把「错项击破」段落拆成逐条（- A: … / 1. … / A项：…），拆不出则整段一条。"""
    items = [
        ln.strip()
        for ln in (text or "").splitlines()
        if re.match(r"^\s*(?:[-*•]|\d+[.、)]|[A-EＡ-Ｅ][项选]?[、:：.])\s*", ln)
    ]
    if items:
        return [re.sub(r"^[-*•]\s*", "", it) for it in items]
    parts = [p.strip() for p in re.split(r"[；;]\s*|\n{2,}", text or "") if p.strip()]
    return parts or ([text.strip()] if text and text.strip() else [])


def classify_error_reason(analysis: str | None) -> str | None:
    """错因分析文本 → 前端 chips 词表之一；只有单一类别命中时才归类（保守）。"""
    t = analysis or ""
    if not t:
        return None
    hits = [name for name, kws in _REASON_KEYWORDS if any(k in t for k in kws)]
    if len(hits) == 1:
        return hits[0]
    # 多类命中：按声明顺序取第一个（粗心 > 概念 > 方法 > 蒙），权重对齐前端排序
    if hits:
        order = [n for n, _ in _REASON_KEYWORDS]
        return min(hits, key=order.index)
    return None


def parse_explain(md: str | None) -> dict:
    """explain markdown → 结构化字段。任何输入都安全返回（绝不抛）。"""
    md = md or ""
    secs = _section_map(md)
    method = None
    m = _METHOD_RE.search(md[:400])
    if m:
        method = m.group(1).strip()[:24] or None
    trap_items = _bullets(secs.get("trap_analysis", "")) if secs.get("trap_analysis") else []
    analysis = secs.get("mistake_analysis")
    return {
        "method": method,
        "mistake_analysis": analysis or None,
        "fastest_solution": secs.get("fastest_solution") or None,
        "trap_items": trap_items,
        "review_tip": secs.get("review_tip") or None,
        "error_reason_tag": classify_error_reason(analysis),
    }


def trap_json(items: list[str]) -> str | None:
    """trap_items → mistakes.trap_analysis 列（JSON 文本）；空列表 → None。"""
    return json.dumps(items, ensure_ascii=False) if items else None


def trap_list(raw: str | None) -> list[str]:
    """mistakes.trap_analysis 列 → list；兼容历史纯文本与坏数据。"""
    if not raw:
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            return [v]
    except (ValueError, TypeError):
        pass
    return [raw]
