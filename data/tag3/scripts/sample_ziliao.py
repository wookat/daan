#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每个三级考点随机抽样（≥20 或全量）供人工核对。
用法：python3 sample_ziliao.py <untagged.jsonl> <tagged.jsonl> <out.txt> [seed]
"""
import json
import random
import sys


def stem_of(q):
    for sep in ("【问题】", "问题：", "问："):
        if sep in q:
            return q.rsplit(sep, 1)[1]
    if "材料：" in q:
        return q.split("材料：")[0]
    return q[-150:]


def main():
    un, tg, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 42
    rows = {r["id"]: r for r in (json.loads(l) for l in open(un, encoding="utf-8"))}
    by_tag = {}
    for l in open(tg, encoding="utf-8"):
        t = json.loads(l)
        by_tag.setdefault(t["tag3"], []).append(t["id"])
    random.seed(seed)
    with open(out_path, "w", encoding="utf-8") as out:
        for tag in sorted(by_tag):
            ids = by_tag[tag]
            sample = ids if len(ids) <= 20 else random.sample(ids, 20)
            out.write(f"\n===== {tag} (n={len(ids)}, sampled={len(sample)}) =====\n")
            for i in sample:
                r = rows[i]
                out.write(f"[{i}] sub={r.get('submodule')}\n")
                out.write("  STEM: " + stem_of(r.get("question") or "")[:160].replace("\n", " ") + "\n")
                out.write("  EXPL: " + (r.get("explanation") or "")[:160].replace("\n", " ") + "\n")


if __name__ == "__main__":
    main()
