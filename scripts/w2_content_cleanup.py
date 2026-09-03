#!/usr/bin/env python3
"""W2 内容清洗：在线题 题干/选项 汉字间空格归一 + hs 管线元句剥离。

规则（口径与 backend/app/quality.py 共用同一常量/正则）：
  a. 在线题 question / options 值中「汉字/中文标点 之间」的半角/全角空格 → 删除
     （quality.normalize_cjk_spaces：数字、字母两侧空格保留，如「1 天有 86400 秒」）
  b. 在线题 hs_explanation 含管线元句「该解法是花生十三体系中此类题型的标准套路，考场可直接套用。」
     及同义变体（quality.HS_META_RE）→ 经 quality.sanitize_hs 剥离并归一空白
  c. 改动题 db.rescore_question

不下线任何题、不改 explanation、不改 hs 正文语义、不触发 LLM。
默认 dry-run 只打印计数与样例 id；`--apply` 才写库（写前备份到 <db>.bak-w2，已存在则不覆盖）。
本地：DB_PATH=/path/data.db python3 scripts/w2_content_cleanup.py [--apply] [--dump ids.json]
生产：sudo docker exec -i deploy-kaogong-1 python3 - [--apply] < scripts/w2_content_cleanup.py
"""
import argparse
import json
import os
import sqlite3
import sys
import time
from collections import Counter

try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
except NameError:  # 经 stdin 管道运行（容器内 cwd=/app/backend 可直接 import app）
    pass

from app import db, quality

ONLINE = "(disabled IS NULL OR disabled=0)"
SAMPLE_N = 10


def scan(conn):
    # a. 题干/选项 汉字间空格（SQL 粗筛含空格的行，再用正则精判）
    rows = conn.execute(
        f"SELECT id, module, question, options FROM questions WHERE {ONLINE} AND ("
        "question LIKE '% %' OR question LIKE '%　%' OR options LIKE '% %' OR options LIKE '%　%')"
    ).fetchall()
    spaces = []
    for r in rows:
        q = r["question"] or ""
        new_q = quality.normalize_cjk_spaces(q)
        new_opts = quality.normalize_options(r["options"])
        if new_q == q and new_opts is None:
            continue
        d = dict(r)
        d["new_question"] = new_q if new_q != q else None
        d["new_options"] = new_opts
        spaces.append(d)

    # b. hs 管线元句
    rows = conn.execute(
        f"SELECT id, module, hs_explanation FROM questions WHERE {ONLINE} AND hs_explanation LIKE '%花生十三%'"
    ).fetchall()
    meta = []
    for r in rows:
        hs = r["hs_explanation"] or ""
        if not quality.HS_META_RE.search(hs):
            continue
        d = dict(r)
        d["new_hs"] = quality.sanitize_hs(hs)
        meta.append(d)
    return {"spaces": spaces, "meta": meta}


def report(res: dict):
    sp, mt = res["spaces"], res["meta"]
    n_q = sum(1 for r in sp if r["new_question"] is not None)
    n_o = sum(1 for r in sp if r["new_options"] is not None)
    print(f"[a] cjk-space online hits: {len(sp)} (question {n_q}, options {n_o})  by module: {dict(Counter(r['module'] for r in sp))}")
    print("    sample ids:", [r["id"] for r in sp[:SAMPLE_N]])
    for r in sp[:3]:
        q = r["question"] or ""
        if r["new_question"] is not None:
            i = next(k for k, (a, b) in enumerate(zip(q, r["new_question"])) if a != b)
            print(f"    #{r['id']} q before: {q[max(0, i - 20):i + 22]!r}")
            print(f"    #{r['id']} q after : {r['new_question'][max(0, i - 20):i + 20]!r}")
        else:
            print(f"    #{r['id']} opts: {r['options']!r} -> {r['new_options']!r}")
    sent = Counter(m.group(0).strip() for r in mt for m in quality.HS_META_RE.finditer(r["hs_explanation"] or ""))
    print(f"[b] hs-meta online hits: {len(mt)}  by module: {dict(Counter(r['module'] for r in mt))}")
    print("    sample ids:", [r["id"] for r in mt[:SAMPLE_N]])
    for s, n in sent.most_common(5):
        print(f"    x{n}: {s!r}")
    for r in mt[:2]:
        hs = r["hs_explanation"] or ""
        m = quality.HS_META_RE.search(hs)
        print(f"    #{r['id']} before: {hs[max(0, m.start() - 30):m.end() + 30]!r}")
        print(f"    #{r['id']} after : {(r['new_hs'] or '')[max(0, m.start() - 30):m.start() + 30]!r}")
    print(f"to rewrite: question/options {len(sp)}, hs {len(mt)}, distinct questions {len({r['id'] for r in sp + mt})}")


def apply(conn, res: dict):
    now = time.time()
    touched = set()
    for r in res["spaces"]:
        sets, vals = [], []
        if r["new_question"] is not None:
            sets.append("question=?")
            vals.append(r["new_question"])
        if r["new_options"] is not None:
            sets.append("options=?")
            vals.append(r["new_options"])
        conn.execute(f"UPDATE questions SET {', '.join(sets)}, updated_at=? WHERE id=?", (*vals, now, r["id"]))
        touched.add(r["id"])
    for r in res["meta"]:
        if r["new_hs"] is None:  # 含自检失败词，留给 r348 规则处理，不在此改写
            continue
        conn.execute(
            "UPDATE questions SET hs_explanation=?, updated_at=? WHERE id=?",
            (r["new_hs"], now, r["id"]),
        )
        touched.add(r["id"])
    for qid in touched:
        db.rescore_question(conn, qid)
    conn.commit()
    return len(touched)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="写库（默认 dry-run）")
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--dump", help="把命中 id 台账写成 JSON")
    args = ap.parse_args()

    if args.apply:
        conn = sqlite3.connect(args.db, timeout=30)
    else:
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True, timeout=30)
    conn.row_factory = sqlite3.Row
    res = scan(conn)
    report(res)
    if args.dump:
        with open(args.dump, "w", encoding="utf-8") as f:
            json.dump({k: [r["id"] for r in res[k]] for k in ("spaces", "meta")}, f, ensure_ascii=False)
        print("dumped ids ->", args.dump)
    if not args.apply:
        print("dry-run only; pass --apply to write")
        conn.close()
        return
    bak = args.db + ".bak-w2"
    if os.path.exists(bak):
        print("backup exists, keep:", bak)
    else:
        with sqlite3.connect(bak) as dst:  # 在线一致快照（含 WAL 未 checkpoint 页），等价 cp
            conn.backup(dst)
        print("backup ->", bak)
    n = apply(conn, res)
    print("rewritten + rescored questions:", n)
    remain = scan(conn)
    print("re-scan after apply:", {k: len(remain[k]) for k in ("spaces", "meta")})
    conn.close()


if __name__ == "__main__":
    main()
