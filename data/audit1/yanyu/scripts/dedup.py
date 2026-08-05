"""重复/近重复检测：题干规范化后精确重复 + 3-gram Jaccard 近重复簇。"""
import json, re, collections, itertools

def norm(s):
    s = re.sub(r"[\s\u3000\u00A0]+", "", s or "")
    s = re.sub(r"_{2,}|＿{2,}", "＿", s)
    s = re.sub(r"[，。、：；！？“”‘’\"'（）()【】《》,.:;!?-]", "", s)
    s = re.sub(r"^（\d{4}[^）]*）", "", s)  # 去掉年份来源前缀
    return s

def shingles(s, k=6):
    return set(s[i:i+k] for i in range(max(1, len(s)-k+1)))

recs = [json.loads(l) for l in open("audit_yanyu.jsonl", encoding="utf-8")]
by_norm = collections.defaultdict(list)
for r in recs:
    by_norm[norm(r["question"])].append(r["id"])

exact = {k: v for k, v in by_norm.items() if len(v) > 1}
print("exact dup groups:", len(exact), "questions involved:", sum(len(v) for v in exact.values()))

# near-dup via LSH-lite: band on 8-char prefix buckets of sorted shingle hashes
import hashlib
def sig(s, n=24):
    sh = shingles(s)
    hs = sorted(hashlib.blake2b(x.encode(), digest_size=8).digest() for x in sh)[:n]
    return hs

norms = {}
for r in recs:
    n = norm(r["question"])
    if len(n) >= 20:
        norms[r["id"]] = n

buckets = collections.defaultdict(list)
for qid, n in norms.items():
    for h in sig(n):
        buckets[h].append(qid)

cand = set()
for ids in buckets.values():
    if 2 <= len(ids) <= 50:
        for a, b in itertools.combinations(sorted(ids), 2):
            cand.add((a, b))
print("candidate pairs:", len(cand))

def jac(a, b):
    sa, sb = shingles(norms[a]), shingles(norms[b])
    inter = len(sa & sb)
    return inter / (len(sa) + len(sb) - inter)

pairs = []
for a, b in cand:
    j = jac(a, b)
    if j >= 0.55:
        pairs.append((a, b, round(j, 3)))
print("near-dup pairs(>=0.55):", len(pairs))

# union-find clusters
parent = {}
def find(x):
    parent.setdefault(x, x)
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(a, b):
    parent[find(a)] = find(b)

for a, b, j in pairs:
    union(a, b)
clusters = collections.defaultdict(set)
for x in parent:
    clusters[find(x)].add(x)
clusters = [sorted(c) for c in clusters.values() if len(c) > 1]
print("clusters:", len(clusters), "questions:", sum(len(c) for c in clusters))

json.dump({"exact": list(exact.values()), "pairs": pairs, "clusters": clusters},
          open("dup_raw.json", "w"), ensure_ascii=False, indent=1)
