"""题目质量打分（规则综合，0-100）。

维度：题干/选项/解析完整性、解析长度与结构、来源可信度、用户反馈信号、
内容自证缺陷（hs 自检失败词 / 管线括注 / yanyu 伪中文机器句）。

另含内容清洗规则（题干汉字间空格、hs 管线元句、explanation 抓取源统计前缀/广告句），
供清洗脚本与 sanitize_hs / sanitize_explanation 共用。
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
# 汉字紧接的空格若充当结构分隔（「善良→美丽 第三步」「甲：乙当选 乙：丙当选」「④¬乙 第三步」），去掉会把
# 逻辑式/分句粘连；标点后的同类空格（「。 第二步」）仍可去。宁多留不误并（fail-closed）。
_STRUCT_AFTER_RE = re.compile(r"第[一二三四五六七八九十\d]+步|解法[一二三四\d]|拓展|综上|[甲乙丙丁戊己庚辛壬癸][：:]")
_LOGIC_BEFORE_RE = re.compile(r"[→←¬∧∨]-?[\u4e00-\u9fff]{1,4}$")
# explanation 抓取源残留：站点统计前缀「正确答案：B，全站正确率：24%，易错项：C。 解析 」
# （含「正确答案是 C 统计 全站数据: … / 解析 」旧格式、不带统计的「正确答案是 B 解析 」「正确答案：C第一步」，
# 与前缀后偶发的孤立选项字母），以及只剩「解析 」「解析：」标签的开头；正文以「第一步/解法」起头时标签可无分隔。
_EXP_STATS = (
    r"正确答案：[A-D]，全站正确率：\d+%，易错项：[A-D]。"
    r"|正确答案是 [A-D] 统计 全站数据:[^/\n]{0,80}/"
    r"|正确答案(?:是 |：)[A-D](?=\s|解析|第一步|解法)"
)
_EXP_LABEL = r"解析(?:[ \t\u3000]+|[：:][ \t\u3000]*|(?=第一步|解法))"
EXP_SRC_PREFIX_RE = re.compile(rf"^(?:(?:{_EXP_STATS})\s*(?:(?:[A-D]\s+)?{_EXP_LABEL})?|{_EXP_LABEL})")
# 抓取源广告句「,一个上岸考生分享经验和答疑的平台。」，多插在句间而非句尾
EXP_AD_TAIL_RE = re.compile(r"[,，]?一个上岸考生分享经验和答疑的平台。?")
# 空格是语义的词表：≥3 个 1–4 字词以单个空格相连（「郭斌 且 吴芳」「石油 汽油 煤油 柴油」
# 「考点 判断推理 定义判断」，以及公式缺失留下的「厘米 的圆柱体 平方厘米」）。命中则整条不做汉字间去空格，
# 交人工处理；PDF 逐字断开（「中 央 和 国 家」）全是单字，不算词表，照常归一。
_CJK_WORD_RUN_RE = re.compile(r"(?<![\u4e00-\u9fff])[\u4e00-\u9fff]{1,4}(?: [\u4e00-\u9fff]{1,4}){2,}(?![\u4e00-\u9fff])")

# 解析结论句的选项字母：只认结论式措辞（「故选 A」「因此，选择 A 选项」「正确答案为 A」「所以 A 项当选」），
# 「排除 A、B」「若选 A 则…」类中间句不入；字母后紧接字母（「故选 AB」）不入（多选结论不判）。
_CONCLUSION_LEAD = r"(?:故|因此|所以|因而|综上所述|综上|由此|据此|本题|此题|该题)"
_LETTER = r"[（(]?\s*([A-Da-d])\s*[）)]?(?![A-Za-z])"
ANSWER_CONCLUSION_RE = re.compile(
    rf"{_CONCLUSION_LEAD}[，,]?\s*(?:本题|答案)?\s*(?:应该选择|应该选|应选择|应选|选择|选)\s*[：:]?\s*{_LETTER}"
    rf"|(?:正确答案|本题答案|答案)\s*(?:应选择|应选|选择|选|应为|为|是|[：:])\s*[：:]?\s*{_LETTER}"
    rf"|{_CONCLUSION_LEAD}[，,]?\s*{_LETTER}\s*(?:项|选项)?\s*(?:当选|正确|符合题意|为正确答案|为答案)"
)
_SINGLE_ANSWER_RE = re.compile(r"^[A-D]$")

PENALTY_HS_SELFCHECK = 40
PENALTY_HS_PIPELINE_NOTE = 15
PENALTY_PSEUDO_ZH = 30
PENALTY_ANSWER_CONFLICT = 30


def hs_selfcheck_failed(hs: str) -> bool:
    return any(w in hs for w in HS_SELFCHECK_WORDS)


def pseudo_zh_hits(text: str) -> int:
    return len(PSEUDO_ZH_RE.findall(text or ""))


def _cjk_space_sub(m: re.Match) -> str:
    s = m.string
    if s[m.start() - 1] + s[m.end()] in _CJK_BLANK_PAIRS:  # 「（ ）」填空占位保留
        return m.group(0)
    if "\u4e00" <= s[m.start() - 1] <= "\u9fff" and (
        _STRUCT_AFTER_RE.match(s, m.end()) or _LOGIC_BEFORE_RE.search(s, max(0, m.start() - 6), m.start())
    ):
        return " "
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
    return _collapse_blank(hs)


def has_cjk_word_list(text: str) -> bool:
    """是否含以空格分隔的汉字词表（至少两个词 ≥2 字），此类空格是语义不可去。"""
    return any(sum(len(t) >= 2 for t in m.group().split(" ")) >= 2 for m in _CJK_WORD_RUN_RE.finditer(text))


def sanitize_explanation(text: str | None) -> str:
    """剥离抓取源统计前缀/「解析」标签与广告句，汉字间空格归一（数字、字母两侧空格保留；
    含空格分隔词表的整条不去空格），空白归一。"""
    e = (text or "").strip()
    if not e:
        return ""
    e = EXP_AD_TAIL_RE.sub("", e).lstrip()  # 广告句可在开头（其后才是「解析 」标签）
    while m := EXP_SRC_PREFIX_RE.match(e):  # 「解析 解析第一步…」双标签
        e = e[m.end():].lstrip()
    if not has_cjk_word_list(e):
        e = normalize_cjk_spaces(e)
    return _collapse_blank(e)


def _collapse_blank(text: str) -> str:
    text = re.sub(r"[ \t\u3000]+\n", "\n", text)
    text = re.sub(r"[ \t\u3000]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _parse_options(options) -> dict:
    if isinstance(options, dict):
        return options
    try:
        d = json.loads(options or "{}")
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


# ---- 解析/题干贴合度（解析串题 = 解析属于另一道题）----
# 口径：解析汉字 bigram 去掉解题套话后，落在本题题干+选项 bigram 里的比例。串题解析几乎不复用题干词，
# 贴合度 0.00–0.03；正常解析引用题干/选项词，通常 ≥0.08。只作分块取证的信号，不能单条自动改写。
_HAN_RE = re.compile(r"[\u4e00-\u9fff]")
_EXP_HEAD_RE = re.compile(r"^(?:解析|【解析】|-\d+-\s*解析)\s*")


def _bigrams(text: str | None) -> set[str]:
    s = "".join(_HAN_RE.findall(text or ""))
    return {s[i:i + 2] for i in range(len(s) - 1)}


EXP_FIT_STOP = _bigrams(
    "第一步第二步第三步本题考查因此选择选项正确错误答案解析题干分析根据可知所以故选排除符合不符合属于关系"
    "文段材料对应原文选是题选非题定义关键词提问方式"
)
EXP_FIT_MIN_GRAMS = 12
EXP_FIT_LOW = 0.03


def explanation_fit(row: dict) -> float | None:
    """解析对本题题干+选项的 bigram 贴合度；解析太短（去套话后 <EXP_FIT_MIN_GRAMS）返回 None。"""
    exp_grams = _bigrams(_EXP_HEAD_RE.sub("", row.get("explanation") or "")) - EXP_FIT_STOP
    if len(exp_grams) < EXP_FIT_MIN_GRAMS:
        return None
    own = _bigrams(question_text(row)) - EXP_FIT_STOP
    return len(exp_grams & own) / len(exp_grams)


def misaligned_blocks(
    rows: list[dict], min_rows: int = 4, max_gap: int = 3, low_ratio: float = 0.6, max_ok_run: int = 1
) -> list[dict]:
    """沿 id 找低贴合解析的连续段（解析数组整体错位的导入痕迹）：段内允许夹 ≤max_ok_run 行连续正常贴合
    （块内已人工修好的题），遇 id 间隔 >max_gap 或更长的正常段即断开；只报 ≥min_rows 且低贴合占比 ≥low_ratio 的段。
    rows 需按 id 升序且含 id/question/options/explanation；返回 [{lo, hi, rows, low, ratio}]。"""
    scored = [(r["id"], f) for r in rows if (f := explanation_fit(r)) is not None]
    blocks: list[dict] = []
    cur: list[tuple[int, float]] = []
    ok_run = 0

    def flush():
        while cur and cur[-1][1] >= EXP_FIT_LOW:  # 尾部正常行不属于段
            cur.pop()
        if len(cur) >= min_rows:
            low = sum(1 for _, f in cur if f < EXP_FIT_LOW)
            if low / len(cur) >= low_ratio:
                blocks.append({"lo": cur[0][0], "hi": cur[-1][0], "rows": len(cur), "low": low, "ratio": round(low / len(cur), 2)})
        cur.clear()

    for i, f in scored:
        is_low = f < EXP_FIT_LOW
        if cur and i - cur[-1][0] > max_gap:
            flush()
            ok_run = 0
        if is_low:
            cur.append((i, f))
            ok_run = 0
        elif cur:
            ok_run += 1
            if ok_run > max_ok_run:
                flush()
                ok_run = 0
            else:
                cur.append((i, f))
    flush()
    return blocks


# ---- 公式丢失解析（PDF 导入时公式/图片被整段抠掉，只剩「可得：，解得。」骨架）----
# 数量/资料模块：任一标点相撞信号即判定（生产 246 条命中逐条人工核过，仅 `。。` 单独出现是笔误）；
# 其他模块只认全角冒号后紧跟标点 / 连续顿号（`，，`/`。。` 在文字题里是笔误不是丢公式）。言语的「、、」是填空占位，不算。
QUANT_MODULES = ("shuliang", "ziliao")
_FD_COLON_RE = re.compile(r"：[。，、；]")
_FD_ENUM_RE = re.compile(r"、、|、，|，、|、。")
_FD_QUANT_RE = re.compile(r"，，|：。|：，|；。|(所求项|所求|括号内|未知项|下一项)(应)?(为|是)[。，；]")
# 「…为，」「解得。」「则有，」：数值/表达式位被抠空。排除 因为/认为/作为/成为… 等词尾的「为」，「可得，」是正常承接不算。
_FD_VALUE_RE = re.compile(r"(?<![因认以作称视成分改定选记行较更尤甚人])为[，。；]|(解得|则有|列式得|列式为|化简得|化简为|整理得|联立)[，。；]")
# 「解得 x＝。」「：＝21」「××＝576」「（1－）」「，。」：等号/运算符两侧或括号内表达式被抠空、公式位只剩相撞的句读。
# `+，`/`＝）` 不算（「11＋，」是余数记法、「(…=）107 万元」值在括号外），`。。` 单独出现是笔误（261638）不算。
_FD_OP_RE = re.compile(
    r"[＝=][，。；]|[，。；：（][＝=]|[×÷＋+－][×÷＝=]|[（(][^）)]{0,3}[×÷＋+－＝=][）)]|[，。；][，；]|[，；]。"
)
FOOTER_PAGE_RE = re.compile(r"\s*第\s*\d{1,3}\s*页\s*共\s*\d{1,3}\s*页\s*")
FOOTER_SRC_RE = re.compile(r"\s*-\s*\d{1,3}\s*-\s*\d{4}\s*年[^，。；：、《》]{0,14}(?:《[^》]{1,12}》)?真题(?:卷)?(?:（[^）]{0,20}）)?\s*")
# 试卷分节标题「二. 数量关系：在这部分试题中…」「第二部分言语理解与表达（共 40 题…）请开始答题：」串到上一题的
# 末选项/解析尾部（PDF 切题时把下一节标题并进了前一题），从标题起裁到字段/JSON 值末尾；可带 `~ 12 ~` 页码前缀。
FOOTER_SECTION_RE = re.compile(
    r"\s*(?:~\s*\d{1,3}\s*~\s*)?(?:第\s*[一二三四五六七八九十]\s*部分|[一二三四五六七八九十]\s*[.、．])\s*"
    r"(?:数量关系|言语理解与表达|言语理解|判断推理|资料分析|常识判断)[^\"]*(?=$|\")"
)


def formula_dropped(row: dict) -> str | None:
    """解析是否为「公式丢失」骨架；命中返回信号名，否则 None。row 需含 module/explanation。"""
    e = row.get("explanation") or ""
    if not e:
        return None
    if _FD_COLON_RE.search(e):
        return "colon"
    if _FD_ENUM_RE.search(e) and (row.get("module") or "") != "yanyu":
        return "enum"
    if (row.get("module") or "") in QUANT_MODULES:
        if _FD_QUANT_RE.search(e):
            return "quant"
        if _FD_VALUE_RE.search(e):
            return "value"
        if _FD_OP_RE.search(e):
            return "op"
    return None


def concluded_letter(text: str | None) -> str | None:
    """解析最后一处结论式措辞所选的字母（大写）；无结论句返回 None。"""
    last = None
    for m in ANSWER_CONCLUSION_RE.finditer(text or ""):
        last = next(g for g in m.groups() if g)
    return last.upper() if last else None


def answer_letter_conflict(row: dict) -> str | None:
    """单选题 explanation / hs_explanation 结论字母与 answer 不一致时返回解析结论字母，否则 None。
    多选（answer 多字母）/ 无结论句不判；只降分不下线，供 admin 排序人审。"""
    answer = (row.get("answer") or "").strip().upper()
    if not _SINGLE_ANSWER_RE.match(answer):
        return None
    for text in (row.get("explanation"), row.get("hs_explanation")):
        letter = concluded_letter(text)
        if letter and letter != answer:
            return letter
    return None


def strip_page_footers(text: str | None) -> str:
    """去掉 PDF 页脚「第 N 页共 M 页」/「-N- 20XX年…真题」及串到字段尾部的下一节标题「二. 数量关系：…」；无命中原样返回。"""
    if not text:
        return text or ""
    out = FOOTER_PAGE_RE.sub("", text)
    out = FOOTER_SRC_RE.sub("", out)
    out = FOOTER_SECTION_RE.sub("", out)
    return out.strip() if out != text else text


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
    if answer_letter_conflict(row):
        score -= PENALTY_ANSWER_CONFLICT

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
