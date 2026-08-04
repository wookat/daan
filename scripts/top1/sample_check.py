#!/usr/bin/env python3
"""从清洗后成品中按模块分层抽样，产出人工核对清单（答案与解析一致性抽检）。

用法:
  生成待审清单:  python3 sample_check.py --in top1_xingce.jsonl --n 120 --seed 401 --out sample_check.md
  合并审核结果:  python3 sample_check.py --in top1_xingce.jsonl --n 120 --seed 401 --out sample_check.md \
                   --audit audit_top1.jsonl --summary audit_summary.json

--audit 为逐条人工审核结果 JSONL，每行 {"k": 序号, "verdict": "PASS"|"FAIL",
"category": 失败类别, "reason": 失败原因, "note": 备注}。未提供 --audit 时，
清单中的核对结论输出为 PENDING（待人工审核），不会默认 PASS。
"""
import argparse, collections, hashlib, json


def pick(items, n, seed):
    """按模块分层，模块内按 md5(seed+题干) 确定性排序取前 per 条。

    基于题干内容哈希而非下标，数据集增删个别记录时抽样结果保持稳定。
    """
    by_mod = collections.defaultdict(list)
    for i, q in enumerate(items):
        key = hashlib.md5(f"{seed}:{q['question']}".encode("utf-8")).hexdigest()
        by_mod[q["module"]].append((key, i))
    per = max(1, n // len(by_mod))
    picked = []
    for _, pairs in sorted(by_mod.items()):
        pairs.sort()
        picked.extend(i for _, i in pairs[:per])
    return picked[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="sample_check.md")
    ap.add_argument("--audit", help="人工审核结果 JSONL（k/verdict/category/reason/note）")
    ap.add_argument("--summary", help="输出审计汇总 JSON 路径")
    args = ap.parse_args()

    items = [json.loads(l) for l in open(args.inp, encoding="utf-8")]
    picked = pick(items, args.n, args.seed)

    audit = {}
    if args.audit:
        for l in open(args.audit, encoding="utf-8"):
            r = json.loads(l)
            k = r["k"]
            if k in audit:
                raise SystemExit(f"审核输入重复序号: k={k}")
            if not (1 <= k <= len(picked)):
                raise SystemExit(f"审核输入序号越界: k={k}")
            if r.get("verdict") not in ("PASS", "FAIL"):
                raise SystemExit(f"审核结论非法（仅允许 PASS/FAIL）: k={k}")
            if r["verdict"] == "FAIL" and not (
                    str(r.get("category", "")).strip()
                    and str(r.get("reason", "")).strip()
                    and str(r.get("note", "")).strip()):
                raise SystemExit(f"FAIL 记录缺 category/reason/note: k={k}")
            audit[k] = r
        missing = [k for k in range(1, len(picked) + 1) if k not in audit]
        if missing:
            raise SystemExit(f"审核输入不完整，缺序号: {missing}")

    with open(args.out, "w", encoding="utf-8") as w:
        w.write(f"# 抽样核对清单（n={len(picked)}，seed={args.seed}）\n\n")
        for k, i in enumerate(picked, 1):
            q = items[i]
            a = audit.get(k, {})
            verdict = a.get("verdict", "PENDING")
            w.write(f"## {k}. [{q['module']}/{q.get('submodule')}] 行{i + 1} ({q['source']})\n\n")
            w.write(f"年份/地区: {q.get('year')}/{q.get('region')}\n\n")
            w.write(f"{q['question']}\n\n")
            for o in "ABCD":
                w.write(f"- {o}. {q['options'][o]}\n")
            w.write(f"\n**答案**: {q['answer']}\n\n**解析**: {q['explanation']}\n\n")
            w.write(f"**核对结论**: {verdict}\n\n")
            w.write(f"**失败类别**: {a.get('category', '-') or '-'}\n\n")
            w.write(f"**失败原因**: {a.get('reason', '-') or '-'}\n\n")
            w.write(f"**备注**: {a.get('note', '-') or '-'}\n\n---\n\n")

    if args.summary:
        n_pass = sum(1 for k in range(1, len(picked) + 1) if audit.get(k, {}).get("verdict") == "PASS")
        n_fail = sum(1 for k in range(1, len(picked) + 1) if audit.get(k, {}).get("verdict") == "FAIL")
        cats = collections.Counter(
            audit[k]["category"] for k in audit if audit[k].get("verdict") == "FAIL")
        batches = collections.defaultdict(lambda: [0, 0])  # source -> [total, pass]
        for k, i in enumerate(picked, 1):
            src = items[i]["source"]
            batches[src][0] += 1
            if audit.get(k, {}).get("verdict") == "PASS":
                batches[src][1] += 1
        summary = {
            "sample_size": len(picked),
            "seed": args.seed,
            "pass_count": n_pass,
            "fail_count": n_fail,
            "pending_count": len(picked) - n_pass - n_fail,
            "pass_rate": round(n_pass / len(picked) * 100, 2) if picked else 0,
            "failure_categories": dict(cats),
            "source_batches": {
                s: {"sampled": t, "passed": p, "pass_rate": round(p / t * 100, 2)}
                for s, (t, p) in sorted(batches.items())
            },
        }
        with open(args.summary, "w", encoding="utf-8") as w:
            json.dump(summary, w, ensure_ascii=False, indent=2)
        print(json.dumps({k: summary[k] for k in
                          ("sample_size", "pass_count", "fail_count", "pending_count", "pass_rate")},
                         ensure_ascii=False))
    print(f"written {len(picked)} -> {args.out}")


if __name__ == "__main__":
    main()
