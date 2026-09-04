#!/usr/bin/env python3
"""W2 内容清洗：在线题 hs 管线元句剥离。

规则（口径与 backend/app/quality.py 共用同一常量/正则）：
  a. 在线题 hs_explanation 含管线元句「该解法是花生十三体系中此类题型的标准套路，考场可直接套用。」
     及同义变体（quality.HS_META_RE）→ 经 quality.sanitize_hs 剥离并归一空白
  b. 改动题 db.rescore_question

本脚本**不改写 question / options**（`quality.normalize_cjk_spaces` 保留为工具函数，任何调用方须先排除填空题型）：
  - 逻辑填空题的选项以空格分词（「履行 强化 改变」），题干用连续空格/\xa0 表示空位，去空格即毁题；
  - `db._seed_questions` 以题干原文 INSERT OR IGNORE 去重，题干一旦改写，下次重启会把种子题当新题重插一份。
  存量「汉字间空格」问题（约 7700 题）归入重复簇/按题型治理，见 docs/iter/workflow/w2.md §5.1。

不下线任何题、不改 question / options / answer / explanation、不改 hs 正文语义、不触发 LLM。
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
    return {"meta": meta}


def report(res: dict):
    mt = res["meta"]
    sent = Counter(m.group(0).strip() for r in mt for m in quality.HS_META_RE.finditer(r["hs_explanation"] or ""))
    print(f"[a] hs-meta online hits: {len(mt)}  by module: {dict(Counter(r['module'] for r in mt))}")
    print("    sample ids:", [r["id"] for r in mt[:SAMPLE_N]])
    for s, n in sent.most_common(5):
        print(f"    x{n}: {s!r}")
    for r in mt[:2]:
        hs = r["hs_explanation"] or ""
        m = quality.HS_META_RE.search(hs)
        print(f"    #{r['id']} before: {hs[max(0, m.start() - 30):m.end() + 30]!r}")
        print(f"    #{r['id']} after : {(r['new_hs'] or '')[max(0, m.start() - 30):m.start() + 30]!r}")
    print(f"to rewrite: hs {len(mt)}")


def apply(conn, res: dict):
    now = time.time()
    touched = set()
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
            json.dump(
                {"meta": [r["id"] for r in res["meta"]]}, f, ensure_ascii=False,
            )
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
    print("re-scan after apply:", {k: len(v) for k, v in remain.items()})
    conn.close()


if __name__ == "__main__":
    main()
