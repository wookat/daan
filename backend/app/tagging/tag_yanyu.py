#!/usr/bin/env python3
"""言语理解模块三级考点规则打标脚本（人工+规则，不调用外部 LLM API）。

用法:
    python3 tag_yanyu.py [--in ../untagged_yanyu.jsonl] [--out ../tagged_yanyu.jsonl]

规则设计说明见 report_yanyu.md。
"""
import argparse
import collections
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- taxonomy: submodule -> 候选 group ----------
SUB2GROUP = {
    "逻辑填空": ["YY-LJ"],
    "中心理解": ["YY-ZX"],
    "意图判断": ["YY-ZX"],
    "片段阅读": ["YY-ZX"],
    "中心理解-意图判断": ["YY-ZX"],
    "细节理解": ["YY-XJ"],
    "词句理解": ["YY-XJ"],
    "语句表达": ["YY-JB"],
    "语句排序": ["YY-JB"],
    "语句填空": ["YY-JB"],
    "接语选择": ["YY-JB"],
    "标题填入": ["YY-BT"],
    "篇章阅读": ["YY-PZ"],
}
ALL_GROUPS = ["YY-LJ", "YY-ZX", "YY-XJ", "YY-JB", "YY-BT", "YY-PZ"]

GROUP_TOPICS = {
    "YY-LJ": ["YY-LJ-01", "YY-LJ-02", "YY-LJ-03", "YY-LJ-04"],
    "YY-ZX": ["YY-ZX-01", "YY-ZX-02", "YY-ZX-03", "YY-ZX-04", "YY-ZX-05"],
    "YY-XJ": ["YY-XJ-01", "YY-XJ-02", "YY-XJ-03"],
    "YY-JB": ["YY-JB-01", "YY-JB-02", "YY-JB-03", "YY-JB-04"],
    "YY-BT": ["YY-BT-01"],
    "YY-PZ": ["YY-PZ-01"],
}

BLANK_RE = re.compile(r"_{2,}|＿{2,}|（\s*）|\(\s*\)")
CJK = re.compile(r"^[\u4e00-\u9fff]+$")

CONNECTIVES = {
    "但是", "然而", "因此", "所以", "虽然", "而且", "并且", "如果", "即使",
    "尽管", "不过", "因为", "由于", "只要", "只有", "无论", "不仅", "反而",
    "何况", "况且", "否则", "从而", "进而", "于是", "可见", "既然",
}

RE_ORDER = re.compile(r"排列|排序|顺序")
RE_TITLE = re.compile(r"标题")
RE_NEXT = re.compile(r"接下来|接着|这是一篇文章的开头")
RE_SICK = re.compile(r"语病|歧义|表述有误|表达有误|用词不当|病句")
RE_WORDSENSE = re.compile(
    r"(画线|划线|横线|加点|文中).{0,14}(意思|含义|理解|指代|指的是|字是指)"
    r"|(意思|含义|理解|指代|指的是).{0,10}(画线|划线|加点)"
    r"|“[^”]{1,20}”(?:一词|一句)?.{0,6}(指的是|指代|的意思|的含义|理解|的寓意|来说明|的作用)"
    r"|(画线|划线|段首句).{0,10}的作用"
    r"|这句话的意思是"
    r"|“[^”]{1,20}”是指"
)
RE_FILL_SENT = re.compile(r"填入.{0,10}(画|划)横线.{0,10}最恰当的一句")
RE_FILL = re.compile(r"填入.{0,14}(横线|画线处|划线处|空格处|画线部分|划线部分)")
RE_YICI = re.compile(r"依次填入")
RE_INSERT_POS = re.compile(r"[\u2460-\u2469]\s*[与和]\s*[\u2460-\u2469]\s*之间")
RE_INTENT = re.compile(
    r"意在(说明|强调|表明|指出|阐明|论证|突出)|意在[：:？?]|意在$"
    r"|想要?(表达|说明|传递)|(作者|文段).{0,8}(意图|目的)"
    r"|的目的是|最可能想批评|想批评的是"
)
RE_MAIN = re.compile(
    r"主旨|主要(说明|讲述|谈论|介绍|阐述|强调|讨论|论述|说的是|观点|表达|内容|意思)"
    r"|概括|核心观点|核心理念|中心思想|中心议题|主题是|旨在|重在说明|得出的结论|主要支持|复述|中心|议题|着重强调"
    r"|强调(的是|了)|主要反映|主要批评|主要谈|表达了作者|想告诉我们|可用来回答|从文中数据来看"
    r"|提炼|最能概括|最合适的一项是文段|包含的道理|说明的道理|言外之意|反驳了哪种观点|主要是说明"
)
RE_KEYWORD = re.compile(r"提取的关键词|关键词")
RE_DETAIL_JUDGE = re.compile(
    r"说法(正确|不正确|错误)|(不)?符合(文意|原文|这段话|文段)|(理解|表述)(正确|不正确|有误|错误)"
    r"|(可以|能够|无法|不能)(得知|得出|推出|推断|推知|看出|了解|确定|解释)|(意思|文字|内容|陈述)?(相符|不符)"
    r"|未涉及|不包括|无关的一项|符合规定|正确的一项|错误的一项"
    r"|说法.{0,3}(正确|不正确|错误|有误)|理解.{0,3}(准确|正确|不正确|有误|错误)"
    r"|没有(提到|提及|涉及)|未(提到|提及)|不能从原文|可以确定的是|符合文义的|最符合作者的观点"
    r"|(不)?一致的是|可以?知(道)?[：:？]?|可知$"
)
RE_DETAIL_FIND = re.compile(
    r"(下列|以下).{0,10}属于|属于文中|文中(提到|列举|所说)的"
    r"|哪一?种(形态|类型|方法|情况)|原因主要是|根本原因是|之所以.{0,10}是因为|不是因为|可以作为.{0,16}证据"
    r"|根据(文意|材料|上述|这段).{0,30}(是因为|依据|最接近)"
)

# 中心理解结构判定：从解析中找行文结构特征词
# strong = 结构特征词与“重点/主旨/引出”同现，weak = 仅出现结构特征词
RE_TURN_STRONG = re.compile(
    r"转折(词|关联词|关系)?[^。]{0,30}(重点|主旨|引出|强调)"
    r"|(重点|主旨)[^。]{0,20}转折"
)
RE_SOLUTION_STRONG = re.compile(
    r"(对策|解决问题|提出解决)[^。]{0,30}(重点|主旨|强调|引出)"
    r"|(重点|主旨)[^。]{0,20}(对策|解决)"
    r"|对策标志词|并提对策|给出(了)?对策|提出对策"
)
RE_CAUSE_STRONG = re.compile(
    r"因果(结构|关系)"
    r"|(重点|主旨)[^。]{0,10}“?因此”?"
    r"|通过“?(因此|所以|可见)”?[^。]{0,20}(总结|结论|得出)"
    r"|以“?(因此|所以)”?引导|结论(句)?(是|为)重点"
)
RE_EXP_TURN = re.compile(r"转折(关系|之后|词)|转折后")
RE_EXP_SOLUTION = re.compile(r"对策|提出解决|应该怎么做|呼吁")
RE_EXP_CAUSE = re.compile(r"因果(关系|结构)|通过“?(因此|所以)”?(引导|之后|得出|总结)")
# 解析里“选项辨析”部分常顺带提到对策/因果，会污染结构判定，故只取解析的行文分析段
RE_EXP_TAIL = re.compile(
    r"第二步|对比选项|辨析选项|【?拓展|故正确答案|因此，选择|故选|当选"
    r"|[A-D]\s*项[，,“]|故本题|【文段出处】"
)


def exp_head(exp):
    m = RE_EXP_TAIL.search(exp)
    return exp[:m.start()] if m else exp


RE_EXP_STRUCT = re.compile(r"总分(结构|关系)?|分总(结构|关系)?|总分总|主题词|并列(结构|关系)|首句(是|为)?(中心|主旨|观点)|尾句")


def opt_values(options):
    if not options:
        return []
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except Exception:
            return []
    if isinstance(options, dict):
        return [str(v) for v in options.values()]
    if isinstance(options, list):
        return [str(v) for v in options]
    return []


def split_words(opts):
    """逻辑填空选项通常是 顿号/空格 分隔的多个词。返回词列表的列表。"""
    out = []
    for o in opts:
        words = re.split(r"[、，,；;\s]+", o.strip())
        out.append([w for w in words if w])
    return out


def is_perm_options(ov):
    """选项均为 ①②③… 序号排列（语句排序题）。"""
    if len(ov) < 2:
        return False
    for o in ov:
        s = o.strip()
        if len(s) < 3 or not all('\u2460' <= ch <= '\u2473' or ch in '-—' for ch in s):
            return False
    return True


def classify(q, opts, exp, allowed):
    """返回 (code, confidence, reason)。allowed 是候选 topic code 集合。"""
    text = q or ""
    exp = exp or ""
    head = exp_head(exp)
    stem = text[-80:]  # 提问句式一般在末尾
    ov = opt_values(opts)

    def ok(code, conf, reason):
        if code in allowed:
            return code, conf, reason
        return None

    # --- 强句式规则（按互斥性排序） ---
    # 语句排序：选项均为序号排列，或题干含 ①②③ 且问排列顺序
    if is_perm_options(ov):
        r = ok("YY-JB-01", 0.95, "选项为序号排列")
        if r:
            return r
    if RE_INSERT_POS.search(" ".join(ov)):
        r = ok("YY-JB-02", 0.8, "句子放回原文位置")
        if r:
            return r
    if RE_ORDER.search(stem) and ("①" in text or re.search(r"排列.{0,6}(最)?(恰当|合理|准确)", stem)):
        r = ok("YY-JB-01", 0.95, "排序句式")
        if r:
            return r
    if RE_TITLE.search(stem):
        r = ok("YY-BT-01", 0.95, "标题句式")
        if r:
            return r
    if RE_NEXT.search(stem) and re.search(r"讲述|论述|介绍|说明|谈论|讲的|讨论|阐述", stem):
        r = ok("YY-JB-03", 0.95, "接语句式")
        if r:
            return r
    if RE_SICK.search(stem) or RE_SICK.search(text[:60]):
        r = ok("YY-JB-04", 0.9, "病句/歧义句式")
        if r:
            return r
    if allowed <= {"YY-JB-01", "YY-JB-02", "YY-JB-03", "YY-JB-04"} and re.search(r"语病|病句|歧义|语义重复", exp[:120]):
        r = ok("YY-JB-04", 0.7, "语句表达组内解析提示病句")
        if r:
            return r
    if RE_WORDSENSE.search(stem) and not RE_FILL.search(stem):
        r = ok("YY-XJ-03", 0.9, "词句理解句式")
        if r:
            return r

    # --- 填空类：逻辑填空 vs 语句填空 ---
    n_blank = len(BLANK_RE.findall(text))
    if RE_FILL.search(stem) or RE_YICI.search(stem) or n_blank > 0:
        word_opts = split_words(ov)
        avg_len = sum(len(o) for o in ov) / len(ov) if ov else 0
        max_words = max((len(w) for w in word_opts), default=1)
        # 语句填空：选项是完整句子（明确"最恰当的一句"，或选项很长）
        if RE_FILL_SENT.search(stem) or (avg_len >= 12 and max_words <= 2 and not RE_YICI.search(stem)):
            r = ok("YY-JB-02", 0.9, "语句填空句式")
            if r:
                return r
        if "YY-LJ-01" in allowed or "YY-LJ-02" in allowed:
            # 逻辑填空：多空 or 单空
            if n_blank >= 2 or max_words >= 2:
                r = ok("YY-LJ-04", 0.9, "多空综合")
                if r:
                    return r
            flat = [w for ws in word_opts for w in ws]
            if flat and all(w in CONNECTIVES for w in flat):
                r = ok("YY-LJ-03", 0.85, "选项为关联词")
                if r:
                    return r
            if flat and all(len(w) == 4 and CJK.match(w) for w in flat):
                r = ok("YY-LJ-02", 0.9, "单空且选项均为四字成语")
                if r:
                    return r
            if flat and all(1 <= len(w) <= 6 and CJK.match(w) for w in flat):
                if sum(1 for w in flat if len(w) == 4) * 2 >= len(flat):
                    r = ok("YY-LJ-02", 0.75, "单空且选项多数为四字成语")
                    if r:
                        return r
                r = ok("YY-LJ-01", 0.85, "单空且选项为实词")
                if r:
                    return r
        # 单空但选项为短句/短语（非词语）：语境呼应类填空
        r = ok("YY-JB-02", 0.75, "单空且选项为句子/短语")
        if r:
            return r
        r = ok("YY-LJ-03", 0.6, "逻辑填空下的语境对应(选项为短语)")
        if r:
            return r

    # --- 意图判断 ---
    if RE_INTENT.search(stem):
        r = ok("YY-ZX-05", 0.9, "意图判断句式")
        if r:
            return r

    # --- 选项为词语列表且题干有空：逻辑填空（早于主旨类兜底） ---
    if n_blank > 0 and {"YY-LJ-01", "YY-LJ-02"} & allowed:
        word_opts0 = split_words(ov)
        flat0 = [w for ws in word_opts0 for w in ws]
        if flat0 and all(CJK.match(w) and len(w) <= 6 for w in flat0):
            if max((len(w) for w in word_opts0), default=1) >= 2:
                r = ok("YY-LJ-04", 0.8, "有空且选项为多词组合")
            elif all(len(w) == 4 for w in flat0):
                r = ok("YY-LJ-02", 0.8, "有空且选项均为四字成语")
            else:
                r = ok("YY-LJ-01", 0.75, "有空且选项为实词")
            if r:
                return r

    # --- 主题词/关键词 ---
    if RE_KEYWORD.search(stem):
        r = ok("YY-ZX-04", 0.85, "关键词提取句式")
        if r:
            return r

    # --- 主旨/中心理解：按解析中的结构特征细分 ---
    if RE_MAIN.search(stem):
        for regex, code, reason in (
            (RE_SOLUTION_STRONG, "YY-ZX-03", "主旨+解析对策结构(强)"),
            (RE_TURN_STRONG, "YY-ZX-01", "主旨+解析转折结构(强)"),
            (RE_CAUSE_STRONG, "YY-ZX-02", "主旨+解析因果结构(强)"),
            (RE_EXP_SOLUTION, "YY-ZX-03", "主旨+解析对策特征"),
            (RE_EXP_TURN, "YY-ZX-01", "主旨+解析转折特征"),
            (RE_EXP_CAUSE, "YY-ZX-02", "主旨+解析因果特征"),
        ):
            if regex.search(head):
                r = ok(code, 0.8 if "强" in reason else 0.7, reason)
                if r:
                    return r
        r = ok("YY-ZX-04", 0.7, "主旨类默认主题词/行文脉络")
        if r:
            return r

    # --- 细节理解 ---
    if RE_DETAIL_JUDGE.search(stem):
        r = ok("YY-XJ-01", 0.85, "细节判断句式")
        if r:
            return r
    if RE_DETAIL_FIND.search(stem):
        r = ok("YY-XJ-02", 0.75, "细节查找句式")
        if r:
            return r

    # --- 二次机会：意图/主旨结构规则也适用于无明显主旨提问但解析给出结构的 ZX 组题 ---
    if {"YY-ZX-01", "YY-ZX-05"} & allowed:
        if RE_INTENT.search(exp[:60]):
            r = ok("YY-ZX-05", 0.7, "解析开头提示意图判断")
            if r:
                return r
        for regex, code in ((RE_SOLUTION_STRONG, "YY-ZX-03"), (RE_TURN_STRONG, "YY-ZX-01"),
                            (RE_CAUSE_STRONG, "YY-ZX-02"), (RE_EXP_SOLUTION, "YY-ZX-03"),
                            (RE_EXP_TURN, "YY-ZX-01"), (RE_EXP_CAUSE, "YY-ZX-02")):
            if regex.search(head):
                r = ok(code, 0.65, "解析结构特征(无标准提问句式)")
                if r:
                    return r
        if RE_EXP_STRUCT.search(exp):
            r = ok("YY-ZX-04", 0.6, "解析总分/主题词特征")
            if r:
                return r

    # --- 无提问句式但选项为词语列表：逻辑填空弱兜底 ---
    word_opts = split_words(ov)
    flat = [w for ws in word_opts for w in ws]
    if flat and all(CJK.match(w) and len(w) <= 4 for w in flat):
        max_words = max((len(w) for w in word_opts), default=1)
        if max_words >= 2:
            r = ok("YY-LJ-04", 0.7, "选项为多词组合(疑似多空)")
            if r:
                return r
        if all(len(w) == 4 for w in flat):
            r = ok("YY-LJ-02", 0.6, "选项为四字成语(无标准提问句式)")
            if r:
                return r

    # --- 单考点组兜底（组内只有一个考点，允许直接映射） ---
    single = [c for c in allowed if c in ("YY-BT-01", "YY-PZ-01")]
    if len(allowed) == 1:
        return next(iter(allowed)), 0.85, "submodule 组内唯一考点"
    if single and len(allowed) == len(single):
        return single[0], 0.85, "候选仅单考点组"

    return "UNKNOWN", 0.0, "无规则命中"


def allowed_codes(submodule):
    groups = SUB2GROUP.get((submodule or "").strip())
    if not groups:
        groups = ALL_GROUPS
    codes = set()
    for g in groups:
        codes.update(GROUP_TOPICS[g])
    return codes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=os.path.join(HERE, "..", "untagged_yanyu.jsonl"))
    ap.add_argument("--out", dest="out", default=os.path.join(HERE, "..", "tagged_yanyu.jsonl"))
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    dist = collections.Counter()
    reasons = collections.Counter()
    with open(args.inp, encoding="utf-8") as f, open(args.out, "w", encoding="utf-8") as w:
        for line in f:
            d = json.loads(line)
            code, conf, reason = classify(
                d.get("question"), d.get("options"), d.get("explanation"),
                allowed_codes(d.get("submodule")))
            dist[code] += 1
            reasons[reason] += 1
            w.write(json.dumps({
                "id": d["id"], "tag3": code, "confidence": round(conf, 2),
                "method": "rule",
            }, ensure_ascii=False) + "\n")

    total = sum(dist.values())
    print(f"total={total} unknown={dist['UNKNOWN']} ({dist['UNKNOWN']/total:.1%})")
    for k, v in dist.most_common():
        print(f"{k}\t{v}\t{v/total:.1%}")
    print("--- reasons ---")
    for k, v in reasons.most_common():
        print(f"{k}\t{v}")


if __name__ == "__main__":
    main()
