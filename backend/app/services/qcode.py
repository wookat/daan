"""题目语义化唯一编码。

格式：{模块缩写}-{题型拼音首字母}-{年份?}-{序号6位}
例：ZL-JQL-2024-000914（资料分析·基期量·2024年真题·题库序号 914）
    PD-LJPD-010913（判断推理·逻辑判断·非真题）
序号即题库主键 id，保证全局唯一；前缀提供语义可读性。
"""

_MOD_ABBR = {
    "ziliao": "ZL",
    "shuliang": "SL",
    "yanyu": "YY",
    "panduan": "PD",
    "changshi": "CS",
    "shenlun": "SW",
}


def _initials(text: str, max_len: int = 4) -> str:
    if not text:
        return ""
    try:
        from pypinyin import Style, pinyin

        parts = pinyin(text, style=Style.FIRST_LETTER, errors="ignore")
        s = "".join(p[0] for p in parts if p and p[0].isalpha())
        return s.upper()[:max_len]
    except Exception:
        return ""


def build_code(q: dict) -> str:
    qid = q.get("id")
    if not qid:
        return ""
    seg = [_MOD_ABBR.get(q.get("module") or "", "QT")]
    t = _initials((q.get("submodule") or "").strip())
    if t:
        seg.append(t)
    year = q.get("exam_year")
    if q.get("is_real") and year:
        seg.append(str(year))
    seg.append(f"{int(qid):06d}")
    return "-".join(seg)


def parse_qid(code: str) -> int | None:
    """从语义码或纯数字反解题库 id。"""
    tail = (code or "").strip().split("-")[-1]
    return int(tail) if tail.isdigit() else None
