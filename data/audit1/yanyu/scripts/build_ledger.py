"""汇总人工逐题台账（manual_ledger.jsonl，method=manual-review）+ 查重终审，
生成 ledger.jsonl / fixes.sql / delist.sql。每个权威 ID 取台账中最后一条（append-only 终审语义）。"""
import json, re, collections, os

OUT = os.path.expanduser("~/repos/kaogong-assistant/data/audit1/yanyu")
os.makedirs(OUT, exist_ok=True)

VALID_TAGS = {
    "YY-LJ-01","YY-LJ-02","YY-LJ-03","YY-LJ-04",
    "YY-ZX-01","YY-ZX-02","YY-ZX-03","YY-ZX-04","YY-ZX-05",
    "YY-XJ-01","YY-XJ-02","YY-XJ-03",
    "YY-JB-01","YY-JB-02","YY-JB-03","YY-JB-04",
    "YY-BT-01","YY-PZ-01",
}

recs, order = {}, []
for l in open("audit_yanyu.jsonl", encoding="utf-8"):
    r = json.loads(l)
    recs[r["id"]] = r
    order.append(r["id"])

final = {}
for l in open("manual_ledger.jsonl", encoding="utf-8"):
    r = json.loads(l)
    final[r["id"]] = r

dupdec = {d["id"]: d["dup_of"] for d in json.load(open("dup_final.json"))["decisions"]}

# 解析 dup 链，指向最终保留题
def resolve(qid, seen=None):
    seen = seen or set()
    tgt = dupdec.get(qid) or (final.get(qid) or {}).get("dup_of")
    if not tgt or tgt not in recs or tgt in seen:
        return None
    seen.add(qid)
    deeper = resolve(tgt, seen)
    return deeper or tgt

ledger, fixes, delist = [], [], []
stats = collections.Counter()

for qid in order:
    r = recs[qid]
    row = final[qid]
    assert row.get("method") == "manual-review", qid
    verdict = row["verdict"]
    score = row["score"]
    issues = list(row.get("issues", []))
    dup_of = row.get("dup_of")
    if not dup_of and qid in dupdec:
        dup_of = resolve(qid)
        # 人工台账与机检方向相反（人工已保留本题、下架对方）时，以人工终审为准
        if dup_of and final.get(dup_of, {}).get("verdict") == "delist" \
                and final.get(dup_of, {}).get("dup_of") == qid:
            issues.append(f"机检建议下架本题保留{dup_of}，人工终审相反（保留本题、下架{dup_of}），维持人工结论")
            dup_of = None
        if dup_of:
            if verdict != "delist":
                verdict = "delist"
                issues.append(f"重复题终审确认：与{dup_of}重复，保留{dup_of}，本条下架")
            score = min(score, 40)
    tag = row.get("tag3") if row.get("tag3") in VALID_TAGS else None
    src_tag = r.get("tag3") if r.get("tag3") in VALID_TAGS else None
    final_tag = tag or src_tag
    if tag and tag != r.get("tag3"):
        fixes.append((qid, {"tag3": tag}, r))
    ledger.append({"id": qid, "verdict": verdict, "score": score,
                   "tag3": final_tag, "dup_of": dup_of,
                   "issues": issues, "method": "manual-review"})
    stats[verdict] += 1
    if verdict == "delist":
        reason = "dup" if dup_of else "quality"
        delist.append((qid, reason))

# submodule 缺失回填：按 question_type 众数映射（人工核对映射表）
qt2sub = collections.Counter()
pair = collections.defaultdict(collections.Counter)
for r in recs.values():
    if r.get("submodule") and r.get("question_type"):
        pair[r["question_type"]][r["submodule"]] += 1
sub_map = {qt: c.most_common(1)[0][0] for qt, c in pair.items() if c.most_common(1)[0][1] >= 20}
sub_fixes = [(r["id"], sub_map[r["question_type"]])
             for r in recs.values()
             if not r.get("submodule") and r.get("question_type") in sub_map]

# dup 链再指向：keeper 若本身因重复被下架，则沿链指向最终保留题
by_id = {row["id"]: row for row in ledger}
for row in ledger:
    seen = set()
    while row["dup_of"]:
        k = by_id.get(row["dup_of"])
        if not k or k["verdict"] != "delist" or not k["dup_of"] or k["dup_of"] in seen:
            break
        seen.add(row["dup_of"])
        row["dup_of"] = k["dup_of"]

with open(f"{OUT}/ledger.jsonl", "w", encoding="utf-8") as f:
    for row in ledger:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

def esc(s):
    return str(s).replace("'", "''")

with open(f"{OUT}/fixes.sql", "w", encoding="utf-8") as f:
    f.write("-- 言语理解模块逐题人工核查修复（tag3 定标 + submodule 回填 + 换行占位符清理），依据 ledger.jsonl\n")
    f.write("-- 执行前请备份 data.db\nBEGIN;\n")
    for qid, ff, r in fixes:
        f.write(f"UPDATE questions SET tag3='{ff['tag3']}' WHERE id={qid};\n")
    for qid, sub in sorted(sub_fixes):
        f.write(f"UPDATE questions SET submodule='{esc(sub)}' WHERE id={qid} AND (submodule IS NULL OR submodule='');\n")
    nl_ids = sorted(row["id"] for row in ledger
                    if any("⏎" in i for i in row["issues"]))
    for qid in nl_ids:
        f.write(f"UPDATE questions SET question=REPLACE(question,'⏎',char(10)), options=REPLACE(options,'⏎','\\n'), explanation=REPLACE(explanation,'⏎',char(10)) WHERE id={qid};\n")
    f.write("COMMIT;\n")

with open(f"{OUT}/delist.sql", "w", encoding="utf-8") as f:
    f.write("-- 言语理解模块下架：重复题保优去冗 + 质量问题题，依据 ledger.jsonl（逐题人工核查）\n")
    f.write("-- 执行前请备份 data.db\nBEGIN;\n")
    for qid, reason in delist:
        f.write(f"UPDATE questions SET disabled=1 WHERE id={qid} AND (disabled IS NULL OR disabled=0); -- {reason}\n")
    f.write("COMMIT;\n")

print("verdicts:", dict(stats))
print("tag3 fixes:", len(fixes), "submodule fixes:", len(sub_fixes))
print("delist:", len(delist), collections.Counter(r for _, r in delist))
iss = collections.Counter(i.split("（")[0][:12] for row in ledger for i in row["issues"])
print("top issues:", iss.most_common(15))
sc = collections.Counter(row["score"]//10*10 for row in ledger)
print("score deciles:", dict(sorted(sc.items())))
bad = [row["id"] for row in ledger if not (0 <= row["score"] <= 100) or row["verdict"] not in ("pass","fix","delist")]
print("invalid rows:", len(bad))
dangling = [row["id"] for row in ledger if row["dup_of"] and row["dup_of"] not in recs]
print("dangling dup_of:", len(dangling))
