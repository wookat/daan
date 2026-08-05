#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""合并规则/LLM 定标结果并生成迁移 SQL。

优先级：脏数据下架 > 事件排序维持 > 规则定标 > LLM 定标（confidence ≥ 阈值）> 维持 UNKNOWN。
只处理生产在架 UNKNOWN 集合（unknown_questions.json 5,569 条），仓库存档多出的 69 条跳过。

用法：python3 merge_and_sql.py <taxonomy.json> <rules_outdir> <llm_raw.jsonl> <prod_unknown.json> <outdir>
"""
import json
import os
import sys
from collections import Counter

LLM_CONF_MIN = 0.9

# 人工抽检未达 95% 的家族在此列出后整体不放行（见 report_round2.md 抽检结果）
BLOCKED_FAMILIES: set = set()


def load_taxonomy_codes(path):
    t = json.load(open(path, encoding="utf-8"))
    code2mod = {}
    for m in t["modules"]:
        for g in m["groups"]:
            for tp in g["topics"]:
                code2mod[tp["code"]] = m["key"]
    return code2mod


def esc(s):
    return str(s).replace("'", "''")


def main():
    tax, rules_dir, llm_path, prod_path, outdir = sys.argv[1:6]
    os.makedirs(outdir, exist_ok=True)
    code2mod = load_taxonomy_codes(tax)
    prod_ids = {r["id"] for r in json.load(open(prod_path, encoding="utf-8"))}

    delist = {json.loads(l)["question_id"]: json.loads(l)
              for l in open(os.path.join(rules_dir, "delist_candidates.jsonl"), encoding="utf-8")}
    rule_retag = {json.loads(l)["question_id"]: json.loads(l)
                  for l in open(os.path.join(rules_dir, "retag_candidates.jsonl"), encoding="utf-8")}
    keep = {json.loads(l)["question_id"]: json.loads(l)
            for l in open(os.path.join(rules_dir, "keep_unknown.jsonl"), encoding="utf-8")}
    llm = {}
    for l in open(llm_path, encoding="utf-8"):
        r = json.loads(l)
        llm[r["question_id"]] = r

    final_retag, final_delist, final_keep = [], [], []
    stats = Counter()
    for qid in sorted(prod_ids):
        if qid in delist:
            final_delist.append(delist[qid])
            stats["delist"] += 1
        elif qid in rule_retag:
            r = rule_retag[qid]
            fam = "rule_" + r["family"]
            if fam in BLOCKED_FAMILIES:
                final_keep.append({"question_id": qid, "module": r["old_module"],
                                   "reason": f"家族{fam}抽检未达标，维持UNKNOWN"})
                stats["keep_blocked"] += 1
            else:
                r["family"] = fam
                final_retag.append(r)
                stats[fam] += 1
        elif qid in llm and llm[qid]["tag3"] not in ("UNKNOWN", "ERROR") \
                and llm[qid].get("confidence", 0) >= LLM_CONF_MIN:
            r = llm[qid]
            fam = "llm_" + r["orig_module"]
            if fam in BLOCKED_FAMILIES:
                final_keep.append({"question_id": qid, "module": r["orig_module"],
                                   "reason": f"家族{fam}抽检未达标，维持UNKNOWN"})
                stats["keep_blocked"] += 1
            else:
                final_retag.append({"question_id": qid, "old_module": r["orig_module"],
                                    "module": code2mod[r["tag3"]], "tag3": r["tag3"],
                                    "confidence": r.get("confidence", 0), "family": fam,
                                    "why": r.get("why", "")})
                stats[fam] += 1
        else:
            reason = (keep.get(qid) or {}).get("reason") or \
                (llm.get(qid) or {}).get("why") or "信息不足"
            mod = (keep.get(qid) or {}).get("module") or (llm.get(qid) or {}).get("orig_module")
            final_keep.append({"question_id": qid, "module": mod, "reason": reason})
            stats["keep"] += 1

    with open(os.path.join(outdir, "final_retag.jsonl"), "w", encoding="utf-8") as f:
        for r in final_retag:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(outdir, "final_delist.jsonl"), "w", encoding="utf-8") as f:
        for r in final_delist:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(outdir, "final_keep_unknown.jsonl"), "w", encoding="utf-8") as f:
        for r in final_keep:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # SQL：重新定标
    with open(os.path.join(outdir, "02_unknown_retag.sql"), "w", encoding="utf-8") as f:
        f.write("-- UNKNOWN tag3 第二轮治理：重新定标（生成于 merge_and_sql.py）\n")
        f.write("-- 执行前请备份 data.db\nBEGIN;\n")
        for r in final_retag:
            if r["module"] != r["old_module"]:
                f.write(f"UPDATE questions SET tag3='{esc(r['tag3'])}', module='{esc(r['module'])}', "
                        f"submodule=NULL WHERE id={r['question_id']} AND tag3='UNKNOWN';\n")
            else:
                f.write(f"UPDATE questions SET tag3='{esc(r['tag3'])}' "
                        f"WHERE id={r['question_id']} AND tag3='UNKNOWN';\n")
        f.write("COMMIT;\n")

    # SQL：脏数据下架
    with open(os.path.join(outdir, "03_unknown_delist.sql"), "w", encoding="utf-8") as f:
        f.write("-- UNKNOWN tag3 第二轮治理：脏数据下架建议（生成于 merge_and_sql.py）\n")
        f.write("-- 执行前请备份 data.db；逐条原因见 final_delist.jsonl\nBEGIN;\n")
        for r in final_delist:
            f.write(f"UPDATE questions SET disabled=1 WHERE id={r['question_id']} AND (disabled IS NULL OR disabled=0);\n")
        f.write("COMMIT;\n")

    for k, v in stats.most_common():
        print(k, v)
    print("TOTAL", sum(stats.values()), "retag", len(final_retag),
          "delist", len(final_delist), "keep", len(final_keep))


if __name__ == "__main__":
    main()
