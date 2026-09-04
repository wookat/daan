"""题目质量打分（规则综合，0-100）。

维度：题干/选项/解析完整性、解析长度与结构、来源可信度、用户反馈信号、
内容自证缺陷（hs 自检失败词 / 管线括注 / yanyu 伪中文机器句）。

另含内容清洗规则（题干汉字间空格、hs 管线元句），供清洗脚本与 sanitize_hs 共用。
"""
import json
import re

_STRUCT_HINTS = ("因此", "所以", "故选", "故答案", "综上", "第一步", "第二步", "步骤", "代入", "排除", "由题", "根据")

# hs 生成管线自检失败留下的内话（题干/答案自相矛盾，讲解不可信）。
# 「数据矛盾」单独出现多为正常排错措辞（「C 项与数据矛盾」），不入词表。
HS_SELFCHECK_WORDS = ("SKIP:", "官方解析有误", "官方解析误", "无法用给定", "无法可靠得到", "题干数据或选项有误")
# 管线括注「（通用解法，该题型花生方法不在库中）」及其变体
HS_PIPELINE_NOTE_RE = re.compile(r"（通用解法，[^）]*不在库中）")
# 管线元句「该解法是花生十三体系中此类题型的标准套路，考场可直接套用。」及同义变体：
# 该/本/此 + 解法/方法/思路 + 是/为 + 花生十三…套路/套用…，到句号为止（含前后空白）
HS_META_RE = re.compile(
    r"[ \t\u3000]*(?:该|本|此)(?:解法|方法|思路|做法)(?:是|为|属于|即)花生十三"
    r"[^。！\n]{0,40}(?:套路|套用|通法)[^。！\n]*[。！]?[ \t\u3000]*"
)
# AI 批次 yanyu 伪中文机器句特征「X着Y的Z」；命中 ≥ PSEUDO_ZH_MIN_HITS 判定为机器句
PSEUDO_ZH_RE = re.compile(r"[一-龥]{1,3}着[一-龥]{1,5}的[一-龥]{1,4}")
PSEUDO_ZH_MIN_HITS = 3
# 汉字 / 中文标点（不含全角数字字母），用于「汉字之间夹空格」判定
_CJK_CLASS = (
    "\u4e00-\u9fff\u3001-\u303f\u2014\u2026\u2018\u2019\u201c\u201d"
    "\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff5e"
)
CJK_SPACE_RE = re.compile(f"(?<=[{_CJK_CLASS}])[ \u3000]+(?=[{_CJK_CLASS}])")
_CJK_BLANK_PAIRS = {"（）", "【】", "〔〕", "「」", "『』"}

PENALTY_HS_SELFCHECK = 40
PENALTY_HS_PIPELINE_NOTE = 15
PENALTY_PSEUDO_ZH = 30


def hs_selfcheck_failed(hs: str) -> bool:
    return any(w in hs for w in HS_SELFCHECK_WORDS)


def pseudo_zh_hits(text: str) -> int:
    return len(PSEUDO_ZH_RE.findall(text or ""))


def _cjk_space_sub(m: re.Match) -> str:
    s = m.string
    if s[m.start() - 1] + s[m.end()] in _CJK_BLANK_PAIRS:  # 「（ ）」填空占位保留
        return m.group(0)
    return ""


def normalize_cjk_spaces(text: str | None) -> str:
    """仅剥离汉字/中文标点之间的半角/全角空格；数字、字母两侧空格保留（「1 天有 86400 秒」不变）。"""
    return CJK_SPACE_RE.sub(_cjk_space_sub, text or "")


def normalize_options(options) -> str | None:
    """对选项 JSON 各值做 normalize_cjk_spaces；无变化返回 None（调用方据此判断是否写库）。"""
    opts = _parse_options(options)
    if not opts:
        return None
    fixed = {k: normalize_cjk_spaces(v) if isinstance(v, str) else v for k, v in opts.items()}
    if fixed == opts:
        return None
    return json.dumps(fixed, ensure_ascii=False)


def question_text(row: dict) -> str:
    """题干 + 选项文本拼接（伪中文判定口径）。"""
    opts = _parse_options(row.get("options"))
    return "\n".join([row.get("question") or "", *(str(v) for v in opts.values())])


def sanitize_hs(text: str | None) -> str | None:
    """剥离管线括注并归一空白；含自检失败词返回 None（不应落库）。"""
    hs = (text or "").strip()
    if not hs:
        return ""
    if hs_selfcheck_failed(hs):
        return None
    hs = HS_PIPELINE_NOTE_RE.sub("", hs)
    hs = HS_META_RE.sub("", hs)
    hs = re.sub(r"[ \t\u3000]+\n", "\n", hs)
    hs = re.sub(r"[ \t\u3000]{2,}", " ", hs)
    hs = re.sub(r"\n{3,}", "\n\n", hs)
    return hs.strip()


def _parse_options(options) -> dict:
    if isinstance(options, dict):
        return options
    try:
        d = json.loads(options or "{}")
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def score_question(row: dict) -> int:
    """row 需含 module/question/options/answer/explanation/hs_explanation/source/is_real/exam_year/exam_region/hs_down/hs_up。"""
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

    # 5) 内容自证缺陷扣分
    if hs_selfcheck_failed(hs):
        score -= PENALTY_HS_SELFCHECK
    if HS_PIPELINE_NOTE_RE.search(hs):
        score -= PENALTY_HS_PIPELINE_NOTE
    if row.get("module") == "yanyu" and pseudo_zh_hits(question_text(row)) >= PSEUDO_ZH_MIN_HITS:
        score -= PENALTY_PSEUDO_ZH

    return max(0, min(100, score))


def score_all(conn, log=None) -> dict:
    """全库打分并写回 quality_score 列。"""
    import time

    t0 = time.time()
    rows = conn.execute(
        "SELECT id, module, question, options, answer, explanation, hs_explanation, "
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
