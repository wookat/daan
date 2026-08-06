#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""资料分析（ziliao）三级考点规则打标脚本。

用法：python3 tag_ziliao.py <taxonomy.json> <untagged_ziliao.jsonl> <out.jsonl>

思路：
1. submodule 通过 taxonomy 的 group aliases 约束候选考点（找不到则全模块候选）。
2. 从提问句（题干最后一问）+ 解析中提取特征词，按优先级规则判定三级考点。
3. 规则强命中 confidence 0.9+，弱命中 0.6-0.8，判不了 UNKNOWN(0)。
"""
import json
import os
import re
import sys


def load_taxonomy(path):
    t = json.load(open(path, encoding="utf-8"))
    mod = next(m for m in t["modules"] if m["key"] == "ziliao")
    alias2group = {}
    all_topics = []
    for g in mod["groups"]:
        codes = [tp["code"] for tp in g["topics"]]
        all_topics.extend(codes)
        alias2group[g["name"]] = codes
        for a in g.get("aliases", []):
            alias2group[a] = codes
    return alias2group, all_topics


def split_stem(question):
    """取材料后的提问句（最后一问）。"""
    q = question or ""
    for sep in ("【问题】", "问题：", "问："):
        if sep in q:
            return q.rsplit(sep, 1)[1]
    if "材料：" in q:  # 提问在前、材料在后的格式
        return q.split("材料：")[0]
    # 兜底：取最后一句
    parts = re.split(r"[。？?]", q.strip("。？? "))
    return parts[-1] if parts else q[-120:]


RE_YEAR = re.compile(r"(19|20)\d{2}\s*[-—~至到]\s*(19|20)\d{2}")


# 解析中显式声明题型（官方解析常见句式：“本题考查XX”“可判定本题为XX问题”），优先级最高
_EXPL_TYPE = [
    ("间隔基期", "ZL-JQ-02"), ("基期和差", "ZL-JQ-03"), ("基期比较", "ZL-JQ-04"),
    ("现期量计算", "ZL-JQ-05"), ("基期量计算", "ZL-JQ-01"), ("求基期量", "ZL-JQ-01"), ("基期计算", "ZL-JQ-01"),
    ("两期比重", "ZL-BZ-03"), ("基期比重", "ZL-BZ-02"), ("混合比重", "ZL-BZ-04"),
    ("现期比重", "ZL-BZ-01"),
    ("间隔增长率", "ZL-ZZL-02"), ("年均增长率", "ZL-ZZL-03"), ("混合增长率", "ZL-ZZL-04"),
    ("增长率计算比较", "ZL-ZZL-05"), ("增长率比较", "ZL-ZZL-05"),
    ("一般增长率", "ZL-ZZL-01"), ("增长率计算", "ZL-ZZL-01"),
    ("间隔增长量", "ZL-ZZLL-03"), ("年均增长量", "ZL-ZZLL-04"), ("增长量比较", "ZL-ZZLL-02"),
    ("增长量计算", "ZL-ZZLL-01"), ("求增长量", "ZL-ZZLL-01"),
    ("基期平均数", "ZL-PJ-02"), ("平均数增长率", "ZL-PJ-03"), ("平均数的增长率", "ZL-PJ-03"),
    ("两期平均数", "ZL-PJ-04"),
    ("现期平均数", "ZL-PJ-01"), ("基期倍数", "ZL-PJ-06"), ("现期倍数", "ZL-PJ-05"),
    ("比值计算", "ZL-PJ-05"),
    ("直接读数", "ZL-JS-01"), ("和差类", "ZL-JS-02"), ("和差问题", "ZL-JS-02"),
    ("排序类", "ZL-JS-03"),
    ("综合分析", "ZL-ZH-01"),
]
_EXPL_DECL = re.compile(
    r"(本题考查|题目考查|可判定本题为|判定此题为|判定本题为|可判断本题是|可判断该题是"
    r"|该题是|本题是|本题为|此题为)([^。，,]{0,20})")


def expl_declared(expl):
    for m in _EXPL_DECL.finditer(expl or ""):
        window = m.group(2)
        for phrase, code in _EXPL_TYPE:
            if phrase in window:
                return code
    return None


def classify(row):
    """返回 (tag3, confidence) 或 (None, 0)。"""
    stem = split_stem(row.get("question") or "")
    expl = row.get("explanation") or ""
    both = stem + " " + expl
    sub = (row.get("submodule") or "").strip()

    def has(text, *kws):
        return any(k in text for k in kws)

    # ---------- 综合分析（提问形态判定，优先级最高） ----------
    if has(stem, "说法正确的是", "说法错误的是", "表述正确", "表述错误", "不正确的是",
           "能够推出", "无法推出", "不能推出", "推出的是", "推出的有几条", "说法中正确", "说法中错误",
           "叙述正确", "叙述错误", "正确的一项", "错误的一项", "描述正确", "描述错误",
           "正确的说法", "错误的说法", "以下正确", "以下错误", "发生变化的是", "不准确的是",
           "根据资料可知", "可以推出"):
        return "ZL-ZH-01", 0.95
    # 提问+①②③选项列表时提问句可能不在尾部，补查全文
    if has(row.get("question") or "", "推出的有几条", "可从资料中推出", "能够从上述资料中推出"):
        return "ZL-ZH-01", 0.9

    # ---------- 解析声明题型 ----------
    decl = expl_declared(expl)
    if decl:
        return decl, 0.92
    if sub == "综合分析":
        # 综合分析 submodule 下非判断句式的复合计算
        if has(stem, "正确", "错误"):
            return "ZL-ZH-01", 0.85
        return "ZL-ZH-02", 0.6

    # ---------- 年均 ----------
    if has(stem, "年均增长率", "年平均增长率", "年均增速", "平均每年增长率", "年均复合增长"):
        return "ZL-ZZL-03", 0.9
    if has(stem, "年均增长量", "平均每年增长", "平均每年增加", "平均每年减少", "年均增加", "年均增长约", "年均减少"):
        # 区分量与率：出现 % 目标问法多为率
        if has(stem, "增长率", "增速", "百分之", "快"):
            return "ZL-ZZL-03", 0.75
        return "ZL-ZZLL-04", 0.85

    # ---------- 间隔（隔年） ----------
    if has(both, "隔年", "间隔增长"):
        if has(stem, "增长量", "增加了多少", "多多少"):
            return "ZL-ZZLL-03", 0.8
        if has(stem, "增长率", "增速", "增长了百分之"):
            return "ZL-ZZL-02", 0.85
        return "ZL-JQ-02", 0.7

    # ---------- 增长量（提前：“比上年增加多少X”优先于基期规则） ----------
    if (re.search(r"(增加|增长|减少|下降|多|少|净增)了?大?约?\s*多少", stem)
            or re.search(r"(增加|减少)了约?[：:（(]?$", stem.strip())) \
            and not has(stem, "百分之", "多少倍", "多少个百分点"):
        if has(stem, "年均", "平均每年"):
            return "ZL-ZZLL-04", 0.85
        return "ZL-ZZLL-01", 0.9

    # ---------- 比重 ----------
    if has(stem, "比重", "占比", "所占的比例", "约占了", "约占") or re.search(r"占.{0,18}(比例|比重|的百分比)", stem):
        # 两期比重：比重与上年（同期）比较升降/变化/百分点
        if (has(stem, "比上年", "较上年", "与上年", "比去年", "较去年", "同比") and
                has(stem, "百分点", "上升", "下降", "提高", "降低", "变化", "高于", "低于", "约：", "相较")) \
                or re.search(r"比重(比|较|与)(上年|去年)(同期)?[约]?[：:（(]?$", stem.strip()) \
                or has(stem, "比重变化", "占比变化", "变化趋势"):
            return "ZL-BZ-03", 0.85
        # 基期比重：问的年份早于材料主年份
        if _asks_earlier_year(row, stem):
            return "ZL-BZ-02", 0.8
        if has(stem, "上年", "去年", "前一年"):
            return "ZL-BZ-02", 0.7
        return "ZL-BZ-01", 0.85
    if has(stem, "百分点") and has(stem, "比重", "占比"):
        return "ZL-BZ-03", 0.85

    # ---------- 平均数 ----------
    if has(stem, "平均每", "人均", "亩均", "均价", "市均", "店均", "件均", "月均", "单位面积", "每万人", "每千人",
           "平均单价", "平均价格", "平均收入", "平均产量", "平均工资", "亩产", "单产") \
            and not has(stem, "多少倍", "几倍", "之比"):
        if has(stem, "增长率", "增速", "增长了百分之", "同比增长约"):
            return "ZL-PJ-03", 0.85
        if has(stem, "上升还是下降", "升高还是降低", "高于还是低于", "相比") and has(both, "升", "降"):
            return "ZL-PJ-04", 0.7
        if has(stem, "上年", "去年", "前一年") or _asks_earlier_year(row, stem):
            return "ZL-PJ-02", 0.8
        return "ZL-PJ-01", 0.8

    # ---------- 倍数 ----------
    if has(stem, "几倍", "多少倍", "倍数", "翻了", "翻番", "之比约为", "之比为"):
        if has(stem, "上年", "去年", "前一年") or _asks_earlier_year(row, stem):
            return "ZL-PJ-06", 0.8
        return "ZL-PJ-05", 0.85

    # ---------- 增长量 ----------
    if has(stem, "增长量", "增加了多少", "减少了多少", "净增", "增加额", "增长额", "多多少", "少多少",
           "增加了约多少", "减少量"):
        if not has(stem, "增长率", "增速", "百分之"):
            if has(stem, "最多", "最大", "最少", "最小", "高于", "超过", "排序", "由高到低", "由大到小"):
                return "ZL-ZZLL-02", 0.8
            return "ZL-ZZLL-01", 0.85

    # ---------- 增长率 ----------
    if has(stem, "增长率", "增速", "增长速度", "下降率", "降幅", "增幅", "下降速度",
           "增长了百分之", "下降了百分之", "增长最快", "增长最慢", "下降最快", "增速最") \
            or re.search(r"比上年(同期|末)?(增长|下降)[大约]{0,2}[：:，]?$", stem.strip()):
        if has(stem, "最快", "最慢", "最高", "最低", "最大", "最小", "排序", "快于", "高于", "低于", "由高到低", "由大到小"):
            return "ZL-ZZL-05", 0.85
        if has(both, "混合", "整体增速介于"):
            return "ZL-ZZL-04", 0.7
        return "ZL-ZZL-01", 0.85
    if re.search(r"(同比|环比)(增长|下降)约?为?[:：（(]?$", stem.strip()):
        return "ZL-ZZL-01", 0.8

    # ---------- 基期/现期量 ----------
    if _asks_earlier_year(row, stem) or has(stem, "上年", "去年", "前一年"):
        if has(stem, "之和", "总和", "合计", "之差", "相差"):
            return "ZL-JQ-03", 0.8
        if "不超过" in stem and has(stem, "数量", "多少"):
            return "ZL-JQ-03", 0.7
        if has(stem, "最多", "最大", "最少", "最小", "高于", "超过", "排序", "由高到低", "由大到小", "多于", "少于"):
            return "ZL-JQ-04", 0.8
        return "ZL-JQ-01", 0.85
    if has(stem, "预计", "预测", "将达到", "将为", "能达到"):
        return "ZL-JQ-05", 0.75

    # ---------- 简单计算/读数 ----------
    if has(stem, "之和", "总和", "合计为", "共为", "总共", "之差", "相差"):
        return "ZL-JS-02", 0.7
    if has(stem, "排序", "从高到低", "从低到高", "由大到小", "由小到大", "从大到小", "从小到大",
           "最大的是", "最小的是",
           "最多的是", "最少的是", "最高的是", "最低的是", "最长的", "最短的"):
        return "ZL-JS-03", 0.7
    if has(stem, "为多少", "是多少", "为：", "约为", "达到多少", "约多少"):
        # 直接读数/现期量类兜底，弱命中（借助 submodule 与解析算式约束）
        if sub == "基期量":
            return "ZL-JQ-01", 0.6
        if sub == "比重求量" or (sub == "比重" and has(expl, "×", "*")):
            return "ZL-BZ-01", 0.6
        if sub in ("贸易差额", "构成计算") or re.search(r"=[\d.]+[-－][\d.]+=", (expl or "").replace(" ", "")):
            return "ZL-JS-02", 0.6
        if sub == "简单计算":
            # 解析算式含百分比→比重求量；含除法折算→平均数；纯加减→简单加减
            if "%" in expl:
                return "ZL-BZ-01", 0.65
            if "×1000" in expl or has(stem, "每千人", "每万人"):
                return "ZL-PJ-01", 0.6
            if has(expl, "-", "－", "+", "＋"):
                return "ZL-JS-02", 0.65
            return "ZL-JS-01", 0.6
        return None, 0

    return None, 0


_MAIN_YEAR = re.compile(r"(20\d{2}|19\d{2})\s*年")


def _asks_earlier_year(row, stem):
    """提问年份 < 材料主体年份（材料首个年份）视为基期问题。"""
    q = row.get("question") or ""
    mat = q.split("【问题】")[0].split("问题：")[0]
    m_years = [int(y) for y in _MAIN_YEAR.findall(mat)]
    s_years = [int(y) for y in _MAIN_YEAR.findall(stem)]
    if not m_years or not s_years:
        return False
    main = max(m_years)  # 统计材料的最新年份即现期
    return all(y < main for y in s_years)


def load_overrides():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "manual_overrides_ziliao.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {int(k): tuple(v) for k, v in data.items() if not k.startswith("_")}


def main():
    tax_path, in_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    alias2group, all_topics = load_taxonomy(tax_path)
    all_set = set(all_topics)
    overrides = load_overrides()
    n = unk = manual = 0
    with open(in_path, encoding="utf-8") as f, open(out_path, "w", encoding="utf-8") as out:
        for line in f:
            row = json.loads(line)
            n += 1
            method = "rule"
            tag, conf = classify(row)
            sub = (row.get("submodule") or "").strip()
            cand = alias2group.get(sub)
            # submodule 约束：若命中的 tag 与 submodule 候选簇冲突，且规则置信不高，则降级
            if tag and cand and tag not in cand and conf < 0.65:
                tag, conf = None, 0
            if not tag or tag not in all_set:
                if row["id"] in overrides:
                    tag, conf = overrides[row["id"]]
                    method = "manual"
                    manual += 1
                else:
                    tag, conf = "UNKNOWN", 0
                    unk += 1
            out.write(json.dumps({"id": row["id"], "tag3": tag,
                                  "confidence": round(conf, 2), "method": method},
                                 ensure_ascii=False) + "\n")
    print(f"total={n} unknown={unk} ({unk/n:.1%}) manual={manual}")


if __name__ == "__main__":
    main()
