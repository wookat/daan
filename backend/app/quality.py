"""题目质量打分（规则综合，0-100）。

维度：题干/选项/解析完整性、解析长度与结构、来源可信度、用户反馈信号。
"""
import json
import re

_STRUCT_HINTS = ("因此", "所以", "故选", "故答案", "综上", "第一步", "第二步", "步骤", "代入", "排除", "由题", "根据")


def _parse_options(options) -> dict:
    if isinstance(options, dict):
        return options
    try:
        d = json.loads(options or "{}")
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def score_question(row: dict) -> int:
    """row 需含 question/options/answer/explanation/hs_explanation/source/is_real/exam_year/exam_region/hs_down/hs_up。"""
    score = 0
    question = (row.get("question") or "").strip()
    opts = _parse_options(row.get("options"))
    answer = (row.get("answer") or "").strip().upper()
    expl = (row.get("explanation") or "").strip()
    hs = (row.get("hs_explanation") or "").strip()

    # 1) 题干完整性（0-20）
    if len(question) >= 10:
        score += 12
    elif question:
        score += 5
    if len(question) >= 25:
        score += 5
    if not re.search(r"(如下图|如图|下表|见图)", question) or row.get("image"):
        score += 3  # 引用图表但无图的题干扣分

    # 2) 选项完整性（0-20）
    filled = [v for v in opts.values() if str(v).strip()]
    if len(filled) >= 4:
        score += 12
    elif len(filled) >= 2:
        score += 6
    if len(filled) >= 2 and len({str(v).strip() for v in filled}) == len(filled):
        score += 4  # 选项无重复
    if answer and answer in {k.strip().upper() for k in opts}:
        score += 4  # 答案落在选项内

    # 3) 解析完整性/长度/结构（0-40）
    best = max(len(expl), len(hs))
    if best >= 30:
        score += 12
    elif best >= 10:
        score += 6
    if best >= 80:
        score += 8
    if best >= 200:
        score += 4
    combined = expl + hs
    hints = sum(1 for h in _STRUCT_HINTS if h in combined)
    score += min(10, hints * 3)  # 结构化推理线索
    if expl and hs:
        score += 6  # 双解析（普通 + AI 精讲）

    # 4) 来源可信度（0-20）
    if row.get("is_real"):
        score += 10
    if row.get("exam_year") and row.get("exam_region"):
        score += 4
    source = (row.get("source") or "").strip()
    if source and source not in ("original", "unknown", "ai"):
        score += 4
    elif source:
        score += 2
    hs_down = row.get("hs_down") or 0
    hs_up = row.get("hs_up") or 0
    if hs_up > hs_down:
        score += 2
    score -= min(10, hs_down * 2)  # 用户差评扣分

    return max(0, min(100, score))


def score_all(conn, log=None) -> dict:
    """全库打分并写回 quality_score 列。"""
    import time

    t0 = time.time()
    rows = conn.execute(
        "SELECT id, question, options, answer, explanation, hs_explanation, "
        "source, is_real, exam_year, exam_region, hs_down, hs_up, image FROM questions"
    ).fetchall()
    updates = []
    for i, r in enumerate(rows):
        updates.append((score_question(dict(r)), r["id"]))
        if log and (i + 1) % 20000 == 0:
            log(f"  scored {i + 1}/{len(rows)}")
    conn.executemany("UPDATE questions SET quality_score=? WHERE id=?", updates)
    conn.commit()
    return {"n": len(rows), "seconds": round(time.time() - t0, 2)}
