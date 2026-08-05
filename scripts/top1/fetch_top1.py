#!/usr/bin/env python3
"""TOP1 绿色题源全量抓取（GitHub 公开仓库，匿名 git clone，无反爬/无登录墙）。

数据源:
  - https://github.com/SGHCN0762/civil-country-exam-xingce-json   国考行测 2000-2026
  - https://github.com/SGHCN0762/civil-provice-exam-xingce-json   省考行测 2004-2025

产出原始抽取 JSONL（未去重、未归一），逐题记录质量门禁淘汰原因统计。
字段: module(一级中文)/question/options/answer/explanation/source/year/region

用法: python3 fetch_top1.py --workdir /tmp/top1_src --out top1_raw.jsonl
"""
import argparse, json, glob, os, re, subprocess, collections

REPOS = [
    ("https://github.com/SGHCN0762/civil-country-exam-xingce-json.git", "src_country", "国考"),
    ("https://github.com/SGHCN0762/civil-provice-exam-xingce-json.git", "src_province", None),
]

MODULES = ["常识判断", "言语理解", "数量关系", "判断推理", "资料分析"]

# 源为 PDF 转换，不含图片与资料分析大段材料：依赖图片的题剔除
IMG_HINTS = ["如图", "下图", "上图", "右图", "左图", "问号处", "填入问号", "图形",
             "折线图", "柱状图", "饼图", "饼状图", "统计图", "图表", "示意图"]

# PDF 转换噪声：广告水印/页码标记
NOISE_RE = re.compile(r"获取试卷更新[^。]*。?|请关注公众号[^。]*。?|第\s*\d+\s*页[，,]?\s*共\s*\d+\s*页|\b\d{1,3}\s+/\s+\d{1,3}\b"
                      r"|(19|20)\d{2}年[^。，]{0,25}[《【][行⾏]测\d?[》】](题|真题)?[A-D]?([（(][^）)]{0,15}[)）])?")

PAGE_NO_RE = re.compile(r"\s*-\s*\d+\s*-\s*")
OPT_TAIL_RE = re.compile(r"[\s，。]*A[、．.]?\s*B[、．.]?\s*C[、．.]?\s*D[、．.]?\s*$")

PROVINCES = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江",
             "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川",
             "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆", "广州", "深圳"]

MOJIBAKE_RE = re.compile(r"[\ufffd\ue000-\uf8ff]")


def clone(url, path):
    if not os.path.isdir(path):
        subprocess.run(["git", "clone", "--depth", "1", url, path], check=True)


def infer_year(name):
    m = re.search(r"(19|20)\d{2}", name)
    return int(m.group(0)) if m else None


def infer_region(name, default):
    if default:
        return default
    for p in PROVINCES:
        if p in name:
            return p
    return "省考"


def infer_module(q):
    part = (q.get("部分") or "").strip()
    if "数字推理" in part:
        return "数量关系"
    for s in MODULES:
        if s in part:
            return s
    return None


def aligned(ans, exp):
    """解析与答案对齐校验，剔除 PDF 转换错位的解析。"""
    pats = [rf"正确答案为\s*{ans}", rf"答案[:：]\s*{ans}", rf"故本题选\s*{ans}",
            rf"选择\s*{ans}\s*[项选]", rf"本题选\s*{ans}", rf"故选\s*{ans}"]
    return any(re.search(p, exp) for p in pats)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", default="/tmp/top1_src")
    ap.add_argument("--out", default="top1_raw.jsonl")
    args = ap.parse_args()

    os.makedirs(args.workdir, exist_ok=True)
    drops = collections.Counter()
    kept = 0
    total = 0
    with open(args.out, "w", encoding="utf-8") as w:
        for url, sub, region_default in REPOS:
            path = os.path.join(args.workdir, sub)
            clone(url, path)
            for f in sorted(glob.glob(os.path.join(path, "**", "*.json"), recursive=True)):
                name = os.path.basename(f)
                try:
                    data = json.load(open(f, encoding="utf-8"))
                except Exception:
                    drops["bad_json_file"] += 1
                    continue
                if not isinstance(data, list):
                    continue
                for q in data:
                    total += 1
                    question = re.sub(r"\s+", " ", (q.get("题目") or "").strip())
                    question = OPT_TAIL_RE.sub("", NOISE_RE.sub(" ", PAGE_NO_RE.sub(" ", question))).strip()
                    question = re.sub(r"\s+", " ", question)
                    opts = q.get("选项") or {}
                    ans = (q.get("答案") or "").strip().upper()
                    exp = re.sub(r"\s+", " ", NOISE_RE.sub(" ", PAGE_NO_RE.sub(" ", (q.get("解析") or "").strip())))
                    module = infer_module(q)
                    if not module:
                        drops["no_module"] += 1
                        continue
                    if not question:
                        drops["empty_question"] += 1
                        continue
                    if ans not in ("A", "B", "C", "D"):
                        drops["no_or_bad_answer"] += 1
                        continue
                    if not all(k in opts and str(opts[k]).strip() for k in "ABCD"):
                        drops["missing_options"] += 1
                        continue
                    if not exp:
                        drops["no_explanation"] += 1
                        continue
                    if not aligned(ans, exp):
                        drops["explanation_misaligned"] += 1
                        continue
                    blob = question + "".join(str(opts[k]) for k in "ABCD") + exp
                    if MOJIBAKE_RE.search(blob):
                        drops["mojibake"] += 1
                        continue
                    if module == "资料分析":
                        drops["ziliao_missing_material"] += 1
                        continue
                    if any(h in question for h in IMG_HINTS):
                        drops["needs_image"] += 1
                        continue
                    kept += 1
                    w.write(json.dumps({
                        "module": module,
                        "question": question,
                        "options": {k: re.sub(r"\s+", " ", NOISE_RE.sub(" ", PAGE_NO_RE.sub(" ", str(opts[k])))).strip() for k in "ABCD"},
                        "answer": ans,
                        "explanation": exp,
                        "source": name.rsplit(".json", 1)[0],
                        "year": infer_year(name),
                        "region": infer_region(name, region_default),
                    }, ensure_ascii=False) + "\n")
    print(json.dumps({"total_raw": total, "kept": kept, "drops": dict(drops)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
