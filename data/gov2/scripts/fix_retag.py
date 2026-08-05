#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对 merge 结果做人工抽检后的系统性纠偏。

抽检发现的系统性问题及处理：
1. rule_cs_stem_strict 家族错误率过高（4/9）→ 整族撤回，维持 UNKNOWN。
2. 「共有…比…多…」和差倍 / 「每箱…分装…」归一化应用题被关键词误判为
   SL-JH-02 立体几何等 → 按题型正则强制改为 SL-JS-06 / SL-JS-01。
3. 问法为削弱/加强/前提的论证题被定义词误判为 PD-DY-* → 按问法覆盖。
4. 平行结构（与题干推理/论证方式最相似）考点树无对应 code → 撤回维持
   UNKNOWN，建议增补考点。
5. manual_corrections.jsonl：逐题人工复核结论（改 code 或撤回）。

用法：python3 fix_retag.py <taxonomy.json> <final_dir> <corrections.jsonl> <unknown_full.jsonl>
输出覆盖 final_dir 下 final_retag/final_keep_unknown 以及 02/03 SQL。
"""
import json
import os
import re
import sys
from collections import Counter

RE_HECHA = re.compile(r"共有\s*\d+.{0,30}?比.{0,30}?多\s*\d+")
RE_FENZHUANG = re.compile(r"每[箱盒筐瓶袋捆桶]\s*\d+.{0,20}?(正好|恰好).{0,10}?[分包]?[装分]\s*\d+")
RE_PARALLEL = re.compile(r"(与(题干|上述).{0,12}(相同|最为类似|最相似|最类似|一致))|((逻辑错误|论证方式|论证方法|推理形式|逻辑结构|论证结构).{0,8}(相同|相似|类似))")
RE_ASK_WEAKEN = re.compile(r"(最能|能够)?(削弱|质疑|反驳|驳斥)(上述|该|以上)")
RE_ASK_SUPPORT = re.compile(r"(最能|能够)?(支持|加强)(上述|该|以上)")
RE_ASK_PREMISE = re.compile(r"(补充.{0,12}(前提|假设))|(必须假设)|(前提是)")
RE_DEF = re.compile(r"根据(上述|以上)定义")


def esc(s):
    return str(s).replace("'", "''")


def main():
    tax_path, final_dir, corr_path, full_path = sys.argv[1:5]
    tax = json.load(open(tax_path, encoding="utf-8"))
    code2mod = {}
    for m in tax["modules"]:
        for g in m["groups"]:
            for tp in g["topics"]:
                code2mod[tp["code"]] = m["key"]
    full = {json.loads(l)["question_id"]: json.loads(l) for l in open(full_path, encoding="utf-8")}
    corr = {}
    if os.path.exists(corr_path):
        for l in open(corr_path, encoding="utf-8"):
            r = json.loads(l)
            corr[r["question_id"]] = r

    retag = [json.loads(l) for l in open(os.path.join(final_dir, "final_retag.jsonl"), encoding="utf-8")]
    keep = [json.loads(l) for l in open(os.path.join(final_dir, "final_keep_unknown.jsonl"), encoding="utf-8")]

    out_retag, stats = [], Counter()
    for r in retag:
        qid = r["question_id"]
        q = (full.get(qid) or {}).get("question") or ""
        # 5. 人工逐题复核结论优先
        if qid in corr:
            c = corr[qid]
            if c["action"] == "keep":
                keep.append({"question_id": qid, "module": r["old_module"],
                             "reason": "人工复核：" + c.get("note", "定标依据不足，维持UNKNOWN")})
                stats["corr_keep"] += 1
                continue
            r["tag3"] = c["tag3"]
            r["module"] = code2mod[c["tag3"]]
            r["family"] = r["family"] + "_manual"
            out_retag.append(r)
            stats["corr_fix"] += 1
            continue
        # 1. 撤回 cs_stem_strict 整族
        if r["family"] == "rule_cs_stem_strict":
            keep.append({"question_id": qid, "module": r["old_module"],
                         "reason": "抽检该规则族错误率过高，撤回定标，维持UNKNOWN"})
            stats["drop_cs_stem"] += 1
            continue
        # 2. 应用题题型强制归位
        if RE_HECHA.search(q):
            if r["tag3"] != "SL-JS-06":
                stats["fix_hecha"] += 1
            r["tag3"], r["module"] = "SL-JS-06", "shuliang"
            out_retag.append(r)
            continue
        if RE_FENZHUANG.search(q):
            if r["tag3"] != "SL-JS-01":
                stats["fix_fenzhuang"] += 1
            r["tag3"], r["module"] = "SL-JS-01", "shuliang"
            out_retag.append(r)
            continue
        # 4. 平行结构：考点树无对应三级考点
        if RE_PARALLEL.search(q):
            keep.append({"question_id": qid, "module": r["old_module"],
                         "reason": "平行结构（推理/论证方式相似比较）题，考点树无对应三级考点，维持UNKNOWN（建议增补）"})
            stats["drop_parallel"] += 1
            continue
        # 3. 论证问法覆盖定义误判
        if r["tag3"].startswith("PD-DY") and not RE_DEF.search(q):
            new = None
            if RE_ASK_WEAKEN.search(q):
                new = "PD-LJ-06"
            elif RE_ASK_SUPPORT.search(q):
                new = "PD-LJ-05"
            elif RE_ASK_PREMISE.search(q):
                new = "PD-LJ-07"
            if new:
                stats["fix_ask"] += 1
                r["tag3"], r["module"] = new, "panduan"
        out_retag.append(r)

    with open(os.path.join(final_dir, "final_retag.jsonl"), "w", encoding="utf-8") as f:
        for r in out_retag:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(final_dir, "final_keep_unknown.jsonl"), "w", encoding="utf-8") as f:
        for r in keep:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(final_dir, "02_unknown_retag.sql"), "w", encoding="utf-8") as f:
        f.write("-- UNKNOWN tag3 第二轮治理：重新定标（fix_retag.py 纠偏后）\n-- 执行前请备份 data.db\nBEGIN;\n")
        for r in out_retag:
            if r["module"] != r["old_module"]:
                f.write(f"UPDATE questions SET tag3='{esc(r['tag3'])}', module='{esc(r['module'])}', "
                        f"submodule=NULL WHERE id={r['question_id']} AND tag3='UNKNOWN';\n")
            else:
                f.write(f"UPDATE questions SET tag3='{esc(r['tag3'])}' "
                        f"WHERE id={r['question_id']} AND tag3='UNKNOWN';\n")
        f.write("COMMIT;\n")
    print(dict(stats))
    print("retag", len(out_retag), "keep", len(keep))


if __name__ == "__main__":
    main()
