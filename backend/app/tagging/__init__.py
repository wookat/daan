"""新题入库规则分类：复用 gov2 轮1 各模块规则打标脚本，统一入口 classify_question。

tag_*.py 原样拷贝自 data/gov2/scripts/round1/（保留独立可执行），此处仅做加载与分发。
"""
import json

from .. import taxonomy
from . import tag_changshi, tag_panduan, tag_shuliang, tag_yanyu, tag_ziliao

_ctx: dict | None = None


def _load():
    global _ctx
    if _ctx is None:
        cs_groups, cs_alias2group, cs_all = tag_changshi.load_taxonomy(taxonomy.PATH)
        zl_alias2group, zl_all = tag_ziliao.load_taxonomy(taxonomy.PATH)
        _ctx = {
            "cs": (cs_groups, cs_alias2group, cs_all),
            "zl": (zl_alias2group, set(zl_all)),
            "valid": set(taxonomy.topic_index().keys()),
        }
    return _ctx


def _options_str(options) -> str:
    if isinstance(options, str):
        return options
    try:
        return json.dumps(options or {}, ensure_ascii=False)
    except Exception:
        return ""


def classify_question(row: dict) -> tuple[str, float]:
    """规则分类三级考点。row 需含 module/question/options/explanation/submodule。

    返回 (tag3, confidence)；无法判定时返回 ("UNKNOWN", 0.0)。
    """
    ctx = _load()
    module = (row.get("module") or "").strip()
    q = row.get("question") or ""
    expl = row.get("explanation") or ""
    sub = (row.get("submodule") or "").strip() or None
    code, conf = "UNKNOWN", 0.0
    try:
        if module == "changshi":
            groups, alias2group, all_topics = ctx["cs"]
            d = {"question": q, "options": _options_str(row.get("options")),
                 "explanation": expl, "submodule": sub}
            code, conf, _ = tag_changshi.classify(d, groups, alias2group, all_topics)
        elif module == "panduan":
            code, conf, _ = tag_panduan.classify(
                {"question": q, "explanation": expl, "submodule": sub})
        elif module == "shuliang":
            code, conf = tag_shuliang.classify(
                {"question": q, "explanation": expl, "submodule": sub,
                 "options": row.get("options")})
        elif module == "yanyu":
            r = tag_yanyu.classify(q, row.get("options"), expl,
                                   tag_yanyu.allowed_codes(sub))
            if r:
                code, conf, _ = r
        elif module == "ziliao":
            tag, c = tag_ziliao.classify(
                {"question": q, "explanation": expl, "submodule": sub})
            alias2group, all_set = ctx["zl"]
            cand = alias2group.get(sub or "")
            if tag and cand and tag not in cand and c < 0.65:
                tag = None
            if tag and tag in all_set:
                code, conf = tag, c
    except Exception:
        return "UNKNOWN", 0.0
    if not code or code not in ctx["valid"]:
        return "UNKNOWN", 0.0
    return code, float(conf or 0)
