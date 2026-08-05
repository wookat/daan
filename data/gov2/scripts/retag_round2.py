#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UNKNOWN tag3 第二轮治理驱动脚本。

输入：data/gov2/unknown_full_20260805.jsonl（第一轮维持 UNKNOWN 的 5,638 条，含题面与维持原因）
输出：
  - retag_candidates.jsonl：可重新定标候选（含目标模块/考点/置信度/家族）
  - delist_candidates.jsonl：脏数据下架建议
  - keep_unknown.jsonl：继续维持 UNKNOWN

第二轮新增杠杆（第一轮做不到的）：
1. 跨模块污染题第一轮只允许输出本模块 code，只能维持 UNKNOWN；
   本轮允许跨模块定标：按维持原因解析目标模块，调用目标模块第一轮规则分类器（清空 submodule 约束）。
2. 常识模板解析题（解析仅"故选X"）第一轮因解析信息不足整体保守回退；
   本轮仅用题干+选项计分，只取最严格档（bs>=8 且 margin>=4）。
3. 题面/选项损坏题全量正则扫描，产出下架建议清单。

用法：python3 retag_round2.py <taxonomy.json> <unknown_full.jsonl> <outdir>
"""
import importlib.util
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))


def load_mod(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, "round1", name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ---------------- 脏数据检测 ----------------
RE_MOJIBAKE = re.compile(r"[\ufffd\ue000-\uf8ff]|&#\d+;|\\u[0-9a-f]{4}")
RE_IMG_REF = re.compile(r"如[上下左右]?图|下图|上图|见图|图所示|如图|下列图形|右边的图形|左边的图形")
# 解析为逻辑填空/语句填空解题步骤，但题干无空位 → 题干与解析错位（串题）
RE_EXP_BLANK = re.compile(r"第[一二三四]空|横线处|所填词|填入.{0,6}空")
RE_STEM_BLANK = re.compile(r"_{2,}|＿{2,}|〔?\s*〕|\(\s*\)|（\s*）")
# 事件排序题：题干为 ①②…编号事件列表；考点树无「事件排序」考点，维持 UNKNOWN
RE_EVENT_SEQ = re.compile(r"^[①（(]?①?.{0,40}②.{0,60}③")
# 解析为语句排序/衔接类步骤但题干非该题型 → 串题
RE_EXP_YYSEQ = re.compile(r"语句排序题|语句衔接题|确定首句|将选项与文段一一对应|观察选项特征")
# 资料分析类提问但题干中无配套材料
RE_STEM_MATERIAL = re.compile(r"能够从(上述)?(资料|材料)|根据(上述|下列)?(资料|材料|表格)|定位表格|定位.{0,4}材料")


def parse_options(raw):
    if isinstance(raw, dict):
        return raw
    try:
        d = json.loads(raw or "{}")
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def dirty_check(q):
    stem = (q.get("question") or "").strip()
    opts = parse_options(q.get("options"))
    reason = q.get("keep_reason") or ""
    vals = [str(v).strip() for v in opts.values()]
    if "损坏" in reason or "串题" in reason or "错位" in reason or "残缺" in reason:
        return "第一轮已确认题面/选项/解析损坏或串题：" + reason
    if len(stem) < 8:
        return f"题干过短（{len(stem)}字），信息不足"
    if len([v for v in vals if v]) < 2:
        return f"有效选项不足2个（{len([v for v in vals if v])}个）"
    if len(set(vals)) < len(vals):
        return "存在重复选项"
    if RE_MOJIBAKE.search(stem + " ".join(vals)):
        return "题面/选项含乱码字符"
    if RE_IMG_REF.search(stem) and not (q.get("image") or "").strip():
        return "题干引用图形/图表但无图片资源"
    exp = q.get("explanation") or ""
    if RE_EXP_BLANK.search(exp) and not RE_STEM_BLANK.search(stem):
        return "解析为填空类解题步骤但题干无空位，题干与解析错位（串题）"
    if RE_EXP_YYSEQ.search(exp) and not (
            RE_STEM_BLANK.search(stem) or "①" in stem or "排序" in stem or "衔接" in stem):
        return "解析为语句排序/衔接类解题步骤但题干非该题型，题干与解析错位（串题）"
    if (RE_STEM_MATERIAL.search(stem) or RE_STEM_MATERIAL.search(exp)) \
            and len(stem) < 150 and sum(c.isdigit() for c in stem) < 10:
        return "资料分析类提问但配套统计材料缺失，无法作答"
    return None


# ---------------- 跨模块目标解析 ----------------
MOD_HINT = [
    ("数量关系", "shuliang"), ("数量", "shuliang"),
    ("言语理解", "yanyu"), ("言语", "yanyu"),
    ("资料分析", "ziliao"), ("资料", "ziliao"),
    ("判断推理", "panduan"), ("逻辑判断", "panduan"), ("类比推理", "panduan"), ("定义判断", "panduan"),
    ("常识判断", "changshi"), ("常识", "changshi"), ("政治", "changshi"),
]
RE_MIX = re.compile(r"(误入|混入|污染)")


def cross_target(reason):
    if not RE_MIX.search(reason):
        return None
    # 取原因中最先出现的模块提示词作为目标模块
    hits = []
    for kw, mod in MOD_HINT:
        i = reason.find(kw)
        if i >= 0:
            hits.append((i, len(kw), mod))
    if not hits:
        return None
    hits.sort(key=lambda t: (t[0], -t[1]))
    return hits[0][2]


class Retagger:
    def __init__(self, taxonomy_path):
        self.tax_path = taxonomy_path
        self.m_cs = load_mod("tag_changshi")
        self.m_pd = load_mod("tag_panduan")
        self.m_sl = load_mod("tag_shuliang")
        self.m_yy = load_mod("tag_yanyu")
        self.m_zl = load_mod("tag_ziliao")
        self.cs_ctx = self.m_cs.load_taxonomy(taxonomy_path)

    def run(self, module, q, strip_sub=True):
        r = dict(q)
        if strip_sub:
            r["submodule"] = ""
        if module == "changshi":
            code, conf, _ = self.m_cs.classify(r, *self.cs_ctx)
            return code, conf
        if module == "panduan":
            code, conf, _ = self.m_pd.classify(r)
            return code, conf
        if module == "shuliang":
            r2 = dict(r)
            r2["options"] = parse_options(r.get("options"))
            code, conf = self.m_sl.classify(r2)
            return code, conf
        if module == "yanyu":
            code, conf, _ = self.m_yy.classify(
                r.get("question"), r.get("options"), r.get("explanation"),
                self.m_yy.allowed_codes(None))
            return code, conf
        if module == "ziliao":
            code, conf = self.m_zl.classify(r)
            return (code or "UNKNOWN"), conf
        return "UNKNOWN", 0.0

    def changshi_stem_only(self, q):
        """常识模板解析题：仅题干+选项计分，最严格档才放行。"""
        r = dict(q)
        r["explanation"] = ""
        r["submodule"] = q.get("submodule") or ""
        code, conf, _ = self.m_cs.classify(r, *self.cs_ctx)
        # classify 内部含多档，本轮仅取最高置信档
        if code != "UNKNOWN" and conf >= 0.9:
            return code, conf
        return "UNKNOWN", 0.0


def main():
    tax, inp, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    rt = Retagger(tax)
    retag, delist, keep = [], [], []
    stats = Counter()
    for line in open(inp, encoding="utf-8"):
        q = json.loads(line)
        qid = q["question_id"]
        reason = q.get("keep_reason") or ""
        d = dirty_check(q)
        if d:
            delist.append({"question_id": qid, "module": q["module"], "reason": d})
            stats["delist"] += 1
            continue
        if q["module"] == "panduan" and RE_EVENT_SEQ.search((q.get("question") or "").strip()):
            keep.append({"question_id": qid, "module": q["module"],
                         "reason": "事件排序题，考点树无对应三级考点，维持UNKNOWN（建议后续为判断模块增补「事件排序」考点）"})
            stats["keep_event_seq"] += 1
            continue
        tgt = cross_target(reason)
        if tgt and tgt != q["module"]:
            code, conf = rt.run(tgt, q)
            if code != "UNKNOWN" and conf >= 0.7:
                retag.append({"question_id": qid, "old_module": q["module"], "module": tgt,
                              "tag3": code, "confidence": round(conf, 2), "family": "cross_module"})
                stats["retag_cross"] += 1
                continue
            keep.append({"question_id": qid, "module": q["module"],
                         "reason": f"跨模块（目标{tgt}）规则分类仍不可靠，维持UNKNOWN"})
            stats["keep_cross"] += 1
            continue
        if q["module"] == "changshi":
            code, conf = rt.changshi_stem_only(q)
            if code != "UNKNOWN":
                retag.append({"question_id": qid, "old_module": "changshi", "module": "changshi",
                              "tag3": code, "confidence": round(conf, 2), "family": "cs_stem_strict"})
                stats["retag_cs_stem"] += 1
                continue
        keep.append({"question_id": qid, "module": q["module"], "reason": reason})
        stats["keep"] += 1
    for name, rows in [("retag_candidates.jsonl", retag), ("delist_candidates.jsonl", delist),
                       ("keep_unknown.jsonl", keep)]:
        with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    for k, v in stats.most_common():
        print(k, v)
    print("TOTAL", sum(stats.values()))


if __name__ == "__main__":
    main()
