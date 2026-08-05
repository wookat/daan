"""机检规则：对 28,655 道言语题逐题跑一致性校验，输出 mc_results.jsonl。"""
import json, re, collections

VALID_TAGS = {
    "YY-LJ-01","YY-LJ-02","YY-LJ-03","YY-LJ-04",
    "YY-ZX-01","YY-ZX-02","YY-ZX-03","YY-ZX-04","YY-ZX-05",
    "YY-XJ-01","YY-XJ-02","YY-XJ-03",
    "YY-JB-01","YY-JB-02","YY-JB-03","YY-JB-04",
    "YY-BT-01","YY-PZ-01",
}
GROUP_OF_SUB = {
    "逻辑填空":"YY-LJ", "中心理解":"YY-ZX", "意图判断":"YY-ZX", "片段阅读":"YY-ZX",
    "细节理解":"YY-XJ", "词句理解":"YY-XJ",
    "语句表达":"YY-JB", "语句排序":"YY-JB", "语句填空":"YY-JB", "接语选择":"YY-JB",
    "标题填入":"YY-BT", "篇章阅读":"YY-PZ",
}
BLANK_RE = re.compile(r"_{2,}|＿{2,}|（\s*）|\(\s*\)|【\s*】|□{2,}|[ \u3000\u00A0\u2002\u2003]{3,}")
EXPL_LEAK_RE = re.compile(r"故.{0,3}选[ABCD]|本题.{0,4}答案|正确答案|解析[:：]|排除[ABCD]|[ABCD]项?当选")
ANS_IN_EXPL = [
    re.compile(r"(?:故|因此|所以)[^ABCD]{0,12}选(?:择)?\s*([ABCD])"),
    re.compile(r"答案(?:为|是|选)\s*([ABCD])"),
    re.compile(r"锁定\s*([ABCD])"),
    re.compile(r"([ABCD])\s*(?:项|选项)?当选"),
    re.compile(r"对应\s*([ABCD])\s*项?[。．]?\s*$"),
    re.compile(r"选\s*([ABCD])\s*[。．]?\s*$"),
]

def extract_claimed(expl: str):
    if not expl:
        return None
    got = []
    for pat in ANS_IN_EXPL:
        got += pat.findall(expl)
    return got[-1] if got else None

def check(r):
    issues = []
    q = (r.get("question") or "").strip()
    expl = (r.get("explanation") or "").strip()
    ans = (r.get("answer") or "").strip()
    tag3 = r.get("tag3")
    sub = (r.get("submodule") or "").strip() or None
    try:
        opts = json.loads(r.get("options") or "{}")
        assert isinstance(opts, dict)
    except Exception:
        opts = None
        issues.append("OPT_UNPARSEABLE")
    if opts is not None:
        keys = sorted(opts.keys())
        if keys != ["A","B","C","D"]:
            issues.append(f"OPT_KEYS:{','.join(keys)}")
        vals = [str(v).strip() for v in opts.values()]
        if any(not v for v in vals):
            issues.append("OPT_EMPTY")
        if len(set(vals)) < len(vals):
            issues.append("OPT_DUP_VALUE")
        for v in vals:
            if EXPL_LEAK_RE.search(str(v)):
                issues.append("OPT_EXPL_LEAK"); break
        for v in vals:
            if len(str(v)) > 120:
                issues.append("OPT_OVERLONG"); break
    if ans not in ("A","B","C","D"):
        issues.append(f"ANS_INVALID:{ans!r}")
    elif opts and ans not in opts:
        issues.append("ANS_NOT_IN_OPTS")
    # 题干完整性
    if len(q) < 10:
        issues.append("STEM_TOO_SHORT")
    is_cloze = sub == "逻辑填空" or (r.get("question_type") or "").endswith(("填空",)) and "语句填空" not in (r.get("question_type") or "")
    qt = r.get("question_type") or ""
    cloze_like = sub == "逻辑填空" or qt in ("言语理解-逻辑填空","言语理解-实词填空","言语理解-成语填空","言语理解-混搭填空")
    if cloze_like and not BLANK_RE.search(q):
        issues.append("STEM_NO_BLANK")
    if cloze_like and BLANK_RE.search(q):
        nb = len(BLANK_RE.findall(q))
        if opts:
            n_parts = [len(re.split(r"[\s;；、]+", str(v).strip())) for v in opts.values()]
            if len(set(n_parts)) == 1 and n_parts[0] != nb and n_parts[0] > 1:
                issues.append(f"BLANK_COUNT_MISMATCH:{nb}vs{n_parts[0]}")
    if EXPL_LEAK_RE.search(q):
        issues.append("STEM_EXPL_LEAK")
    if q.endswith(("，", "、", "；", "而且", "但是", "因为", "所以说")) or q.endswith(("，", "、")):
        issues.append("STEM_TRUNCATED?")
    # 解析
    if not expl:
        issues.append("EXPL_MISSING")
    else:
        claimed = extract_claimed(expl)
        if claimed and ans in "ABCD" and claimed != ans:
            issues.append(f"EXPL_ANS_MISMATCH:{claimed}")
        if len(expl) < 15:
            issues.append("EXPL_TOO_SHORT")
    # tag3
    if not tag3:
        issues.append("TAG3_MISSING")
    elif tag3 not in VALID_TAGS:
        issues.append(f"TAG3_INVALID:{tag3}")
    elif sub and sub in GROUP_OF_SUB and not tag3.startswith(GROUP_OF_SUB[sub]):
        issues.append(f"TAG3_GROUP_MISMATCH:{sub}->{tag3}")
    if not sub:
        issues.append("SUBMODULE_MISSING")
    elif sub not in GROUP_OF_SUB and sub != "":
        issues.append(f"SUBMODULE_ODD:{sub}")
    return issues

def main():
    out = open("mc_results.jsonl","w",encoding="utf-8")
    stat = collections.Counter()
    for line in open("audit_yanyu.jsonl",encoding="utf-8"):
        r = json.loads(line)
        issues = check(r)
        for i in issues:
            stat[i.split(":")[0]] += 1
        out.write(json.dumps({"id": r["id"], "issues": issues}, ensure_ascii=False)+"\n")
    out.close()
    clean = sum(1 for l in open("mc_results.jsonl") if json.loads(l)["issues"]==[])
    print("clean:", clean)
    for k,v in stat.most_common():
        print(k, v)

if __name__ == "__main__":
    main()
