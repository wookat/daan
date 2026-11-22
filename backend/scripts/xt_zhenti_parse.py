#!/usr/bin/env python3
"""解析 xt 真题仓库（模块目录 → 每卷一篇 md）为统一 jsonl。

输入：ERRRC/xingcezhenti 稀疏克隆目录（仅 .md，无 90-图片/）。
输出：每行一个题目：
  {paper, year, region, mod, no, qid, subtype, material, stem, options, answer,
   explanation, images(仅题干/材料), option_imgs(按选项字母), exp_images}
模块目录映射：政治理论/常识判断→changshi，言语→yanyu，数量→shuliang，
判断→panduan，资料→ziliao（与本库 MODULE_ORDER 一致）。
用法：
    python backend/scripts/xt_zhenti_parse.py --src D:/xt_src --out /tmp/xt.jsonl
"""
import argparse
import html
import json
import os
import re
import sys

MOD_MAP = {
    "01-政治理论": "changshi",
    "02-常识判断": "changshi",
    "03-言语理解与表达": "yanyu",
    "04-数量关系": "shuliang",
    "05-判断推理": "panduan",
    "06-资料分析": "ziliao",
}
HEAD_Q = re.compile(r"^#{2,3}\s*第\s*(\d+)\s*题")
HEAD_MAT = re.compile(r"^#{2}\s*材料\s*(\d+)")
QID_RE = re.compile(r"<sub>\s*qid\s*(\d+)\s*(?:·\s*([^<]+?))?\s*</sub>")
OPT_RE = re.compile(r"^-\s*\*\*([A-Z])\*\*\s*[.、．]?\s*(.*)$")
ANS_RE = re.compile(r"\*\*答案\*\*\s*[::：]\s*(.+)")
IMG_RE = re.compile(r'src="(\.\./)?(90-图片/[^"]+)"')
TAG_RE = re.compile(r"<[^>]+>")


def clean_html(s: str) -> str:
    s = re.sub(r"<p>\s*", "\n", s)
    s = re.sub(r"</p>", "", s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = TAG_RE.sub("", s)
    s = html.unescape(s)
    s = s.replace("　", " ").replace("\xa0", " ")
    lines = [ln.strip() for ln in s.split("\n")]
    return "\n".join(ln for ln in lines if ln).strip()


def parse_file(path: str):
    """返回 (meta, [questions])；meta 取 frontmatter 的试卷/年份/地区。"""
    text = open(path, encoding="utf-8").read()
    meta = {}
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            for ln in text[3:end].splitlines():
                m = re.match(r"(\S+?)\s*[:：]\s*\"?(.+?)\"?\s*$", ln)
                if m:
                    meta[m.group(1)] = m.group(2)
    # 切块：材料/题头驱动状态机
    cur_mat_txt: list[str] = []  # 当前材料原文片段
    material = ""                # 已完成的当前材料文本
    mat_no = 0                   # 当前材料编号（## 材料 N）
    q: dict | None = None
    out: list[dict] = []
    stage = "pre"                # pre | stem | opt | ans | exp
    exp_buf: list[str] = []
    exp_imgs: list[str] = []

    def flush_exp():
        q["explanation"] = clean_html("".join(exp_buf))
        q["exp_images"] = list(exp_imgs)
        exp_buf.clear()
        exp_imgs.clear()

    def flush_q():
        nonlocal q
        if q is None:
            return
        flush_exp()
        q["material"] = material
        q["mat_no"] = mat_no
        out.append(q)
        q = None

    for raw in text.splitlines():
        line = raw.rstrip()
        mq = HEAD_Q.match(line)
        mm = HEAD_MAT.match(line)
        if mm:
            flush_q()
            material = ""
            cur_mat_txt = []
            mat_no = int(mm.group(1))
            stage = "mat"
            continue
        if mq:
            flush_q()
            m_qid = QID_RE.search(line)
            q = {
                "no": int(mq.group(1)),
                "qid": int(m_qid.group(1)) if m_qid else None,
                "subtype": (m_qid.group(2) or "").strip() if m_qid else "",
                "stem_parts": [], "options": {}, "answer": "",
                "images": [], "option_imgs": {},
            }
            stage = "stem"
            continue
        if q is None:
            if stage == "mat":
                cur_mat_txt.append(line)
                material = clean_html("".join(cur_mat_txt))
            continue
        m_opt = OPT_RE.match(line)
        m_ans = ANS_RE.search(line)
        if line.strip() == "---":
            flush_q()
            stage = "pre"
            continue
        if m_opt:
            stage = "opt"
            letter, otxt = m_opt.group(1), m_opt.group(2)
            oimgs = [im[1] for im in IMG_RE.findall(otxt)]
            if oimgs:
                q["option_imgs"][letter] = oimgs
            otxt = re.sub(r"✅", "", clean_html(otxt)).strip()
            q["options"][letter] = otxt
            continue
        if m_ans:
            stage = "exp"
            q["answer"] = re.sub(r"[^A-Z对错误√×ABCD]", "", m_ans.group(1).strip()) or m_ans.group(1).strip()
            continue
        if stage == "exp":
            if re.fullmatch(r"\s*\*{0,2}官方解析\*{0,2}\s*", line):
                continue
            for im in IMG_RE.findall(line):
                exp_imgs.append(im[1])
            exp_buf.append(line + "\n")
        elif stage == "opt":
            # 选项跨行（罕见）：并入最后一项
            if q["options"]:
                k = list(q["options"])[-1]
                for im in IMG_RE.findall(line):
                    q["option_imgs"].setdefault(k, []).append(im[1])
                q["options"][k] += " " + clean_html(line)
        else:
            for im in IMG_RE.findall(line):
                q["images"].append(im[1])
            q["stem_parts"].append(line)
    flush_q()

    for q in out:
        q["stem"] = clean_html("\n".join(q.pop("stem_parts")))
        q["paper"] = meta.get("试卷") or os.path.basename(path)[:-3]
        q["year"] = meta.get("年份") or ""
        q["region"] = meta.get("地区") or ""
    return meta, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    n_q = 0
    n_files = 0
    bad = []
    with open(args.out, "w", encoding="utf-8") as f:
        for d, mod in MOD_MAP.items():
            dp = os.path.join(args.src, d)
            if not os.path.isdir(dp):
                print(f"缺目录 {d}，跳过", file=sys.stderr)
                continue
            for fn in sorted(os.listdir(dp)):
                if not fn.endswith(".md"):
                    continue
                n_files += 1
                try:
                    _, qs = parse_file(os.path.join(dp, fn))
                except Exception as e:  # noqa: BLE001 批量解析容错，坏文件收集后人工看
                    bad.append((d, fn, str(e)))
                    continue
                for q in qs:
                    q["mod"] = mod
                    f.write(json.dumps(q, ensure_ascii=False) + "\n")
                    n_q += 1
    print(f"解析 {n_files} 文件 → {n_q} 题 -> {args.out}")
    if bad:
        print(f"解析失败 {len(bad)} 文件：")
        for d, fn, e in bad[:20]:
            print(f"  {d}/{fn}: {e}")


if __name__ == "__main__":
    main()
