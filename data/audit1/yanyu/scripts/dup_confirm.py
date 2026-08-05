"""近重复簇确认：结合选项集合相似度与答案文本一致性，人工规则确认后输出 dup_final.json。
keep 选择：is_real 优先 > 机检干净 > 有解析(长) > 有 tag3 > id 小。"""
import json, re, collections

def normtxt(s):
    return re.sub(r"[\s\u3000\u00A0，。、：；！？“”‘’\"'（）()【】《》,.:;!?-]", "", str(s or ""))

recs = {}
for l in open("audit_yanyu.jsonl", encoding="utf-8"):
    r = json.loads(l)
    try:
        r["opts"] = {k: normtxt(v) for k, v in json.loads(r["options"]).items()}
    except Exception:
        r["opts"] = {}
    recs[r["id"]] = r
mc = {json.loads(l)["id"]: json.loads(l)["issues"] for l in open("mc_results.jsonl")}
d = json.load(open("dup_raw.json"))

def opt_sim(a, b):
    sa, sb = set(recs[a]["opts"].values()), set(recs[b]["opts"].values())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

def ans_text(qid):
    r = recs[qid]
    return r["opts"].get(r["answer"], "")

confirmed_pairs = []
rejected = []
ans_conflicts = []
for a, b, j in d["pairs"]:
    os_ = opt_sim(a, b)
    if j >= 0.80 or (j >= 0.55 and os_ >= 0.6):
        confirmed_pairs.append((a, b, j, round(os_, 2)))
        ta, tb = ans_text(a), ans_text(b)
        if ta and tb and ta != tb and os_ >= 0.9:
            ans_conflicts.append((a, b, ta[:40], tb[:40]))
    else:
        rejected.append((a, b, j, round(os_, 2)))

# exact dups always confirmed
parent = {}
def find(x):
    parent.setdefault(x, x)
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(a, b): parent[find(a)] = find(b)
for grp in d["exact"]:
    for x in grp[1:]:
        union(grp[0], x)
for a, b, *_ in confirmed_pairs:
    union(a, b)
clusters = collections.defaultdict(set)
for x in parent:
    clusters[find(x)].add(x)
clusters = [sorted(c) for c in clusters.values() if len(c) > 1]

def keep_key(qid):
    r = recs[qid]
    return (
        -int(r["is_real"] or 0),
        len(mc.get(qid, ["x"])) if mc.get(qid) else 0,
        -len(r.get("explanation") or ""),
        0 if r.get("tag3") else 1,
        qid,
    )

decisions = []
kept_variants = 0
for c in clusters:
    # 同一真题可能同时出现于不同卷（副省级/地市级等），按 (year,region) 各保留一份
    groups = collections.defaultdict(list)
    for qid in c:
        r = recs[qid]
        key = ("real", r["exam_year"], r["exam_region"]) if r["is_real"] else ("gen",)
        groups[key].append(qid)
    keeps = set()
    real_keys = [k for k in groups if k[0] == "real"]
    for k in real_keys:
        keeps.add(sorted(groups[k], key=keep_key)[0])
    if not real_keys:
        keeps.add(sorted(c, key=keep_key)[0])
    kept_variants += max(0, len(keeps) - 1)
    best = sorted(keeps, key=keep_key)[0]
    for qid in c:
        if qid not in keeps:
            decisions.append({"id": qid, "dup_of": best})

print("confirmed pairs:", len(confirmed_pairs), "rejected pairs:", len(rejected))
print("clusters:", len(clusters), "delist count:", len(decisions))
print("answer conflicts within dups:", len(ans_conflicts))
json.dump({"clusters": clusters, "decisions": decisions, "rejected": rejected,
           "ans_conflicts": ans_conflicts},
          open("dup_final.json", "w"), ensure_ascii=False, indent=1)
