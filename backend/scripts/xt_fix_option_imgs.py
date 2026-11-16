#!/usr/bin/env python3
"""回填 option_imgs / 修正题干图 / 复活图选项题。

背景：首版导入把「选项里的图」混进题干图 images，749 道纯图选项题被标记 disabled。
新版解析器输出 option_imgs={字母:[图径]}，本脚本按规范化题干匹配本库行：
  - option_imgs → /qimg/<basename> 写入 questions.option_imgs（json）
  - image      ← 题干/材料图首张（选项图误入 image 的纠正为题干图或 NULL）
  - options    清理纯标点选项文本（有图选项里的 "；" 等残留分隔符）
  - disabled   note='xt:选项为图片暂不支持' 且修复后可作答 → 0

用法：
    python scripts/xt_fix_option_imgs.py --xt /tmp/xt2.jsonl --check   # 缺图清单+预览
    python scripts/xt_fix_option_imgs.py --xt /tmp/xt2.jsonl --apply  # 写库
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from app import db
from xt_zhenti_apply import norm_text, clean_stem

PUNCT_ONLY = re.compile(r"^[；;，,。.、：:？?！!\s（）()\[\]【】—\-~·…]*$")


def build_stem(q: dict) -> str:
    stem = clean_stem(q["stem"])
    if q.get("material"):
        stem = f"(材料 {q['mat_no']}){q['material']}\n{stem}" if q.get("mat_no") else f"{q['material']}\n{stem}"
    return stem


def basename_map(paths):
    return sorted({p.split("/")[-1] for p in (paths or [])})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xt", required=True)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    db.init_db()
    conn = db.get_conn()
    norm2ids = {}
    for r in conn.execute("SELECT id, question FROM questions"):
        norm2ids.setdefault(norm_text(r["question"]), []).append(r["id"])

    stats = Counter()
    need_imgs: set[str] = set()
    updates = []  # (qid, option_imgs_json, image_or_None_marker, options_json, revive)

    for line in open(args.xt, encoding="utf-8"):
        q = json.loads(line)
        oi = q.get("option_imgs") or {}
        stem_imgs = basename_map(q.get("images"))
        if not oi and not stem_imgs:
            continue
        stem = build_stem(q)
        ids = norm2ids.get(norm_text(stem)) or []
        if not ids:
            stats["no_match"] += 1
            continue
        oi_out = {k: [f"/qimg/{p.split('/')[-1]}" for p in v] for k, v in oi.items()}
        for paths in oi.values():
            need_imgs.update(p.split("/")[-1] for p in paths)
        need_imgs.update(stem_imgs)
        for qid in ids:
            row = conn.execute(
                "SELECT id, options, image, disabled, note FROM questions WHERE id=?", (qid,)
            ).fetchone()
            if not row:
                continue
            opts = json.loads(row["options"] or "{}")
            # 有图选项里的纯标点文本清掉
            opts_changed = False
            for k, v in opts.items():
                if oi.get(k) and isinstance(v, str) and PUNCT_ONLY.match(v):
                    opts[k] = ""
                    opts_changed = True
            opt_img_fns = {p.split("/")[-1] for paths in oi.values() for p in paths}
            stem_img = f"/qimg/{stem_imgs[0]}" if stem_imgs else None
            cur_img = row["image"]
            # 题干图优先取题干/材料图；当前 image 若实为选项图 → 清空
            new_img = stem_img or (None if cur_img and cur_img.split("/")[-1] in opt_img_fns else cur_img)
            revive = (row["disabled"] == 1 and
                      (row["note"] or "") == "xt:选项为图片暂不支持" and bool(oi))
            updates.append((qid, json.dumps(oi_out, ensure_ascii=False) if oi_out else None,
                            new_img, json.dumps(opts, ensure_ascii=False) if opts_changed else None,
                            revive))
            stats["rows"] += 1
            if revive:
                stats["revive"] += 1

    print(f"待更新 {stats['rows']} 行 | 复活 {stats['revive']} | 未匹配 {stats['no_match']} | 引用图 {len(need_imgs)}")

    missing = sorted(fn for fn in need_imgs
                     if not os.path.exists(os.path.join("/data/qimg", fn)))
    print(f"缺图 {len(missing)} 张")
    if args.check or not args.apply:
        with open("/tmp/xt_oi_missing.txt", "w") as f:
            f.write("\n".join(missing))
        print("清单 → /tmp/xt_oi_missing.txt")
        return

    for qid, oi_json, img, opts_json, revive in updates:
        sets, vals = [], []
        if oi_json is not None:
            sets.append("option_imgs=?"); vals.append(oi_json)
        sets.append("image=?"); vals.append(img)
        if opts_json is not None:
            sets.append("options=?"); vals.append(opts_json)
        if revive:
            sets.append("disabled=0"); sets.append("note=NULL")
        if not sets:
            continue
        vals.append(qid)
        conn.execute(f"UPDATE questions SET {','.join(sets)} WHERE id=?", vals)
        stats["updated"] += 1
        if stats["updated"] % 500 == 0:
            conn.commit()
    conn.commit()
    print(f"完成：更新 {stats['updated']} 行")
    if missing:
        print("仍缺图：", missing[:10])


if __name__ == "__main__":
    main()
