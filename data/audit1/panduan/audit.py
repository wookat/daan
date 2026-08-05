#!/usr/bin/env python3
"""判断推理模块全量质检流水线：机检规则族 → 高风险清单 → 人工判定合并 → 台账/SQL/报告。

用法：
  python3 audit.py machine   # 跑机检规则族 + 重复检测，输出 machine.jsonl 与高风险清单
  python3 audit.py finalize  # 合并 manual_overrides.jsonl，生成 ledger.jsonl / fixes.sql / delist.sql
"""
import json
import re
import sys
import collections
import hashlib
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = "/tmp/audit_panduan.jsonl"
TAXONOMY = os.path.join(HERE, "../../../backend/app/data/taxonomy.json")

VALID_TAG3 = set()
TAG_GROUP = {}


def load_taxonomy():
    with open(TAXONOMY, encoding="utf-8") as f:
        t = json.load(f)
    for m in t["modules"]:
        for g in m["groups"]:
            for tp in g["topics"]:
                VALID_TAG3.add(tp["code"])
                TAG_GROUP[tp["code"]] = (m["key"], g["code"], g["name"])


SUB2GROUP = {
    "图形推理": "PD-TX",
    "定义判断": "PD-DY",
    "类比推理": "PD-LB",
    "逻辑判断": "PD-LJ",
    "逻辑推理": "PD-LJ",
    "分析推理": "PD-FX",
    "翻译推理": "PD-LJ",
    "加强论证": "PD-LJ",
    "削弱论证": "PD-LJ",
    "真假推理": "PD-LJ",
}

IMG_REF = re.compile(r"如[上下左右]图|如图所示|下列图形|所给(的)?[四五]?个?图形|上边?[四五]个图|左边.{0,4}图形|右边.{0,4}图形|展开图|折叠成|折成|纸盒|三视图|填入问号处|呈现的规律|阴影部分")
ANS_LEAK = re.compile(r"^（[^）]{2,20}）\s*([A-D])\s")
PAGE_ART = re.compile(r"第\s*\d+\s*[页⻚]，?\s*共\s*\d+\s*[页⻚]|【杨柳（微信[：:]?gwy[^】]*】?")
AD_TEXT = re.compile(r"获取试卷更新[，,]?请关注公众号[：:][\w（）()一-鿿]*|公众号[：:]gwyeasy[^。]*。?|-\d+- ")

# 解析中声明的答案
EXP_ANS = [
    re.compile(r"故?正确?答案[为是选：:]\s*([A-D])"),
    re.compile(r"故本题?选\s*([A-D])"),
    re.compile(r"故选\s*([A-D])"),
    re.compile(r"因此[，,]?选择?\s*([A-D])"),
    re.compile(r"答案[为是：:]\s*([A-D])"),
    re.compile(r"本题选\s*([A-D])"),
    re.compile(r"选\s*([A-D])\s*[。．]?\s*$"),
]

# tag3 关键词启发（仅生成候选，人工确认）
KW_RULES = [
    ("PD-LJ-01", re.compile(r"如果.{1,40}(那么|则|就)|只有.{1,40}才|翻译推理|除非|→|⇒|前推后|后推前|逆否")),
    ("PD-LJ-02", re.compile(r"(只有一[人个句].{0,6}(真|假))|([两二三四]人.{0,20}(说真话|说假话))|(真话|假话).{0,20}(一句|一人)|矛盾关系.{0,10}必有一真")),
    ("PD-LJ-07", re.compile(r"(前提|假设)是?[：:？]?|必须假设|隐含的?前提|补充.{0,6}前提")),
    ("PD-LJ-06", re.compile(r"最能(削弱|质疑|反驳)|削弱上述|削弱该|构成质疑")),
    ("PD-LJ-05", re.compile(r"最能(支持|加强|证明)|加强上述|支持上述结论")),
    ("PD-LJ-04", re.compile(r"最能解释|如何解释|解释.{0,12}(现象|矛盾)")),
    ("PD-LJ-03", re.compile(r"(可以|能够|据此可)推出|推不出|必然为真|一定为真|不能推出")),
    ("PD-FX-01", re.compile(r"(甲|乙|丙|丁).{0,60}(分别|各自|对应).{0,30}(是|来自|职业|从事)")),
    ("PD-FX-02", re.compile(r"(名次|排名|排序|从左到右|依次坐|座位|排在第)")),
]

MATH_KW = re.compile(r"(列?方程|多少种(不同的)?(方法|排法|组合|方案|选法)|概率是多少|至少.{0,12}才能保证|等差数列|等比数列|需要?多少(天|小时|元|个|次|米)|共有?多少|利润率|浓度为?\d|行驶?速度为\d|周长是?多少|面积是?多少)")
YANYU_KW = re.compile(r"(这段文字(主要|意在|说明)|概括最准确|行文逻辑|衔接最恰当|①②.{0,60}(排列顺序|顺序最合理|语序))")


def norm_text(s):
    s = re.sub(r"\s+", "", s or "")
    s = re.sub(r"[，。、；：“”‘’？！（）()\[\]【】\-—…·,.;:!?\"']", "", s)
    return s


def parse_options(raw):
    try:
        o = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(o, dict):
            return o
    except Exception:
        pass
    return None


FX_KW = re.compile(r"(名次|排名|排序|从左到右|依次坐|座位|排在第|值班|住.{0,3}层|身高.{0,6}(高|矮)|分别(是|来自|从事|住在))")


def infer_group(q, opts, sub, exp):
    """基于题面内容的强信号题型组推断（仅强信号，避免误报）。"""
    text = (q or "")
    short = len(norm_text(text)) < 40
    if "∶" in text[:40] and short:
        return "PD-LB"
    if re.search(r"与下列哪组词语逻辑关系|逻辑关系最为?相[近似]|之于.{0,14}相当于", text):
        return "PD-LB"
    if re.search(r"根据(上述|以上)定义", text):
        return "PD-DY"
    if IMG_REF.search(text) and opts and all(len(str(v).strip()) <= 2 for v in opts.values()):
        return "PD-TX"
    return None


def exp_answer(exp):
    for pat in EXP_ANS:
        m = pat.search(exp or "")
        if m:
            return m.group(1)
    return None


def kw_tag(text):
    for code, pat in KW_RULES:
        if pat.search(text):
            return code
    return None


def shingles(s, k=6):
    return {s[i:i + k] for i in range(max(1, len(s) - k + 1))}


def minhash_bands(s, num=32, bands=8):
    sh = shingles(s)
    if not sh:
        return []
    hs = []
    for i in range(num):
        hs.append(min(int(hashlib.md5((str(i) + x).encode()).hexdigest()[:8], 16) for x in sh))
    r = num // bands
    return [tuple(hs[b * r:(b + 1) * r]) for b in range(bands)]


def jaccard(a, b):
    sa, sb = shingles(a), shingles(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def machine():
    load_taxonomy()
    rows = [json.loads(l) for l in open(DATA, encoding="utf-8")]
    out = []
    # ---- 重复检测 ----
    byid = {r["id"]: r for r in rows}
    exact = collections.defaultdict(list)
    for r in rows:
        key = norm_text(r["question"]) + "|" + norm_text(str(r.get("options")))
        exact[hashlib.md5(key.encode()).hexdigest()].append(r["id"])
    dup_of = {}
    for ids in exact.values():
        ids.sort()
        for i in ids[1:]:
            dup_of[i] = ids[0]
    # 近重复：LSH on 题干
    buckets = collections.defaultdict(list)
    for r in rows:
        if r["id"] in dup_of:
            continue
        nt = norm_text(r["question"])
        for band in minhash_bands(nt):
            buckets[band].append(r["id"])
    near_pairs = set()
    for ids in buckets.values():
        if 1 < len(ids) <= 50:
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    a, b = min(ids[i], ids[j]), max(ids[i], ids[j])
                    near_pairs.add((a, b))
    near_dup = {}
    for a, b in sorted(near_pairs):
        if b in dup_of or b in near_dup:
            continue
        ra, rb = byid[a], byid[b]
        ja = jaccard(norm_text(ra["question"]), norm_text(rb["question"]))
        if ja >= 0.85:
            # 选项也要基本一致才算重复候选
            jo = jaccard(norm_text(str(ra.get("options"))), norm_text(str(rb.get("options"))))
            if jo >= 0.7:
                root = dup_of.get(a, a)
                near_dup[b] = {"dup_of": root, "sim_q": round(ja, 3), "sim_o": round(jo, 3)}
    # ---- 逐题机检 ----
    for r in rows:
        issues = []
        risk = []
        q = r.get("question") or ""
        exp = r.get("explanation") or ""
        ans = (r.get("answer") or "").strip().upper()
        opts = parse_options(r.get("options"))
        sub = r.get("submodule")
        tag3 = r.get("tag3")

        # 题干泄露答案字母（导入解析错位）
        if ANS_LEAK.search(q):
            issues.append("stem_answer_leak")
            risk.append("leak")
        if AD_TEXT.search(exp):
            issues.append("explanation_ad_text")
        if AD_TEXT.search(q) or PAGE_ART.search(q):
            issues.append("stem_ad_or_page_artifact")
        if re.match(r"^[，。；）”、]|^[a-z项]", exp.strip()[:1]) and exp.strip():
            issues.append("explanation_truncated_head")
            risk.append("exp_trunc")
        # 1/3 选项完整
        if not opts:
            issues.append("options_unparseable")
        else:
            keys = sorted(opts.keys())
            if keys != ["A", "B", "C", "D"]:
                issues.append(f"options_keys:{','.join(keys)}")
            empt = [k for k, v in opts.items() if not str(v).strip()]
            if empt:
                issues.append("options_empty:" + ",".join(empt))
            vals = [norm_text(str(v)) for v in opts.values() if str(v).strip()]
            if len(vals) != len(set(vals)):
                issues.append("options_duplicate_text")
        # 答案有效
        if ans not in ("A", "B", "C", "D"):
            issues.append(f"answer_invalid:{ans!r}")
        elif opts and ans not in opts:
            issues.append("answer_not_in_options")
        # 2 解析一致性
        ea = exp_answer(exp)
        if not exp.strip():
            issues.append("explanation_missing")
        elif ea and ans in "ABCD" and ea != ans:
            issues.append(f"exp_answer_mismatch:{ea}")
            risk.append("mismatch")
        elif len(exp.strip()) < 15:
            issues.append("explanation_too_short")
        # 4 题干完整 / 图形
        is_lb = (sub == "类比推理") or (tag3 or "").startswith("PD-LB") or "∶" in q
        if len(q.strip()) < 12 and not is_lb:
            issues.append("stem_too_short")
        elif not q.strip():
            issues.append("stem_too_short")
        if "�" in q or "�" in exp or "�" in str(r.get("options")):
            issues.append("mojibake")
        img = r.get("image")
        is_tx = (sub == "图形推理") or (tag3 or "").startswith("PD-TX")
        refs_img = bool(IMG_REF.search(q)) and not re.search(r"上图入库|采集上图|线上图书", q)
        if (is_tx or refs_img) and not img:
            issues.append("image_missing")
            risk.append("noimage")
        if img and not str(img).strip():
            issues.append("image_empty")
        # 5 tag3
        sug = None
        if tag3 not in VALID_TAG3:
            issues.append(f"tag3_invalid:{tag3}")
            risk.append("tag3")
        else:
            grp = TAG_GROUP[tag3][1]
            exp_grp = infer_group(q, opts, sub, exp)
            if exp_grp and grp != exp_grp:
                issues.append(f"tag3_group_mismatch:{grp}->{exp_grp}")
                risk.append("tag3")
        # 关键词建议（组内细分错放）
        if (tag3 or "").startswith("PD-LJ") or tag3 in (None, "UNKNOWN") or "tag3_invalid" in str(issues):
            k = kw_tag(q)
            if k and k != tag3:
                sug = k
        # 跨模块错放
        if MATH_KW.search(q) and not re.search(r"定义|推理|论证", q[:30]):
            issues.append("crossmodule_math_suspect")
            risk.append("xmod")
        if YANYU_KW.search(q):
            issues.append("crossmodule_yanyu_suspect")
            risk.append("xmod")
        # 重复
        d = None
        if r["id"] in dup_of:
            d = dup_of[r["id"]]
            issues.append("exact_duplicate")
        elif r["id"] in near_dup:
            d = near_dup[r["id"]]["dup_of"]
            issues.append(f"near_duplicate:{near_dup[r['id']]['sim_q']}")
            risk.append("neardup")
        out.append({
            "id": r["id"], "submodule": sub, "tag3": tag3, "issues": issues,
            "risk": risk, "dup_of": d, "tag3_suggest": sug,
            "is_real": r.get("is_real"), "has_image": bool(img),
        })
    with open(os.path.join(HERE, "machine.jsonl"), "w", encoding="utf-8") as f:
        for o in out:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")
    # 高风险清单
    stats = collections.Counter()
    for o in out:
        for i in o["issues"]:
            stats[i.split(":")[0]] += 1
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    print("clean:", sum(1 for o in out if not o["issues"]))


SCORE_DEDUCT = {
    "options_unparseable": 60, "options_keys": 30, "options_empty": 40,
    "options_duplicate_text": 25, "answer_invalid": 60, "answer_not_in_options": 60,
    "explanation_missing": 25, "exp_answer_mismatch": 50, "explanation_too_short": 10,
    "stem_too_short": 30, "mojibake": 20, "image_missing": 60, "image_empty": 30,
    "tag3_invalid": 15, "tag3_group_mismatch": 12, "crossmodule_math_suspect": 15,
    "crossmodule_yanyu_suspect": 15, "exact_duplicate": 40, "near_duplicate": 25,
    "answer_wrong": 70, "explanation_wrong": 40, "unanswerable": 70,
    "stem_answer_leak": 35, "explanation_ad_text": 10, "explanation_truncated_head": 15,
    "stem_ad_or_page_artifact": 15, "explanation_offtopic": 55, "crossmodule_keji": 20,
    "needs_module_move": 0,
}


def finalize():
    machine_rows = [json.loads(l) for l in open(os.path.join(HERE, "machine.jsonl"), encoding="utf-8")]
    overrides = {}
    op = os.path.join(HERE, "manual_overrides.jsonl")
    if os.path.exists(op):
        for l in open(op, encoding="utf-8"):
            o = json.loads(l)
            overrides[o["id"]] = o
    ledger = []
    fixes = []
    delist = []
    for m in machine_rows:
        o = overrides.get(m["id"], {})
        issues = o.get("issues", m["issues"])
        method = o.get("method", "machine+rule-family-manual-validation")
        verdict = o.get("verdict")
        tag3 = o.get("tag3", m["tag3"])  # 机器建议仅供人工确认，不自动应用
        dup_of = o.get("dup_of", m["dup_of"])
        score = 100
        for i in issues:
            score -= SCORE_DEDUCT.get(i.split(":")[0], 10)
        score = max(0, min(100, score))
        if verdict is None:
            hard = {"image_missing", "answer_invalid", "answer_not_in_options",
                    "options_unparseable", "options_empty", "stem_too_short",
                    "exact_duplicate", "near_duplicate", "answer_wrong", "unanswerable"}
            heads = {i.split(":")[0] for i in issues}
            if heads & hard:
                verdict = "delist"
            elif heads:
                verdict = "fix"
            else:
                verdict = "ok"
        ledger.append({"id": m["id"], "verdict": verdict, "score": score,
                       "tag3": tag3, "dup_of": dup_of, "issues": issues, "method": method})
        if verdict == "delist":
            delist.append(m["id"])
        else:
            if tag3 != m["tag3"]:
                fixes.append(f"UPDATE questions SET tag3='{tag3}' WHERE id={m['id']};")
            if "fix_sql" in o:
                fixes.extend(o["fix_sql"])
    with open(os.path.join(HERE, "ledger.jsonl"), "w", encoding="utf-8") as f:
        for l in ledger:
            f.write(json.dumps(l, ensure_ascii=False) + "\n")
    with open(os.path.join(HERE, "fixes.sql"), "w", encoding="utf-8") as f:
        f.write("-- 判断推理模块质检修复（tag3 改标等）\nBEGIN TRANSACTION;\n")
        f.write("\n".join(fixes))
        f.write("\nCOMMIT;\n")
    with open(os.path.join(HERE, "delist.sql"), "w", encoding="utf-8") as f:
        f.write("-- 判断推理模块下架（不可作答/重复/损坏）\nBEGIN TRANSACTION;\n")
        for chunk in range(0, len(delist), 200):
            ids = ",".join(map(str, delist[chunk:chunk + 200]))
            f.write(f"UPDATE questions SET disabled=1 WHERE id IN ({ids});\n")
        f.write("COMMIT;\n")
    c = collections.Counter(l["verdict"] for l in ledger)
    print("verdicts:", dict(c), "fixes:", len(fixes), "delist:", len(delist))


if __name__ == "__main__":
    {"machine": machine, "finalize": finalize}[sys.argv[1]]()
