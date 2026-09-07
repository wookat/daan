#!/usr/bin/env python3
"""W3 内容清洗：在线题 explanation 抓取源统计前缀/「解析」标签 + 广告句剥离 + 汉字间空格归一。

规则（口径与 backend/app/quality.py 共用同一常量/正则，整体经 quality.sanitize_explanation）：
  a. 开头「正确答案：B，全站正确率：24%，易错项：C。 解析 」统计前缀及只剩「解析 」标签的开头
     （quality.EXP_SRC_PREFIX_RE）→ 删除
  b. 句间广告「,一个上岸考生分享经验和答疑的平台。」（quality.EXP_AD_TAIL_RE）→ 删除
  c. 「汉字/中文标点 之间」的半角/全角空格（quality.normalize_cjk_spaces：数字、字母两侧空格保留）→ 删除；
     含空格分隔词表（quality.has_cjk_word_list：「郭斌 且 吴芳」「石油 汽油 煤油」公式缺失等）的整条不去空格，
     台账记 space_kept 交人工（W2 选项分词空格被误删事故后的 fail-closed 闸）
  d. 空白归一（行尾空格、连续空格、3+ 空行）；改动题 db.rescore_question

不下线任何题、不改 question/options/hs_explanation、不触发 LLM。
默认 dry-run 只打印计数与样例；`--apply` 才写库（写前备份到 <db>.bak-w3，已存在则不覆盖）。
`_render_question` 为 lru_cache，生产 apply 后需重启容器一次。
本地：DB_PATH=/path/data.db python3 scripts/w3_content_cleanup.py [--apply] [--dump ids.json] [--show 262611,235535]
生产：sudo docker exec -i deploy-kaogong-1 python3 - [--apply] < scripts/w3_content_cleanup.py
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
RULES = ("prefix", "ad", "space", "blank")
KEPT = "space_kept"  # 命中词表闸而保留汉字间空格的题（仍可因 prefix/ad/blank 被改写）


def classify(e: str) -> list[str]:
    rules = []
    if quality.EXP_SRC_PREFIX_RE.match(e):
        rules.append("prefix")
    if quality.EXP_AD_TAIL_RE.search(e):
        rules.append("ad")
    if quality.normalize_cjk_spaces(e) != e:
        rules.append(KEPT if quality.has_cjk_word_list(e) else "space")
    if not rules:
        rules.append("blank")  # 仅空白归一（行尾空格 / 连续空格 / 首尾空白）
    return rules


def scan(conn) -> tuple[list[dict], list[int]]:
    rows = conn.execute(
        f"SELECT id, module, source, explanation FROM questions WHERE {ONLINE} AND explanation IS NOT NULL AND explanation<>''"
    )
    hits, kept = [], []
    for r in rows:
        e = r["explanation"]
        new = quality.sanitize_explanation(e)
        rules = classify(e)
        if KEPT in rules:
            kept.append(r["id"])
        if new == e:
            continue
        hits.append({"id": r["id"], "module": r["module"], "source": r["source"], "old": e, "new": new, "rules": rules})
    return hits, kept


def _diff_snippet(old: str, new: str, width: int = 24) -> tuple[str, str]:
    i = next((k for k, (a, b) in enumerate(zip(old, new)) if a != b), min(len(old), len(new)))
    return old[max(0, i - width):i + width], new[max(0, i - width):i + width]


def report(hits: list[dict], kept: list[int]):
    by_rule = Counter(rule for h in hits for rule in h["rules"])
    print(f"explanation to rewrite: {len(hits)}  by module: {dict(Counter(h['module'] for h in hits))}")
    print(f"[{KEPT}] cjk spaces kept (word-list guard, manual review): {len(kept)}  ids: {kept[:SAMPLE_N]}")
    for rule in RULES:
        sub = [h for h in hits if rule in h["rules"]]
        print(f"[{rule}] hits: {by_rule[rule]}  by module: {dict(Counter(h['module'] for h in sub))}")
        print("    sample ids:", [h["id"] for h in sub[:SAMPLE_N]])
        for h in sub[:2]:
            if rule == "prefix":
                m = quality.EXP_SRC_PREFIX_RE.match(h["old"])
                print(f"    #{h['id']} strip: {m.group(0)!r}" if m else "")
            elif rule == "ad":
                m = quality.EXP_AD_TAIL_RE.search(h["old"])
                print(f"    #{h['id']} before: {h['old'][max(0, m.start() - 20):m.end() + 20]!r}" if m else "")
            else:
                a, b = _diff_snippet(h["old"], h["new"])
                print(f"    #{h['id']} before: {a!r}")
                print(f"    #{h['id']} after : {b!r}")
    prefixes = Counter(m.group(0) for h in hits for m in [quality.EXP_SRC_PREFIX_RE.match(h["old"])] if m)
    print("prefix variants:", [(p, n) for p, n in prefixes.most_common(6)])
    print("empty after clean:", [h["id"] for h in hits if not h["new"]])


def show(hits: list[dict], ids: list[int]):
    by_id = {h["id"]: h for h in hits}
    for qid in ids:
        h = by_id.get(qid)
        if not h:
            print(f"--- #{qid}: no change")
            continue
        print(f"--- #{qid} {h['module']} rules={h['rules']}\nBEFORE: {h['old']!r}\nAFTER : {h['new']!r}")


def apply(conn, hits: list[dict]) -> int:
    """乐观并发：只改写扫描后未被他人改过的行（explanation 仍等于扫描值），被并发改写的行跳过并打印。"""
    now = time.time()
    n, skipped = 0, []
    for h in hits:
        cur = conn.execute(
            "UPDATE questions SET explanation=?, updated_at=? WHERE id=? AND explanation=?",
            (h["new"], now, h["id"], h["old"]),
        )
        if cur.rowcount != 1:
            skipped.append(h["id"])
            continue
        db.rescore_question(conn, h["id"])
        n += 1
    conn.commit()
    if skipped:
        print(f"skipped (changed concurrently since scan): {len(skipped)} ids: {skipped[:SAMPLE_N]}")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="写库（默认 dry-run）")
    ap.add_argument("--db", default=os.environ.get("DB_PATH", "/data/data.db"))
    ap.add_argument("--dump", help="把命中 id 台账写成 JSON（按规则分组）")
    ap.add_argument("--show", help="逗号分隔题 id，打印完整 before/after")
    args = ap.parse_args()

    if args.apply:
        conn = sqlite3.connect(args.db, timeout=30)
    else:
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True, timeout=30)
    conn.row_factory = sqlite3.Row
    hits, kept = scan(conn)
    report(hits, kept)
    if args.show:
        show(hits, [int(x) for x in args.show.split(",") if x.strip()])
    if args.dump:
        with open(args.dump, "w", encoding="utf-8") as f:
            json.dump({**{rule: [h["id"] for h in hits if rule in h["rules"]] for rule in RULES}, KEPT: kept}, f, ensure_ascii=False)
        print("dumped ids ->", args.dump)
    if not args.apply:
        print("dry-run only; pass --apply to write")
        conn.close()
        return
    bak = args.db + ".bak-w3"
    if os.path.exists(bak):
        print("backup exists, keep:", bak)
    else:
        with sqlite3.connect(bak) as dst:  # 在线一致快照（含 WAL 未 checkpoint 页），等价 cp
            conn.backup(dst)
        print("backup ->", bak)
    n = apply(conn, hits)
    print("rewritten + rescored questions:", n)
    print("re-scan after apply:", len(scan(conn)[0]))
    conn.close()


if __name__ == "__main__":
    main()
