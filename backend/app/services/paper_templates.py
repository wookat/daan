"""省份卷型模板：纯数据配置层，不改组卷算法签名。

每套模板 = 行测五模块题量分布 + 总时长。counts 的键与 db.MODULE_ORDER 同域；
供 /api/exam/start 的 template_id 参数与前端组卷面板共用。
真实考情口径：题量/时长按近年公开卷面结构（副省级 135/120、联考 120/120、
江苏A 135/120、京考 135/120、沪考 130/120、粤考 100/90）折算到五模块。
"""

TEMPLATES: dict[str, dict] = {
    "guokao": {
        "name": "国考卷型",
        "duration_min": 120,
        "counts": {"changshi": 20, "yanyu": 40, "shuliang": 15, "panduan": 40, "ziliao": 20},
        "note": "135 题 · 副省级/地市级通用结构",
    },
    "liankao": {
        "name": "省考联考",
        "duration_min": 120,
        "counts": {"changshi": 20, "yanyu": 40, "shuliang": 10, "panduan": 35, "ziliao": 15},
        "note": "120 题 · 多省联考常见结构",
    },
    "jiangsu-a": {
        "name": "江苏 A 类",
        "duration_min": 120,
        "counts": {"changshi": 15, "yanyu": 30, "shuliang": 20, "panduan": 50, "ziliao": 20},
        "note": "135 题 · 数量与判断占比高",
    },
    "beijing": {
        "name": "京考卷型",
        "duration_min": 120,
        "counts": {"changshi": 35, "yanyu": 35, "shuliang": 15, "panduan": 30, "ziliao": 20},
        "note": "135 题 · 常识题量大",
    },
    "shanghai": {
        "name": "沪考卷型",
        "duration_min": 120,
        "counts": {"changshi": 25, "yanyu": 25, "shuliang": 15, "panduan": 45, "ziliao": 20},
        "note": "130 题 · 含不定项/科学推理",
    },
    "guangdong": {
        "name": "粤考卷型",
        "duration_min": 90,
        "counts": {"changshi": 15, "yanyu": 20, "shuliang": 15, "panduan": 35, "ziliao": 15},
        "note": "100 题 · 90 分钟",
    },
    "mini": {
        "name": "迷你模考",
        "duration_min": 30,
        "counts": {"changshi": 5, "yanyu": 9, "shuliang": 3, "panduan": 9, "ziliao": 4},
        "note": "30 题 · 30 分钟 · 快速热身",
    },
}


def get(template_id: str | None) -> dict | None:
    """按 id 取模板；未知/空返回 None（调用方决定 400 或回退）。"""
    if not template_id:
        return None
    return TEMPLATES.get(str(template_id).strip().lower())


def options() -> list[dict]:
    """前端组卷面板的选项列表（含总题数，顺序即展示顺序）。"""
    out = []
    for tid, t in TEMPLATES.items():
        out.append({
            "id": tid,
            "name": t["name"],
            "n": sum(t["counts"].values()),
            "duration_min": t["duration_min"],
            "note": t["note"],
        })
    return out
